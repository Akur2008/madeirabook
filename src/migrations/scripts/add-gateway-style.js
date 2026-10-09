// One-off migration: колонка style для группировки шлюзов в галерее /gateways.
// Запуск: node src/migrations/scripts/add-gateway-style.js
require('dotenv').config();
const db = require('../../../db/client');

(async () => {
  try {
    await db.query(
      "ALTER TABLE emotional_gateways ADD COLUMN IF NOT EXISTS style VARCHAR(16) DEFAULT 'ocean'"
    );
    await db.query(
      "UPDATE emotional_gateways SET style = 'ocean' WHERE slug = 'ocean'"
    );
    // style: forest | sun | ocean | wild | terra
    console.log('Migration OK: emotional_gateways.style');
    process.exit(0);
  } catch (e) {
    console.error('Migration failed:', e.message);
    process.exit(1);
  }
})();
