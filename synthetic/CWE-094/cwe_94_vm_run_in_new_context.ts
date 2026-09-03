// cwe_94_vm_run_in_new_context.ts
// Scenariusz: usługa "notification templating" renderuje szablony powiadomień.
// Deweloper założył, że moduł vm jest sandboxem bezpieczeństwa - to częste,
// nieświadome nieporozumienie (dokumentacja Node.js wprost temu zaprzecza).
// Wariant: vm.runInNewContext + kontekst wystawiający require -> ucieczka z "sandboxa".

import * as vm from 'node:vm';
import express, { Request, Response } from 'express';

interface TemplateRequest {
  template: string;
  recipient: { name: string; email: string };
}

const app = express();
app.use(express.json());

export function renderTemplate(template: string, recipient: TemplateRequest['recipient']): string {
  const sandbox = {
    recipient,
    require, // wygoda dla autorów szablonów - w praktyce pełna ucieczka z kontekstu
    result: '',
  };

  // SINK: kod szablonu pochodzący z żądania wykonywany przez silnik V8.
  return String(vm.runInNewContext(template, vm.createContext(sandbox), { timeout: 1000 }));
}

app.post('/notifications/preview', (req: Request, res: Response) => {
  const body = req.body as TemplateRequest; // SOURCE

  try {
    const html = renderTemplate(body.template, body.recipient);
    res.json({ html });
  } catch (err) {
    res.status(422).json({ error: (err as Error).message });
  }
});

export default app;
