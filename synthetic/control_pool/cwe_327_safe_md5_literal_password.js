// control_pool/cwe_327_safe_md5_literal_password.js
// Bezpieczny odpowiednik: cwe_327_md5_literal_password.js
// Poprawka: hasło nie jest haszowane funkcją skrótu ogólnego przeznaczenia, lecz
// funkcją KDF (scrypt) z losową solą i parametrami kosztu. Ten sam stopień
// pośredniości - wywołanie wprost w handlerze.

const crypto = require('crypto');
const { promisify } = require('util');
const express = require('express');
const { Pool } = require('pg');

const scrypt = promisify(crypto.scrypt);

const app = express();
app.use(express.json());

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };
const KEY_LENGTH = 64;

app.post('/api/users', async (req, res) => {
  const { email, password } = req.body;

  const salt = crypto.randomBytes(16);
  const derivedKey = await scrypt(String(password), salt, KEY_LENGTH, SCRYPT_PARAMS);

  await pool.query('INSERT INTO users(email, password_digest, salt) VALUES ($1, $2, $3)', [
    email,
    derivedKey.toString('hex'),
    salt.toString('hex'),
  ]);

  res.status(201).json({ email });
});

module.exports = app;
