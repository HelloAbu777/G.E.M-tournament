// Shared DB module for all API routes
const { Pool } = require('pg');

const N = 28;
let pool = null;
let DB_READY = false;
let MEM = {
  teams: Array.from({length:N}, (_,i) => `Jamoa ${i+1}`),
  matches: {}
};

function getPool() {
  if (pool) return pool;
  const url = process.env.DATABASE_URL;
  if (!url || url.includes('xxx')) return null;
  pool = new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    max: 3,
    connectionTimeoutMillis: 8000,
  });
  return pool;
}

async function ensureTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS tournament_state (
      id         SERIAL PRIMARY KEY,
      key        VARCHAR(64) UNIQUE NOT NULL,
      value      JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

async function dbRead() {
  const p = getPool();
  if (!p) return MEM;
  try {
    const client = await p.connect();
    try {
      await ensureTable(client);
      const r = await client.query(`SELECT value FROM tournament_state WHERE key='main'`);
      if (r.rowCount === 0) {
        await client.query(`INSERT INTO tournament_state (key,value) VALUES ('main',$1)`, [JSON.stringify(MEM)]);
        return MEM;
      }
      MEM = r.rows[0].value;
      return MEM;
    } finally { client.release(); }
  } catch(e) {
    console.error('dbRead error:', e.message);
    return MEM;
  }
}

async function dbWrite(data) {
  MEM = data;
  const p = getPool();
  if (!p) return;
  try {
    const client = await p.connect();
    try {
      await ensureTable(client);
      const r = await client.query(`SELECT 1 FROM tournament_state WHERE key='main'`);
      if (r.rowCount === 0) {
        await client.query(`INSERT INTO tournament_state (key,value) VALUES ('main',$1)`, [JSON.stringify(data)]);
      } else {
        await client.query(`UPDATE tournament_state SET value=$1, updated_at=NOW() WHERE key='main'`, [JSON.stringify(data)]);
      }
    } finally { client.release(); }
  } catch(e) {
    console.error('dbWrite error:', e.message);
  }
}

module.exports = { dbRead, dbWrite, N, PASS: () => process.env.ADMIN_PASSWORD || 'gem2026' };
