const express = require('express');
const { z } = require('zod');
const { Resend } = require('resend');
const db = require('../../db/client');

const router = express.Router();
const resend = new Resend(process.env.RESEND_API_KEY);

const subscribeSchema = z.object({
  email: z.string().email(),
  source: z.string().optional().default('website')
});

router.post('/', async (req, res) => {
  try {
    const { email, source } = subscribeSchema.parse(req.body);

    await db.query(
      'INSERT INTO subscribers (email, source) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING',
      [email, source]
    );

    const pdfResponse = await fetch('https://www.madeirabook.com/madeira-guide.pdf');
    if (!pdfResponse.ok) throw new Error('Could not fetch PDF');
    const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());

    await resend.emails.send({
      from: 'Madeirabook <hello@madeirabook.com>',
      to: email,
      subject: 'Your Madeira Travel Guide 🌴',
      text: 'Thanks for subscribing! Your Madeira travel guide is attached.\n\nGet restaurant discounts and insider tips in Telegram: https://t.me/Madeirabookbot?start=pdf_guide',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
          <h2 style="color: #064e3b;">Thanks for subscribing!</h2>
          <p>Your Madeira travel guide is attached to this email.</p>
          <p style="margin: 24px 0;">
            <a href="https://t.me/Madeirabookbot?start=pdf_guide" style="display: inline-block; padding: 14px 28px; background: #10b981; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold;">Open Telegram bot</a>
          </p>
          <p style="color: #6b7280; font-size: 14px;">Inside you'll find restaurant discounts of 30–50%, flight price alerts, and other useful guides for your trip to Madeira.</p>
          <p style="color: #6b7280; font-size: 14px;">— The Madeirabook team</p>
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
