// cwe_78_spawn_shell_true_converter.ts
// Poziom przepływu 3/5: podatność wynika z opcji, nie z konkatenacji.
// Scenariusz: konwerter dokumentów. Deweloper poprawnie użył tablicy argumentów
// (co zwykle jest bezpieczne), ale ustawił shell: true, przez co argumenty
// są ponownie interpretowane przez powłokę. Klasyczny fałszywy sens bezpieczeństwa.

import { spawn } from 'node:child_process';
import express, { Request, Response } from 'express';

interface ConversionJob {
  inputPath: string;
  format: string;
  extraFlags: string;
}

const app = express();
app.use(express.json());

function convertDocument(job: ConversionJob): Promise<string> {
  const args = [
    '--headless',
    '--convert-to',
    job.format,
    job.extraFlags,
    job.inputPath,
  ].filter(Boolean);

  return new Promise((resolve, reject) => {
    // SINK: shell: true sprawia, że argumenty przechodzą przez /bin/sh -c.
    const child = spawn('libreoffice', args, { shell: true, cwd: '/srv/conversions' });

    let stdout = '';
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve(stdout) : reject(new Error(`exit ${code}`))));
  });
}

app.post('/api/documents/convert', async (req: Request, res: Response) => {
  const job: ConversionJob = {
    inputPath: String(req.body.inputPath), // SOURCE
    format: String(req.body.format),
    extraFlags: String(req.body.extraFlags || ''),
  };

  try {
    res.json({ output: await convertDocument(job) });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export { app, convertDocument };
