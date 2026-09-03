// control_pool/cwe_20_safe_nosql_type_confusion_login.js
// Bezpieczny odpowiednik: cwe_20_nosql_type_confusion_login.js
// Poprawka: pola poświadczeń są jawnie sprawdzane pod kątem typu i odrzucane, gdy
// klient przysłał obiekt lub tablicę - dzięki temu do filtru trafiają wyłącznie
// łańcuchy, a operatory zapytań MongoDB nie mogą zostać wstrzyknięte.
// Dodatkowo filtr budowany jest z wartości już znormalizowanych, a nie z surowego ciała.

const { MongoClient } = require('mongodb');
const express = require('express');

const app = express();
app.use(express.json());

const client = new MongoClient(process.env.MONGO_URL);
const users = () => client.db('accounts').collection('users');

const MAX_FIELD_LENGTH = 256;

function requireString(value, fieldName) {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_FIELD_LENGTH) {
    throw new Error(`${fieldName} must be a non-empty string`);
  }
  return value;
}

function buildCredentialsFilter(credentials) {
  return {
    email: requireString(credentials.email, 'email'),
    passwordHash: requireString(credentials.passwordHash, 'passwordHash'),
    active: true,
  };
}

async function findByCredentials(credentials) {
  return users().findOne(buildCredentialsFilter(credentials));
}

app.post('/api/session', async (req, res) => {
  try {
    const user = await findByCredentials({
      email: req.body.email,
      passwordHash: req.body.passwordHash,
    });

    if (!user) {
      return res.status(401).json({ error: 'invalid credentials' });
    }

    res.json({ userId: user._id, email: user.email, role: user.role });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = { app, findByCredentials, buildCredentialsFilter, requireString };
