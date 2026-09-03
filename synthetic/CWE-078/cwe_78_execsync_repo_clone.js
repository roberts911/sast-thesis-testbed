// cwe_78_execsync_repo_clone.js
// Poziom przepływu 2/5: interprocedural, template literal, dane przechodzą przez
// budowanie tablicy argumentów i join().
// Scenariusz: serwis CI klonuje repozytorium wskazane przez użytkownika w formularzu.

const { execSync } = require('child_process');
const path = require('path');
const express = require('express');

const app = express();
app.use(express.json());

const WORKSPACE_ROOT = '/var/lib/ci/workspaces';

function buildCloneCommand(repoUrl, branch, targetDir) {
  const parts = ['git', 'clone', '--depth', '1'];

  if (branch) {
    parts.push('--branch', branch);
  }
  parts.push(repoUrl, targetDir);

  return parts.join(' ');
}

function runClone(repoUrl, branch, buildId) {
  const targetDir = path.join(WORKSPACE_ROOT, buildId);
  const command = buildCloneCommand(repoUrl, branch, targetDir);

  // SINK: polecenie zbudowane ze stringów kontrolowanych przez użytkownika.
  return execSync(command, { encoding: 'utf8', cwd: WORKSPACE_ROOT });
}

app.post('/api/builds', (req, res) => {
  const { repoUrl, branch } = req.body; // SOURCE
  const buildId = `build-${Date.now()}`;

  try {
    const output = runClone(repoUrl, branch, buildId);
    res.status(201).json({ buildId, output });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { app, runClone, buildCloneCommand };
