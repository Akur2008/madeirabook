p = 'scripts/import-gateways.js'
s = open(p, encoding='utf-8').read()

# 1. Заменяем slugify-логику на явную карту
old1 = """// === Карта имён → slug ===
// Читается из labels.txt
function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}"""

new1 = """// === Явная карта baseName → slug ===
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
}"""

if old1 not in s: print('FAIL 1'); exit(1)
s = s.replace(old1, new1, 1)

# 2. Используем SLUG_MAP при импорте
old2 = "    const slug = slugify(item.title) || slugify(baseName);"
new2 = "    const slug = SLUG_MAP[baseName] || slugify(baseName);"
if old2 not in s: print('FAIL 2'); exit(1)
s = s.replace(old2, new2, 1)

# 3. Убираем subtitle про "два вопроса" — теперь 3 ступени
old3 = "'Two questions. Then we show you the place.',"
new3 = "'Three steps. Then we show you the place.',"
if old3 not in s: print('FAIL 3'); exit(1)
s = s.replace(old3, new3, 1)

open(p, 'w', encoding='utf-8').write(s)
print('OK')
