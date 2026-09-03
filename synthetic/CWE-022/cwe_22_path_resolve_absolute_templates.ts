// cwe_22_path_resolve_absolute_templates.ts
// Poziom przepływu 4/5: pułapka path.resolve() i walidacja niepokrywająca ścieżek bezwzględnych.
// Scenariusz: loader szablonów e-mail. Autor odrzuca wejście zawierające "..", więc typowy
// traversal nie przejdzie. Pomija jednak, że path.resolve() porzuca wszystkie wcześniejsze
// segmenty, gdy kolejny argument jest ścieżką bezwzględną - "/etc/passwd" wychodzi
// poza katalog bazowy bez użycia ani jednej kropki.
// Test dla skanera: czy odróżnia path.join (konkatenacja) od path.resolve (reset bazy)
// i czy widzi, że walidacja nie pokrywa całej klasy wejść.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import express, { Request, Response } from 'express';

const TEMPLATES_DIR = '/srv/app/templates';

const app = express();
app.use(express.json());

function assertNoTraversal(templateName: string): string {
  if (templateName.includes('..')) {
    throw new Error('traversal detected');
  }
  return templateName;
}

export async function loadTemplate(templateName: string): Promise<string> {
  const checked = assertNoTraversal(templateName);
  const fullPath = path.resolve(TEMPLATES_DIR, checked);

  // SINK: path.resolve zwraca ścieżkę bezwzględną z wejścia, ignorując katalog bazowy.
  return fs.readFile(fullPath, 'utf8');
}

app.get('/api/templates', async (req: Request, res: Response) => {
  const templateName = String(req.query.name ?? ''); // SOURCE

  try {
    res.type('text/plain').send(await loadTemplate(templateName));
  } catch (err) {
    res.status(404).json({ error: (err as Error).message });
  }
});

export { app, assertNoTraversal };
