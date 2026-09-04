// cwe_89_second_order_saved_filters.js
// Poziom przepływu 4/5: second-order SQL injection.
// Scenariusz: użytkownik zapisuje "widok" z własnym fragmentem warunku. Zapis do bazy
// jest w pełni sparametryzowany (więc miejsce zapisu wygląda na bezpieczne), ale
// eksporter CSV odczytuje ten fragment i wkleja go do nowego zapytania.
// Test dla skanera: czy traktuje odczyt z bazy jako źródło danych niezaufanych.

const { Pool } = require('pg');
const express = require('express');

const app = express();
app.use(express.json());

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Atrapa uwierzytelniania: stała tożsamość, aby req.user było zdefiniowane
// i aby plik zawierał wyłącznie jedną badaną klasę podatności.
function requireAuth(req, _res, next) {
  req.user = { id: 42, role: 'analyst' };
  next();
}

app.use(requireAuth);

app.post('/api/saved-views', async (req, res) => {
  const { name, whereFragment } = req.body; // SOURCE

  await pool.query(
    'INSERT INTO saved_views(owner_id, name, where_fragment) VALUES ($1, $2, $3)',
    [req.user.id, name, whereFragment],
  );

  res.status(201).json({ name });
});

async function loadView(viewId) {
  const { rows } = await pool.query('SELECT name, where_fragment FROM saved_views WHERE id = $1', [
    viewId,
  ]);
  return rows[0];
}

async function exportView(viewId) {
  const view = await loadView(viewId);
  const sql = `SELECT id, customer_email, total, created_at FROM orders WHERE ${view.where_fragment}`;

  // SINK: warunek odtworzony z rekordu zapisanego wcześniej przez użytkownika.
  const { rows } = await pool.query(sql);
  return rows;
}

app.get('/api/saved-views/:id/export', async (req, res) => {
  try {
    res.json(await exportView(req.params.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { app, exportView, loadView };
