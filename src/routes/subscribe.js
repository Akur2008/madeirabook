const express = require('express');
const crypto = require('crypto');
const { z } = require('zod');
const { Resend } = require('resend');
const db = require('../../db/client');
const { unsubscribeFooter, unsubscribeUrl } = require('../emails/templates');

const router = express.Router();

const subscribeSchema = z.object({
  email: z.string().email(),
  source: z.string().optional().default('website')
});

router.post('/', async (req, res) => {
  try {
    const { email, source } = subscribeSchema.parse(req.body);

    if (!process.env.RESEND_API_KEY) {
      return res.status(503).json({ error: 'Email service not configured' });
    }
    const resend = new Resend(process.env.RESEND_API_KEY);

    // ON CONFLICT DO UPDATE (no-op) — чтобы получить id/token и при повторной подписке.
    // Существующий unsubscribe_token не перезаписываем: COALESCE берёт старый, если он есть.
    const ins = await db.query(
      `INSERT INTO subscribers (email, source, unsubscribe_token) VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE
         SET unsubscribe_token = COALESCE(subscribers.unsubscribe_token, EXCLUDED.unsubscribe_token)
       RETURNING id, unsubscribe_token, (xmax = 0) AS is_new`,
      [email, source, crypto.randomBytes(24).toString('hex')]
    );
    const subId = ins.rows[0].id;
    const unsubToken = ins.rows[0].unsubscribe_token;
    // Если подписчик новый — кладём 4 письма в очередь (welcome уже отправляется ниже)
    if (ins.rows[0].is_new) {
      await db.query(
        `INSERT INTO email_queue (subscriber_id, template, send_at) VALUES
          ($1, 'gateway_ocean',      NOW() + INTERVAL '1 day'),
          ($1, 'restaurants_funchal', NOW() + INTERVAL '7 days'),
          ($1, 'madeira_winter',     NOW() + INTERVAL '21 days'),
          ($1, 'return_offer',       NOW() + INTERVAL '45 days')`,
        [subId]
      );
    }

    const pdfResponse = await fetch('https://www.madeirabook.com/madeira-guide.pdf');
    if (!pdfResponse.ok) throw new Error('Could not fetch PDF');
    const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());

    await resend.emails.send({
      from: 'Madeirabook <hello@madeirabook.com>',
      to: email,
      replyTo: 'akur2013@gmail.com',
      subject: 'Your Madeira Travel Guide 🌴',
      text: 'Thanks for subscribing! Your Madeira travel guide is attached.\n\nGet restaurant discounts and insider tips in Telegram: https://t.me/Madeirabookbot?start=pdf_guide\n\nUnsubscribe: ' + unsubscribeUrl(unsubToken),
      headers: {
        'List-Unsubscribe': `<${unsubscribeUrl(unsubToken)}>, <mailto:hello@madeirabook.com?subject=unsubscribe>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
          <h2 style="color: #064e3b;">Thanks for subscribing!</h2>
          <p>Your Madeira travel guide is attached to this email.</p>
          <p style="margin: 24px 0;">
            <a href="https://t.me/Madeirabookbot?start=pdf_guide" style="display: inline-block; padding: 14px 28px; background: #10b981; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold;">Open Telegram bot</a>
          </p>
          <p style="color: #6b7280; font-size: 14px;">Inside you'll find restaurant discounts of 30–50%, flight price alerts, and other useful guides for your trip to Madeira.</p>
          <p style="color: #6b7280; font-size: 14px;">— The Madeirabook team</p>
          ${unsubscribeFooter(unsubToken)}
        </div>
      `,
      attachments: [
        {
          filename: 'madeira-guide.pdf',
          content: pdfBuffer.toString('base64'),
        },
      ],
    });

    res.json({ ok: true, message: 'Subscribed successfully!' });
  } catch (error) {
    console.error('Subscribe error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ ok: false, error: 'Invalid email' });
    }
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

module.exports = router;
