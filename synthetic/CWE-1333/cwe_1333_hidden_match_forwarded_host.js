// cwe_1333_hidden_match_forwarded_host.js
// Poziom przepływu 2/5: ReDoS ukryty w String.prototype.match / split.
// Scenariusz: middleware ustalające host klienta na podstawie nagłówka X-Forwarded-Host.
// Sink nie jest wywołaniem RegExp.test - wzorzec przekazany jest do metody String,
// co bywa pomijane przez reguły szukające wyłącznie .test() i .exec().
// Wzorzec ^(\w+\.)+\w+$ zawiera kwantyfikator wewnątrz grupy kwantyfikowanej.

const express = require('express');

const app = express();

const HOSTNAME_PATTERN = /^(\w+\.)+\w+$/;

function pickFirstValidHost(headerValue) {
  const candidates = headerValue.split(/\s*,\s*/);

  for (const candidate of candidates) {
    // SINK: match() z podatnym wzorcem na wartości nagłówka o dowolnej długości.
    if (candidate.match(HOSTNAME_PATTERN)) {
      return candidate;
    }
  }
  return null;
}

app.use((req, res, next) => {
  const forwarded = String(req.header('x-forwarded-host') || ''); // SOURCE
  req.clientHost = forwarded ? pickFirstValidHost(forwarded) : req.hostname;
  next();
});

app.get('/api/whoami', (req, res) => {
  res.json({ host: req.clientHost });
});

module.exports = { app, pickFirstValidHost };
