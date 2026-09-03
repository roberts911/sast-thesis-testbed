// control_pool/cwe_1321_safe_recursive_merge_settings.js
// Bezpieczny odpowiednik: cwe_1321_recursive_merge_settings.js
// Poprawka: iteracja po Object.keys zamiast for...in (pomija łańcuch prototypów),
// odrzucenie kluczy odnoszących się do prototypu oraz budowa obiektów bez prototypu
// (Object.create(null)), przez co zapis pod __proto__ nie ma żadnego efektu globalnego.

const express = require('express');

const app = express();
app.use(express.json());

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const defaultSettings = {
  theme: 'light',
  notifications: { email: true, push: false },
  locale: 'pl-PL',
};

function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (FORBIDDEN_KEYS.has(key)) continue;

    const value = source[key];

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const child =
        typeof target[key] === 'object' && target[key] !== null ? target[key] : Object.create(null);
      target[key] = deepMerge(child, value);
    } else {
      target[key] = value;
    }
  }
  return target;
}

app.post('/api/settings', (req, res) => {
  const settings = deepMerge(Object.assign(Object.create(null), defaultSettings), req.body);
  res.json({ settings });
});

module.exports = { app, deepMerge };
