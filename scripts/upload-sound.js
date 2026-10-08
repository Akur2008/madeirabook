/**
 * Загрузка звука в Cloudflare R2 + запись в таблицу sounds.
 * Использование:
 *   node scripts/upload-sound.js <local-file> <slug> <title> <category> [is_default]
 * Пример:
 *   node scripts/upload-sound.js ~/Downloads/gateway-ocean/ocean-ambient-20s.m4a ocean-ambient "Ocean Ambience" ambient true
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { Pool } = require('pg');

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET = 'madeirabook-sounds';

(async () => {
  const [,, localPath, slug, title, category, isDefaultArg] = process.argv;

  if (!localPath || !slug || !title || !category) {
    console.error('Usage: node scripts/upload-sound.js <file> <slug> <title> <category> [is_default]');
    process.exit(1);
  }

  const isDefault = isDefaultArg === 'true' || isDefaultArg === '1';

  if (!fs.existsSync(localPath)) {
    console.error('File not found:', localPath);
    process.exit(1);
  }

  const fileBuf = fs.readFileSync(localPath);
  const ext = path.extname(localPath);
  const key = 'sounds/' + slug + ext;

  console.log('Uploading', localPath, '→', key, '(' + Math.round(fileBuf.length / 1024) + ' KB)');

  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: fileBuf,
    ContentType: ext === '.m4a' ? 'audio/mp4' : (ext === '.mp3' ? 'audio/mpeg' : 'audio/wav'),
  }));

  const publicUrl = process.env.R2_PUBLIC_URL + '/' + key;
  console.log('Uploaded →', publicUrl);

  // Простая оценка duration (не идеально, но работает)
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query(
    `INSERT INTO sounds (slug, title, category, file_url, is_default, status)
     VALUES ($1, $2, $3, $4, $5, 'published')
     ON CONFLICT (slug) DO UPDATE SET
       title = EXCLUDED.title,
       category = EXCLUDED.category,
       file_url = EXCLUDED.file_url,
       is_default = EXCLUDED.is_default,
       updated_at = NOW()`,
    [slug, title, category, publicUrl, isDefault]
  );
  console.log('DB row saved: slug=' + slug);

  await pool.end();
  process.exit(0);
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
