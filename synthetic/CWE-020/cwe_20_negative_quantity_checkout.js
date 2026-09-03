// cwe_20_negative_quantity_checkout.js
// Poziom przepływu 3/5: brak walidacji zakresu wartości liczbowej.
// Scenariusz: koszyk i finalizacja zamówienia. Ilość sztuk jest poprawną liczbą,
// więc kontrola typu przechodzi - brakuje jednak sprawdzenia, czy jest dodatnią
// liczbą całkowitą. Ujemna ilość obniża sumę zamówienia, a przy kilku pozycjach
// pozwala doprowadzić kwotę do zera lub wartości ujemnej.
// Wartość przechodzi przez agregację pozycji i osobny moduł wyliczający rabat.

const express = require('express');

const app = express();
app.use(express.json());

const CATALOG = {
  'sku-1001': { name: 'Klawiatura', unitPrice: 249.0 },
  'sku-1002': { name: 'Monitor', unitPrice: 1199.0 },
  'sku-1003': { name: 'Stacja dokująca', unitPrice: 649.0 },
};

function lineTotal(item) {
  const product = CATALOG[item.sku];
  if (!product) throw new Error('unknown sku');

  // SINK: ilość użyta w mnożeniu bez sprawdzenia znaku ani całkowitości.
  return product.unitPrice * item.quantity;
}

function applyVolumeDiscount(total, itemCount) {
  return itemCount >= 10 ? total * 0.95 : total;
}

function calculateOrder(items) {
  const total = items.reduce((sum, item) => sum + lineTotal(item), 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return { total: applyVolumeDiscount(total, itemCount), itemCount };
}

app.post('/api/checkout', (req, res) => {
  const items = req.body.items || []; // SOURCE

  try {
    res.json(calculateOrder(items));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = { app, calculateOrder, lineTotal };
