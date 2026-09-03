// cwe_1321_query_parser_filters.js
// Poziom przepływu 2/5: zanieczyszczenie przez parser query stringa.
// Scenariusz: lista zamówień z filtrami w URL. Autor włączył w qs opcję
// allowPrototypes, bo bez niej "gubiły się" niektóre klucze zagnieżdżone.
// Opcja ta wyłącza wbudowaną ochronę biblioteki, a wynik trafia do Object.assign
// na współdzielonym obiekcie konfiguracji zapytania.
// Test dla skanera: czy zna semantykę opcji konkretnej biblioteki.

const qs = require('qs');
const express = require('express');

const app = express();

const baseQueryOptions = { limit: 50, offset: 0, includeArchived: false };

function parseFilters(rawQueryString) {
  // allowPrototypes: true przywraca możliwość ustawienia kluczy prototypu.
  return qs.parse(rawQueryString, { allowPrototypes: true, depth: 10 });
}

function buildQueryOptions(filters) {
  const options = { ...baseQueryOptions };

  for (const key of Object.keys(filters)) {
    // SINK: klucze pochodzące z URL kopiowane bez weryfikacji.
    options[key] = filters[key];
  }
  return options;
}

app.get('/api/orders', (req, res) => {
  const rawQueryString = req.url.split('?')[1] || ''; // SOURCE
  const options = buildQueryOptions(parseFilters(rawQueryString));

  res.json({ options, results: [] });
});

module.exports = { app, parseFilters, buildQueryOptions };
