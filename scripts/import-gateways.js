#!/usr/bin/env node
/**
 * import-gateways.js — загрузка шлюзов из ~/madeirabook-media/ в R2 + Neon.
 *
 * Читает ~/madeirabook-media/labels.txt в формате:
 *   filename.mp4 | Название | стихия | V
 *
 * Для каждого файла:
 *   1. Загружает видео из out-video/ в R2 → gateways/{slug}.mp4
 *   2. Загружает постер из out-poster/ в R2 → gateways/{slug}.jpg
 *   3. Загружает аудио из out-audio/ в R2 (если есть) → gateways/{slug}.m4a
 *   4. INSERT/UPDATE в emotional_gateways
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { Pool } = require('pg');

const HOME = process.env.HOME;
const BASE = path.join(HOME, 'madeirabook-media');
const LABELS = path.join(BASE, 'labels.txt');
const BUCKET = 'madeirabook-sounds';

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});

// === Явная карта baseName → slug ===
const SLUG_MAP = {
  '176': 'surfers',
  '291168': 'sunset-ocean',
  '335455': 'laurisilva',
  'Delfiny… na Maderze można podziwiać je w ich naturalnym środowisku przez cały rok 🐬 #madera #wy': 'dolphins',
  'SaveClip.App_AQNEl1AApOeyErIfbBaX91i5QOdd7HygD5VFSJ9HYgjetXyTBBYeBD46NltDBkxKTWHsaFG_spSNzugrVTGXgXlAb_OCTxIP0BwJ8OU 2': 'clouds-mountains',
  'SaveInsta.App - 2659110993453920751': 'catamaran',
  'Video by azorean.fpv': 'above-clouds',
  'Video by droneilhadamadeira': 'drone-peak-ocean',
  'Video by maxmotionlab': 'airport-takeoff',
  'Video by mogacaptures': 'airport-landing',
  'Video by vh.fpv (1)': 'levada-drone',
  'Video by vh.fpv': 'drone-peak-ocean-2',
  'Video by vipdolphins': 'dolphin-large',
  'Video by xtravel.madeira': 'mountains-mix',
  'tweeload_zl8m3rd3': 'cruise-ship',
  'vertical-20s-v1': 'forest-flowers',
  'vertical-full-v13': 'surfers-2',
};

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

// Стандартные 3 вопроса для всех новых шлюзов
// (можно будет переопределить в БД позже)
function defaultQuestions(style) {
  const qs = {
    ocean: [
      { question: 'Что тянет к океану?', answers: [
        { label: 'Шум волн', tags: ['vibe:oceanfront', 'sound:waves'] },
        { label: 'Тишина у воды', tags: ['vibe:quiet', 'sound:silence'] },
      ]},
      { question: 'Ваш ритм?', answers: [
        { label: 'Медленное утро', tags: ['pace:slow'] },
        { label: 'Активный день', tags: ['pace:active'] },
      ]},
      { question: 'Вы с кем?', answers: [
        { label: 'Вдвоём', tags: ['party:couple'] },
        { label: 'Один', tags: ['party:solo'] },
        { label: 'С семьёй', tags: ['party:family'] },
      ]},
    ],
    forest: [
      { question: 'Что ищете в лесу?', answers: [
        { label: 'Запах эвкалипта', tags: ['vibe:forest', 'sense:smell'] },
        { label: 'Тишину среди деревьев', tags: ['vibe:quiet'] },
      ]},
      { question: 'Ваш ритм?', answers: [
        { label: 'Медленная прогулка', tags: ['pace:slow'] },
        { label: 'Треккинг', tags: ['pace:active', 'activity:hike'] },
      ]},
      { question: 'Вы с кем?', answers: [
        { label: 'Вдвоём', tags: ['party:couple'] },
        { label: 'Один', tags: ['party:solo'] },
        { label: 'С семьёй', tags: ['party:family'] },
      ]},
    ],
    sun: [
      { question: 'Что ищете под солнцем?', answers: [
        { label: 'Тепло на коже', tags: ['vibe:sunny'] },
        { label: 'Свет для души', tags: ['vibe:bright'] },
      ]},
      { question: 'Ваш ритм?', answers: [
        { label: 'Утро у моря', tags: ['pace:slow'] },
        { label: 'Закат на воде', tags: ['pace:sunset'] },
      ]},
      { question: 'Вы с кем?', answers: [
        { label: 'Вдвоём', tags: ['party:couple'] },
        { label: 'Один', tags: ['party:solo'] },
        { label: 'С семьёй', tags: ['party:family'] },
      ]},
    ],
    wild: [
      { question: 'Что зовёт?', answers: [
        { label: 'Свобода', tags: ['vibe:wild'] },
        { label: 'Адреналин', tags: ['vibe:adventure'] },
      ]},
      { question: 'Ваш ритм?', answers: [
        { label: 'Созерцание', tags: ['pace:slow'] },
        { label: 'Движение', tags: ['pace:active'] },
      ]},
      { question: 'Вы с кем?', answers: [
        { label: 'Вдвоём', tags: ['party:couple'] },
        { label: 'Один', tags: ['party:solo'] },
        { label: 'С семьёй', tags: ['party:family'] },
      ]},
    ],
    terra: [
      { question: 'Что ищете на земле?', answers: [
        { label: 'Скалы и вулканы', tags: ['vibe:terra', 'land:volcanic'] },
        { label: 'Высоту и обзор', tags: ['vibe:panorama'] },
      ]},
      { question: 'Ваш ритм?', answers: [
        { label: 'Медленное созерцание', tags: ['pace:slow'] },
        { label: 'Восхождение', tags: ['pace:active'] },
      ]},
      { question: 'Вы с кем?', answers: [
        { label: 'Вдвоём', tags: ['party:couple'] },
        { label: 'Один', tags: ['party:solo'] },
        { label: 'С семьёй', tags: ['party:family'] },
      ]},
    ],
  };
  return qs[style] || qs.ocean;
}

// === Загрузка файла в R2 ===
async function uploadFile(localPath, remotePath, mimeType) {
  if (!fs.existsSync(localPath)) return null;
  const buf = fs.readFileSync(localPath);
  const cmd = new PutObjectCommand({
    Bucket: BUCKET,
    Key: remotePath,
    Body: buf,
    ContentType: mimeType,
  });
  await s3.send(cmd);
  return process.env.R2_PUBLIC_URL + '/' + remotePath;
}

// === Читаем labels.txt ===
function parseLabels() {
  const lines = fs.readFileSync(LABELS, 'utf8').split('\n');
  const items = [];
  for (const line of lines) {
    if (!line.trim() || line.startsWith('#')) continue;
    const parts = line.split('|').map(s => s.trim());
    if (parts.length < 4) continue;
    const [filename, title, style, orient] = parts;
    if (orient !== 'V') continue; // только вертикальные
    if (!title || !style) continue;
    items.push({ filename, title, style, orient });
  }
  return items;
}

(async () => {
  console.log('📦 База:', BASE);
  console.log('📋 labels:', LABELS);

  const items = parseLabels();
  console.log('Найдено вертикальных размеченных:', items.length);

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  const stats = { video: 0, poster: 0, audio: 0, db: 0, errors: [] };

  for (const item of items) {
    const baseName = item.filename.replace(/\.(mp4|mov|m4v)$/i, '');
    const slug = SLUG_MAP[baseName] || slugify(baseName);

    console.log('\n▶ ' + slug + '  (' + item.title + ' | ' + item.style + ')');

    try {
      // 1. Видео
      const videoLocal = path.join(BASE, 'out-video', baseName + '.mp4');
      const videoUrl = await uploadFile(videoLocal, 'gateways/' + slug + '.mp4', 'video/mp4');
      if (videoUrl) { console.log('  🎥 видео ✓'); stats.video++; }
      else console.log('  ⚠️ видео не найдено:', videoLocal);

      // 2. Постер
      const posterLocal = path.join(BASE, 'out-poster', baseName + '.jpg');
      const posterUrl = await uploadFile(posterLocal, 'gateways/' + slug + '.jpg', 'image/jpeg');
      if (posterUrl) { console.log('  🖼  постер ✓'); stats.poster++; }
      else console.log('  ⚠️ постер не найден');

      // 3. Аудио (может не быть)
      const audioLocal = path.join(BASE, 'out-audio', baseName + '.m4a');
      const audioUrl = await uploadFile(audioLocal, 'gateways/' + slug + '.m4a', 'audio/mp4');
      if (audioUrl) { console.log('  🔊 аудио ✓'); stats.audio++; }
      else console.log('  ⚠️ аудио не найдено (норм)');

      // 4. INSERT в БД
      const questions = defaultQuestions(item.style);
      await pool.query(
        `INSERT INTO emotional_gateways
         (slug, title, subtitle, style, poster_url, video_url, audio_url, questions, target_route, accent_color, status, display_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'published', 0)
         ON CONFLICT (slug) DO UPDATE SET
           title = EXCLUDED.title,
           subtitle = EXCLUDED.subtitle,
           style = EXCLUDED.style,
           poster_url = EXCLUDED.poster_url,
           video_url = EXCLUDED.video_url,
           audio_url = EXCLUDED.audio_url,
           questions = EXCLUDED.questions,
           updated_at = NOW()`,
        [
          slug,
          item.title,
          'Three steps. Then we show you the place.',
          item.style,
          posterUrl,
          videoUrl,
          audioUrl,
          JSON.stringify(questions),
          '/p/apartamentos-do-mar-303',
          '#0891B2',
        ]
      );
      console.log('  ✅ БД OK');
      stats.db++;
    } catch (e) {
      console.log('  ❌ ERR:', e.message);
      stats.errors.push({ slug, error: e.message });
    }
  }

  await pool.end();
  console.log('\n=== ГОТОВО ===');
  console.log('Видео:', stats.video);
  console.log('Постеров:', stats.poster);
  console.log('Аудио:', stats.audio);
  console.log('Записей в БД:', stats.db);
  if (stats.errors.length) {
    console.log('Ошибки:', stats.errors.length);
    stats.errors.forEach(e => console.log('  ' + e.slug + ': ' + e.error));
  }
  process.exit(0);
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
