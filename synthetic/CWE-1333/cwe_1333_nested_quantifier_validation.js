// cwe_1333_nested_quantifier_validation.js
// Poziom przepływu 1/5: wzorzec z zagnieżdżonym kwantyfikatorem, użyty wprost na wejściu HTTP.
// Scenariusz: walidacja nazwy wyświetlanej przy rejestracji. Wzorzec ma postać (X+\s?)*,
// czyli kwantyfikator wewnątrz kwantyfikatora - dla łańcucha bez dopasowania końcowego
// liczba ścieżek backtrackingu rośnie wykładniczo.

const express = require('express');

const app = express();
app.use(express.json());

// Zagnieżdżony kwantyfikator: (…+\s?)* - klasyczny wzorzec wykładniczy.
const DISPLAY_NAME_PATTERN = /^([a-zA-Z0-9]+\s?)*$/;

app.post('/api/register', (req, res) => {
  const displayName = String(req.body.displayName || ''); // SOURCE

  // SINK: dopasowanie podatnego wzorca do łańcucha o niekontrolowanej długości.
  if (!DISPLAY_NAME_PATTERN.test(displayName)) {
    return res.status(400).json({ error: 'invalid display name' });
  }

  res.status(201).json({ displayName });
});

module.exports = app;
