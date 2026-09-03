// cwe_327_sha1_module_constant.js
// Poziom pośredniości 2/5: nazwa algorytmu w stałej modułowej, użyta w innej funkcji.
// Scenariusz: podpisywanie tokenów dostępu do API webhookiem. HMAC-SHA1 jest nadal
// szeroko spotykany w integracjach, ale SHA-1 jest algorytmem wycofanym.
// Literał 'sha1' nie występuje w miejscu wywołania - trzeba rozwiązać referencję do stałej.

const crypto = require('crypto');
const express = require('express');

const app = express();
app.use(express.json());

const SIGNATURE_ALGORITHM = 'sha1';
const SIGNING_SECRET = process.env.WEBHOOK_SIGNING_SECRET;

function signPayload(payload) {
  // SINK: algorytm pobrany ze stałej modułowej, wycofany SHA-1.
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
