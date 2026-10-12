const { dbRead, dbWrite, PASS } = require('./_db');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { password } = req.body || {};
  if (password !== PASS()) return res.status(401).json({ error: "Noto'g'ri parol" });

  try {
    const cur = await dbRead();
    await dbWrite({ teams: cur.teams, matches: {} });
    res.status(200).json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
};
