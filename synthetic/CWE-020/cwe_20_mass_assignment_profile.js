// cwe_20_mass_assignment_profile.js
// Poziom przepływu 2/5: mass assignment - brak allowlisty pól przy aktualizacji.
// Scenariusz: edycja profilu użytkownika. Handler kopiuje całe ciało żądania do
// rekordu, więc klient może ustawić pola, których formularz nigdy nie wysyła -
// m.in. role, emailVerified czy creditBalance.
// Dane przechodzą przez warstwę serwisu, a zapis jest budowany dynamicznie z kluczy.

const { Pool } = require('pg');
const express = require('express');

const app = express();
app.use(express.json());

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function loadProfile(userId) {
  const { rows } = await pool.query(
    'SELECT id, email, display_name, role, email_verified, credit_balance FROM users WHERE id = $1',
    [userId],
  );
  return rows[0];
}

async function updateProfile(userId, patch) {
  const current = await loadProfile(userId);

  // SINK: wszystkie klucze z żądania nadpisują rekord, bez ograniczenia do pól edytowalnych.
  const updated = Object.assign({}, current, patch);

  await pool.query(
    'UPDATE users SET display_name = $1, role = $2, email_verified = $3, credit_balance = $4 WHERE id = $5',
    [updated.display_name, updated.role, updated.email_verified, updated.credit_balance, userId],
  );

  return updated;
}

app.patch('/api/profile', async (req, res) => {
  const patch = req.body; // SOURCE

  try {
    res.json(await updateProfile(req.header('x-user-id'), patch));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { app, updateProfile };
