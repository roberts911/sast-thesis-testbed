// control_pool/cwe_1333_safe_nested_quantifier_validation.js
// Bezpieczny odpowiednik: cwe_1333_nested_quantifier_validation.js
// Poprawka: wzorzec przepisany bez zagnieżdżonego kwantyfikatora (klasa znaków
// z jednym kwantyfikatorem), a długość wejścia sprawdzana przed dopasowaniem -
// więc nawet gdyby wzorzec był kosztowny, rozmiar problemu jest ograniczony stałą.

const express = require('express');

const app = express();
app.use(express.json());

const MAX_DISPLAY_NAME_LENGTH = 64;

// Jeden kwantyfikator nad klasą znaków - brak niejednoznaczności, dopasowanie liniowe.
const DISPLAY_NAME_PATTERN = /^[a-zA-Z0-9]+(?: [a-zA-Z0-9]+)*$/;

app.post('/api/register', (req, res) => {
  const displayName = String(req.body.displayName || '');

  if (displayName.length === 0 || displayName.length > MAX_DISPLAY_NAME_LENGTH) {
    return res.status(400).json({ error: 'invalid display name length' });
  }

  if (!DISPLAY_NAME_PATTERN.test(displayName)) {
    return res.status(400).json({ error: 'invalid display name' });
  }

  res.status(201).json({ displayName });
});

module.exports = app;
