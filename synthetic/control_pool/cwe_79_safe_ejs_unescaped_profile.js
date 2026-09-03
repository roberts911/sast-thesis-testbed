// control_pool/cwe_79_safe_ejs_unescaped_profile.js
// Bezpieczny odpowiednik: cwe_79_ejs_unescaped_profile.js
// Poprawka: wszystkie wartości renderowane przez <%= %> (autoescaping EJS), a adres
// strony domowej walidowany schematem przed trafieniem do atrybutu href - samo
// enkodowanie HTML nie chroni przed javascript: w kontekście URL.

const ejs = require('ejs');
const express = require('express');

const app = express();
app.use(express.json());

const PROFILE_TEMPLATE = `
  <section class="profile">
    <h2><%= user.displayName %></h2>
    <a href="<%= user.website %>" rel="noopener noreferrer nofollow">Strona domowa</a>
    <div class="bio"><%= user.bio %></div>
  </section>
`;

function safeWebsiteUrl(rawUrl) {
  try {
    const url = new URL(String(rawUrl));
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : '#';
  } catch {
    return '#';
  }
}

function renderProfile(user) {
  return ejs.render(PROFILE_TEMPLATE, {
    user: {
      displayName: String(user.displayName || ''),
      website: safeWebsiteUrl(user.website),
      bio: String(user.bio || ''),
    },
  });
}

app.post('/profile/preview', (req, res) => {
  res.type('text/html; charset=utf-8').send(renderProfile(req.body));
});

module.exports = { app, renderProfile, safeWebsiteUrl };
