// control_pool/cwe_327_safe_config_object_cipher.js
// Bezpieczny odpowiednik: cwe_327_config_object_cipher.js
// Poprawka: konfiguracja wskazuje AES-256-GCM - szyfr uwierzytelniony, z 256-bitowym
// kluczem i 96-bitowym nonce. Zwracany jest również tag uwierzytelniający, bez którego
// tryb GCM nie daje gwarancji integralności. Pośredniość bez zmian: wartość nadal
// pochodzi z pola obiektu konfiguracyjnego.

const crypto = require('crypto');
const express = require('express');

const app = express();
app.use(express.json());

const cryptoConfig = {
  cipher: 'aes-256-gcm',
  keyBytes: 32,
  ivBytes: 12,
  encoding: 'base64',
};

function encryptAccountNumber(accountNumber, key) {
  const iv = crypto.randomBytes(cryptoConfig.ivBytes);

  const cipher = crypto.createCipheriv(cryptoConfig.cipher, key, iv);
  const encrypted = Buffer.concat([cipher.update(accountNumber, 'utf8'), cipher.final()]);

  return {
    iv: iv.toString(cryptoConfig.encoding),
    payload: encrypted.toString(cryptoConfig.encoding),
    authTag: cipher.getAuthTag().toString(cryptoConfig.encoding),
  };
}

app.post('/api/payments/accounts', (req, res) => {
  const key = Buffer.from(process.env.PAYMENTS_KEY, 'hex').subarray(0, cryptoConfig.keyBytes);
  res.status(201).json(encryptAccountNumber(String(req.body.accountNumber), key));
});

module.exports = { app, encryptAccountNumber, cryptoConfig };
