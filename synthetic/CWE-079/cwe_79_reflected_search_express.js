// cwe_79_reflected_search_express.js
// Poziom przepływu 1/5: reflected XSS, bezpośredni, jednoetapowy.
// Scenariusz: strona wyników wyszukiwania renderowana ręcznie sklejonym HTML-em,
// aby "uniknąć narzutu silnika szablonów". Fraza użytkownika wraca w kontekście HTML body.

const express = require('express');

const app = express();

app.get('/search', (req, res) => {
  const term = req.query.q || ''; // SOURCE

  const html = `
    <!DOCTYPE html>
    <html lang="pl">
      <body>
        <h1>Wyniki wyszukiwania</h1>
        <p>Szukana fraza: ${term}</p>
        <p>Nie znaleziono produktów.</p>
      </body>
    </html>
  `;

  // SINK: dane z parametru query trafiają do odpowiedzi HTML bez enkodowania.
  res.type('html').send(html);
});

module.exports = app;
