// cwe_20_nan_pagination_ledger.js
// Poziom przepływu 1/5: brak walidacji typu po konwersji liczbowej.
// Scenariusz: paginowana lista operacji księgowych. parseInt zwraca NaN dla wejścia
// nieliczbowego, a NaN propaguje przez arytmetykę bez rzucenia wyjątku. Wartość trafia
// do zapytania jako LIMIT/OFFSET, a ujemne lub ogromne wartości pozwalają wyciągnąć
// całą tabelę albo wyczerpać pamięć procesu.

const { Pool } = require('pg');
const express = require('express');

const app = express();
app.use(express.json());

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function listEntries(page, pageSize) {
  const offset = (page - 1) * pageSize;

  // SINK: page i pageSize użyte bez sprawdzenia, czy są skończonymi liczbami.
  const { rows } = await pool.query(
    'SELECT id, description, amount FROM ledger_entries ORDER BY id LIMIT $1 OFFSET $2',
    [pageSize, offset],
  );
  return rows;
}

app.get('/api/ledger', async (req, res) => {
  const page = parseInt(req.query.page, 10); // SOURCE
  const pageSize = parseInt(req.query.pageSize, 10);

  try {
    res.json({ page, entries: await listEntries(page, pageSize) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { app, listEntries };
