// control_pool/cwe_94_safe_settimeout_string_scheduler.js
// Bezpieczny odpowiednik: cwe_94_settimeout_string_scheduler.js
// Poprawka: użytkownik wskazuje nazwę zarejestrowanego handlera, a setTimeout
// otrzymuje referencję do funkcji (nigdy stringa). Parametry zadania przekazywane
// są jako dane, nie jako fragment kodu.

const express = require('express');

const app = express();
app.use(express.json());

const jobs = new Map();

const HANDLERS = {
  syncInvoices: (params) => console.log('syncing invoices for tenant', params.tenantId),
  purgeTempFiles: () => console.log('purging temp files'),
  sendDigest: (params) => console.log('sending digest to', params.tenantId),
};

const MAX_DELAY_MS = 24 * 60 * 60 * 1000;

function scheduleJob(jobName, handlerName, params, delayMs) {
  const handler = Object.prototype.hasOwnProperty.call(HANDLERS, handlerName)
    ? HANDLERS[handlerName]
    : null;

  if (!handler) {
    throw new Error('unknown handler');
  }

  const delay = Math.min(Math.max(Number(delayMs) || 5000, 1000), MAX_DELAY_MS);
  const handle = setTimeout(() => {
    try {
      handler(params);
    } catch (e) {
      console.error('job failed', jobName, e);
    }
  }, delay);

  jobs.set(jobName, handle);
  return handle;
}

app.post('/scheduler/jobs', (req, res) => {
  const { name, handler, delay } = req.body;

  try {
    scheduleJob(String(name), String(handler), { tenantId: String(req.body.tenantId || '') }, delay);
    res.status(202).json({ scheduled: name });
  } catch (err) {
    res.status(400).json({ error: err.message, allowed: Object.keys(HANDLERS) });
  }
});

app.delete('/scheduler/jobs/:name', (req, res) => {
  clearTimeout(jobs.get(req.params.name));
  jobs.delete(req.params.name);
  res.status(204).end();
});

module.exports = { app, scheduleJob };
