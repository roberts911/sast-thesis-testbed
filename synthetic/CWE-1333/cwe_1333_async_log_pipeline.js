// cwe_1333_async_log_pipeline.js
// Poziom przepływu 5/5: najtrudniejszy - wzorzec składany ze fragmentów, sink w workerze.
// Scenariusz: potok przetwarzania logów. Linie pochodzą z kolejki (nie z HTTP), a wzorzec
// parsujący jest budowany przez konkatenację stałych fragmentów - żaden pojedynczy literał
// nie wygląda podejrzanie, dopiero złożenie daje zagnieżdżony kwantyfikator ([^\]]+\s*)+.
// Dopasowanie działa w pętli po wszystkich liniach paczki, w tle, bez limitu czasu,
// więc jedna spreparowana linia blokuje pętlę zdarzeń całego procesu.
// Test dla skanera: czy rekonstruuje wzorzec złożony ze zmiennych i traktuje kolejkę jako źródło.

const amqp = require('amqplib');

const TIMESTAMP_PART = '\\[(\\d{4}-\\d{2}-\\d{2}[^\\]]*)\\]';
const LEVEL_PART = '\\s*(INFO|WARN|ERROR)\\s*';
const MESSAGE_PART = '((?:[^\\]]+\\s*)+)$';

const LOG_LINE_PATTERN = new RegExp('^' + TIMESTAMP_PART + LEVEL_PART + MESSAGE_PART);

function parseLine(line) {
  // SINK: wzorzec z zagnieżdżonym kwantyfikatorem na linii o dowolnej długości.
  const matched = LOG_LINE_PATTERN.exec(line);

  if (!matched) return null;
  return { timestamp: matched[1], level: matched[2], message: matched[3] };
}

function parseBatch(batch) {
  return batch
    .split('\n')
    .map(parseLine)
    .filter(Boolean);
}

async function startLogWorker() {
  const connection = await amqp.connect(process.env.AMQP_URL);
  const channel = await connection.createChannel();
  await channel.assertQueue('logs.ingest');

  channel.consume('logs.ingest', (msg) => {
    if (!msg) return;

    const batch = msg.content.toString(); // SOURCE
    const entries = parseBatch(batch);

    console.log('parsed entries', entries.length);
    channel.ack(msg);
  });
}

module.exports = { startLogWorker, parseBatch, parseLine, LOG_LINE_PATTERN };
