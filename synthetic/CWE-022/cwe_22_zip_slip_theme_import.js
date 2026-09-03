// cwe_22_zip_slip_theme_import.js
// Poziom przepływu 3/5: Zip Slip - ścieżka pochodzi z metadanych archiwum.
// Scenariusz: import paczki z motywem graficznym. Nazwa wpisu w archiwum (entryName)
// jest atrybutem kontrolowanym przez autora pliku ZIP i może zawierać "../".
// Źródłem nie jest tu parametr HTTP, lecz zawartość przesłanego pliku.
// Test dla skanera: czy modeluje wpisy archiwum jako dane niezaufane.

const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const express = require('express');
const multer = require('multer');

const app = express();
const upload = multer({ dest: '/tmp/uploads' });

const THEMES_DIR = '/srv/app/themes';

function extractTheme(archivePath, themeId) {
  const zip = new AdmZip(archivePath);
  const targetDir = path.join(THEMES_DIR, themeId);

  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;

    const destination = path.join(targetDir, entry.entryName); // SOURCE: metadane archiwum
    fs.mkdirSync(path.dirname(destination), { recursive: true });

    // SINK: zapis pod ścieżką zbudowaną z niezweryfikowanej nazwy wpisu.
    fs.writeFileSync(destination, entry.getData());
  }

  return targetDir;
}

app.post('/themes/import', upload.single('archive'), (req, res) => {
  try {
    const dir = extractTheme(req.file.path, String(req.body.themeId || 'default'));
    res.status(201).json({ installedAt: dir });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { app, extractTheme };
