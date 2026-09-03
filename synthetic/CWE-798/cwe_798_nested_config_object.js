// cwe_798_nested_config_object.js
// Poziom pośredniości 3/5: sekrety zaszyte w zagnieżdżonej strukturze konfiguracyjnej.
// Scenariusz: moduł bootstrapujący usługę raportową. Poświadczenia bazy, klucze AWS
// i klucz podpisujący tokeny znajdują się w jednym obiekcie config, importowanym
// przez pozostałe warstwy aplikacji.
// UWAGA: wszystkie poświadczenia w tym korpusie są syntetyczne i nieaktywne.

const { Pool } = require('pg');
const { S3Client } = require('@aws-sdk/client-s3');
const jwt = require('jsonwebtoken');

const config = {
  database: {
    host: 'reporting-db.internal',
    port: 5432,
    user: 'reporting_service',
    // SINK: hasło do bazy produkcyjnej zapisane w kodzie.
    password: 'Rp7!vXm2Qw9LtZk4NbHc',
    database: 'reporting',
  },
  aws: {
    region: 'eu-central-1',
    credentials: {
      accessKeyId: 'AKIA5J7QW3ZLMNVR2XPD',
      secretAccessKey: '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',
    },
  },
  auth: {
    jwtSecret: 'b41d7c8e93af2560bd17e4a09c3f8821de56b7049af31c62e08d5b7a9c4f0132e',
    tokenTtlSeconds: 3600,
  },
};

function createDatabasePool() {
  return new Pool(config.database);
}

function createStorageClient() {
  return new S3Client({ region: config.aws.region, credentials: config.aws.credentials });
}

function issueServiceToken(subject) {
  return jwt.sign({ sub: subject }, config.auth.jwtSecret, {
    expiresIn: config.auth.tokenTtlSeconds,
  });
}

module.exports = { config, createDatabasePool, createStorageClient, issueServiceToken };
