
const express = require('express');
const db = require('../../db/client');
const stripeSvc = require('../services/stripe');
const config = require('../config');

const router = express.Router();

function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, function (c) {
    var map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    return map[c];
  });
}

router.get('/', async (req, res, next) => {
  try {
    const q = 'SELECT p.smoobu_id, p.commission_percent, '
      + 'p.charges_enabled, o.id AS owner_id, '
      + 'o.email AS owner_email, o.stripe_account_id, '
      + 'o.rnal FROM properties p '
      + 'JOIN owners o ON o.id = p.owner_id '
      + 'ORDER BY p.created_at DESC';
    const result = await db.query(q);
    const rows = result.rows;

    let linkBox = '';
    if (req.query.link) {
      linkBox = '<div style="background:#e6f4ea;'
        + 'border:1px solid #34a853;padding:20px;'
        + 'border-radius:8px;margin-bottom:25px;">'
        + '<h3 style="margin-top:0;color:#137333;">'
        + 'Ссылка для владельца создана</h3>'
        + '<p>Объект: <b>'
        + escapeHtml(req.query.prop || '')
        + '</b> | Владелец: <b>'
        + escapeHtml(req.query.email || '')
        + '</b></p>'
        + '<input id="copyInput" value="'
        + escapeHtml(req.query.link)
        + '" readonly style="width:100%;padding:10px;">'
        + '<button onclick="navigator.clipboard.'
        + 'writeText(document.getElementById(\'copyInput\').value);'
        + 'alert(\'Скопировано\');">Скопировать</button>'
        + '</div>';
    }

    let list = '';
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      let kyc;
      if (r.charges_enabled) {
        kyc = '<span style="background:#28a745;color:#fff;'
          + 'padding:2px 8px;border-radius:4px;font-size:12px;">'
          + 'Активен</span>';
      } else {
        kyc = '<span style="background:#dc3545;color:#fff;'
          + 'padding:2px 8px;border-radius:4px;font-size:12px;">'
          + 'Не верифицирован</span>';
      }
      list += '<div style="background:#fff;padding:15px;'
        + 'margin-bottom:12px;border-radius:8px;'
        + 'border:1px solid #ddd;">'
        + '<b>Smoobu ID:</b> ' + escapeHtml(r.smoobu_id) + '<br>'
        + '<b>Email:</b> ' + escapeHtml(r.owner_email) + '<br>'
        + '<b>RNAL:</b> ' + escapeHtml(r.rnal || '—') + '<br>'
        + '<b>Stripe:</b> <code>'
        + escapeHtml(r.stripe_account_id || '—') + '</code><br>'
        + '<b>KYC:</b> ' + kyc + '<br>'
        + '<form action="/admin/update-commission" '
        + 'method="POST" style="margin-top:12px;">'
        + '<input type="hidden" name="smoobuId" value="'
        + escapeHtml(r.smoobu_id) + '">'
        + '<label>Комиссия, %:</label> '
        + '<input type="number" name="commissionPercent" value="'
        + r.commission_percent
        + '" min="0" max="100" step="0.5" required '
        + 'style="width:80px;"> '
        + '<button type="submit">Изменить</button>'
        + '</form></div>';
    }

    const html = '<html><head><meta charset="utf-8">'
      + '<title>Madeirabook Admin</title></head>'
      + '<body style="font-family:Arial;max-width:850px;'
      + 'margin:auto;padding:20px;background:#f4f6f8;">'
      + '<h2>Madeirabook Admin</h2>'
      + linkBox
      + '<div style="background:#fff;padding:20px;'
      + 'border-radius:8px;margin-bottom:25px;">'
      + '<h3>Привязать объект</h3>'
      + '<form action="/admin/create-owner" method="POST">'
      + '<input name="smoobuId" placeholder="Smoobu ID" required '
      + 'style="display:block;padding:8px;margin-bottom:8px;'
      + 'width:100%;">'
      + '<input name="email" type="email" '
      + 'placeholder="Email владельца" required '
      + 'style="display:block;padding:8px;margin-bottom:8px;'
      + 'width:100%;">'
      + '<input name="rnal" placeholder="RNAL" '
      + 'style="display:block;padding:8px;margin-bottom:8px;'
      + 'width:100%;">'
      + '<input name="commissionPercent" type="number" value="12" '
      + 'min="0" max="100" step="0.5" required '
      + 'style="display:block;padding:8px;margin-bottom:8px;'
      + 'width:100%;">'
      + '<button type="submit" style="padding:10px 20px;'
      + 'background:#635bff;color:#fff;border:none;'
      + 'border-radius:4px;">Создать ссылку</button>'
      + '</form></div>'
      + '<h3>Объекты</h3>'
      + (list || '<p>Пусто</p>')
      + '</body></html>';

    res.send(html);
  } catch (e) {
    next(e);
  }
});

