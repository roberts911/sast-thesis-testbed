// control_pool/cwe_798_safe_env_conditional_sandbox_key.ts
// Bezpieczny odpowiednik: cwe_798_env_conditional_sandbox_key.ts
// Poprawka: rozgałęzienie na środowiska pozostaje, ale wybierana jest nazwa zmiennej
// środowiskowej, nie wartość sekretu. Żadna ścieżka wykonania nie prowadzi do
// literału z poświadczeniem, a brak konfiguracji kończy się błędem.

import axios from 'axios';
import express, { Request, Response } from 'express';

const app = express();
app.use(express.json());

const GATEWAY_URL = 'https://api.sms-gateway.example/v2/messages';

export function resolveApiKey(): string {
  const envVarName =
    process.env.NODE_ENV === 'production' ? 'SMS_GATEWAY_KEY' : 'SMS_GATEWAY_SANDBOX_KEY';

  const key = process.env[envVarName];
  if (!key) {
    throw new Error(`missing required environment variable: ${envVarName}`);
  }
  return key;
}

export async function sendMessage(recipient: string, body: string) {
  const response = await axios.post(
    GATEWAY_URL,
    { recipient, body },
    { headers: { 'X-Api-Key': resolveApiKey() } },
  );

  return response.data.messageId;
}

app.post('/api/notifications/sms', async (req: Request, res: Response) => {
  try {
    const messageId = await sendMessage(String(req.body.recipient), String(req.body.body));
    res.status(202).json({ messageId });
  } catch (err) {
    res.status(502).json({ error: 'gateway unavailable' });
  }
});

export { app };
