const crypto = require('crypto');
const bcrypt = require('bcryptjs');

exports.makeSyntheticEmail = (usernameOrName) => {
  const base = String(usernameOrName || 'creator')
    .replace(/[^a-z0-9._-]/gi, '')
    .toLowerCase() || 'creator';
  const salt = crypto.randomBytes(3).toString('hex');
  return `${base}.${salt}@noemail.fluencerz.local`; // your non-routable domain
};

exports.makeRandomPasswordHash = async () => {
  const pwd = crypto.randomBytes(9).toString('base64url');
  const password_hash = await bcrypt.hash(pwd, 10);
  return { password_plain: pwd, password_hash };
};
