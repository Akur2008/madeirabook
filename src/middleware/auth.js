const config = require('../config');

module.exports = function basicAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, encoded] = header.split(' ');

  if (scheme !== 'Basic' || !encoded) {
    res.set('WWW-Authenticate', 'Basic realm="admin"');
    return res.status(401).send('Auth required');
  }

  const decoded = Buffer.from(encoded, 'base64').toString();
  const idx = decoded.indexOf(':');
  if (idx === -1) {
    return res.status(401).send('Invalid credentials');
  }

  const user = decoded.substring(0, idx);
  const pass = decoded.substring(idx + 1);

  if (user !== config.ADMIN_USER || pass !== config.ADMIN_PASS) {
    return res.status(401).send('Invalid credentials');
  }

  req.adminUser = user;
  next();
};
