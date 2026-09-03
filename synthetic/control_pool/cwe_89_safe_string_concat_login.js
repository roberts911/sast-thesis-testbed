// control_pool/cwe_89_safe_string_concat_login.js
// Bezpieczny odpowiednik: cwe_89_string_concat_login.js
// Poprawka: prepared statement (connection.execute z placeholderami ?), hasło
// weryfikowane bcryptem poza SQL-em, a odpowiedź nie różnicuje przyczyny błędu.

const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const express = require('express');

const app = express();
app.use(express.json());

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: 'shop',
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const [rows] = await pool.execute(
      'SELECT id, email, role, password_hash FROM users WHERE email = ? LIMIT 1',
      [String(email || '')],
    );

    const user = rows[0];
    const passwordMatches = user
      ? await bcrypt.compare(String(password || ''), user.password_hash)
      : false;

    if (!passwordMatches) {
      return res.status(401).json({ error: 'invalid credentials' });
    }

    res.json({ user: { id: user.id, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: 'login failed' });
  }
});

module.exports = app;
