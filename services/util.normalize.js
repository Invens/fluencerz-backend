exports.normalizeUsername = (u) =>
    String(u || '').trim().replace(/^@+/, '').toLowerCase();
  
  exports.asNum = (x, fallback = 0) => {
    if (x === null || x === undefined || x === '') return fallback;
    const n = Number(x);
    return Number.isFinite(n) ? n : fallback;
  };
  