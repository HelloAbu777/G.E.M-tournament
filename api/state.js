const { dbRead, dbWrite, PASS } = require('./_db');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    try {
      const data = await dbRead();
      return res.status(200).json(data);
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'PUT') {
    const { password, teams, matches } = req.body || {};
    if (password !== PASS()) return res.status(401).json({ error: "Noto'g'ri parol" });
    if (!Array.isArray(teams) || typeof matches !== 'object')
      return res.status(400).json({ error: 'Invalid data' });
    try {
      await dbWrite({ teams, matches });
      return res.status(200).json({ ok: true });
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.status(405).json({ error: 'Method not allowed' });
};
