// control_pool/cwe_1321_safe_gadget_chain_ejs_render.js
// Bezpieczny odpowiednik: cwe_1321_gadget_chain_ejs_render.js
// Poprawka: przerwane oba ogniwa łańcucha. Scalanie kopiuje wyłącznie klucze
// z allowlisty konfiguracji, a obiekt opcji przekazywany do EJS jest tworzony
// bez prototypu, więc nie może odziedziczyć właściwości sterujących silnikiem.

const ejs = require('ejs');
const express = require('express');

const app = express();
app.use(express.json());

const REPORT_TEMPLATE = '<h1><%= title %></h1><p>Wierszy: <%= rowCount %></p>';

const ALLOWED_CONFIG_KEYS = new Set(['name', 'orientation', 'includeSummary']);

function applyOverrides(base, overrides) {
  const result = { ...base };

  for (const key of Object.keys(overrides)) {
    if (!ALLOWED_CONFIG_KEYS.has(key)) continue;
    result[key] = overrides[key];
  }
  return result;
}

function renderReport(config, data) {
  const options = Object.create(null);
  options.filename = String(config.name || 'raport');

  return ejs.render(REPORT_TEMPLATE, data, options);
}

app.post('/api/reports/render', (req, res) => {
  const config = applyOverrides({ name: 'raport' }, req.body.config || {});

  try {
    res.type('html').send(renderReport(config, { title: config.name, rowCount: 0 }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { app, applyOverrides, renderReport };
