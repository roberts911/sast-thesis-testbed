// control_pool/cwe_798_safe_inline_stripe_api_key.js
// Bezpieczny odpowiednik: cwe_798_inline_stripe_api_key.js
// Poprawka: klucz pochodzi ze zmiennej środowiskowej, a jego brak zatrzymuje start
// procesu (fail-fast) zamiast cichego przejścia na wartość zastępczą. Ten sam stopień
// pośredniości - wartość jest odczytywana bezpośrednio w miejscu użycia.

const axios = require('axios');
const express = require('express');

const app = express();
app.use(express.json());

function requireEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`missing required environment variable: ${name}`);
  }
  return value;
}

app.post('/api/payments/charge', async (req, res) => {
  const { amount, currency, source } = req.body;

  try {
    const response = await axios.post(
      'https://api.payments-provider.example/v1/charges',
      new URLSearchParams({ amount, currency, source }),
      {
        headers: {
          Authorization: `Bearer ${requireEnv('PAYMENTS_API_KEY')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    );

    res.json({ chargeId: response.data.id });
  } catch (err) {
    res.status(502).json({ error: 'payment provider unavailable' });
  }
});

module.exports = { app, requireEnv };
