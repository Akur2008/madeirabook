// Компиляция Tailwind (tailwind.config.ts + src/styles/globals.css).
// Результат кладём и в public/ (для статических хостов), и в
// src/views/generated-styles.js — его отдаёт приложение на Vercel.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const INPUT = path.join(ROOT, 'src', 'styles', 'globals.css');
const CONFIG = path.join(ROOT, 'tailwind.config.ts');
const MODULE_FILE = path.join(ROOT, 'src', 'views', 'generated-styles.js');
const PUBLIC_ASSETS = path.join(ROOT, 'public', 'assets');

function buildCss() {
  const bin = path.join(ROOT, 'node_modules', '.bin', 'tailwindcss');
  const out = execFileSync(
    bin,
    ['--config', CONFIG, '--input', INPUT, '--minify'],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );
  return out.toString().trim();
}

function write(css) {
  const hash = crypto.createHash('sha1').update(css).digest('hex').slice(0, 10);

  fs.writeFileSync(
    MODULE_FILE,
    '// Сгенерировано `npm run build` из src/styles/globals.css. Не редактировать.\n'
    + 'module.exports = {\n'
    + "  hash: '" + hash + "',\n"
    + '  css: ' + JSON.stringify(css) + '\n'
    + '};\n'
  );

  fs.mkdirSync(PUBLIC_ASSETS, { recursive: true });
  fs.writeFileSync(path.join(PUBLIC_ASSETS, 'site.' + hash + '.css'), css);

  return { hash: hash, bytes: Buffer.byteLength(css) };
}

module.exports = function buildStyles() {
  return write(buildCss());
};
