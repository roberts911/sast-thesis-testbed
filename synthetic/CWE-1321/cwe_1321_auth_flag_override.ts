// cwe_1321_auth_flag_override.ts
// Poziom przepływu 4/5: zanieczyszczenie zmieniające wynik decyzji autoryzacyjnej.
// Scenariusz: zapis preferencji użytkownika scala dane wejściowe w obiekt profilu.
// Osobny moduł sprawdza uprawnienia, odczytując pole isAdmin z rekordu zwróconego
// przez bazę. Rekord nie zawiera tego pola, więc odczyt trafia do prototypu -
// zanieczyszczonego wcześniej innym żądaniem.
// Skutek nie jest lokalny: sink zapisu i miejsce eksploatacji są w różnych warstwach.
// Test dla skanera: czy wiąże zapis do prototypu z odczytem właściwości gdzie indziej.

import express, { Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';

const app = express();
app.use(express.json());

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

interface UserRecord {
  id: number;
  email: string;
  isAdmin?: boolean;
}

function mergePreferences(target: Record<string, unknown>, source: Record<string, unknown>) {
  for (const key of Object.keys(source)) {
    const value = source[key];

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const child = (target[key] as Record<string, unknown>) ?? {};
      target[key] = mergePreferences(child, value as Record<string, unknown>);
    } else {
      // SINK: klucz z ciała żądania użyty bezpośrednio jako właściwość docelowa.
      target[key] = value;
    }
  }
  return target;
}

app.put('/api/profile/preferences', (req: Request, res: Response) => {
  const preferences = mergePreferences({}, req.body); // SOURCE
  res.json({ preferences });
});

async function loadUser(userId: string): Promise<UserRecord> {
  const { rows } = await pool.query<UserRecord>('SELECT id, email FROM users WHERE id = $1', [
    userId,
  ]);
  return rows[0];
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = await loadUser(String(req.header('x-user-id')));

  // Odczyt brakującej właściwości schodzi po łańcuchu prototypów.
  if (user && user.isAdmin) {
    return next();
  }
  res.status(403).json({ error: 'forbidden' });
}

app.delete('/api/tenants/:id', requireAdmin, (req: Request, res: Response) => {
  res.json({ deleted: req.params.id });
});

export { app, mergePreferences };
