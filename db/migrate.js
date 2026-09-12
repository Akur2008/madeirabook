const fs = require('fs');
const path = require('path');
const db = require('./client');

(async () => {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  try {
    await db.query(sql);
    console.log('✅ Migrations applied');
    process.exit(0);
  } catch (e) {
    console.error('❌ Migration failed:', e.message);
    process.exit(1);
  }
})();
