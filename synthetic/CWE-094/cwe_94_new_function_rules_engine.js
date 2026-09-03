// cwe_94_new_function_rules_engine.js
// Scenariusz: silnik reguł biznesowych. Administrator zapisuje regułę do bazy,
// a worker kompiluje ją później przez new Function().
// Wariant: second-order / stored code injection - source (HTTP) i sink (worker)
// są rozdzielone warstwą persystencji, co wymaga od skanera cross-function taint tracking.

const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.post('/admin/rules', async (req, res) => {
  const { name, expression } = req.body; // SOURCE
  await pool.query('INSERT INTO discount_rules(name, expression) VALUES ($1, $2)', [
    name,
    expression,
  ]);
  res.status(201).json({ name });
});

function compileRule(expression) {
  // SINK: ciało funkcji budowane z danych pochodzących z zewnątrz.
  return new Function('order', 'customer', `return (${expression});`);
}

async function applyDiscounts(order, customer) {
  const { rows } = await pool.query('SELECT name, expression FROM discount_rules');

  let total = order.total;
  for (const row of rows) {
    const rule = compileRule(row.expression);
    if (rule(order, customer)) {
      total = total * 0.9;
    }
  }
  return total;
}

module.exports = { app, applyDiscounts, compileRule };
