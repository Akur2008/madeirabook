const express = require('express')
const router = express.Router()
const { validateInitData } = require('../services/telegramAuth')

/**
 * POST /api/auth/telegram
 * Body: { initData: string }
 * Response: { ok: true, user: {...}, role: 'guest'|'owner' }
 */
router.post('/telegram', function (req, res) {
  const initData = req.body && req.body.initData
  const result = validateInitData(initData)

  if (!result) {
    return res.status(401).json({ ok: false, error: 'invalid_init_data' })
  }

  const user = result.user
  const role = 'guest'

  req.session.userId = user.id
  req.session.role = role

  res.json({ ok: true, user: user, role: role })
})

/**
 * GET /api/auth/me
 * Возвращает текущую сессию (если есть).
 */
router.get('/me', function (req, res) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ ok: false, error: 'no_session' })
  }
  res.json({ ok: true, userId: req.session.userId, role: req.session.role })
})

/**
 * POST /api/auth/logout
 */
router.post('/logout', function (req, res) {
  req.session.destroy(function () {
    res.json({ ok: true })
  })
})

module.exports = router
