// cwe_89_partial_parameterization_search.js
// Poziom przepływu 2/5: częściowa parametryzacja - najczęstszy realny błąd.
// Scenariusz: wyszukiwarka produktów. Deweloper poprawnie sparametryzował wartości
// w WHERE ($1, $2), ale nazwa kolumny sortowania, kierunek i LIMIT są wklejane
// stringiem, bo placeholdery nie działają dla identyfikatorów.
// Test dla skanera: czy wykrywa injection mimo obecności parametrów w tym samym zapytaniu.

const { Pool } = require('pg');
const express = require('express');

const app = express();
app.use(express.json());

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function buildOrderClause(sortBy, direction) {
  if (!sortBy) return 'ORDER BY created_at DESC';
  return `ORDER BY ${sortBy} ${direction || 'ASC'}`;
}

async function searchProducts(term, category, sortBy, direction, limit) {
  const sql = `
    SELECT id, name, price, category
    FROM products
    WHERE name ILIKE $1 AND category = $2
    ${buildOrderClause(sortBy, direction)}
    LIMIT ${limit || 50}
  `;

  // SINK: fragmenty ORDER BY i LIMIT pochodzą z parametrów żądania.
  const { rows } = await pool.query(sql, [`%${term}%`, category]);
  return rows;
}

app.get('/api/products/search', async (req, res) => {
  const { term, category, sortBy, direction, limit } = req.query; // SOURCE

  try {
    res.json(await searchProducts(term, category, sortBy, direction, limit));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { app, searchProducts, buildOrderClause };