router.post('/create-owner', async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const smoobuId = req.body.smoobuId;
    const cleanEmail = (req.body.email || '').trim().toLowerCase();
    const cleanPropId = String(smoobuId || '').trim();
    const rnal = req.body.rnal || null;
    const pct = parseFloat(req.body.commissionPercent || '12');

    if (!cleanEmail || !cleanPropId) {
      return res.status(400).json({ error: 'email и smoobuId обязательны' });
    }

    await client.query('BEGIN');

    // 1. Ищем существующего owner
    let ownerRes = await client.query('SELECT id, stripe_account_id FROM owners WHERE email = $1', [cleanEmail]);
    let ownerId;
    let stripeAccountId;
    let onboardingToken;

    if (ownerRes.rows.length) {
      ownerId = ownerRes.rows[0].id;
      stripeAccountId = ownerRes.rows[0].stripe_account_id;
      // Генерируем токен если его нет
      const t = require('crypto').randomUUID();
      await client.query(
        'UPDATE owners SET onboarding_token = COALESCE(onboarding_token, $1), rnal = $2 WHERE id = $3',
        [t, rnal, ownerId]
      );
      const tr = await client.query('SELECT onboarding_token FROM owners WHERE id = $1', [ownerId]);
      onboardingToken = tr.rows[0].onboarding_token;
    } else {
      // Создаём нового owner
      const t = require('crypto').randomUUID();
      const ins = await client.query(
        'INSERT INTO owners (email, rnal, onboarding_token) VALUES ($1, $2, $3) RETURNING id, onboarding_token',
        [cleanEmail, rnal, t]
      );
      ownerId = ins.rows[0].id;
      onboardingToken = ins.rows[0].onboarding_token;
    }

    // 2. Создаём Stripe Express аккаунт если его нет
    if (!stripeAccountId) {
      const account = await stripeSvc.createExpressAccount(cleanEmail);
      stripeAccountId = account.id;
      await client.query('UPDATE owners SET stripe_account_id = $1 WHERE id = $2', [stripeAccountId, ownerId]);
    }

    // 3. Привязываем property
    await client.query(
      'INSERT INTO properties (smoobu_id, owner_id, commission_percent) VALUES ($1, $2, $3) '
      + 'ON CONFLICT (smoobu_id) DO UPDATE SET owner_id = EXCLUDED.owner_id, commission_percent = EXCLUDED.commission_percent',
      [cleanPropId, ownerId, pct]
    );

    await client.query('COMMIT');

    // 4. Возвращаем JSON с ПЕРМАНЕНТНОЙ ссылкой
    const permalink = 'https://madeirabook-core.vercel.app/owner/onboarding/' + onboardingToken;
    console.log('=== OWNER CREATED ===');
    console.log('email:', cleanEmail);
    console.log('owner_id:', ownerId);
    console.log('stripe_account_id:', stripeAccountId);
    console.log('onboarding_token:', onboardingToken);
    console.log('permalink:', permalink);
    console.log('=====================');

    res.json({
      ok: true,
      owner_id: ownerId,
      email: cleanEmail,
      stripe_account_id: stripeAccountId,
      onboarding_token: onboardingToken,
      permalink: permalink,
      message: 'Отправь эту ссылку владельцу — она бессрочная'
    });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('create-owner error:', e.message, e.stack);
    next(e);
  } finally {
    client.release();
  }
});

