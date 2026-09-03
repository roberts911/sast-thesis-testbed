// control_pool/cwe_327_safe_sha1_module_constant.js
// Bezpieczny odpowiednik: cwe_327_sha1_module_constant.js
// Poprawka: stała modułowa wskazuje SHA-256 zamiast wycofanego SHA-1. Struktura
// pośredniości pozostaje identyczna - algorytm nadal jest odczytywany ze stałej
// w innej funkcji niż miejsce jej deklaracji.

const crypto = require('crypto');
const express = require('express');

const app = express();
app.use(express.json());

const SIGNATURE_ALGORITHM = 'sha256';
const SIGNING_SECRET = process.env.WEBHOOK_SIGNING_SECRET;

function signPayload(payload) {
  return crypto
    .createHmac(SIGNATURE_ALGORITHM, SIGNING_SECRET)
    .update(JSON.stringify(payload))
    .digest('hex');
}

app.post('/api/webhooks/dispatch', (req, res) => {
  const signature = signPayload(req.body);
  res.json({ signature, algorithm: SIGNATURE_ALGORITHM });
});

module.exports = { app, signPayload };
