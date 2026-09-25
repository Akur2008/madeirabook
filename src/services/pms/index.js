// PMS-абстракция.
// По умолчанию — Smoobu (старый канал). Если PMS_PROVIDER=zeevou — используем Zeevou.
const provider = (process.env.PMS_PROVIDER || 'smoobu').toLowerCase();

let impl;
if (provider === 'zeevou') {
  impl = require('./zeevou');
} else {
  impl = require('./smoobu');
}

module.exports = impl;
module.exports.__provider = provider;
