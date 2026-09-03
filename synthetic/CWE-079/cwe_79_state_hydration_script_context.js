// cwe_79_state_hydration_script_context.js
// Poziom przepływu 5/5: najtrudniejszy - XSS w kontekście <script>, mimo JSON.stringify.
// Scenariusz: SSR wstrzykuje stan początkowy aplikacji do window.__PRELOADED_STATE__.
// JSON.stringify wygląda jak neutralizacja i skutecznie usuwa problem w kontekście HTML,
// ale nie escapuje sekwencji </script>, przez co wartość zamyka blok skryptu.
// Dane przechodzą dodatkowo przez agregator stanu i cache w pamięci.
// Test dla skanera: czy rozumie kontekst osadzenia (script vs body) i czy nie uznaje
// JSON.stringify za uniwersalny sanitizer.

const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const stateCache = new Map();

async function buildInitialState(tenantSlug, referrer) {
  const { rows } = await pool.query('SELECT name, theme FROM tenants WHERE slug = $1', [tenantSlug]);

  return {
    tenant: rows[0] || { name: tenantSlug, theme: 'default' },
    campaign: { referrer },
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
    <script>
      window.__PRELOADED_STATE__ = ${JSON.stringify(state)};
    </script>
  </head>
  <body><div id="root"></div></body>
</html>`;
}

app.get('/app/:tenantSlug', async (req, res) => {
  const referrer = req.query.ref || ''; // SOURCE
  const state = await getState(req.params.tenantSlug, referrer);

  // SINK: JSON osadzony w bloku <script> bez escapowania sekwencji </script>.
  res.type('html').send(renderShell(state));
});

module.exports = { app, renderShell, getState };
