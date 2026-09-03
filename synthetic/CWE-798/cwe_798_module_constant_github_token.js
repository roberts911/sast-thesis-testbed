// cwe_798_module_constant_github_token.js
// Poziom pośredniości 2/5: sekret w stałej modułowej, użyty w innej funkcji.
// Scenariusz: integracja z API repozytoriów, pobierająca listę zgłoszeń. Token
// osobisty zadeklarowany na górze pliku, konsumowany kilkadziesiąt linii niżej.
// UWAGA: wszystkie poświadczenia w tym korpusie są syntetyczne i nieaktywne.

const axios = require('axios');
const express = require('express');

const app = express();

// SINK: osobisty token dostępu zapisany na stałe w kodzie.
const GITHUB_TOKEN = 'ghp_9fK2mQxV7LbTn4RsYc1JdWpZ8HgEo3AiUvBr';
const API_BASE_URL = 'https://api.github.com';

async function fetchRepositoryIssues(owner, repo) {
  const response = await axios.get(`${API_BASE_URL}/repos/${owner}/${repo}/issues`, {
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
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

module.exports = { app, fetchRepositoryIssues };
