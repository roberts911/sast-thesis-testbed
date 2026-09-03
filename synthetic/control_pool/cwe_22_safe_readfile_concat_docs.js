// control_pool/cwe_22_safe_readfile_concat_docs.js
// Bezpieczny odpowiednik: cwe_22_readfile_concat_docs.js
// Poprawka: nazwa pliku sprowadzona do samego basename, rozszerzenie z allowlisty,
// a wynikowa ścieżka bezwzględna zweryfikowana pod kątem zawierania się w katalogu
// bazowym (porównanie z prefiksem zakończonym separatorem).

const fs = require('fs');
const path = require('path');
const express = require('express');

const app = express();

const DOCS_DIR = path.resolve('/srv/app/docs');
const ALLOWED_EXTENSIONS = new Set(['.md', '.txt']);

function resolveDocPath(requestedFile) {
  const filename = path.basename(String(requestedFile || ''));

  if (!ALLOWED_EXTENSIONS.has(path.extname(filename).toLowerCase())) {
    throw new Error('unsupported file type');
  }

  const fullPath = path.resolve(DOCS_DIR, filename);
  if (!fullPath.startsWith(DOCS_DIR + path.sep)) {
    throw new Error('path outside docs directory');
  }
  return fullPath;
}

app.get('/docs', (req, res) => {
  let fullPath;
  try {
    fullPath = resolveDocPath(req.query.file);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  fs.readFile(fullPath, 'utf8', (err, content) => {
    if (err) return res.status(404).json({ error: 'not found' });
    res.type('text/plain').send(content);
  });
});

module.exports = { app, resolveDocPath };
