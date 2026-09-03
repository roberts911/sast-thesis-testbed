// control_pool/cwe_20_safe_negative_quantity_checkout.js
// Bezpieczny odpowiednik: cwe_20_negative_quantity_checkout.js
// Poprawka: ilość jest walidowana jako dodatnia liczba całkowita w dopuszczalnym
// zakresie, zanim trafi do jakiejkolwiek arytmetyki. Walidacja obejmuje też liczbę
// pozycji w koszyku, więc żaden składnik sumy nie może być ujemny.

const express = require('express');

const app = express();
app.use(express.json());

const MAX_QUANTITY_PER_ITEM = 99;
const MAX_ITEMS_PER_ORDER = 50;

const CATALOG = {
  'sku-1001': { name: 'Klawiatura', unitPrice: 249.0 },
  'sku-1002': { name: 'Monitor', unitPrice: 1199.0 },
  'sku-1003': { name: 'Stacja dokująca', unitPrice: 649.0 },
};

function validateItem(item) {
  const product = CATALOG[String(item?.sku)];
  if (!product) throw new Error('unknown sku');

  const quantity = Number(item.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY_PER_ITEM) {
    throw new Error('quantity must be an integer between 1 and 99');
  }

  return { sku: item.sku, quantity, unitPrice: product.unitPrice };
}

function lineTotal(item) {
  return item.unitPrice * item.quantity;
}

function applyVolumeDiscount(total, itemCount) {
  return itemCount >= 10 ? total * 0.95 : total;
}

function calculateOrder(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new Error('cart is empty');
  }
  if (rawItems.length > MAX_ITEMS_PER_ORDER) {
    throw new Error('too many line items');
  }

  const items = rawItems.map(validateItem);
  const total = items.reduce((sum, item) => sum + lineTotal(item), 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return { total: applyVolumeDiscount(total, itemCount), itemCount };
}

app.post('/api/checkout', (req, res) => {
  try {
    res.json(calculateOrder(req.body.items));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = { app, calculateOrder, validateItem };
