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
   DATABASE — Neon PostgreSQL
═══════════════════════════════════════════════════════════════ */
let pool     = null;
let DB_READY = false;
let MEM_STATE = {
  teams:   Array.from({length:N}, (_,i) => `Jamoa ${i+1}`),
  matches: {}
};

const DB_URL = process.env.DATABASE_URL || '';
const IS_CONFIGURED = DB_URL && !DB_URL.includes('xxx');

if (IS_CONFIGURED) {
  const { Pool } = require('pg');
  pool = new Pool({
    connectionString: DB_URL.replace('sslmode=require', 'sslmode=verify-full'),
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 8000,
  });
  initDB().catch(e => console.warn('DB init failed:', e.message));
} else {
  console.log('ℹ️  No DATABASE_URL → in-memory mode');
}

async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS tournament_state (
        id         SERIAL PRIMARY KEY,
        key        VARCHAR(64) UNIQUE NOT NULL,
        value      JSONB         NOT NULL,
        updated_at TIMESTAMPTZ   DEFAULT NOW()
      );
    `);
    const row = await client.query(
      `SELECT value FROM tournament_state WHERE key = 'main'`
    );
    if (row.rowCount === 0) {
      await client.query(
        `INSERT INTO tournament_state (key, value) VALUES ('main', $1)`,
        [JSON.stringify(MEM_STATE)]
      );
    } else {
      MEM_STATE = row.rows[0].value;
    }
    DB_READY = true;
    console.log('✓ Neon connected');
  } finally {
    client.release();
  }
}

async function dbRead() {
  if (!DB_READY) return MEM_STATE;
  const r = await pool.query(`SELECT value FROM tournament_state WHERE key='main'`);
  const data = r.rows[0]?.value || MEM_STATE;
  MEM_STATE = data;
  return data;
}

async function dbWrite(data) {
  MEM_STATE = data;
  if (!DB_READY) return;
  await pool.query(
    `UPDATE tournament_state SET value=$1, updated_at=NOW() WHERE key='main'`,
    [JSON.stringify(data)]
  );
}

/* ═══════════════════════════════════════════════════════════════
   ROUTES
═══════════════════════════════════════════════════════════════ */
app.get('/api/state', async (req, res) => {
  try { res.json(await dbRead()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/info', (req, res) => {
  res.json({ db: DB_READY ? 'neon' : 'memory', dbReady: DB_READY, teams: N });
});

app.post('/api/auth', (req, res) => {
  const { password } = req.body || {};
  const ok = password === PASS;
  res.status(ok ? 200 : 401).json({ ok });
});

app.put('/api/state', async (req, res) => {
  const { password, teams, matches } = req.body || {};
  if (password !== PASS) return res.status(401).json({ error: "Noto'g'ri parol" });
  if (!Array.isArray(teams) || typeof matches !== 'object')
    return res.status(400).json({ error: 'Invalid data' });
  try { await dbWrite({ teams, matches }); res.json({ ok: true }); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/reset', async (req, res) => {
  const { password } = req.body || {};
  if (password !== PASS) return res.status(401).json({ error: "Noto'g'ri parol" });
  try {
    const cur = await dbRead();
    await dbWrite({ teams: cur.teams, matches: {} });
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/reset-full', async (req, res) => {
  const { password } = req.body || {};
  if (password !== PASS) return res.status(401).json({ error: "Noto'g'ri parol" });
  try {
    const fresh = { teams: Array.from({length:N},(_,i)=>`Jamoa ${i+1}`), matches:{} };
    await dbWrite(fresh);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

/* Serve index.html for root */
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

/* Local dev only */
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n🏆 G.E.M Tournament Server`);
    console.log(`   http://localhost:${PORT}`);
    console.log(`   Admin: ${PASS}`);
    console.log(`   DB: ${DB_READY ? 'Neon ✓' : 'In-memory'}\n`);
  });
}

module.exports = app;
