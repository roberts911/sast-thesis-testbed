// control_pool/cwe_94_safe_new_function_rules_engine.js
// Bezpieczny odpowiednik: cwe_94_new_function_rules_engine.js
// Poprawka: reguły są danymi (JSON), nie kodem. Zamiast new Function() używany jest
// mały interpreter z zamkniętym zbiorem pól i operatorów - brak kompilacji stringów.

const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const FIELDS = {
  'order.total': (order) => order.total,
  'order.itemCount': (order) => order.items.length,
  'customer.tier': (_order, customer) => customer.tier,
  'customer.ordersCount': (_order, customer) => customer.ordersCount,
};

const OPERATORS = {
  eq: (a, b) => a === b,
  gt: (a, b) => a > b,
  gte: (a, b) => a >= b,
  lt: (a, b) => a < b,
  lte: (a, b) => a <= b,
};

function validateRule(rule) {
  if (!rule || typeof rule !== 'object') throw new Error('rule must be an object');
  if (!Object.prototype.hasOwnProperty.call(FIELDS, rule.field)) throw new Error('unknown field');
  if (!Object.prototype.hasOwnProperty.call(OPERATORS, rule.op)) throw new Error('unknown operator');
  if (typeof rule.value !== 'number' && typeof rule.value !== 'string') {
    throw new Error('value must be a scalar');
  }
  return { field: rule.field, op: rule.op, value: rule.value };
}

function evaluateRule(rule, order, customer) {
  return OPERATORS[rule.op](FIELDS[rule.field](order, customer), rule.value);
}

app.post('/admin/rules', async (req, res) => {
  try {
    const rule = validateRule(req.body.rule);
    await pool.query('INSERT INTO discount_rules(name, definition) VALUES ($1, $2)', [
      String(req.body.name || 'unnamed'),
      JSON.stringify(rule),
    ]);
    res.status(201).json({ rule });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

async function applyDiscounts(order, customer) {
  const { rows } = await pool.query('SELECT definition FROM discount_rules');

  let total = order.total;
  for (const row of rows) {
    const rule = validateRule(JSON.parse(row.definition));
    if (evaluateRule(rule, order, customer)) {
      total = total * 0.9;
    }
  }
  return total;
}

module.exports = { app, applyDiscounts, evaluateRule };
