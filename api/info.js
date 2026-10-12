module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const url = process.env.DATABASE_URL || '';
  res.json({
    db: (url && !url.includes('xxx')) ? 'neon' : 'memory',
    dbReady: !!(url && !url.includes('xxx')),
    teams: 28,
  });
};
