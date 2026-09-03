// cwe_94_lodash_template_upload.js
// Scenariusz: użytkownik wgrywa własny szablon faktury (.tpl), a backend renderuje
// go biblioteką lodash. _.template kompiluje szablon do funkcji JS, więc znaczniki
// <% %> pozwalają na wykonanie dowolnego kodu.
// Wariant: sink w bibliotece zewnętrznej + source z systemu plików (upload),
// co testuje wykrywanie niebezpiecznych API third-party i taint przez fs.

const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const _ = require('lodash');

const app = express();
const upload = multer({ dest: path.join(__dirname, 'uploads') });

const UPLOAD_DIR = path.join(__dirname, 'uploads');

function renderInvoice(templateSource, invoice) {
  // SINK: lodash.template kompiluje przekazany string do wykonywalnej funkcji.
  const compiled = _.template(templateSource);
  return compiled({ invoice });
}

app.post('/invoices/:id/render', upload.single('template'), (req, res) => {
  // SOURCE: zawartość pliku przesłanego przez użytkownika.
  const templateSource = fs.readFileSync(req.file.path, 'utf8');

  const invoice = { id: req.params.id, amount: 1200, currency: 'PLN' };
  const html = renderInvoice(templateSource, invoice);

  res.type('html').send(html);
});

app.get('/invoices/:id/render-saved', (req, res) => {
  const saved = fs.readFileSync(path.join(UPLOAD_DIR, `${req.params.id}.tpl`), 'utf8');
  res.type('html').send(renderInvoice(saved, { id: req.params.id }));
});

module.exports = { app, renderInvoice };
