// control_pool/cwe_94_safe_eval_express.js
// Bezpieczny odpowiednik: cwe_94_eval_express.js
// Poprawka: zamiast wykonywać wyrażenie użytkownika, endpoint akceptuje wyłącznie
// nazwę metryki z zamkniętej listy (allowlist), a logika obliczeń jest statyczna.

const express = require('express');

const app = express();
app.use(express.json());

const SAMPLES = [
  { host: 'web-01', cpu: 71, mem: 42 },
  { host: 'web-02', cpu: 12, mem: 88 },
  { host: 'db-01', cpu: 95, mem: 61 },
];

const AGGREGATORS = {
  avg_cpu: (rows) => rows.reduce((acc, r) => acc + r.cpu, 0) / rows.length,
  max_cpu: (rows) => Math.max(...rows.map((r) => r.cpu)),
  avg_mem: (rows) => rows.reduce((acc, r) => acc + r.mem, 0) / rows.length,
  host_count: (rows) => rows.length,
};

function aggregate(rows, metricName) {
  const aggregator = Object.prototype.hasOwnProperty.call(AGGREGATORS, metricName)
    ? AGGREGATORS[metricName]
    : null;

  if (!aggregator) {
    throw new Error('unsupported metric');
  }
  return aggregator(rows);
}

app.get('/api/reports/metric', (req, res) => {
  const metricName = String(req.query.metric || '');

  try {
    res.json({ metric: metricName, value: aggregate(SAMPLES, metricName) });
  } catch (err) {
    res.status(400).json({ error: err.message, allowed: Object.keys(AGGREGATORS) });
  }
});

module.exports = app;
