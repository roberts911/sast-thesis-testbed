// cwe_78_broken_sanitizer_media_queue.js
// Poziom przepływu 5/5: najtrudniejszy - dane wchodzą przez kolejkę (nie przez HTTP),
// przechodzą przez własny "sanitizer" oparty na blackliście, są cache'owane w obiekcie,
// a dopiero potem trafiają do exec.
// Scenariusz: worker transkodujący pliki wideo. Autor dodał filtr, który usuwa ';' i '&',
// więc uznał temat za zamknięty - pomijając podstawienie polecenia $(...), backticki i '|'.
// Ten przypadek testuje, czy skaner rozpoznaje niekompletny sanitizer (nie przerywa taintu).

const { exec } = require('child_process');
const amqp = require('amqplib');

const OUTPUT_DIR = '/srv/media/out';
const commandCache = new Map();

function sanitizeFilterExpression(value) {
  // Niekompletna blacklista - nie neutralizuje $(), ``, |, nowej linii.
  return String(value).replace(/;/g, '').replace(/&/g, '');
}

function buildTranscodeCommand(job) {
  const filter = sanitizeFilterExpression(job.filter);
  const preset = sanitizeFilterExpression(job.preset);

  return `ffmpeg -i ${job.sourceUrl} -vf "${filter}" -preset ${preset} ${OUTPUT_DIR}/${job.id}.mp4`;
}

function getCommandFor(job) {
  if (!commandCache.has(job.id)) {
    commandCache.set(job.id, buildTranscodeCommand(job));
  }
  return commandCache.get(job.id);
}

function processJob(job) {
  const command = getCommandFor(job);

  // SINK: polecenie zawiera wartości, których blacklista nie zneutralizowała.
  exec(command, { timeout: 600000 }, (err, stdout) => {
    if (err) return console.error('transcode failed', job.id, err.message);
    console.log('transcoded', job.id, stdout.length);
  });
}

async function startWorker() {
  const connection = await amqp.connect(process.env.AMQP_URL);
  const channel = await connection.createChannel();
  await channel.assertQueue('media.transcode');

  channel.consume('media.transcode', (msg) => {
    if (!msg) return;
    const job = JSON.parse(msg.content.toString()); // SOURCE
    processJob(job);
    channel.ack(msg);
  });
}

module.exports = { startWorker, processJob, buildTranscodeCommand, sanitizeFilterExpression };
