// cwe_327_config_object_cipher.js
// Poziom pośredniości 3/5: algorytm odczytywany z obiektu konfiguracyjnego.
// Scenariusz: szyfrowanie numerów kont w module płatności. Parametry kryptografii
// zebrano w jednym obiekcie konfiguracyjnym, a wywołanie createCipheriv odwołuje się
// wyłącznie do jego pól. Konfiguracja wskazuje 3DES (des-ede3-cbc) - algorytm
// wycofany przez NIST, z blokiem 64-bitowym.
// Test dla skanera: czy śledzi wartość właściwości obiektu do miejsca użycia.

const crypto = require('crypto');
const express = require('express');

const app = express();
app.use(express.json());

const cryptoConfig = {
  cipher: 'des-ede3-cbc',
  keyBytes: 24,
  ivBytes: 8,
  encoding: 'base64',
};

function encryptAccountNumber(accountNumber, key) {
  const iv = crypto.randomBytes(cryptoConfig.ivBytes);

  // SINK: nazwa szyfru pochodzi z pola obiektu konfiguracyjnego.
  const cipher = crypto.createCipheriv(cryptoConfig.cipher, key, iv);
  const encrypted = Buffer.concat([cipher.update(accountNumber, 'utf8'), cipher.final()]);

  return {
    iv: iv.toString(cryptoConfig.encoding),
    payload: encrypted.toString(cryptoConfig.encoding),
  };
}

app.post('/api/payments/accounts', (req, res) => {
  const key = Buffer.from(process.env.PAYMENTS_KEY, 'hex').subarray(0, cryptoConfig.keyBytes);
  res.status(201).json(encryptAccountNumber(String(req.body.accountNumber), key));
});

module.exports = { app, encryptAccountNumber, cryptoConfig };
