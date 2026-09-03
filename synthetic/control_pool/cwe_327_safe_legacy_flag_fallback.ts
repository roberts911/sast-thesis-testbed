// control_pool/cwe_327_safe_legacy_flag_fallback.ts
// Bezpieczny odpowiednik: cwe_327_legacy_flag_fallback.ts
// Poprawka: gałąź "legacy" nie obniża już poziomu ochrony - zamiast cofać się do RC4,
// kod odrzuca żądanie i wymusza migrację integracji. Struktura warunkowa zostaje
// zachowana, więc stopień pośredniości jest ten sam, ale żadna ścieżka wykonania
// nie prowadzi do słabego szyfru.

import * as crypto from 'node:crypto';
import express, { Request, Response } from 'express';

const app = express();
app.use(express.json());

const LEGACY_CLIENTS = new Set(['acme-erp', 'globex-mainframe', 'initech-batch']);

export function selectCipher(clientId: string): string {
  if (LEGACY_CLIENTS.has(clientId)) {
    throw new Error('client requires migration to a supported cipher suite');
  }
  return 'aes-256-gcm';
}

export function encryptExport(clientId: string, payload: string, key: Buffer) {
  const algorithm = selectCipher(clientId);
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv(algorithm, key, iv);
  const encrypted = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);

  return {
    iv: iv.toString('base64'),
    payload: encrypted.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
  };
}

app.post('/api/exports/:clientId', (req: Request, res: Response) => {
  const key = crypto.scryptSync(process.env.EXPORT_SECRET as string, 'export-salt', 32);

  try {
    res.json(encryptExport(req.params.clientId, JSON.stringify(req.body), key));
  } catch (err) {
    res.status(409).json({ error: (err as Error).message });
  }
});

export { app };
