// control_pool/cwe_327_safe_crypto_helper_factory.js
// Bezpieczny odpowiednik: cwe_327_crypto_helper_factory.js
// Poprawka: domyślny algorytm w konstruktorze to SHA-256, a dodatkowo konstruktor
// odrzuca algorytmy spoza allowlisty - więc również jawne przekazanie 'md5' przez
// wywołującego nie doprowadzi do słabego skrótu. Struktura klasy i fabryki
// pozostaje identyczna z wariantem podatnym.

const crypto = require('crypto');

const DIGEST_ENCODING = 'hex';
const APPROVED_ALGORITHMS = new Set(['sha256', 'sha384', 'sha512']);

class CryptoHelper {
  constructor(algorithm = 'sha256', encoding = DIGEST_ENCODING) {
    if (!APPROVED_ALGORITHMS.has(algorithm)) {
      throw new Error(`unsupported digest algorithm: ${algorithm}`);
    }
    this.algorithm = algorithm;
    this.encoding = encoding;
  }

  digest(content) {
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
