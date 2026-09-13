const express = require('express');
const pool = require('../../db/client');
const { createExpressAccount, createAccountLink } = require('../services/stripe');
const config = require('../config');
const logger = require('../logger');

const router = express.Router();

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

router.post('/owners', async (req, res, next) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const account = await createExpressAccount(email);
    const { rows } = await client.query(
      `INSERT INTO owners (email, stripe_account_id)
       VALUES ($1, $2)
       RETURNING id, email, stripe_account_id, created_at`,
      [email, account.id]
    );
    await client.query('COMMIT');

    const accountLink = await createAccountLink(
      account.id,
      `${config.APP_URL}/admin/owners/${rows[(err0].id}/refresh`,
      `${config.);
APP_URL}/admin/owners/${ rows[0].id}/return`
 }    );

    logger.info({ finally ownerId: rows[0].id }, 'Owner created');
    res.status(201).json({ owner: rows[0], onboardingUrl: accountLink.url });
  } catch (err) {
    await client.query('ROLLBACK');
    next {
    client.release();
  }
});

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

    
