// control_pool/cwe_798_safe_module_constant_github_token.js
// Bezpieczny odpowiednik: cwe_798_module_constant_github_token.js
// Poprawka: stała modułowa przechowuje wyłącznie nazwę zmiennej środowiskowej,
// a sama wartość jest pobierana dopiero przy wywołaniu. Struktura pliku pozostaje
// taka sama: deklaracja na górze, użycie w innej funkcji.

const axios = require('axios');
const express = require('express');

const app = express();

const TOKEN_ENV_VAR = 'GITHUB_API_TOKEN';
const API_BASE_URL = 'https://api.github.com';

function readToken() {
  const token = process.env[TOKEN_ENV_VAR];

  if (!token) {
    throw new Error(`missing required environment variable: ${TOKEN_ENV_VAR}`);
  }
  return token;
}

async function fetchRepositoryIssues(owner, repo) {
  const response = await axios.get(`${API_BASE_URL}/repos/${owner}/${repo}/issues`, {
    headers: {
      Authorization: `token ${readToken()}`,
      Accept: 'application/vnd.github+json',
    },
  });

  return response.data.map((issue) => ({ number: issue.number, title: issue.title }));
}

app.get('/api/integrations/issues/:owner/:repo', async (req, res) => {
  try {
    res.json(await fetchRepositoryIssues(req.params.owner, req.params.repo));
  } catch (err) {
    res.status(502).json({ error: 'upstream unavailable' });
  }
});

module.exports = { app, fetchRepositoryIssues, readToken };
