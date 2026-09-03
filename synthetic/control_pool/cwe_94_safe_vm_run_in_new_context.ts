// control_pool/cwe_94_safe_vm_run_in_new_context.ts
// Bezpieczny odpowiednik: cwe_94_vm_run_in_new_context.ts
// Poprawka: rezygnacja z vm i z szablonów logic-full. Użytkownik wybiera szablon
// z repozytorium serwera, a jedyne dane dynamiczne to podstawienia placeholderów
// z zamkniętej listy, dodatkowo escapowane pod HTML.

import express, { Request, Response } from 'express';

interface Recipient {
  name: string;
  email: string;
}

const TEMPLATES: Record<string, string> = {
  welcome: '<p>Witaj {{name}}, dziękujemy za rejestrację.</p>',
  reset: '<p>{{name}}, link do resetu hasła wysłaliśmy na {{email}}.</p>',
};

const app = express();
app.use(express.json());

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderTemplate(templateId: string, recipient: Recipient): string {
  const template = Object.prototype.hasOwnProperty.call(TEMPLATES, templateId)
    ? TEMPLATES[templateId]
    : null;

  if (!template) {
    throw new Error('unknown template');
  }

  const values: Record<string, string> = {
    name: escapeHtml(String(recipient.name ?? '')),
    email: escapeHtml(String(recipient.email ?? '')),
  };

  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? values[key] : match,
  );
}

app.post('/notifications/preview', (req: Request, res: Response) => {
  try {
    const html = renderTemplate(String(req.body.templateId), req.body.recipient as Recipient);
    res.json({ html });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message, allowed: Object.keys(TEMPLATES) });
  }
});

export default app;
