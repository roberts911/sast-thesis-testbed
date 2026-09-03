// control_pool/cwe_22_safe_path_resolve_absolute_templates.ts
// Bezpieczny odpowiednik: cwe_22_path_resolve_absolute_templates.ts
// Poprawka: kontrola nie opiera się już na szukaniu ".." w wejściu. Nazwa szablonu musi
// pasować do wzorca bez separatorów, a wynik path.resolve jest weryfikowany względem
// katalogu bazowego - co pokrywa również przypadek ścieżki bezwzględnej.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import express, { Request, Response } from 'express';

const TEMPLATES_DIR = path.resolve('/srv/app/templates');
const TEMPLATE_NAME_PATTERN = /^[a-zA-Z0-9_-]{1,64}\.html$/;

const app = express();
app.use(express.json());

export function resolveTemplatePath(templateName: string): string {
  if (!TEMPLATE_NAME_PATTERN.test(templateName)) {
    throw new Error('invalid template name');
  }

  const fullPath = path.resolve(TEMPLATES_DIR, templateName);
  if (!fullPath.startsWith(TEMPLATES_DIR + path.sep)) {
    throw new Error('template outside base directory');
  }
  return fullPath;
}

export async function loadTemplate(templateName: string): Promise<string> {
  return fs.readFile(resolveTemplatePath(templateName), 'utf8');
}

app.get('/api/templates', async (req: Request, res: Response) => {
  try {
    res.type('text/plain').send(await loadTemplate(String(req.query.name ?? '')));
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

export { app };
