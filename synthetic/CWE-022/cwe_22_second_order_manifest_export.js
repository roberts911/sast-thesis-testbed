// cwe_22_second_order_manifest_export.js
// Poziom przepływu 5/5: najtrudniejszy - second-order + błędna kolejność walidacji i dekodowania.
// Scenariusz: eksport paczki załączników. Klient wysyła manifest JSON, którego wpisy są
// walidowane (odrzucane, gdy zawierają "..") i zapisywane do bazy. Worker odczytuje je
// później i przed użyciem wykonuje decodeURIComponent - a więc dekoduje PO walidacji.
// Sekwencja "%2e%2e%2f" przechodzi przez filtr jako niewinny string i dopiero w workerze
// staje się "../". Dodatkowo ścieżka przechodzi przez normalizację w osobnym module.
// Test dla skanera: czy wykrywa validate-then-decode i czy traktuje bazę jako źródło.

const fs = require('fs');
const path = require('path');
const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const STORAGE_ROOT = '/srv/app/storage';

function looksSafe(rawPath) {
  // Walidacja na wartości jeszcze zakodowanej procentowo - nie widzi %2e%2e%2f.
  return typeof rawPath === 'string' && !rawPath.includes('..') && rawPath.length < 512;
}

app.post('/api/exports', async (req, res) => {
  const manifest = req.body.entries || []; // SOURCE

  const accepted = manifest.filter((entry) => looksSafe(entry.storagePath));
  await pool.query('INSERT INTO export_jobs(manifest, status) VALUES ($1, $2)', [
    JSON.stringify(accepted),
    'pending',
  ]);

  res.status(202).json({ accepted: accepted.length });
});

function toDiskPath(storagePath) {
  const decoded = decodeURIComponent(storagePath);
  return path.join(STORAGE_ROOT, path.normalize(decoded));
}

async function runExportJob(jobId) {
  const { rows } = await pool.query('SELECT manifest FROM export_jobs WHERE id = $1', [jobId]);
  const entries = JSON.parse(rows[0].manifest);

  return entries.map((entry) => {
    const diskPath = toDiskPath(entry.storagePath);

    // SINK: ścieżka odtworzona z manifestu i zdekodowana już po walidacji.
    return { name: entry.name, content: fs.readFileSync(diskPath) };
  });
}

module.exports = { app, runExportJob, toDiskPath, looksSafe };
