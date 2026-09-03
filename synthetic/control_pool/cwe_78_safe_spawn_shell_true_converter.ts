// control_pool/cwe_78_safe_spawn_shell_true_converter.ts
// Bezpieczny odpowiednik: cwe_78_spawn_shell_true_converter.ts
// Poprawka: shell: false (domyślne), format wybierany z allowlisty, dowolne
// "extraFlags" zastąpione zamkniętym zbiorem opcji, a ścieżka wejściowa
// ograniczona do katalogu roboczego.

import { spawn } from 'node:child_process';
import * as path from 'node:path';
import express, { Request, Response } from 'express';

const WORK_DIR = '/srv/conversions';
const ALLOWED_FORMATS = new Set(['pdf', 'docx', 'odt', 'txt']);
const ALLOWED_OPTIONS: Record<string, string[]> = {
  none: [],
  keepLayout: ['--keep-layout'],
  noLogo: ['--nologo'],
};

const app = express();
app.use(express.json());

function resolveInputPath(rawPath: string): string {
  const resolved = path.resolve(WORK_DIR, path.basename(String(rawPath)));

  if (path.dirname(resolved) !== path.resolve(WORK_DIR)) {
    throw new Error('input path outside work directory');
  }
  return resolved;
}

export function convertDocument(rawPath: string, format: string, optionKey: string): Promise<string> {
  if (!ALLOWED_FORMATS.has(format)) {
    return Promise.reject(new Error('unsupported format'));
  }

  const options = Object.prototype.hasOwnProperty.call(ALLOWED_OPTIONS, optionKey)
    ? ALLOWED_OPTIONS[optionKey]
    : ALLOWED_OPTIONS.none;

  const args = ['--headless', '--convert-to', format, ...options, resolveInputPath(rawPath)];

  return new Promise((resolve, reject) => {
    const child = spawn('libreoffice', args, { shell: false, cwd: WORK_DIR });

    let stdout = '';
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve(stdout) : reject(new Error(`exit ${code}`))));
  });
}

app.post('/api/documents/convert', async (req: Request, res: Response) => {
  try {
    const output = await convertDocument(
      String(req.body.inputPath),
      String(req.body.format),
      String(req.body.option || 'none'),
    );
    res.json({ output });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

export { app };
