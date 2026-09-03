// control_pool/cwe_1333_safe_async_log_pipeline.js
// Bezpieczny odpowiednik: cwe_1333_async_log_pipeline.js
// Poprawka: dopasowanie wykonuje RE2 (automat skończony, brak backtrackingu), więc
// czas dopasowania jest liniowy niezależnie od wejścia. Wzorzec został dodatkowo
// przepisany bez zagnieżdżonych kwantyfikatorów, a paczka jest ograniczona co do
// liczby i długości linii - obrona nie polega wyłącznie na wyborze silnika.

const RE2 = require('re2');
const amqp = require('amqplib');

const MAX_LINE_LENGTH = 4096;
const MAX_LINES_PER_BATCH = 5000;

const LOG_LINE_PATTERN = new RE2(
  '^\\[(\\d{4}-\\d{2}-\\d{2}[^\\]]{0,32})\\]\\s(INFO|WARN|ERROR)\\s(.{0,2048})$',
);

function parseLine(line) {
  if (line.length > MAX_LINE_LENGTH) return null;

  const matched = LOG_LINE_PATTERN.exec(line);
  if (!matched) return null;

  return { timestamp: matched[1], level: matched[2], message: matched[3] };
}

function parseBatch(batch) {
  return batch
    .split('\n', MAX_LINES_PER_BATCH)
    .map(parseLine)
    .filter(Boolean);
}

async function startLogWorker() {
  const connection = await amqp.connect(process.env.AMQP_URL);
  const channel = await connection.createChannel();
  await channel.assertQueue('logs.ingest');

  channel.consume('logs.ingest', (msg) => {
    if (!msg) return;

    const entries = parseBatch(msg.content.toString());
    console.log('parsed entries', entries.length);
    channel.ack(msg);
  });
}

module.exports = { startLogWorker, parseBatch, parseLine };
