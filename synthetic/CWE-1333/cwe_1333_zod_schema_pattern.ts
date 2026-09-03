// cwe_1333_zod_schema_pattern.ts
// Poziom przepływu 3/5: podatny wzorzec zaszyty w schemacie walidacji.
// Scenariusz: endpoint tworzenia faktury waliduje ciało żądania schematem Zod.
// Warstwa walidacji sprawia wrażenie kontroli bezpieczeństwa, ale sama zawiera
// wzorzec z zagnieżdżonymi kwantyfikatorami i nie ogranicza długości pól.
// Sinkiem jest schema.parse(), a nie żadne bezpośrednie wywołanie na RegExp.
// Test dla skanera: czy analizuje wzorce przekazane do bibliotek walidacyjnych.

import { z } from 'zod';
import express, { Request, Response } from 'express';

const app = express();
app.use(express.json());

const invoiceSchema = z.object({
  // (\d+-?)+ oraz ([\w ]+,?)* - kwantyfikatory zagnieżdżone, brak limitu długości.
  reference: z.string().regex(/^(\d+-?)+$/, 'invalid reference'),
  description: z.string().regex(/^([\w ]+,?)*$/, 'invalid description'),
  amount: z.number().positive(),
});

app.post('/api/invoices', (req: Request, res: Response) => {
  // SINK: walidacja podatnymi wzorcami na nieograniczonym ciele żądania.
  const parsed = invoiceSchema.safeParse(req.body); // SOURCE

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues });
  }

  res.status(201).json({ invoice: parsed.data });
});

export { app, invoiceSchema };
