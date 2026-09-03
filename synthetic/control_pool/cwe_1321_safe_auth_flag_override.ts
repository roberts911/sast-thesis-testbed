// control_pool/cwe_1321_safe_auth_flag_override.ts
// Bezpieczny odpowiednik: cwe_1321_auth_flag_override.ts
// Poprawka: scalanie odrzuca klucze prototypowe i buduje obiekty bez prototypu,
// a decyzja autoryzacyjna nie opiera się na odczycie potencjalnie brakującej
// właściwości - rola jest pobierana wprost z bazy i porównywana jako wartość własna
// (Object.hasOwn), więc łańcuch prototypów nie ma wpływu na wynik.

import express, { Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';

const app = express();
app.use(express.json());

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

interface UserRecord {
  id: number;
  email: string;
  role: string;
}

function mergePreferences(target: Record<string, unknown>, source: Record<string, unknown>) {
  for (const key of Object.keys(source)) {
    if (FORBIDDEN_KEYS.has(key)) continue;

    const value = source[key];

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const child = (target[key] as Record<string, unknown>) ?? Object.create(null);
      target[key] = mergePreferences(child, value as Record<string, unknown>);
    } else {
      target[key] = value;
    }
  }
  return target;
}

app.put('/api/profile/preferences', (req: Request, res: Response) => {
  const preferences = mergePreferences(Object.create(null), req.body);
  res.json({ preferences });
});

async function loadUser(userId: string): Promise<UserRecord | undefined> {
  const { rows } = await pool.query<UserRecord>(
    'SELECT id, email, role FROM users WHERE id = $1',
    [userId],
  );
  return rows[0];
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = await loadUser(String(req.header('x-user-id')));

  if (user && Object.hasOwn(user, 'role') && user.role === 'admin') {
    return next();
  }
  res.status(403).json({ error: 'forbidden' });
}

app.delete('/api/tenants/:id', requireAdmin, (req: Request, res: Response) => {
  res.json({ deleted: req.params.id });
});

export { app, mergePreferences };
