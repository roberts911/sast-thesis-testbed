// control_pool/cwe_89_safe_second_order_saved_filters.js
// Bezpieczny odpowiednik: cwe_89_second_order_saved_filters.js
// Poprawka: zapisywany jest strukturalny filtr (JSON), nie fragment SQL. Przy eksporcie
// filtr jest ponownie walidowany i tłumaczony na warunki z placeholderami - dane
// odczytane z bazy traktowane są jako niezaufane.

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

const FILTERABLE_COLUMNS = {
  total: 'total',
  status: 'status',
  customerEmail: 'customer_email',
  createdAt: 'created_at',
};

const COMPARATORS = { eq: '=', gt: '>', gte: '>=', lt: '<', lte: '<=' };

function validateFilter(filter) {
  if (!filter || typeof filter !== 'object') throw new Error('filter must be an object');
  if (!Object.prototype.hasOwnProperty.call(FILTERABLE_COLUMNS, filter.field)) {
    throw new Error('field not filterable');
  }
  if (!Object.prototype.hasOwnProperty.call(COMPARATORS, filter.op)) {
    throw new Error('unsupported operator');
  }
  if (typeof filter.value !== 'string' && typeof filter.value !== 'number') {
    throw new Error('value must be a scalar');
  }
  return { field: filter.field, op: filter.op, value: filter.value };
}

function toWhereClause(filters) {
  const conditions = [];
  const params = [];

  filters.forEach((filter, index) => {
    conditions.push(`${FILTERABLE_COLUMNS[filter.field]} ${COMPARATORS[filter.op]} $${index + 1}`);
    params.push(filter.value);
  });

  return { clause: conditions.length ? conditions.join(' AND ') : 'TRUE', params };
}

app.post('/api/saved-views', async (req, res) => {
  try {
    const filters = (req.body.filters || []).map(validateFilter);
    await pool.query('INSERT INTO saved_views(owner_id, name, definition) VALUES ($1, $2, $3)', [
      req.user.id,
      String(req.body.name || 'unnamed'),
      JSON.stringify(filters),
    ]);
    res.status(201).json({ name: req.body.name });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

async function exportView(viewId) {
  const { rows } = await pool.query('SELECT definition FROM saved_views WHERE id = $1', [viewId]);
  if (!rows.length) throw new Error('view not found');

  const filters = JSON.parse(rows[0].definition).map(validateFilter);
  const { clause, params } = toWhereClause(filters);

  const result = await pool.query(
    `SELECT id, customer_email, total, created_at FROM orders WHERE ${clause}`,
    params,
  );
  return result.rows;
}

app.get('/api/saved-views/:id/export', async (req, res) => {
  try {
    res.json(await exportView(req.params.id));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = { app, exportView, validateFilter, toWhereClause };
