#!/usr/bin/env node
/**
 * prepare-media.js — подготовка медиа для эмоциональных шлюзов.
 *
 * Использование:
 *   node scripts/prepare-media.js video   # src-video → out-video + out-poster
 *   node scripts/prepare-media.js audio   # src-audio → out-audio
 *   node scripts/prepare-media.js combo   # src-combo → out-video + out-audio + out-poster
 *   node scripts/prepare-media.js all     # всё подряд
 *
 * Требования: ffmpeg (бинарник в ~/Downloads/ffmpeg или в PATH).
 */
const { execFileSync, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const HOME = process.env.HOME;
const BASE = path.join(HOME, 'madeirabook-media');
const DIRS = {
  srcVideo: path.join(BASE, 'src-video'),
  srcAudio: path.join(BASE, 'src-audio'),
  srcCombo: path.join(BASE, 'src-combo'),
  outVideo: path.join(BASE, 'out-video'),
  outAudio: path.join(BASE, 'out-audio'),
  outPoster: path.join(BASE, 'out-poster'),
};

function findFfmpeg() {
  const candidates = [
    path.join(HOME, 'Downloads', 'ffmpeg'),
    '/usr/local/bin/ffmpeg',
    '/opt/homebrew/bin/ffmpeg',
  ];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  try {
    const w = execSync('which ffmpeg').toString().trim();
    if (w) return w;
  } catch (_) {}
  return null;
}

const FFMPEG = findFfmpeg();
if (!FFMPEG) {
  console.error('❌ ffmpeg не найден. Положи бинарник в ~/Downloads/ffmpeg');
  process.exit(1);
}
console.log('🎬 ffmpeg:', FFMPEG);

function listFiles(dir, exts) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => !f.startsWith('.') && exts.includes(path.extname(f).toLowerCase()))
    .map(f => path.join(dir, f));
}

function isVideo(f) { return ['.mp4', '.mov', '.m4v', '.avi', '.mkv'].includes(path.extname(f).toLowerCase()); }
function isAudio(f) { return ['.wav', '.m4a', '.mp3', '.aac', '.flac'].includes(path.extname(f).toLowerCase()); }

function ok(file) {
  try { return fs.statSync(file).size > 1000; } catch { return false; }
}

// Сжимаем видео без звука + генерируем постер
function processVideo(src) {
  const name = path.basename(src, path.extname(src));
  const out = path.join(DIRS.outVideo, name + '.mp4');
  const poster = path.join(DIRS.outPoster, name + '.jpg');

  if (!ok(out)) {
    console.log('  🎥 видео:', name);
    execFileSync(FFMPEG, [
      '-y', '-nostdin', '-i', src,
      '-vf', 'scale=1280:1280:force_original_aspect_ratio=decrease:force_divisible_by=2',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '28',
      '-pix_fmt', 'yuv420p', '-an',
      '-movflags', '+faststart',
      out,
    ], { stdio: ['ignore', 'ignore', 'inherit'] });
  } else {
    console.log('  🎥 видео:', name, '(уже готово)');
  }

  if (!ok(poster)) {
    console.log('  🖼  постер:', name);
    try {
      execFileSync(FFMPEG, [
        '-y', '-nostdin', '-ss', '2', '-i', src,
        '-vframes', '1', '-q:v', '3',
        '-vf', 'scale=1280:1280:force_original_aspect_ratio=decrease:force_divisible_by=2',
        poster,
      ], { stdio: ['ignore', 'ignore', 'inherit'] });
    } catch (_) {
      console.log('     ⚠️  постер не удалось (видео короче 2 сек?)');
    }
  }
}

// Извлекаем аудиодорожку + сжимаем в AAC 128k m4a
function processAudio(src, prefix) {
  const baseName = path.basename(src, path.extname(src));
  const name = prefix ? prefix + '-' + baseName : baseName;
  const out = path.join(DIRS.outAudio, name + '.m4a');

  if (ok(out)) {
    console.log('  🔊 аудио:', name, '(уже готово)');
    return;
  }
  console.log('  🔊 аудио:', name);
  try {
    execFileSync(FFMPEG, [
      '-y', '-nostdin', '-i', src,
      '-c:a', 'aac', '-b:a', '128k',
      out,
    ], { stdio: ['ignore', 'ignore', 'inherit'] });
  } catch (e) {
    console.log('     ⚠️  звука нет — пропускаю');
  }
}

// Извлекаем аудио ИЗ ВИДЕО (для combo)
function extractAudioFromVideo(src) {
  const name = path.basename(src, path.extname(src));
  const out = path.join(DIRS.outAudio, name + '.m4a');
  if (ok(out)) {
    console.log('  🔊 аудио (из видео):', name, '(уже готово)');
    return;
  }
  console.log('  🔊 аудио (из видео):', name);
  try {
    execFileSync(FFMPEG, [
      '-y', '-nostdin', '-i', src,
      '-vn', '-c:a', 'aac', '-b:a', '128k',
      out,
    ], { stdio: ['ignore', 'ignore', 'inherit'] });
  } catch (e) {
    console.log('     ⚠️  звука нет — пропускаю (это норма для большинства видео)');
  }
}

function cmdVideo() {
  const files = listFiles(DIRS.srcVideo, ['.mp4', '.mov', '.m4v', '.avi', '.mkv']);
  console.log('📹 src-video:', files.length, 'файлов');
  files.forEach(f => processVideo(f));
}

function cmdAudio() {
  const files = listFiles(DIRS.srcAudio, ['.wav', '.m4a', '.mp3', '.aac', '.flac']);
  console.log('🔊 src-audio:', files.length, 'файлов');
  files.forEach(f => processAudio(f));
}

function cmdCombo() {
  const files = listFiles(DIRS.srcCombo, ['.mp4', '.mov', '.m4v', '.avi', '.mkv']);
  console.log('🎬 src-combo:', files.length, 'файлов');
  for (const f of files) {
    processVideo(f);           // видео в out-video
    extractAudioFromVideo(f);  // аудио из этого же файла в out-audio
  }
}

const cmd = process.argv[2] || 'all';
console.log('📦 База:', BASE);
console.log('🎯 Команда:', cmd);
console.log('');

if (cmd === 'video') cmdVideo();
else if (cmd === 'audio') cmdAudio();
else if (cmd === 'combo') cmdCombo();
else if (cmd === 'all') { cmdVideo(); cmdAudio(); cmdCombo(); }
else { console.error('❌ Неизвестная команда:', cmd); process.exit(1); }

console.log('');
console.log('✅ Готово.');
console.log('   out-video :', listFiles(DIRS.outVideo, ['.mp4']).length, 'файлов');
console.log('   out-audio :', listFiles(DIRS.outAudio, ['.m4a']).length, 'файлов');
console.log('   out-poster:', listFiles(DIRS.outPoster, ['.jpg']).length, 'файлов');
