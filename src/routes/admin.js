import express from 'express';
import pool from '../../db/client.js';
import { createExpressAccount, createAccountLink } from '../services/stripe.js';
import config from '../config.js';
import logger from '../logger.js';

const router = express.Router();

/**
 * GET /admin/owners
 * Список всех владельцев
 */
router.get('/owners', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, email, stripe_account_id, rnal, telegram_id, created_at
       FROM owners ORDER BY created_at DESC`
    );
    res.json({ owners: rows });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /admin/owners
 * Создать владельца + Stripe Express аккаунт + ссылку на онбординг
 * Body: { email }
 */
router.post('/owners', async (req, res, next) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Создать Express аккаунт в Stripe
    const account = await createExpressAccount(email);

    // 2. Сохранить владельца в БД
    const { rows } = await client.query(
      `INSERT INTO owners (email, stripe_account_id)
       VALUES ($1, $2)
       RETURNING id, email, stripe_account_id, created_at`,
      [email, account.id]
    );

    await client.query('COMMIT');

    // 3. Сгенерировать ссылку онбординга
    const accountLink = await createAccountLink(
      account.id,
      `${config.APP_URL}/admin/owners/${rows[0].id}/refresh`,
      `${config.APP_URL}/admin/owners/${rows[0].id}/return`
    );

    logger.info({ ownerId: rows[0].id }, 'Owner created');
    res.status(201).json({ owner: rows[0], onboardingUrl: accountLink.url });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

/**
 * GET /admin/properties
 * Список всех апартаментов с владельцами
 */
router.get('/properties', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.id, p.smoobu_id, p.commission_percent, p.charges_enabled,
              p.created_at, o.email AS owner_email, o.id AS owner_id
       FROM properties p
       JOIN owners o ON o.id = p.owner_id
       ORDER BY p.created_at DESC`
    );
    res.json({ properties: rows });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /admin/properties
 * Создать апартамент
 * Body: { smoobu_id, owner_id, commission_percent }
 */
router.post('/properties', async (req, res, next) => {
  const { smoobu_id, owner_id, commission_percent } = req.body;
  if (!smoobu_id || !owner_id) {
    return res.status(400).json({ error: 'smoobu_id and owner_id required' });
  }

  const percent = commission_percent ?? 12.0;
  if (percent < 0 || percent > 100) {
    return res.status(400).json({ error: 'commission_percent must be 0..100' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO properties (smoobu_id, owner_id, commission_percent)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [smoobu_id, owner_id, percent]
    );
    res.status(201).json({ property: rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'smoobu_id already exists' });
    }
    next(err);
  }
});

/**
 * PATCH /admin/properties/:id/commission
 * Изменить комиссию + записать в commission_history
 * Body: { commission_percent, changed_by }
 */
router.patch('/properties/:id/commission', async (req, res, next) => {
  const { id } = req.params;
  const { commission_percent, changed_by } = req.body;

  if (commission_percent == null || commission_percent < 0 || commission_percent > 100) {
    return res.status(400).json({ error: 'commission_percent must be 0..100' });
  }
  if (!changed_by) {
    return res.status(400).json({ error: 'changed_by required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Читаем текущую комиссию
    const { rows: current } = await client.query(
      'SELECT commission_percent FROM properties WHERE id = $1 FOR UPDATE',
      [id]
    );
    if (current.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'property not found' });
    }

    const oldPercent = current[0].commission_percent;

    // Обновляем
    await client.query(
      'UPDATE properties SET commission_percent = $1 WHERE id = $2',
      [commission_percent, id]
    );

    // Пишем в историю
    await client.query(
      `INSERT INTO commission_history
         (property_id, old_percent, new_percent, changed_by)
       VALUES ($1, $2, $3, $4)`,
      [id, oldPercent, commission_percent, changed_by]
    );

    await client.query('COMMIT');

    logger.info({ propertyId: id, oldPercent, newPercent: commission_percent, changed_by },
                'Commission updated');
    res.json({ ok: true, oldPercent, newPercent: commission_percent });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

/**
 * GET /admin/commission-history/:propertyId
 */
router.get('/commission-history/:propertyId', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, old_percent, new_percent, changed_by, changed_at
       FROM commission_history
       WHERE property_id = $1
       ORDER BY changed_at DESC`,
      [req.params.propertyId]
    );
    res.json({ history: rows });
  } catch (err) {
    next(err);
  }
});

export default router;
