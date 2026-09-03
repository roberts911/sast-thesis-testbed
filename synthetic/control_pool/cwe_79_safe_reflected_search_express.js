// control_pool/cwe_79_safe_reflected_search_express.js
// Bezpieczny odpowiednik: cwe_79_reflected_search_express.js
// Poprawka: wartość osadzana w HTML przechodzi przez enkodowanie encji, długość jest
// ograniczona, a odpowiedź deklaruje jawny charset. Bez nagłówków przeglądarkowych -
// badanie dotyczy wyłącznie poprawności przepływu danych i escapingu w kodzie.

const express = require('express');

const app = express();

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

app.get('/search', (req, res) => {
  const term = escapeHtml(String(req.query.q || '').slice(0, 200));

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

  res.type('text/html; charset=utf-8').send(html);
});

module.exports = app;
