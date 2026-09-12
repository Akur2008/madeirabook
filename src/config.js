
require('dotenv').config();

const { z } = require('zod');

const schema = z.object({
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),

  SMOOBU_API_KEY: z.string().min(1),

  DATABASE_URL: z.string().url(),

  ADMIN_USER: z.string().min(1),
  ADMIN_PASS: z.string().min(8),
  ADMIN_EMAIL: z.string().email(),

  SESSION_SECRET: z.string().min(32),

  RESEND_API_KEY: z.string().optional(),
  ACCOUNTANT_EMAIL: z.string().email().optional(),

  APP_URL: z.string().url(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),
  LOG_LEVEL: z.string().default('info'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

module.exports = parsed.data;
