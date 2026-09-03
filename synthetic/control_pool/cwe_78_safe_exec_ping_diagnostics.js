// control_pool/cwe_78_safe_exec_ping_diagnostics.js
// Bezpieczny odpowiednik: cwe_78_exec_ping_diagnostics.js
// Poprawka: execFile zamiast exec (brak powłoki), argumenty jako tablica,
// dodatkowo walidacja hosta allowlistą znaków (RFC 1123) przed uruchomieniem.

const { execFile } = require('child_process');
const express = require('express');

const app = express();
app.use(express.json());

const HOSTNAME_PATTERN = /^(?=.{1,253}$)[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

app.get('/api/diagnostics/ping', (req, res) => {
  const host = String(req.query.host || '');

  if (!HOSTNAME_PATTERN.test(host)) {
    return res.status(400).json({ error: 'invalid hostname' });
  }

  execFile('ping', ['-c', '4', '--', host], { timeout: 10000 }, (err, stdout, stderr) => {
    if (err) {
      return res.status(500).json({ error: stderr || err.message });
    }
    res.type('text').send(stdout);
  });
});

module.exports = app;
