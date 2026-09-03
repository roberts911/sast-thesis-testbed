// cwe_78_second_order_backup_worker.js
// Poziom przepływu 4/5: second-order - source (HTTP) i sink (worker cron)
// rozdzielone przez MongoDB oraz przez granicę modułu i asynchroniczny scheduler.
// Scenariusz: użytkownik konfiguruje politykę backupu, w tym "hook" wykonywany
// po zrzucie bazy. Wartość trafia do dokumentu w bazie, a dopiero nocny worker
// wkleja ją do polecenia powłoki.

const { exec } = require('child_process');
const cron = require('node-cron');
const express = require('express');
const { MongoClient } = require('mongodb');

const app = express();
app.use(express.json());

const client = new MongoClient(process.env.MONGO_URL);
const policies = () => client.db('ops').collection('backup_policies');

app.put('/api/tenants/:tenantId/backup-policy', async (req, res) => {
  const { destination, postDumpHook } = req.body; // SOURCE

  await policies().updateOne(
    { tenantId: req.params.tenantId },
    { $set: { destination, postDumpHook, updatedAt: new Date() } },
    { upsert: true },
  );

  res.json({ ok: true });
});

function renderBackupScript(policy) {
  return [
    `pg_dump ${policy.tenantId} | gzip > /backups/${policy.tenantId}.sql.gz`,
    `aws s3 cp /backups/${policy.tenantId}.sql.gz ${policy.destination}`,
    policy.postDumpHook,
  ]
    .filter(Boolean)
    .join(' && ');
}

async function runNightlyBackups() {
  const all = await policies().find({}).toArray();

  for (const policy of all) {
    const script = renderBackupScript(policy);

    // SINK: fragmenty polecenia pochodzą z dokumentu zapisanego przez użytkownika.
    exec(script, { shell: '/bin/bash' }, (err) => {
      if (err) console.error('backup failed for', policy.tenantId, err.message);
    });
  }
}

cron.schedule('0 2 * * *', runNightlyBackups);

module.exports = { app, runNightlyBackups, renderBackupScript };
