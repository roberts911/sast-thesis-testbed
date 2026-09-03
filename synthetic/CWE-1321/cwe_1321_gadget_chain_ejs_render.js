// cwe_1321_gadget_chain_ejs_render.js
// Poziom przepływu 3/5: zanieczyszczenie + gadget prowadzący do wykonania kodu.
// Scenariusz: generator raportów PDF/HTML. Konfiguracja raportu jest scalana z
// szablonem domyślnym, a następnie renderowana przez EJS z pustym obiektem opcji.
// Pusty literał {} dziedziczy z Object.prototype, więc zanieczyszczone właściwości
// (np. outputFunctionName w EJS) stają się opcjami silnika szablonów.
// Podatność jest rozłożona na dwa miejsca: punkt zanieczyszczenia i gadget.
// Test dla skanera: czy łączy zapis do prototypu z późniejszym odczytem w innej funkcji.

const ejs = require('ejs');
const express = require('express');

const app = express();
app.use(express.json());

const REPORT_TEMPLATE = '<h1><%= title %></h1><p>Wierszy: <%= rowCount %></p>';

function applyOverrides(base, overrides) {
  for (const key of Object.keys(overrides)) {
    if (overrides[key] && typeof overrides[key] === 'object') {
      base[key] = applyOverrides(base[key] || {}, overrides[key]);
    } else {
      // SINK: zapis pod dowolny klucz, w tym __proto__ z zagnieżdżonego JSON-a.
      base[key] = overrides[key];
    }
  }
  return base;
}

function renderReport(config, data) {
  // Pusty literał dziedziczy zanieczyszczone właściwości i przekazuje je jako opcje EJS.
  const options = {};
  options.filename = config.name;

  return ejs.render(REPORT_TEMPLATE, data, options);
}

app.post('/api/reports/render', (req, res) => {
  const config = applyOverrides({ name: 'raport' }, req.body.config || {}); // SOURCE

  try {
    res.type('html').send(renderReport(config, { title: config.name, rowCount: 0 }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { app, applyOverrides, renderReport };
