// control_pool/cwe_798_safe_nested_config_object.js
// Bezpieczny odpowiednik: cwe_798_nested_config_object.js
// Poprawka: struktura konfiguracji zostaje zachowana, ale każde pole wrażliwe jest
// wypełniane ze zmiennej środowiskowej z walidacją obecności. Klient AWS korzysta
// z domyślnego łańcucha dostawców poświadczeń (rola IAM, profil, zmienne), więc
// klucze w ogóle nie przechodzą przez kod aplikacji.

const { Pool } = require('pg');
const { S3Client } = require('@aws-sdk/client-s3');
const jwt = require('jsonwebtoken');

function requireEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`missing required environment variable: ${name}`);
  }
  return value;
}

const config = {
  database: {
    host: process.env.DB_HOST || 'reporting-db.internal',
    port: Number(process.env.DB_PORT || 5432),
    user: requireEnv('DB_USER'),
    password: requireEnv('DB_PASSWORD'),
    database: process.env.DB_NAME || 'reporting',
  },
  aws: {
    region: process.env.AWS_REGION || 'eu-central-1',
  },
  auth: {
    jwtSecret: requireEnv('JWT_SIGNING_SECRET'),
    tokenTtlSeconds: Number(process.env.TOKEN_TTL_SECONDS || 3600),
  },
};

function createDatabasePool() {
  return new Pool(config.database);
}

function createStorageClient() {
  return new S3Client({ region: config.aws.region });
}

function issueServiceToken(subject) {
  return jwt.sign({ sub: subject }, config.auth.jwtSecret, {
    expiresIn: config.auth.tokenTtlSeconds,
  });
}

module.exports = { config, createDatabasePool, createStorageClient, issueServiceToken };
