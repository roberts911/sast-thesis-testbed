// control_pool/cwe_1321_safe_query_parser_filters.js
// Bezpieczny odpowiednik: cwe_1321_query_parser_filters.js
// Poprawka: allowPrototypes pozostaje wyłączone (domyślna ochrona qs), głębokość
// zagnieżdżenia ograniczona, a kopiowane są wyłącznie klucze z allowlisty opcji -
// więc nawet klucz prototypowy nie ma dokąd trafić.

const qs = require('qs');
const express = require('express');

const app = express();

const baseQueryOptions = { limit: 50, offset: 0, includeArchived: false };
const ALLOWED_FILTER_KEYS = new Set(['limit', 'offset', 'includeArchived', 'status', 'customerId']);

function parseFilters(rawQueryString) {
  return qs.parse(rawQueryString, { allowPrototypes: false, depth: 3, plainObjects: true });
}

function buildQueryOptions(filters) {
  const options = { ...baseQueryOptions };

  for (const key of Object.keys(filters)) {
    if (!ALLOWED_FILTER_KEYS.has(key)) continue;
    options[key] = filters[key];
  }
  return options;
}

app.get('/api/orders', (req, res) => {
  const rawQueryString = req.url.split('?')[1] || '';
  const options = buildQueryOptions(parseFilters(rawQueryString));

  res.json({ options, results: [] });
});

module.exports = { app, parseFilters, buildQueryOptions };
