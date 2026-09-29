const fs = require('fs');
const path = require('path');
const db = require('./client');

const DATA_FILE = path.join(__dirname, 'valuable-legacy-data.json');

async function seedOwners(client, owners) {
  for (const o of owners) {
    await client.query(
      'INSERT INTO owners '
      + '(id, email, stripe_account_id, stripe_customer_id, password_hash, '
      + 'rnal, onboarding_token, telegram_id, created_at) '
      + 'VALUES ($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9, NOW())) '
      + 'ON CONFLICT (email) DO UPDATE SET '
      + 'stripe_account_id = COALESCE(EXCLUDED.stripe_account_id, owners.stripe_account_id), '
      + 'stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, owners.stripe_customer_id), '
      + 'rnal = COALESCE(EXCLUDED.rnal, owners.rnal), '
      + 'onboarding_token = COALESCE(owners.onboarding_token, EXCLUDED.onboarding_token)',
      [
        o.id, o.email, o.stripe_account_id, o.stripe_customer_id,
        o.password_hash, o.rnal, o.onboarding_token, o.telegram_id, o.created_at
      ]
    );
  }
}

async function seedProperties(client, properties) {
  for (const p of properties) {
    await client.query(
      'INSERT INTO properties '
      + '(id, smoobu_id, owner_id, commission_percent, charges_enabled, pms, type, created_at) '
      + 'VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8, NOW())) '
      + 'ON CONFLICT (smoobu_id) DO UPDATE SET '
      + 'owner_id = EXCLUDED.owner_id, '
      + 'commission_percent = EXCLUDED.commission_percent, '
      + 'charges_enabled = EXCLUDED.charges_enabled, '
      + 'pms = EXCLUDED.pms, '
      + 'type = EXCLUDED.type',
      [
        p.id, p.smoobu_id, p.owner_id, p.commission_percent,
        p.charges_enabled, p.pms, p.type, p.created_at
      ]
    );
  }
}

async function seedSubscribers(client, subscribers) {
  for (const s of subscribers) {
    await client.query(
      'INSERT INTO subscribers (id, email, source, telegram_id, created_at) '
      + 'VALUES ($1,$2,$3,$4,COALESCE($5, NOW())) '
      + 'ON CONFLICT (email) DO NOTHING',
      [s.id, s.email, s.source, s.telegram_id, s.created_at]
    );
  }
}

// Строки вставляются с явными id, поэтому последовательности нужно
// перевести на максимальный существующий id — иначе следующая вставка
// без id падает с duplicate key.
async function resyncSequences(client, tables) {
  for (const table of tables) {
    await client.query(
      "SELECT setval(pg_get_serial_sequence($1, 'id'), "
      + 'COALESCE((SELECT MAX(id) FROM ' + table + '), 0) + 1, false)',
      [table]
    );
  }
}

async function seed() {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const owners = data.owners || [];
  const properties = data.properties || [];
  const subscribers = data.subscribers || [];

  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    await seedOwners(client, owners);
    await seedProperties(client, properties);
    await seedSubscribers(client, subscribers);
    await resyncSequences(client, ['owners', 'properties', 'subscribers']);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  return {
    owners: owners.length,
    properties: properties.length,
    subscribers: subscribers.length
  };
}

if (require.main === module) {
  seed()
    .then((counts) => {
      console.log(
        '✅ Seed applied: owners=' + counts.owners
        + ', properties=' + counts.properties
        + ', subscribers=' + counts.subscribers
      );
      return db.pool.end();
    })
    .then(() => process.exit(0))
    .catch((e) => {
      console.error('❌ Seed failed:', e.message);
      process.exit(1);
    });
}

module.exports = { seed };
