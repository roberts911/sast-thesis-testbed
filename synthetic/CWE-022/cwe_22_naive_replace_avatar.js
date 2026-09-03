// cwe_22_naive_replace_avatar.js
// Poziom przepływu 2/5: naiwna sanityzacja pojedynczym replace().
// Scenariusz: serwowanie awatarów użytkowników. Autor usuwa sekwencję "../" jednym
// przebiegiem replace(), co jest omijalne przez zagnieżdżenie ("....//" po usunięciu
// wewnętrznego "../" daje z powrotem "../") oraz przez separatory Windows i %2e%2e.
// Test dla skanera: czy rozpoznaje sanitizer nieidempotentny jako niewystarczający.

const path = require('path');
const express = require('express');

const app = express();

const AVATAR_DIR = path.join(__dirname, 'storage', 'avatars');

function sanitizeFilename(value) {
  // Jednokrotne usunięcie "../" - sekwencje zagnieżdżone przetrwają filtr.
  return String(value).replace(/\.\.\//g, '');
}

app.get('/avatars/:filename', (req, res) => {
  const filename = sanitizeFilename(req.params.filename); // SOURCE
  const fullPath = path.join(AVATAR_DIR, filename);

  // SINK: przefiltrowana wartość nadal może zawierać sekwencje wyjścia z katalogu.
  res.sendFile(fullPath, (err) => {
    if (err) res.status(404).json({ error: 'avatar not found' });
  });
});

module.exports = { app, sanitizeFilename };
