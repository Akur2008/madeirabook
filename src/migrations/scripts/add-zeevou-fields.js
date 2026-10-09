// One-off migration: поле pms для мульти-PMS (smoobu | zeevou | external).
// ID объекта в Zeevou хранится в существующей колонке properties.pms_property_id.
// Запуск: node src/migrations/scripts/add-zeevou-fields.js
require('dotenv').config();
const db = require('../../../db/client');

(async () => {
  try {
    await db.query(
      "ALTER TABLE properties ADD COLUMN IF NOT EXISTS pms VARCHAR(16) DEFAULT 'smoobu'"
    );
    // pms: smoobu | zeevou | external
    console.log('Migration OK: properties.pms');
    process.exit(0);
  } catch (e) {
    console.error('Migration failed:', e.message);
    process.exit(1);
  }
})();