router.get('/success', async (req, res, next) => {
  try {
    const accountId = req.query.account_id;
    if (!accountId) {
      return res.redirect(303, '/admin');
    }

    const account = await stripeSvc.retrieveAccount(accountId);

    await db.query(
      'UPDATE properties p SET charges_enabled = $1 '
      + 'FROM owners o WHERE p.owner_id = o.id '
      + 'AND o.stripe_account_id = $2',
      [account.charges_enabled, accountId]
    );

    const status = account.charges_enabled
      ? 'Активен'
      : 'Ожидает верификации';

    res.send(
      '<html><body style="font-family:Arial;'
      + 'text-align:center;padding:40px;">'
      + '<h2 style="color:#28a745;">'
      + 'Владелец завершил настройку</h2>'
      + '<p>Статус: ' + status + '</p>'
      + '<a href="/admin" style="padding:10px 20px;'
      + 'background:#635bff;color:#fff;text-decoration:none;'
      + 'border-radius:4px;">В админку</a>'
      + '</body></html>'
    );
  } catch (e) {
    next(e);
  }
});

router.get('/reauth', async (req, res, next) => {
  try {
    const accountId = req.query.account_id;
    const smoobuId = req.query.smoobu_id || '';
    if (!accountId) {
      return res.redirect(303, '/admin');
    }

    const base = config.APP_URL;
    const link = await stripeSvc.createOnboardingLink(
      accountId,
      base + '/admin/success?account_id=' + accountId
        + '&smoobu_id=' + encodeURIComponent(smoobuId),
      base + '/admin/reauth?account_id=' + accountId
        + '&smoobu_id=' + encodeURIComponent(smoobuId)
    );

    res.redirect(303, link.url);
  } catch (e) {
    next(e);
  }
});

router.post('/update-commission', async (req, res, next) => {
  try {
    const smoobuId = req.body.smoobuId;
    const commissionPercent = req.body.commissionPercent;
    const pct = Number(commissionPercent);

    if (!smoobuId || !Number.isFinite(pct) || pct < 0 || pct > 100) {
      return res.status(400).send('Некорректные данные');
    }

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const sel = await client.query(
        'SELECT id, commission_percent FROM properties '
        + 'WHERE smoobu_id = $1 FOR UPDATE',
        [smoobuId]
      );

      if (!sel.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).send('Объект не найден');
      }

      const propertyId = sel.rows[0].id;
      const oldPct = sel.rows[0].commission_percent;

      await client.query(
        'UPDATE properties SET commission_percent = $1 WHERE id = $2',
        [pct, propertyId]
      );

      await client.query(
        'INSERT INTO commission_history '
        + '(property_id, old_percent, new_percent, changed_by) '
        + 'VALUES ($1, $2, $3, $4)',
        [propertyId, oldPct, pct,
         req.headers['x-admin-user'] || 'admin']
      );

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    res.redirect(303, '/admin');
  } catch (e) {
    next(e);
  }
});

