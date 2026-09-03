// cwe_327_legacy_flag_fallback.ts
// Poziom pośredniości 4/5: wybór algorytmu zależny od warunku.
// Scenariusz: eksport danych do partnerów. Część integracji nie obsługuje nowoczesnych
// szyfrów, więc dla klientów z listy "legacy" kod cofa się do RC4 - strumieniowego
// szyfru z udowodnionymi biasami, wycofanego z TLS.
// Wartość docierająca do createCipheriv zależy od gałęzi wykonania, a nie od stałej,
// więc analiza musi rozważyć obie ścieżki.

import * as crypto from 'node:crypto';
import express, { Request, Response } from 'express';

const app = express();
app.use(express.json());

const LEGACY_CLIENTS = new Set(['acme-erp', 'globex-mainframe', 'initech-batch']);

export function selectCipher(clientId: string): string {
  return LEGACY_CLIENTS.has(clientId) ? 'rc4' : 'aes-256-gcm';
}

export function encryptExport(clientId: string, payload: string, key: Buffer): string {
  const algorithm = selectCipher(clientId);
  const iv = algorithm === 'rc4' ? Buffer.alloc(0) : crypto.randomBytes(12);

  // SINK: dla klientów legacy algorytmem jest RC4.
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  return Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]).toString('base64');
}

app.post('/api/exports/:clientId', (req: Request, res: Response) => {
  const key = crypto.scryptSync(process.env.EXPORT_SECRET as string, 'export-salt', 32);
  const encrypted = encryptExport(req.params.clientId, JSON.stringify(req.body), key);

  res.json({ encrypted });
});

export { app };
