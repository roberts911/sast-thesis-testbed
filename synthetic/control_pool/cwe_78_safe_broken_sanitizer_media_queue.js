// control_pool/cwe_78_safe_broken_sanitizer_media_queue.js
// Bezpieczny odpowiednik: cwe_78_broken_sanitizer_media_queue.js
// Poprawka: blacklista zastąpiona podejściem strukturalnym - execFile z tablicą
// argumentów, filtry i presety wybierane z allowlisty, źródło ograniczone do
// zaufanego bucketu, a identyfikator zadania walidowany przed użyciem w ścieżce.

const { execFile } = require('child_process');
const path = require('path');
const amqp = require('amqplib');

const OUTPUT_DIR = '/srv/media/out';
const SOURCE_HOST = 'media-store.internal';
const JOB_ID_PATTERN = /^[a-f0-9-]{8,64}$/;

const FILTERS = {
  none: [],
  scale720: ['-vf', 'scale=-2:720'],
  scale1080: ['-vf', 'scale=-2:1080'],
  deinterlace: ['-vf', 'yadif'],
};

const PRESETS = new Set(['ultrafast', 'fast', 'medium', 'slow']);

function validateSourceUrl(rawUrl) {
  const url = new URL(String(rawUrl));

  if (url.protocol !== 'https:' || url.hostname !== SOURCE_HOST) {
    throw new Error('source not allowed');
  }
  return url.toString();
}

function buildTranscodeArgs(job) {
  if (!JOB_ID_PATTERN.test(String(job.id))) throw new Error('invalid job id');

  const filter = Object.prototype.hasOwnProperty.call(FILTERS, job.filter)
    ? FILTERS[job.filter]
    : FILTERS.none;

  const preset = PRESETS.has(job.preset) ? job.preset : 'medium';
  const outputPath = path.join(OUTPUT_DIR, `${job.id}.mp4`);

  return ['-i', validateSourceUrl(job.sourceUrl), ...filter, '-preset', preset, outputPath];
}

function processJob(job) {
  let args;
  try {
    args = buildTranscodeArgs(job);
  } catch (err) {
    return console.error('rejected job', job.id, err.message);
  }

  execFile('ffmpeg', args, { timeout: 600000 }, (err, stdout) => {
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
    processJob(JSON.parse(msg.content.toString()));
    channel.ack(msg);
  });
}

module.exports = { startWorker, processJob, buildTranscodeArgs };
