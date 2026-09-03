// control_pool/cwe_22_safe_zip_slip_theme_import.js
// Bezpieczny odpowiednik: cwe_22_zip_slip_theme_import.js
// Poprawka: każdy wpis archiwum jest rozwiązywany względem katalogu docelowego
// i sprawdzany pod kątem zawierania się w nim. Odrzucane są wpisy o ścieżkach
// bezwzględnych, identyfikator motywu przechodzi walidację, a katalog docelowy
// jest tworzony dopiero po zaakceptowaniu ścieżki.

const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const express = require('express');
const multer = require('multer');

const app = express();
const upload = multer({ dest: '/tmp/uploads' });

const THEMES_DIR = path.resolve('/srv/app/themes');
const THEME_ID_PATTERN = /^[a-z0-9-]{1,40}$/;

function resolveEntryPath(targetDir, entryName) {
  if (path.isAbsolute(entryName) || entryName.includes('\0')) {
    throw new Error('rejected entry name');
  }

  const destination = path.resolve(targetDir, entryName);
  if (!destination.startsWith(targetDir + path.sep)) {
    throw new Error('entry escapes target directory');
  }
  return destination;
}

function extractTheme(archivePath, themeId) {
  if (!THEME_ID_PATTERN.test(String(themeId))) {
    throw new Error('invalid theme id');
  }

  const targetDir = path.resolve(THEMES_DIR, themeId);
  const zip = new AdmZip(archivePath);

  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;

    const destination = resolveEntryPath(targetDir, entry.entryName);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, entry.getData());
  }

  return targetDir;
}

app.post('/themes/import', upload.single('archive'), (req, res) => {
  try {
    const dir = extractTheme(req.file.path, req.body.themeId);
    res.status(201).json({ installedAt: dir });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = { app, extractTheme, resolveEntryPath };
