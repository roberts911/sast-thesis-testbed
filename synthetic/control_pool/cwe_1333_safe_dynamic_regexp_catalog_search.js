// control_pool/cwe_1333_safe_dynamic_regexp_catalog_search.js
// Bezpieczny odpowiednik: cwe_1333_dynamic_regexp_catalog_search.js
// Poprawka: fraza przestaje być strukturą wyrażenia. Dla trybu fuzzy używane jest
// zwykłe porównanie podłańcuchów (bez silnika regex), a tam gdzie wzorzec jest
// potrzebny, metaznaki są escapowane i długość frazy ograniczona.

const express = require('express');

const app = express();

const MAX_TERM_LENGTH = 64;

const CATALOG = [
  { sku: 'AB-1001', name: 'Klawiatura mechaniczna' },
  { sku: 'AB-1002', name: 'Monitor 27 cali' },
  { sku: 'CD-2001', name: 'Stacja dokująca USB-C' },
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildSearchPattern(term) {
  return new RegExp(`^${escapeRegExp(term)}$`, 'i');
}

function searchCatalog(rawTerm, mode) {
  const term = String(rawTerm || '').slice(0, MAX_TERM_LENGTH);

  if (mode === 'exact') {
    const pattern = buildSearchPattern(term);
    return CATALOG.filter((item) => pattern.test(item.name) || pattern.test(item.sku));
  }

  const needle = term.toLowerCase();
  return CATALOG.filter(
    (item) =>
      item.name.toLowerCase().includes(needle) || item.sku.toLowerCase().includes(needle),
  );
}

app.get('/api/catalog/search', (req, res) => {
  res.json({ results: searchCatalog(req.query.term, String(req.query.mode || 'fuzzy')) });
});

module.exports = { app, searchCatalog, escapeRegExp };
