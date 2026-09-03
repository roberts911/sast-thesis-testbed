// control_pool/cwe_78_safe_second_order_backup_worker.js
// Bezpieczny odpowiednik: cwe_78_second_order_backup_worker.js
// Poprawka: dowolny "postDumpHook" zastąpiony wyborem z rejestru predefiniowanych
// akcji, destination walidowane jako URI S3, a każdy krok backupu uruchamiany
// osobno przez execFile z tablicą argumentów (brak powłoki, brak łańcucha &&).

const { execFile } = require('child_process');
const { promisify } = require('util');
const cron = require('node-cron');
const express = require('express');
const { MongoClient } = require('mongodb');

const execFileAsync = promisify(execFile);

const app = express();
app.use(express.json());

const client = new MongoClient(process.env.MONGO_URL);
const policies = () => client.db('ops').collection('backup_policies');

const TENANT_PATTERN = /^[a-z0-9_]{1,32}$/;
const S3_DESTINATION_PATTERN = /^s3:\/\/[a-z0-9.\-]{3,63}\/[A-Za-z0-9._\-/]{0,512}$/;

const POST_DUMP_HOOKS = {
  none: null,
  verifyChecksum: (tenantId) => ['sha256sum', `/backups/${tenantId}.sql.gz`],
  notifyOps: (tenantId) => ['/usr/local/bin/notify-ops', '--tenant', tenantId],
};

app.put('/api/tenants/:tenantId/backup-policy', async (req, res) => {
  const tenantId = req.params.tenantId;
  const destination = String(req.body.destination || '');
  const hookName = String(req.body.postDumpHook || 'none');

  if (!TENANT_PATTERN.test(tenantId)) {
    return res.status(400).json({ error: 'invalid tenant id' });
  }
  if (!S3_DESTINATION_PATTERN.test(destination)) {
    return res.status(400).json({ error: 'invalid destination' });
  }
  if (!Object.prototype.hasOwnProperty.call(POST_DUMP_HOOKS, hookName)) {
    return res.status(400).json({ error: 'unknown hook', allowed: Object.keys(POST_DUMP_HOOKS) });
  }

  await policies().updateOne(
    { tenantId },
    { $set: { destination, postDumpHook: hookName, updatedAt: new Date() } },
    { upsert: true },
  );

  res.json({ ok: true });
});

async function runBackupFor(policy) {
  const { tenantId, destination, postDumpHook } = policy;

  if (!TENANT_PATTERN.test(tenantId) || !S3_DESTINATION_PATTERN.test(destination)) {
    throw new Error('policy failed revalidation');
  }

  const archive = `/backups/${tenantId}.sql.gz`;
  await execFileAsync('/usr/local/bin/pg-dump-gz', ['--database', tenantId, '--output', archive]);
  await execFileAsync('aws', ['s3', 'cp', archive, destination]);

  const hook = POST_DUMP_HOOKS[postDumpHook];
  if (hook) {
    const [command, ...args] = hook(tenantId);
    await execFileAsync(command, args);
  }
}

async function runNightlyBackups() {
  for (const policy of await policies().find({}).toArray()) {
    try {
      await runBackupFor(policy);
    } catch (err) {
      console.error('backup failed for', policy.tenantId, err.message);
    }
  }
}

cron.schedule('0 2 * * *', runNightlyBackups);

module.exports = { app, runNightlyBackups, runBackupFor };
