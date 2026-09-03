// cwe_79_ejs_unescaped_profile.js
// Poziom przepływu 2/5: błędne użycie silnika szablonów.
// Scenariusz: profil użytkownika w EJS. Autoescaping (<%= %>) jest domyślny i działa,
// ale autor chciał pozwolić na "prosty formatting" w bio i użył <%- %>, czyli
// jawnego wyłączenia enkodowania. Dodatkowo atrybut href pochodzi od użytkownika.
// Test dla skanera: czy odróżnia <%= %> od <%- %> i czy widzi kontekst atrybutu.

const ejs = require('ejs');
const express = require('express');

const app = express();
app.use(express.json());

const PROFILE_TEMPLATE = `
  <section class="profile">
    <h2><%= user.displayName %></h2>
    <a href="<%- user.website %>">Strona domowa</a>
    <div class="bio"><%- user.bio %></div>
  </section>
`;

function renderProfile(user) {
  // SINK: znaczniki <%- %> renderują wartości bez enkodowania HTML.
  return ejs.render(PROFILE_TEMPLATE, { user });
}

app.post('/profile/preview', (req, res) => {
  const user = {
    displayName: req.body.displayName, // SOURCE
    website: req.body.website,
    bio: req.body.bio,
  };

  res.type('html').send(renderProfile(user));
});

module.exports = { app, renderProfile };
