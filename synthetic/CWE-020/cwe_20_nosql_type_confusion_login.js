// cwe_20_nosql_type_confusion_login.js
// Poziom przepływu 5/5: najtrudniejszy - pomylenie typów w zapytaniu NoSQL.
// Scenariusz: logowanie oparte o MongoDB. Kod zakłada, że pola z ciała żądania są
// łańcuchami, ale express.json() przekazuje dowolną strukturę JSON. Klient wysyłający
// {"email": {"$gt": ""}, "password": {"$ne": null}} zamienia porównanie na operator
// zapytania i loguje się bez znajomości poświadczeń.
// Wartości przechodzą przez budowniczego filtru i warstwę repozytorium, a sam sink
// nie zawiera żadnej konkatenacji - podatność wynika wyłącznie z typu danych.
// Test dla skanera: czy modeluje typ wartości, a nie tylko jej pochodzenie.

const { MongoClient } = require('mongodb');
const express = require('express');

const app = express();
app.use(express.json());

const client = new MongoClient(process.env.MONGO_URL);
const users = () => client.db('accounts').collection('users');

function buildCredentialsFilter(credentials) {
  return {
    email: credentials.email,
    passwordHash: credentials.passwordHash,
    active: true,
  };
}

async function findByCredentials(credentials) {
  const filter = buildCredentialsFilter(credentials);

  // SINK: wartości filtru mogą być obiektami z operatorami zapytań MongoDB.
  return users().findOne(filter);
}

app.post('/api/session', async (req, res) => {
  const { email, passwordHash } = req.body; // SOURCE

  const user = await findByCredentials({ email, passwordHash });

  if (!user) {
    return res.status(401).json({ error: 'invalid credentials' });
  }

  res.json({ userId: user._id, email: user.email, role: user.role });
});

module.exports = { app, findByCredentials, buildCredentialsFilter };
