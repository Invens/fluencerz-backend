const db = require('../models');
const { search } = require('../services/instrack.client');
const { importByUsername, importInstrackProfile } = require('../services/influencer.account.importer');

// 1) Search via Instrack
exports.search = async (req, res) => {
  try {
    const { query } = req.body || {};
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ ok: false, error: 'query required' });
    }
    const accounts = await search(query);
    return res.json({ ok: true, accounts });
  } catch (err) {
    console.error('[search]', err.message);
    return res.status(502).json({ ok: false, error: err.message });
  }
};

// 2) Add by single username
exports.addByUsername = async (req, res) => {
  try {
    const { username } = req.body || {};
    if (!username) return res.status(400).json({ ok: false, error: 'username required' });

    const out = await importByUsername(username, db.sequelize);
    return res.json(out);
  } catch (err) {
    console.error('[addByUsername]', err.message);
    return res.status(502).json({ ok: false, error: err.message });
  }
};

// 3) Bulk add usernames (one-by-one, throttled)
exports.bulkAdd = async (req, res) => {
  try {
    const { usernames = [], throttle_ms = 800 } = req.body || {};
    if (!Array.isArray(usernames) || usernames.length === 0) {
      return res.status(400).json({ ok: false, error: 'usernames[] required' });
    }

    const results = [];
    for (const raw of usernames) {
      const u = String(raw || '').trim();
      if (!u) continue;
      try {
        const out = await importByUsername(u, db.sequelize);
        results.push({ username: u, ok: true, ...out });
      } catch (e) {
        results.push({ username: u, ok: false, error: e.message });
      }
      if (throttle_ms > 0) await new Promise(r => setTimeout(r, throttle_ms));
    }

    return res.json({ ok: true, count: results.length, results });
  } catch (err) {
    console.error('[bulkAdd]', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
};

// 4) Import by payload (your Virat-style JSON)
exports.importByPayload = async (req, res) => {
  try {
    const profile = req.body;
    if (!profile || !profile.username) {
      return res.status(400).json({ ok: false, error: 'Invalid payload: username required' });
    }
    const out = await importInstrackProfile(profile, db.sequelize);
    return res.json(out);
  } catch (err) {
    console.error('[importByPayload]', err.message);
    return res.status(502).json({ ok: false, error: err.message });
  }
};
