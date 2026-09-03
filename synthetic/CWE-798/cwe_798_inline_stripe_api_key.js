// cwe_798_inline_stripe_api_key.js
// Poziom pośredniości 1/5: sekret jako literał wprost w miejscu użycia.
// Scenariusz: obciążenie karty przez API płatności. Klucz produkcyjny wklejony
// bezpośrednio w nagłówek Authorization, bez przejścia przez konfigurację.
// UWAGA: wszystkie poświadczenia w tym korpusie są syntetyczne i nieaktywne.

const axios = require('axios');
const express = require('express');

const app = express();
app.use(express.json());

app.post('/api/payments/charge', async (req, res) => {
  const { amount, currency, source } = req.body;

  try {
    const response = await axios.post(
      'https://api.payments-provider.example/v1/charges',
      new URLSearchParams({ amount, currency, source }),
      {
        headers: {
          // SINK: klucz produkcyjny zapisany na stałe w kodzie źródłowym.
          Authorization:
            'Bearer sk_live_51QbXr7KpLm3RfZbT8YhWc9JdXsGnUyE4Pq6BrKvA1MtHoLxSdWfNjCbVgTyReMk',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    );

    res.json({ chargeId: response.data.id });
  } catch (err) {
    res.status(502).json({ error: 'payment provider unavailable' });
  }
});

module.exports = app;
