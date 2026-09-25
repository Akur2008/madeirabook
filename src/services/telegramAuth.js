const crypto = require('crypto')
const config = require('../config')

/**
 * Валидация initData из Telegram WebApp.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
function validateInitData(initData) {
  if (!initData || typeof initData !== 'string') return null
  if (!config.TELEGRAM_BOT_TOKEN) return null

  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) return null

  params.delete('hash')

  const obj = Object.fromEntries(params.entries())
  const dataCheckString = Object.keys(obj)
    .sort()
    .map(function (k) { return k + '=' + obj[k] })
    .join('\n')

  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(config.TELEGRAM_BOT_TOKEN)
    .digest()

  const computed = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex')

  if (computed !== hash) return null

  const authDate = parseInt(params.get('auth_date') || '0', 10)
  if (!authDate || Date.now() / 1000 - authDate > 86400) return null

  const userRaw = params.get('user')
  if (!userRaw) return null

  try {
    return {
      user: JSON.parse(userRaw),
      authDate: authDate,
      queryId: params.get('query_id') || null,
    }
  } catch (e) {
    return null
  }
}

module.exports = { validateInitData: validateInitData }
