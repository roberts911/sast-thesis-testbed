// control_pool/cwe_89_safe_sequelize_literal_broken_escape.js
// Bezpieczny odpowiednik: cwe_89_sequelize_literal_broken_escape.js
// Poprawka: rezygnacja z własnego escapingu i z sequelize.literal(). Wartości trafiają
// przez replacements (bindingi), próg liczbowy jest parsowany i walidowany, a kolumna
// grupowania wybierana z allowlisty.

const { Sequelize, QueryTypes } = require('sequelize');
const express = require('express');

const app = express();
app.use(express.json());

const sequelize = new Sequelize(process.env.DATABASE_URL, { logging: false });

const TIER_COLUMNS = { tier: 'tier', plan: 'plan_code', region: 'region' };

function toReportDto(query) {
  const minPoints = Number.parseInt(query.minPoints ?? '0', 10);

  if (!Number.isFinite(minPoints) || minPoints < 0) {
    throw new Error('invalid minPoints');
  }
  if (query.tier && !Object.prototype.hasOwnProperty.call(TIER_COLUMNS, String(query.tier))) {
    throw new Error('unknown grouping column');
  }

  return {
    tenantId: String(query.tenantId ?? ''),
    minPoints,
    tierColumn: TIER_COLUMNS[String(query.tier)] || TIER_COLUMNS.tier,
  };
}

async function loyaltyReport(dto) {
  return sequelize.query(
    `SELECT ${dto.tierColumn} AS tier, SUM(points) AS points
     FROM loyalty_events
     WHERE tenant_id = :tenantId
     GROUP BY ${dto.tierColumn}
     HAVING SUM(points) > :minPoints`,
    {
      replacements: { tenantId: dto.tenantId, minPoints: dto.minPoints },
      type: QueryTypes.SELECT,
    },
  );
}

app.get('/api/loyalty/report', async (req, res) => {
  try {
    res.json(await loyaltyReport(toReportDto(req.query)));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = { app, loyaltyReport, toReportDto };
