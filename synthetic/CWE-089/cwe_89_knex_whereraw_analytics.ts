// cwe_89_knex_whereraw_analytics.ts
// Poziom przepływu 3/5: błędne użycie ORM/query buildera.
// Scenariusz: dashboard analityczny zbudowany na Knex. Większość zapytania używa
// bezpiecznego API buildera (.where, .select), ale jeden warunek wymagał funkcji SQL,
// więc autor sięgnął po .whereRaw() z template literalem - i stracił bindingi.
// Test dla skanera: czy odróżnia bezpieczne metody buildera od raw escape hatch.

import knexFactory, { Knex } from 'knex';
import express, { Request, Response } from 'express';

const knex: Knex = knexFactory({
  client: 'pg',
  connection: process.env.DATABASE_URL,
});

const app = express();
app.use(express.json());

interface AnalyticsFilter {
  tenantId: string;
  minRevenue: string;
  segmentExpression: string;
}

export async function fetchSegmentRevenue(filter: AnalyticsFilter) {
  return knex('orders')
    .select('segment')
    .sum({ revenue: 'total' })
    .where('tenant_id', filter.tenantId)
    // SINK: interpolacja do surowego SQL zamiast bindingów (?).
    .whereRaw(`total > ${filter.minRevenue} AND ${filter.segmentExpression}`)
    .groupBy('segment');
}

app.get('/api/analytics/segments', async (req: Request, res: Response) => {
  const filter: AnalyticsFilter = {
    tenantId: String(req.query.tenantId), // SOURCE
    minRevenue: String(req.query.minRevenue || '0'),
    segmentExpression: String(req.query.segment || '1=1'),
  };

  try {
    res.json(await fetchSegmentRevenue(filter));
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default app;
