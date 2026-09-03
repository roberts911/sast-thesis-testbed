// cwe_798_credential_provider_fallback.js
// Poziom pośredniości 5/5: sekret ukryty za warstwą abstrakcji, jako wartość zapasowa.
// Scenariusz: wspólny dostawca poświadczeń dla kilku serwisów. Gettery zwracają wartość
// ze zmiennej środowiskowej, a gdy jej brak - "awaryjny" token wpisany na stałe.
// W miejscu użycia nie widać żadnego literału: kod odczytuje jedynie właściwość obiektu
// zwróconego przez fabrykę, więc wykrycie wymaga przejścia przez klasę i getter.
// UWAGA: wszystkie poświadczenia w tym korpusie są syntetyczne i nieaktywne.

const axios = require('axios');

// Wartości zapasowe dodane, "żeby lokalne uruchomienie działało bez konfiguracji".
const FALLBACK_SERVICE_TOKEN = 'svc_2WqYd7Rn4PkLb9XmZt3JgAe6HcVu8FsQ';
const FALLBACK_SIGNING_KEY = 'c93f5a1d78be24069fac8135d7b0e6425a19c8fd30b7e6142d9caf5083be7c19';

class CredentialProvider {
  constructor(env = process.env) {
    this.env = env;
  }

  get serviceToken() {
    // SINK: gdy zmienna środowiskowa nie istnieje, zwracany jest sekret z kodu.
    return this.env.SERVICE_TOKEN || FALLBACK_SERVICE_TOKEN;
  }

  get signingKey() {
    return this.env.SIGNING_KEY || FALLBACK_SIGNING_KEY;
  }
}

let providerInstance = null;

function getCredentialProvider() {
  if (!providerInstance) {
    providerInstance = new CredentialProvider();
  }
  return providerInstance;
}

async function callInventoryService(sku) {
  const credentials = getCredentialProvider();

  const response = await axios.get(`https://inventory.internal/api/items/${sku}`, {
    headers: { Authorization: `Bearer ${credentials.serviceToken}` },
  });

  return response.data;
}

module.exports = { CredentialProvider, getCredentialProvider, callInventoryService };
