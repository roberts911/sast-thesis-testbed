// control_pool/cwe_78_safe_execsync_repo_clone.js
// Bezpieczny odpowiednik: cwe_78_execsync_repo_clone.js
// Poprawka: execFileSync z tablicą argumentów (bez powłoki), walidacja URL przez
// parser WHATWG z allowlistą hostów i schematów, oraz walidacja nazwy gałęzi.

const { execFileSync } = require('child_process');
const path = require('path');
const express = require('express');

const app = express();
app.use(express.json());

const WORKSPACE_ROOT = '/var/lib/ci/workspaces';
const ALLOWED_HOSTS = new Set(['github.com', 'gitlab.com']);
const BRANCH_PATTERN = /^[\w.\-/]{1,100}$/;

function validateRepoUrl(rawUrl) {
  const url = new URL(String(rawUrl));

  if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname)) {
    throw new Error('repository host not allowed');
  }
  return url.toString();
}

function buildCloneArgs(repoUrl, branch, targetDir) {
  const args = ['clone', '--depth', '1'];

  if (branch) {
    if (!BRANCH_PATTERN.test(branch)) throw new Error('invalid branch name');
    args.push('--branch', branch);
  }
  args.push('--', repoUrl, targetDir);
  return args;
}

function runClone(rawRepoUrl, branch, buildId) {
  const repoUrl = validateRepoUrl(rawRepoUrl);
  const targetDir = path.join(WORKSPACE_ROOT, buildId);

  return execFileSync('git', buildCloneArgs(repoUrl, branch, targetDir), {
    encoding: 'utf8',
    cwd: WORKSPACE_ROOT,
    timeout: 120000,
  });
}

app.post('/api/builds', (req, res) => {
  const buildId = `build-${Date.now()}`;

  try {
    const output = runClone(req.body.repoUrl, req.body.branch, buildId);
    res.status(201).json({ buildId, output });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = { app, runClone, buildCloneArgs, validateRepoUrl };
