// control_pool/cwe_79_safe_broken_sanitizer_markdown.js
// Bezpieczny odpowiednik: cwe_79_broken_sanitizer_markdown.js
// Poprawka: regexowa blacklista zastąpiona parserem HTML z allowlistą (DOMPurify na
// jsdom), sanityzacja wykonywana PO renderowaniu Markdown, a przepuszczanie surowego
// HTML w markedzie wyłączone.

const { marked } = require('marked');
const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');
const express = require('express');

const app = express();
app.use(express.json());

const DOMPurify = createDOMPurify(new JSDOM('').window);

const SANITIZE_CONFIG = {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'code', 'pre', 'blockquote', 'a'],
  ALLOWED_ATTR: ['href', 'title'],
  ALLOWED_URI_REGEXP: /^https?:\/\//i,
};

const notes = new Map();

function renderNote(markdown) {
  const rendered = marked.parse(String(markdown), { async: false });
  return DOMPurify.sanitize(rendered, SANITIZE_CONFIG);
}

app.post('/notes', (req, res) => {
  notes.set(String(req.body.id), String(req.body.markdown ?? ''));
  res.status(201).json({ id: req.body.id });
});

app.get('/notes/:id', (req, res) => {
  const markdown = notes.get(req.params.id);

  if (markdown === undefined) {
    return res.status(404).json({ error: 'not found' });
  }

  res.type('text/html; charset=utf-8').send(`<article>${renderNote(markdown)}</article>`);
});

module.exports = { app, renderNote };
