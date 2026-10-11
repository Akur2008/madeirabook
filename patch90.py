p = 'src/routes/sounds.js'
s = open(p, encoding='utf-8').read()

# Заменяем блок с логикой поиска звука
old = """    // Пока простая логика: если page начинается с /gateway/ — ищем звук с этим слагом,
    // иначе — is_default
    let row = null;

    const m = page.match(/^\\/gateway\\/([a-z0-9-]+)/i);
    if (m) {
      const r = await db.query(
        "SELECT slug, title, file_url, duration_sec FROM sounds WHERE slug = $1 AND status = 'published' LIMIT 1",
        [m[1] + '-ambient']
      );
      if (r.rows.length) row = r.rows[0];
    }

    if (!row) {
      const r = await db.query(
        "SELECT slug, title, file_url, duration_sec FROM sounds WHERE is_default = true AND status = 'published' LIMIT 1"
      );
      if (r.rows.length) row = r.rows[0];
    }"""

new = """    let row = null;

    // 1. Если это /gateway/:slug — берём audio_url из emotional_gateways
    const gw = page.match(/^\\/gateway\\/([a-z0-9-]+)/i);
    if (gw) {
      const slug = gw[1];
      const g = await db.query(
        "SELECT slug, title, audio_url FROM emotional_gateways WHERE slug = $1 AND status = 'published' LIMIT 1",
        [slug]
      );
      if (g.rows.length && g.rows[0].audio_url) {
        return res.json({
          ok: true,
          sound: {
            slug: g.rows[0].slug,
            title: g.rows[0].title,
            url: g.rows[0].audio_url,
            duration: null,
          },
        });
      }
    }

    // 2. Иначе — общий ambient (is_default)
    const r = await db.query(
      "SELECT slug, title, file_url, duration_sec FROM sounds WHERE is_default = true AND status = 'published' LIMIT 1"
    );
    if (r.rows.length) row = r.rows[0];"""

if old not in s:
    print('FAIL: не нашёл блок логики')
    exit(1)
s = s.replace(old, new, 1)
open(p, 'w', encoding='utf-8').write(s)
print('OK')
