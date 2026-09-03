// cwe_22_readfile_concat_docs.js
// Poziom przepływu 1/5: bezpośrednia konkatenacja ścieżki.
// Scenariusz: serwowanie plików dokumentacji z katalogu na dysku. Nazwa pliku
// pochodzi wprost z parametru query i jest doklejana do katalogu bazowego.

const fs = require('fs');
const express = require('express');

const app = express();

const DOCS_DIR = '/srv/app/docs';

app.get('/docs', (req, res) => {
  const file = req.query.file; // SOURCE
  const fullPath = DOCS_DIR + '/' + file;

  // SINK: ścieżka zawiera niezweryfikowany segment od użytkownika.
  fs.readFile(fullPath, 'utf8', (err, content) => {
    if (err) return res.status(404).json({ error: 'not found' });
    res.type('text/plain').send(content);
  });
});

module.exports = app;
