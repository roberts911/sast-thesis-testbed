// control_pool/cwe_1333_safe_zod_schema_pattern.ts
// Bezpieczny odpowiednik: cwe_1333_zod_schema_pattern.ts
// Poprawka: wzorce w schemacie pozbawione zagnieżdżonych kwantyfikatorów, a każde
// pole tekstowe ma jawny limit długości ustawiony PRZED regexem - Zod stosuje
// sprawdzenia w kolejności deklaracji, więc długie wejście odpada zanim trafi
// do dopasowania.

import { z } from 'zod';
import express, { Request, Response } from 'express';

const app = express();
app.use(express.json());

const invoiceSchema = z.object({
  reference: z
    .string()
    .max(32)
    .regex(/^\d+(?:-\d+)*$/, 'invalid reference'),
  description: z
    .string()
    .max(500)
    .regex(/^[\w ]+(?:,[\w ]+)*$/, 'invalid description'),
  amount: z.number().positive(),
});

app.post('/api/invoices', (req: Request, res: Response) => {
  const parsed = invoiceSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues });
  }

  res.status(201).json({ invoice: parsed.data });
});

export { app, invoiceSchema };
