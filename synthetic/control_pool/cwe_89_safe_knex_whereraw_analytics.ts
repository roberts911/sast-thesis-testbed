// control_pool/cwe_89_safe_knex_whereraw_analytics.ts
// Bezpieczny odpowiednik: cwe_89_knex_whereraw_analytics.ts
// Poprawka: whereRaw używa bindingów (?) zamiast interpolacji, wartość liczbowa jest
// walidowana, a dowolne "segmentExpression" zastąpione wyborem z allowlisty segmentów.

import knexFactory, { Knex } from 'knex';
import express, { Request, Response } from 'express';

const knex: Knex = knexFactory({
  client: 'pg',
  connection: process.env.DATABASE_URL,
});

const app = express();
app.use(express.json());

const ALLOWED_SEGMENTS = new Set(['retail', 'enterprise', 'partner']);

interface AnalyticsFilter {
  tenantId: string;
  minRevenue: number;
  segment: string | null;
}

function parseFilter(query: Request['query']): AnalyticsFilter {
  const minRevenue = Number(query.minRevenue ?? 0);
  const segment = query.segment ? String(query.segment) : null;

  if (!Number.isFinite(minRevenue) || minRevenue < 0) {
    throw new Error('invalid minRevenue');
  }
  if (segment && !ALLOWED_SEGMENTS.has(segment)) {
    throw new Error('unknown segment');
  }

  return { tenantId: String(query.tenantId ?? ''), minRevenue, segment };
}

export async function fetchSegmentRevenue(filter: AnalyticsFilter) {
  const query = knex('orders')
    .select('segment')
    .sum({ revenue: 'total' })
    .where('tenant_id', filter.tenantId)
    .whereRaw('total > ?', [filter.minRevenue]);

  if (filter.segment) {
    query.where('segment', filter.segment);
  }

  return query.groupBy('segment');
}

app.get('/api/analytics/segments', async (req: Request, res: Response) => {
  try {
    res.json(await fetchSegmentRevenue(parseFilter(req.query)));
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

export default app;
