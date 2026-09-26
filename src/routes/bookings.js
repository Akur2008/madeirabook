const express = require('express')
const router = express.Router()
const db = require('../../db/client')
const { validateInitData } = require('../services/telegramAuth')

/**
 * GET /api/bookings/my
 * Header: X-Telegram-Init-Data: <initData>
 * Returns: { ok: true, bookings: [...] }
 */
router.get('/my', async function (req, res) {
  try {
    const initData = req.headers['x-telegram-init-data']
    const result = validateInitData(initData)
    if (!result) {
      return res.status(401).json({ ok: false, error: 'invalid_init_data' })
    }

    const telegramId = result.user.id

    const rows = await db.query(
      'SELECT id, property_id, status, arrival_date, departure_date, ' +
      'amount_cents, platform_fee_cents, source, created_at ' +
      'FROM bookings ' +
      'WHERE guest_telegram_id = $1 ' +
      'ORDER BY arrival_date DESC',
      [telegramId]
    )

    res.json({ ok: true, bookings: rows.rows, telegramId: telegramId })
  } catch (e) {
    console.error('bookings/my error:', e.message)
    res.status(500).json({ ok: false, error: 'server_error' })
  }
})

module.exports = router
