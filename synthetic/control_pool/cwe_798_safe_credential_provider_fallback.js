// control_pool/cwe_798_safe_credential_provider_fallback.js
// Bezpieczny odpowiednik: cwe_798_credential_provider_fallback.js
// Poprawka: warstwa abstrakcji zostaje, ale znika wartość zapasowa. Provider pobiera
// poświadczenia z menedżera sekretów (z buforowaniem), a przy braku konfiguracji
// zgłasza błąd zamiast cicho użyć wpisanego klucza. Zależność jest wstrzykiwana,
// co pozwala podmienić ją w testach bez umieszczania sekretów w kodzie.

const axios = require('axios');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

class CredentialProvider {
  constructor(secretsClient = new SecretsManagerClient({}), env = process.env) {
    this.secretsClient = secretsClient;
    this.env = env;
    this.cache = new Map();
  }

  async getSecret(secretName) {
    if (this.cache.has(secretName)) {
      return this.cache.get(secretName);
    }

    const response = await this.secretsClient.send(
      new GetSecretValueCommand({ SecretId: secretName }),
    );

    if (!response.SecretString) {
      throw new Error(`secret not available: ${secretName}`);
    }

    this.cache.set(secretName, response.SecretString);
    return response.SecretString;
  }

  getServiceToken() {
    return this.getSecret(this.env.SERVICE_TOKEN_SECRET_ID || 'inventory/service-token');
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
  const token = await getCredentialProvider().getServiceToken();

  const response = await axios.get(`https://inventory.internal/api/items/${sku}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  return response.data;
}

module.exports = { CredentialProvider, getCredentialProvider, callInventoryService };
