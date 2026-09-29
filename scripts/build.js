// Сборка: проверяем синтаксис всех модулей и генерируем статику для SEO.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { buildRobotsTxt, buildSitemapXml } = require('../src/seo/generate');
const buildStyles = require('./build-css');

const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');

function collectJsFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return collectJsFiles(full);
    return entry.isFile() && entry.name.endsWith('.js') ? [full] : [];
  });
}

function checkSyntax() {
  const files = collectJsFiles(path.join(ROOT, 'src'))
    .concat(collectJsFiles(path.join(ROOT, 'db')).filter((f) => f.endsWith('.js')))
    .concat([path.join(ROOT, 'api', 'index.js')]);

  files.forEach((file) => {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  });

  return files.length;
}

function writeStatic() {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  fs.writeFileSync(path.join(PUBLIC_DIR, 'robots.txt'), buildRobotsTxt());
  fs.writeFileSync(path.join(PUBLIC_DIR, 'sitemap.xml'), buildSitemapXml());
}

try {
  const styles = buildStyles();
  const checked = checkSyntax();
  writeStatic();
  console.log('✅ Build OK: ' + checked + ' modules checked, '
    + 'site.' + styles.hash + '.css (' + styles.bytes + ' bytes), '
    + 'public/robots.txt and public/sitemap.xml generated');
} catch (e) {
  console.error('❌ Build failed:', e.message);
  process.exit(1);
}
