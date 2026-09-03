// cwe_327_crypto_helper_factory.js
// Poziom pośredniości 5/5: algorytm ukryty w domyślnym parametrze konstruktora i fabryce.
// Scenariusz: wspólny moduł kryptograficzny używany przez kilka serwisów. Klasa
// CryptoHelper przyjmuje algorytm jako parametr z wartością domyślną 'md5', a fabryka
// createDocumentHasher() wywołuje konstruktor bez argumentów - więc w miejscu użycia
// nie widać ani nazwy algorytmu, ani nawet tego, że jest wybierany.
// Test dla skanera: czy propaguje wartości domyślne parametrów przez granice klas i fabryk.

const crypto = require('crypto');

const DIGEST_ENCODING = 'hex';

class CryptoHelper {
  constructor(algorithm = 'md5', encoding = DIGEST_ENCODING) {
    this.algorithm = algorithm;
    this.encoding = encoding;
  }

  digest(content) {
    // SINK: algorytm pochodzi z domyślnej wartości parametru konstruktora.
    return crypto.createHash(this.algorithm).update(content).digest(this.encoding);
  }

  fingerprint(document) {
    return this.digest(`${document.id}:${document.revision}:${document.body}`);
  }
}

function createDocumentHasher() {
  return new CryptoHelper();
}

function computeDocumentFingerprints(documents) {
  const hasher = createDocumentHasher();
  return documents.map((document) => ({
    id: document.id,
    fingerprint: hasher.fingerprint(document),
  }));
}

module.exports = { CryptoHelper, createDocumentHasher, computeDocumentFingerprints };
