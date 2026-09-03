// control_pool/cwe_1333_safe_hidden_match_forwarded_host.js
// Bezpieczny odpowiednik: cwe_1333_hidden_match_forwarded_host.js
// Poprawka: rezygnacja z wzorca (\w+\.)+ na rzecz podziału na etykiety i sprawdzenia
// każdej z nich osobno prostym wzorcem bez zagnieżdżeń. Dodatkowo limity długości
// nagłówka, liczby kandydatów i długości etykiety zgodnie z RFC 1123.

const express = require('express');

const app = express();

const MAX_HEADER_LENGTH = 256;
const MAX_CANDIDATES = 8;
const LABEL_PATTERN = /^[a-zA-Z0-9-]{1,63}$/;

function isValidHostname(candidate) {
  if (candidate.length === 0 || candidate.length > 253) return false;

  const labels = candidate.split('.');
  return labels.length >= 2 && labels.every((label) => LABEL_PATTERN.test(label));
}

function pickFirstValidHost(headerValue) {
  return (
    headerValue
      .split(',')
      .slice(0, MAX_CANDIDATES)
      .map((candidate) => candidate.trim())
      .find(isValidHostname) || null
  );
}

app.use((req, res, next) => {
  const forwarded = String(req.header('x-forwarded-host') || '').slice(0, MAX_HEADER_LENGTH);
  req.clientHost = forwarded ? pickFirstValidHost(forwarded) : req.hostname;
  next();
});

app.get('/api/whoami', (req, res) => {
  res.json({ host: req.clientHost });
});

module.exports = { app, pickFirstValidHost, isValidHostname };
