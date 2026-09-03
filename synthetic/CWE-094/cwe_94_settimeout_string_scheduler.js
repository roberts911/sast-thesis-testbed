// cwe_94_settimeout_string_scheduler.js
// Scenariusz: prosty scheduler zadań cron-like w aplikacji SaaS.
// Wariant: implicit eval - setTimeout/setInterval z argumentem typu string.
// Sink jest mniej oczywisty niż eval(), często pomijany przez słabsze reguły SAST.
// Dodatkowo dane przechodzą przez konkatenację (string building), co testuje
// obsługę propagacji taintu przez operator +.

const express = require('express');

const app = express();
app.use(express.json());

const jobs = new Map();

function scheduleJob(jobName, handlerBody, delayMs) {
  const code = 'try { ' + handlerBody + ' } catch (e) { console.error("job failed", e); }';

  // SINK: string przekazany do setTimeout jest kompilowany i wykonywany jak eval().
  const handle = setTimeout(code, delayMs);

  jobs.set(jobName, handle);
  return handle;
}

app.post('/scheduler/jobs', (req, res) => {
  const { name, handler, delay } = req.body; // SOURCE

  if (!name || !handler) {
    return res.status(400).json({ error: 'name and handler are required' });
  }

  scheduleJob(name, handler, Number(delay) || 5000);
  res.status(202).json({ scheduled: name });
});

app.delete('/scheduler/jobs/:name', (req, res) => {
  clearTimeout(jobs.get(req.params.name));
  jobs.delete(req.params.name);
  res.status(204).end();
});

module.exports = { app, scheduleJob };
