// cwe_94_eval_express.js
// Scenariusz: mikroserwis raportowy pozwala klientowi przekazać własne
// "wyrażenie agregujące", aby uniknąć dodawania nowych endpointów dla każdej metryki.
// Wariant: bezpośredni eval() na parametrze query (first-order, jeden hop).

const express = require('express');

const app = express();
app.use(express.json());

const SAMPLES = [
  { host: 'web-01', cpu: 71, mem: 42 },
  { host: 'web-02', cpu: 12, mem: 88 },
  { host: 'db-01', cpu: 95, mem: 61 },
];

function aggregate(rows, expression) {
  const count = rows.length;
  const sumCpu = rows.reduce((acc, r) => acc + r.cpu, 0);
  const sumMem = rows.reduce((acc, r) => acc + r.mem, 0);

  // SINK: wyrażenie kontrolowane przez klienta wykonywane w kontekście procesu Node.
  return eval(expression);
}

app.get('/api/reports/metric', (req, res) => {
  const expression = req.query.expr; // SOURCE

  if (!expression) {
    return res.status(400).json({ error: 'missing expr' });
  }

  try {
    const value = aggregate(SAMPLES, expression);
    res.json({ expr: expression, value });
  } catch (err) {
    res.status(422).json({ error: err.message });
  }
});

module.exports = app;
