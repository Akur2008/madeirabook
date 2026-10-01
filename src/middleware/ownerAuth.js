const bcrypt = require('bcrypt');
const db = require('../../db/client');

async function requireOwner(req, res, next) {
  if (!req.session || !req.session.ownerId) {
    return res.redirect('/owner/login');
  }
  try {
    const r = await db.query(
      `SELECT id, email, rnal FROM users WHERE id = $1`,
      [req.session.ownerId]
    );
    if (!r.rows.length) {
      req.session.destroy(() => {});
      return res.redirect('/owner/login');
    }
    req.owner = r.rows[0];
    next();
  } catch (e) {
    next(e);
  }
}

// TODO: пароли владельцев теперь в Payload-auth (users.hash/salt, pbkdf2).
// bcrypt-хелперы с ним несовместимы и пока нигде не вызываются.
async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

async function verifyPassword(password, hash) {
  if (!hash) return false;
  return bcrypt.compare(password, hash);
}

module.exports = { requireOwner, hashPassword, verifyPassword };
