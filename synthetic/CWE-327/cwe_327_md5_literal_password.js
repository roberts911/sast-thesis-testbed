// cwe_327_md5_literal_password.js
// Poziom pośredniości 1/5: nazwa algorytmu jako literał wprost w wywołaniu.
// Scenariusz: rejestracja użytkownika w starszym module kont. Hasło jest haszowane
// MD5 - algorytmem szybkim i podatnym na kolizje, nieprzeznaczonym do haseł.

const crypto = require('crypto');
const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.post('/api/users', async (req, res) => {
  const { email, password } = req.body;

  // SINK: MD5 użyty jako funkcja haszująca hasło.
  const passwordDigest = crypto.createHash('md5').update(password).digest('hex');

  await pool.query('INSERT INTO users(email, password_digest) VALUES ($1, $2)', [
    email,
    passwordDigest,
  ]);

  res.status(201).json({ email });
});

module.exports = app;
