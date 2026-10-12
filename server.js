require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;
const PASS = process.env.ADMIN_PASSWORD || 'gem2026';
const N    = 28;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

/* ═══════════════════════════════════════════════════════════════
   DATABASE SETUP
   Supports: Neon PostgreSQL (recommended) or in-memory fallback
═══════════════════════════════════════════════════════════════ */
let pool     = null;
let DB_READY = false;
let MEM_STATE = {
  teams:   Array.from({length:N}, (_,i) => `Jamoa ${i+1}`),
  matches: {}
};

const DB_URL = process.env.DATABASE_URL || '';
const IS_NEON = DB_URL.includes('neon.tech');
const IS_DB_CONFIGURED = DB_URL && !DB_URL.includes('xxx');

if (IS_DB_CONFIGURED) {
  const { Pool } = require('pg');
  pool = new Pool({
    connectionString: DB_URL.replace('sslmode=require', 'sslmode=verify-full'),
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
  initDB().catch(e => console.warn('⚠️  DB init failed:', e.message));
} else {
  console.log('ℹ️  DATABASE_URL not set → using in-memory store');
  console.log('   Add Neon connection string to .env to persist data\n');
}

async function initDB() {
  const client = await pool.connect();
  try {
    // Create table
    await client.query(`
      CREATE TABLE IF NOT EXISTS tournament_state (
        id         SERIAL PRIMARY KEY,
        key        VARCHAR(64) UNIQUE NOT NULL,
        value      JSONB         NOT NULL,
        updated_at TIMESTAMPTZ   DEFAULT NOW()
      );
    `);

    // Load or seed initial state
    const row = await client.query(
      `SELECT value FROM tournament_state WHERE key = 'main'`
    );
    if (row.rowCount === 0) {
      await client.query(
        `INSERT INTO tournament_state (key, value) VALUES ('main', $1)`,
        [JSON.stringify(MEM_STATE)]
      );
      console.log('✓ Initial tournament state seeded to DB');
    } else {
      MEM_STATE = row.rows[0].value;
      console.log('✓ State loaded from DB');
    }

    DB_READY = true;
    console.log(`✓ Neon PostgreSQL connected${IS_NEON ? ' (Neon)' : ''}`);
  } finally {
    client.release();
  }
}

/* ── DB read/write helpers ── */
async function dbRead() {
  if (!DB_READY) return MEM_STATE;
  const r = await pool.query(
    `SELECT value FROM tournament_state WHERE key = 'main'`
  );
  const data = r.rows[0]?.value || MEM_STATE;
  MEM_STATE = data; // sync cache
  return data;
}

async function dbWrite(data) {
  MEM_STATE = data;
  if (!DB_READY) return;
  await pool.query(
    `UPDATE tournament_state
     SET value = $1, updated_at = NOW()
     WHERE key = 'main'`,
    [JSON.stringify(data)]
  );
}

/* ═══════════════════════════════════════════════════════════════
   API ROUTES
═══════════════════════════════════════════════════════════════ */

/* GET /api/state — public (anyone can view) */
app.get('/api/state', async (req, res) => {
  try {
    const data = await dbRead();
    res.json(data);
  } catch (e) {
    console.error('GET /api/state:', e.message);
    res.status(500).json({ error: 'DB read error' });
  }
});

/* GET /api/info — server status */
app.get('/api/info', (req, res) => {
  res.json({
    db: DB_READY ? 'neon' : 'memory',
    dbReady: DB_READY,
    teams: N,
  });
});

/* POST /api/auth — verify admin password */
app.post('/api/auth', (req, res) => {
  const { password } = req.body || {};
  if (!password) return res.status(400).json({ ok: false, error: 'Password required' });
  const ok = password === PASS;
  res.status(ok ? 200 : 401).json({ ok });
});

/* PUT /api/state — save tournament state (admin only) */
app.put('/api/state', async (req, res) => {
  const { password, teams, matches } = req.body || {};
  if (password !== PASS)
    return res.status(401).json({ error: "Noto'g'ri parol" });
  if (!Array.isArray(teams) || typeof matches !== 'object')
    return res.status(400).json({ error: 'Invalid data format' });
  try {
    await dbWrite({ teams, matches });
    res.json({ ok: true });
  } catch (e) {
    console.error('PUT /api/state:', e.message);
    res.status(500).json({ error: 'DB write error' });
  }
});

/* POST /api/reset — clear match results, keep team names */
app.post('/api/reset', async (req, res) => {
  const { password } = req.body || {};
  if (password !== PASS)
    return res.status(401).json({ error: "Noto'g'ri parol" });
  try {
    const cur = await dbRead();
    await dbWrite({ teams: cur.teams, matches: {} });
    res.json({ ok: true, state: { teams: cur.teams, matches: {} } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* POST /api/reset-full — reset everything */
app.post('/api/reset-full', async (req, res) => {
  const { password } = req.body || {};
  if (password !== PASS)
    return res.status(401).json({ error: "Noto'g'ri parol" });
  try {
    const fresh = {
      teams:   Array.from({length:N}, (_,i) => `Jamoa ${i+1}`),
      matches: {}
    };
    await dbWrite(fresh);
    res.json({ ok: true, state: fresh });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ═══════════════════════════════════════════════════════════════
   START
═══════════════════════════════════════════════════════════════ */
app.listen(PORT, () => {
  console.log(`\n╔══════════════════════════════════════╗`);
  console.log(`║  🏆  G.E.M Tournament Server         ║`);
  console.log(`╠══════════════════════════════════════╣`);
  console.log(`║  URL:   http://localhost:${PORT}         ║`);
  console.log(`║  Admin: ${PASS.padEnd(28)}║`);
  console.log(`║  DB:    ${(DB_READY?'Neon PostgreSQL ✓':'In-memory (no DB)').padEnd(28)}║`);
  console.log(`╚══════════════════════════════════════╝\n`);
});