router.get('/owners', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Owners — Madeirabook Admin</title>
<script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-100 min-h-screen py-10 px-4">
<div style="max-width:672px;margin:20px auto 0;padding:0 16px;"><a href="/admin" style="color:#10b981;font-weight:700;text-decoration:none;">← Все владельцы</a></div>

<div style="max-width:900px;margin:20px auto;padding:0 20px;text-align:right;"><a href="/admin/owners" style="display:inline-block;background:#10b981;color:#fff;font-weight:700;padding:12px 24px;border-radius:8px;text-decoration:none;">+ Создать нового владельца</a></div>


<div class="max-w-2xl mx-auto">
  <h1 class="text-3xl font-black mb-2">Create Owner & Get Onboarding Link</h1>
  <p class="text-slate-600 mb-8">Введи email владельца — получишь бессрочную ссылку для прохождения Stripe KYC.</p>

  <form id="owner-form" class="bg-white rounded-2xl p-6 shadow-sm">
    <div class="mb-4">
      <label class="block text-sm font-bold mb-2">Email владельца *</label>
      <input type="email" name="email" required placeholder="owner@example.com"
             class="w-full px-4 py-3 border border-slate-300 rounded-lg outline-none focus:border-emerald-500">
    </div>

    <div class="mb-4">
      <label class="block text-sm font-bold mb-2">ID объекта (внешний) *</label>
      <input type="text" name="smoobuId" required placeholder="37726"
             class="w-full px-4 py-3 border border-slate-300 rounded-lg outline-none focus:border-emerald-500">
      <p class="text-xs text-slate-500 mt-1">ID property в PMS (Smoobu / Zeevou).</p>
    </div>

    <div class="grid grid-cols-2 gap-4 mb-4">
      <div>
        <label class="block text-sm font-bold mb-2">RNAL (опц.)</label>
        <input type="text" name="rnal" placeholder="12345/AL"
               class="w-full px-4 py-3 border border-slate-300 rounded-lg outline-none focus:border-emerald-500">
      </div>
      <div>
        <label class="block text-sm font-bold mb-2">Комиссия, %</label>
        <input type="number" name="commissionPercent" value="12" min="0" max="100" step="0.5"
               class="w-full px-4 py-3 border border-slate-300 rounded-lg outline-none focus:border-emerald-500">
      </div>
    </div>

    <button type="submit" id="submit-btn"
            class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-lg transition">
      Создать и получить ссылку
    </button>
  </form>

  <div id="result" class="hidden mt-6 bg-white rounded-2xl p-6 shadow-sm">
    <div class="text-green-600 font-bold mb-3">✅ Готово</div>
    <div class="mb-2"><strong>Owner ID:</strong> <span id="r-id"></span></div>
    <div class="mb-2"><strong>Email:</strong> <span id="r-email"></span></div>
    <div class="mb-2"><strong>Stripe account:</strong> <span id="r-acct" class="font-mono text-sm"></span></div>
    <div class="mb-4"><strong>Комиссия:</strong> <span id="r-pct"></span>%</div>
    <div class="mb-2"><strong>Ссылка для владельца (бессрочная):</strong></div>
    <div class="flex gap-2 mb-2">
      <input type="text" id="r-link" readonly
             class="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded font-mono text-xs">
      <button type="button" onclick="copyLink()"
              class="bg-slate-800 hover:bg-slate-900 text-white font-bold px-4 py-2 rounded text-sm">Copy</button>
    </div>
    <p class="text-xs text-slate-500">Отправь эту ссылку владельцу. Она работает всегда, даже если Stripe-ссылка истекла — наша страница сгенерирует свежую.</p>
  </div>

  <div id="error" class="hidden mt-6 bg-rose-50 border-l-4 border-rose-500 rounded-lg p-4 text-rose-800"></div>
</div>

<script>
const form = document.getElementById('owner-form');
const btn = document.getElementById('submit-btn');
const result = document.getElementById('result');
const errorBox = document.getElementById('error');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  result.classList.add('hidden');
  errorBox.classList.add('hidden');
  btn.textContent = 'Создаю...';
  btn.disabled = true;

  const fd = new FormData(form);
  const body = Object.fromEntries(fd.entries());

  try {
    const res = await fetch('/admin/create-owner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || 'Server error ' + res.status);
    }
    document.getElementById('r-id').textContent = data.owner_id;
    document.getElementById('r-email').textContent = data.email;
    document.getElementById('r-acct').textContent = data.stripe_account_id;
    document.getElementById('r-pct').textContent = body.commissionPercent;
    document.getElementById('r-link').value = data.permalink;
    result.classList.remove('hidden');
  } catch (err) {
    errorBox.textContent = '❌ ' + err.message;
    errorBox.classList.remove('hidden');
  } finally {
    btn.textContent = 'Создать и получить ссылку';
    btn.disabled = false;
  }
});

function copyLink() {
  const el = document.getElementById('r-link');
  el.select();
  document.execCommand('copy');
}
</script>

</body>
</html>`);
});

module.exports = router;
