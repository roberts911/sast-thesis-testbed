// cwe_89_sequelize_literal_broken_escape.js
// Poziom przepływu 5/5: najtrudniejszy - własny, niepełny escaping + kontekst numeryczny.
// Scenariusz: raport lojalnościowy w Sequelize. Autor napisał funkcję escapeValue(),
// która podwaja apostrofy, i uznał problem za rozwiązany. Pomija ona jednak fakt, że
// wartości liczbowe trafiają do SQL bez cudzysłowów - tam apostrof nie jest potrzebny
// do wstrzyknięcia. Dane przechodzą dodatkowo przez warstwę DTO i sequelize.literal().
// Test dla skanera: czy rozpoznaje sanitizer nieadekwatny do kontekstu (numeric context).

const { Sequelize, QueryTypes } = require('sequelize');
const express = require('express');

const app = express();
app.use(express.json());

const sequelize = new Sequelize(process.env.DATABASE_URL, { logging: false });

function escapeValue(value) {
  // Neutralizuje wyłącznie apostrofy - bez znaczenia w kontekście liczbowym.
  return String(value).replace(/'/g, "''");
}

function toReportDto(query) {
  return {
    tenantId: escapeValue(query.tenantId),
    minPoints: escapeValue(query.minPoints),
    tierColumn: query.tier ? escapeValue(query.tier) : 'tier',
  };
}

function buildHavingClause(dto) {
  return Sequelize.literal(`SUM(points) > ${dto.minPoints}`);
}

async function loyaltyReport(dto) {
  const having = buildHavingClause(dto);

  // SINK: literal wstawiony do HAVING zawiera wartość spoza cudzysłowów.
  return sequelize.query(
    `SELECT ${dto.tierColumn} AS tier, SUM(points) AS points
     FROM loyalty_events
     WHERE tenant_id = '${dto.tenantId}'
     GROUP BY ${dto.tierColumn}
     HAVING ${having.val}`,
    { type: QueryTypes.SELECT },
  );
}

app.get('/api/loyalty/report', async (req, res) => {
  const dto = toReportDto(req.query); // SOURCE

  try {
    res.json(await loyaltyReport(dto));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { app, loyaltyReport, escapeValue, toReportDto };
