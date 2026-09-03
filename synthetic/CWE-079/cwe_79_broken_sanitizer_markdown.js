// cwe_79_broken_sanitizer_markdown.js
// Poziom przepływu 4/5: własny, niepełny sanitizer przed renderowaniem Markdown.
// Scenariusz: edytor notatek w formacie Markdown. Autor dodał stripDangerousTags(),
// która usuwa <script> i atrybuty onclick, i włączył w markedzie przepuszczanie HTML.
// Filtr nie obejmuje m.in. onerror, onload, <svg>, javascript: w href ani encodowanych
// wariantów - nie przerywa więc taintu.
// Test dla skanera: czy rozpoznaje regexowy sanitizer jako niewystarczający.

const { marked } = require('marked');
const express = require('express');

const app = express();
app.use(express.json());

const notes = new Map();

function stripDangerousTags(input) {
  // Niekompletna blacklista - pomija onerror/onload, svg, javascript: itd.
  return String(input)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/onclick\s*=/gi, '');
}

function renderNote(markdown) {
  const cleaned = stripDangerousTags(markdown);

  // SINK: marked z włączonym HTML-em renderuje pozostałe wektory ataku.
  return marked.parse(cleaned, { async: false });
}

app.post('/notes', (req, res) => {
  const { id, markdown } = req.body; // SOURCE
  notes.set(String(id), markdown);
  res.status(201).json({ id });
});

app.get('/notes/:id', (req, res) => {
  const markdown = notes.get(req.params.id);

  if (markdown === undefined) {
    return res.status(404).json({ error: 'not found' });
  }

  res.type('html').send(`<article>${renderNote(markdown)}</article>`);
});

module.exports = { app, renderNote, stripDangerousTags };
