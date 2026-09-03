// cwe_78_exec_ping_diagnostics.js
// Poziom przepływu 1/5: bezpośredni, jednoetapowy.
// Scenariusz: panel diagnostyczny pozwala adminowi sprawdzić dostępność hosta.
// Deweloper skleja polecenie stringiem, bo "to tylko wewnętrzne narzędzie".

const { exec } = require('child_process');
const express = require('express');

const app = express();
app.use(express.json());

app.get('/api/diagnostics/ping', (req, res) => {
  const host = req.query.host; // SOURCE

  // SINK: konkatenacja do polecenia uruchamianego przez /bin/sh.
  exec('ping -c 4 ' + host, (err, stdout, stderr) => {
    if (err) {
      return res.status(500).json({ error: stderr || err.message });
    }
    res.type('text').send(stdout);
  });
});

module.exports = app;
