// cwe_1333_dynamic_regexp_catalog_search.js
// Poziom przepływu 4/5: regex injection prowadzące do ReDoS.
// Scenariusz: wyszukiwarka katalogu produktów buduje wzorzec z frazy użytkownika,
// aby wspierać "częściowe dopasowania". Fraza nie jest escapowana, więc klient
// dostarcza nie tylko dane, ale i samą strukturę wyrażenia - może więc wprowadzić
// dowolny wzorzec wykładniczy, np. (a+)+$.
// Wzorzec jest dodatkowo uruchamiany w pętli po wszystkich rekordach, co mnoży koszt.
// Test dla skanera: czy widzi, że argument new RegExp pochodzi z żądania.

const express = require('express');

const app = express();

const CATALOG = [
  { sku: 'AB-1001', name: 'Klawiatura mechaniczna' },
  { sku: 'AB-1002', name: 'Monitor 27 cali' },
  { sku: 'CD-2001', name: 'Stacja dokująca USB-C' },
];

function buildSearchPattern(term, mode) {
  const flags = mode === 'exact' ? '' : 'i';

  // SINK: wzorzec kompilowany z niezescapowanej frazy użytkownika.
  return new RegExp(term, flags);
}

function searchCatalog(term, mode) {
  const pattern = buildSearchPattern(term, mode);
  return CATALOG.filter((item) => pattern.test(item.name) || pattern.test(item.sku));
}

app.get('/api/catalog/search', (req, res) => {
  const { term, mode } = req.query; // SOURCE

  try {
    res.json({ results: searchCatalog(String(term || ''), String(mode || 'fuzzy')) });
  } catch (err) {
    res.status(400).json({ error: 'invalid search term' });
  }
});

module.exports = { app, searchCatalog, buildSearchPattern };
