// cwe_89_string_concat_login.js
// Poziom przepływu 1/5: bezpośredni, jednoetapowy.
// Scenariusz: klasyczny endpoint logowania. Dane z formularza sklejane są w zapytanie
// stringiem, bo "tak było w starym kodzie". Podatność w klauzuli WHERE, kontekst tekstowy.

const mysql = require('mysql2');
const express = require('express');

const app = express();
app.use(express.json());

const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: 'shop',
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body; // SOURCE

  const sql =
    "SELECT id, email, role FROM users WHERE email = '" +
    email +
    "' AND password_hash = SHA2('" +
    password +
    "', 256)";

  // SINK: zapytanie zawiera niezacytowane dane użytkownika.
  connection.query(sql, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!rows.length) return res.status(401).json({ error: 'invalid credentials' });
    res.json({ user: rows[0] });
  });
});

module.exports = app;
