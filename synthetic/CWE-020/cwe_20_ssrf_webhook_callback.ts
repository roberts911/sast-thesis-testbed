// cwe_20_ssrf_webhook_callback.ts
// Poziom przepływu 4/5: brak walidacji adresu docelowego (SSRF).
// Scenariusz: rejestracja webhooka i jego weryfikacja przez wysłanie żądania testowego.
// Adres pochodzi od klienta i nie jest sprawdzany pod kątem schematu ani zakresu
// adresowego, więc serwer może zostać zmuszony do odpytania usług w sieci wewnętrznej
// (metadane chmury, panele administracyjne, bazy bez uwierzytelnienia).
// Odpowiedź wraca do klienta, co zamienia SSRF w kanał odczytu.

import axios from 'axios';
import express, { Request, Response } from 'express';

const app = express();
app.use(express.json());

interface WebhookRegistration {
  name: string;
  callbackUrl: string;
}

const registrations = new Map<string, WebhookRegistration>();

export async function verifyCallback(callbackUrl: string) {
  // SINK: żądanie wychodzące pod adres w pełni kontrolowany przez klienta.
  const response = await axios.get(callbackUrl, {
    timeout: 5000,
    maxRedirects: 5,
    headers: { 'X-Webhook-Probe': 'true' },
  });

  return { status: response.status, body: String(response.data).slice(0, 2048) };
}

app.post('/api/webhooks', async (req: Request, res: Response) => {
  const registration = req.body as WebhookRegistration; // SOURCE

  try {
    const probe = await verifyCallback(registration.callbackUrl);
    registrations.set(registration.name, registration);

    res.status(201).json({ registered: registration.name, probe });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

export { app, registrations };
