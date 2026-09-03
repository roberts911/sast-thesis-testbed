// control_pool/cwe_94_safe_lodash_template_upload.js
// Bezpieczny odpowiednik: cwe_94_lodash_template_upload.js
// Poprawka: wgrywany plik nie jest już kompilowany jako kod. Zamiast lodash.template
// (który generuje funkcję JS) używany jest silnik logic-less z automatycznym
// escapowaniem, a wejście jest ograniczone rozmiarem i typem.

const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const Mustache = require('mustache');

const MAX_TEMPLATE_BYTES = 64 * 1024;
const UPLOAD_DIR = path.join(__dirname, 'uploads');

const app = express();
const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: MAX_TEMPLATE_BYTES },
});

function renderInvoice(templateSource, invoice) {
  // Mustache nie wykonuje kodu - znaczniki mapują się wyłącznie na pola widoku.
  const view = {
    id: String(invoice.id),
    amount: Number(invoice.amount) || 0,
    currency: String(invoice.currency || 'PLN'),
  };
  return Mustache.render(templateSource, view);
}

app.post('/invoices/:id/render', upload.single('template'), (req, res) => {
  const templateSource = fs.readFileSync(req.file.path, 'utf8');
  const invoice = { id: req.params.id, amount: 1200, currency: 'PLN' };

  res.type('html').send(renderInvoice(templateSource, invoice));
});

app.get('/invoices/:id/render-saved', (req, res) => {
  const invoiceId = req.params.id;

  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(invoiceId)) {
    return res.status(400).json({ error: 'invalid invoice id' });
  }

  const templatePath = path.join(UPLOAD_DIR, `${invoiceId}.tpl`);
  if (path.dirname(path.resolve(templatePath)) !== path.resolve(UPLOAD_DIR)) {
    return res.status(400).json({ error: 'invalid template path' });
  }

  const saved = fs.readFileSync(templatePath, 'utf8');
  res.type('html').send(renderInvoice(saved, { id: invoiceId, amount: 0, currency: 'PLN' }));
});

module.exports = { app, renderInvoice };
