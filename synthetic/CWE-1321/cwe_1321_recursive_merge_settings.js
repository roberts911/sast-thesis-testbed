// cwe_1321_recursive_merge_settings.js
// Poziom przepływu 1/5: klasyczny podatny deep merge.
// Scenariusz: aktualizacja ustawień użytkownika. Funkcja scalająca rekurencyjnie
// kopiuje wszystkie klucze obiektu wejściowego, nie sprawdzając, czy klucz nie
// odwołuje się do prototypu ("__proto__", "constructor", "prototype").

const express = require('express');

const app = express();
app.use(express.json());

const defaultSettings = {
  theme: 'light',
  notifications: { email: true, push: false },
  locale: 'pl-PL',
};

function deepMerge(target, source) {
  for (const key in source) {
    if (typeof source[key] === 'object' && source[key] !== null) {
      if (typeof target[key] !== 'object' || target[key] === null) {
        target[key] = {};
      }
      deepMerge(target[key], source[key]);
    } else {
      // SINK: przypisanie pod klucz kontrolowany przez użytkownika, bez filtrowania.
      target[key] = source[key];
    }
  }
  return target;
}

app.post('/api/settings', (req, res) => {
  const incoming = req.body; // SOURCE
  const settings = deepMerge({ ...defaultSettings }, incoming);

  res.json({ settings });
});

module.exports = { app, deepMerge };
