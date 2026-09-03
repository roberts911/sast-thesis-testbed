// control_pool/cwe_20_safe_ssrf_webhook_callback.ts
// Bezpieczny odpowiednik: cwe_20_ssrf_webhook_callback.ts
// Poprawka: adres jest parsowany, ograniczony do HTTPS, a nazwa hosta rozwiązywana
// przed wysłaniem żądania - wszystkie zwrócone adresy muszą leżeć poza pulami
// prywatnymi i specjalnego przeznaczenia. Przekierowania są wyłączone, bo inaczej
// kontrola adresu dałaby się obejść odpowiedzią 302 z hosta zewnętrznego.

import * as dns from 'node:dns/promises';
import * as net from 'node:net';
import axios from 'axios';
import express, { Request, Response } from 'express';

const app = express();
app.use(express.json());

interface WebhookRegistration {
  name: string;
  callbackUrl: string;
}

const registrations = new Map<string, WebhookRegistration>();

function isDisallowedAddress(address: string): boolean {
  if (net.isIPv4(address)) {
    const [a, b] = address.split('.').map(Number);

    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 169 && b === 254) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }

  const normalized = address.toLowerCase();
  return (
    normalized === '::1' ||
    normalized === '::' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80')
  );
}

export async function assertPublicUrl(rawUrl: string): Promise<string> {
  const url = new URL(rawUrl);

  if (url.protocol !== 'https:') {
    throw new Error('only https callbacks are allowed');
  }

  const resolved = await dns.lookup(url.hostname, { all: true });
  if (resolved.length === 0 || resolved.some((entry) => isDisallowedAddress(entry.address))) {
    throw new Error('callback host resolves to a non-public address');
  }

  return url.toString();
}

export async function verifyCallback(callbackUrl: string) {
  const safeUrl = await assertPublicUrl(callbackUrl);

  const response = await axios.get(safeUrl, {
    timeout: 5000,
    maxRedirects: 0,
    headers: { 'X-Webhook-Probe': 'true' },
  });

  return { status: response.status, body: String(response.data).slice(0, 2048) };
}

app.post('/api/webhooks', async (req: Request, res: Response) => {
  const registration = req.body as WebhookRegistration;

  try {
    const probe = await verifyCallback(String(registration.callbackUrl));
    registrations.set(String(registration.name), registration);

    res.status(201).json({ registered: registration.name, probe });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

export { app, registrations };
