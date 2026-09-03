// cwe_798_env_conditional_sandbox_key.ts
// Poziom pośredniości 4/5: warunkowy wybór sekretu zapisanego na stałe.
// Scenariusz: klient bramki SMS. Dla środowiska produkcyjnego klucz pochodzi ze
// zmiennej środowiskowej, ale dla pozostałych środowisk kod używa wpisanego na stałe
// klucza "sandbox" - który mimo nazwy jest prawdziwym poświadczeniem u dostawcy
// i trafia do repozytorium razem z kodem.
// UWAGA: wszystkie poświadczenia w tym korpusie są syntetyczne i nieaktywne.

import axios from 'axios';
import express, { Request, Response } from 'express';

const app = express();
app.use(express.json());

const GATEWAY_URL = 'https://api.sms-gateway.example/v2/messages';

export function resolveApiKey(): string {
  if (process.env.NODE_ENV === 'production') {
    return process.env.SMS_GATEWAY_KEY as string;
  }

  // SINK: klucz środowiska testowego zapisany na stałe na gałęzi nieprodukcyjnej.
  return 'sms_test_4TgWq8ZnPk2LyRv6BdXm9CsHf3JuAe5N';
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
