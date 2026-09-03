// control_pool/cwe_22_safe_second_order_manifest_export.js
// Bezpieczny odpowiednik: cwe_22_second_order_manifest_export.js
// Poprawka: dekodowanie wykonywane PRZED walidacją (właściwa kolejność), a właściwą
// kontrolą jest rozwiązanie ścieżki i sprawdzenie prefiksu - nie szukanie "..".
// Wartości odczytane z bazy przechodzą tę samą walidację ponownie, więc rekord
// zapisany wcześniej nie jest traktowany jako zaufany.

const fs = require('fs');
const path = require('path');
const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const STORAGE_ROOT = path.resolve('/srv/app/storage');

function toDiskPath(storagePath) {
  const decoded = decodeURIComponent(String(storagePath || ''));

  if (decoded.includes('\0') || path.isAbsolute(decoded)) {
    throw new Error('rejected storage path');
  }

  const diskPath = path.resolve(STORAGE_ROOT, decoded);
  if (!diskPath.startsWith(STORAGE_ROOT + path.sep)) {
    throw new Error('path outside storage root');
  }
  return diskPath;
}

function isAcceptable(entry) {
  try {
    toDiskPath(entry.storagePath);
    return true;
  } catch {
    return false;
  }
}

app.post('/api/exports', async (req, res) => {
  const accepted = (req.body.entries || []).filter(isAcceptable);

  await pool.query('INSERT INTO export_jobs(manifest, status) VALUES ($1, $2)', [
    JSON.stringify(accepted),
    'pending',
  ]);

  res.status(202).json({ accepted: accepted.length });
});

async function runExportJob(jobId) {
  const { rows } = await pool.query('SELECT manifest FROM export_jobs WHERE id = $1', [jobId]);
  const entries = JSON.parse(rows[0].manifest);

  return entries.map((entry) => ({
    name: String(entry.name || ''),
    content: fs.readFileSync(toDiskPath(entry.storagePath)),
  }));
}

module.exports = { app, runExportJob, toDiskPath };
