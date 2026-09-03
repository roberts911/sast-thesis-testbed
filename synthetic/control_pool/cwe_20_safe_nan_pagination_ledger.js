// control_pool/cwe_20_safe_nan_pagination_ledger.js
// Bezpieczny odpowiednik: cwe_20_nan_pagination_ledger.js
// Poprawka: konwersja liczbowa jest weryfikowana (Number.isInteger), a wynik
// ograniczany do dopuszczalnego zakresu przed użyciem w arytmetyce i zapytaniu.
// Wartości spoza zakresu są zastępowane bezpiecznymi domyślnymi, więc NaN ani
// wartość ujemna nigdy nie docierają do warstwy dostępu do danych.

const { Pool } = require('pg');
const express = require('express');

const app = express();
app.use(express.json());

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

function toBoundedInteger(rawValue, fallback, min, max) {
  const parsed = Number.parseInt(rawValue, 10);

  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

async function listEntries(page, pageSize) {
  const offset = (page - 1) * pageSize;

  const { rows } = await pool.query(
    'SELECT id, description, amount FROM ledger_entries ORDER BY id LIMIT $1 OFFSET $2',
    [pageSize, offset],
  );
  return rows;
}

app.get('/api/ledger', async (req, res) => {
  const page = toBoundedInteger(req.query.page, 1, 1, 10000);
  const pageSize = toBoundedInteger(req.query.pageSize, DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);

  try {
    res.json({ page, entries: await listEntries(page, pageSize) });
  } catch (err) {
    res.status(500).json({ error: 'query failed' });
  }
});

module.exports = { app, listEntries, toBoundedInteger };
