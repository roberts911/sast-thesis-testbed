// control_pool/cwe_79_safe_state_hydration_script_context.js
// Bezpieczny odpowiednik: cwe_79_state_hydration_script_context.js
// Poprawka: stan nie jest już osadzany w wykonywalnym bloku <script>. Trafia do
// <script type="application/json">, a znaki mogące zamknąć element (<, >, &) są
// zamieniane na sekwencje unicode - JSON pozostaje poprawny, a parser HTML nie
// napotka sekwencji </script>. Klient odczytuje stan przez JSON.parse.

const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const stateCache = new Map();

function serializeForScriptTag(state) {
  return JSON.stringify(state)
    .replace(/</g, '\\u003C')
    .replace(/>/g, '\\u003E')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

async function buildInitialState(tenantSlug, referrer) {
  const { rows } = await pool.query('SELECT name, theme FROM tenants WHERE slug = $1', [tenantSlug]);

  return {
    tenant: rows[0] || { name: tenantSlug, theme: 'default' },
    campaign: { referrer: String(referrer).slice(0, 200) },
    renderedAt: new Date().toISOString(),
  };
}

async function getState(tenantSlug, referrer) {
  const key = `${tenantSlug}:${referrer}`;

  if (!stateCache.has(key)) {
    stateCache.set(key, await buildInitialState(tenantSlug, referrer));
  }
  return stateCache.get(key);
}

function renderShell(state) {
  return `<!DOCTYPE html>
<html lang="pl">
  <head>
    <script id="preloaded-state" type="application/json">${serializeForScriptTag(state)}</script>
  </head>
  <body><div id="root"></div></body>
</html>`;
}

app.get('/app/:tenantSlug', async (req, res) => {
  const state = await getState(req.params.tenantSlug, req.query.ref || '');

  res.type('text/html; charset=utf-8').send(renderShell(state));
});

module.exports = { app, renderShell, serializeForScriptTag };
