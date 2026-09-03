// control_pool/cwe_20_safe_mass_assignment_profile.js
// Bezpieczny odpowiednik: cwe_20_mass_assignment_profile.js
// Poprawka: zamiast kopiowania całego ciała żądania, z patcha wybierane są jawnie
// wskazane pola edytowalne, a każde z nich przechodzi normalizację typu. Pola
// wrażliwe (role, email_verified, credit_balance) nie są w ogóle brane pod uwagę,
// a zapytanie UPDATE dotyczy wyłącznie kolumny edytowalnej.

const { Pool } = require('pg');
const express = require('express');

const app = express();
app.use(express.json());

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const MAX_DISPLAY_NAME_LENGTH = 80;

function pickEditableFields(patch) {
  const editable = {};

  if (typeof patch.display_name === 'string') {
    editable.display_name = patch.display_name.trim().slice(0, MAX_DISPLAY_NAME_LENGTH);
  }
  return editable;
}

async function updateProfile(userId, patch) {
  const editable = pickEditableFields(patch);

  if (Object.keys(editable).length === 0) {
    throw new Error('no editable fields provided');
  }

  const { rows } = await pool.query(
    'UPDATE users SET display_name = $1 WHERE id = $2 RETURNING id, email, display_name, role',
    [editable.display_name, userId],
  );
  return rows[0];
}

app.patch('/api/profile', async (req, res) => {
  try {
    res.json(await updateProfile(req.header('x-user-id'), req.body));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = { app, updateProfile, pickEditableFields };
