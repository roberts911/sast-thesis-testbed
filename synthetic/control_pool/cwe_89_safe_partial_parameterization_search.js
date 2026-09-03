// control_pool/cwe_89_safe_partial_parameterization_search.js
// Bezpieczny odpowiednik: cwe_89_partial_parameterization_search.js
// Poprawka: wartości nadal przez placeholdery, a identyfikatory (kolumna sortowania,
// kierunek) mapowane przez allowlistę - nigdy nie trafiają do SQL bezpośrednio.
// LIMIT przekazany jako parametr i dodatkowo ograniczony numerycznie.

const { Pool } = require('pg');
const express = require('express');

const app = express();
app.use(express.json());

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const SORT_COLUMNS = {
  name: 'name',
  price: 'price',
  newest: 'created_at',
};

const SORT_DIRECTIONS = { asc: 'ASC', desc: 'DESC' };

function buildOrderClause(sortBy, direction) {
  const column = SORT_COLUMNS[String(sortBy)] || SORT_COLUMNS.newest;
  const dir = SORT_DIRECTIONS[String(direction).toLowerCase()] || 'DESC';
  return `ORDER BY ${column} ${dir}`;
}

function normalizeLimit(rawLimit) {
  const parsed = Number.parseInt(rawLimit, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 50;
  return Math.min(parsed, 200);
}

async function searchProducts(term, category, sortBy, direction, limit) {
  const sql = `
    SELECT id, name, price, category
    FROM products
    WHERE name ILIKE $1 AND category = $2
    ${buildOrderClause(sortBy, direction)}
    LIMIT $3
  `;

  const { rows } = await pool.query(sql, [
    `%${String(term || '')}%`,
    String(category || ''),
    normalizeLimit(limit),
  ]);
  return rows;
}

app.get('/api/products/search', async (req, res) => {
  const { term, category, sortBy, direction, limit } = req.query;

  try {
    res.json(await searchProducts(term, category, sortBy, direction, limit));
  } catch (err) {
    res.status(500).json({ error: 'search failed' });
  }
});

module.exports = { app, searchProducts, buildOrderClause, normalizeLimit };
