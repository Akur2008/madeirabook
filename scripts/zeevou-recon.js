#!/usr/bin/env node
/**
 * Read-only разведка Zeevou API.
 * Берёт access token через OAuth (client_credentials, либо уже
 * авторизованный authorization_code токен — в том же процессе нет,
 * поэтому для standalone-запуска нужны ZEEVOU_OAUTH_CRED_*).
 *
 * Запуск: node scripts/zeevou-recon.js
 */
require('dotenv').config();

const oauth = require('../src/services/pms/zeevou-oauth');

const BASE =
  process.env.ZEEVOU_BASE_URL ||
  process.env.ZEEVOU_SANDBOX_URL ||
  'https://sandbox.zeevou.com';

const ENDPOINTS = [
  ['areas?area_name=Madeira', '/apis/areas?area_name=Madeira'],
  ['areas (all)', '/apis/areas'],
  ['properties', '/apis/properties'],
  ['property_types', '/apis/property_types'],
  ['unit_types', '/apis/unit_types'],
  ['currencies', '/apis/currencies'],
  ['rate_plans', '/apis/rate_plans'],
];

async function main() {
  console.log('Zeevou recon — base:', BASE);

  const token = await oauth.getAccessToken();
  const status = oauth.getStatus();
  console.log('Token:', status.grant_type, '| expires_in:', status.expires_in_sec, 's\n');

  const headers = { Authorization: 'Bearer ' + token, Accept: 'application/json' };

  for (const [name, path] of ENDPOINTS) {
    try {
      const res = await fetch(BASE + path, { headers });
      const text = await res.text();
      let body;
      try { body = JSON.parse(text); } catch { body = text; }

      console.log('===== ' + name + ' -> HTTP ' + res.status);
      if (Array.isArray(body) && body.length > 3) {
        console.log(`(${body.length} items, showing first 3)`);
        console.log(JSON.stringify(body.slice(0, 3), null, 2));
      } else {
        console.log(JSON.stringify(body, null, 2).slice(0, 4000));
      }
      console.log('');
    } catch (e) {
      console.log('===== ' + name + ' -> ERROR ' + e.message + '\n');
    }
  }

  // EUR check inside currencies
  try {
    const res = await fetch(BASE + '/apis/currencies', { headers });
    const list = await res.json();
    const eur = Array.isArray(list) && list.find((c) => c.code === 'EUR');
    console.log('===== EUR check:', eur ? 'FOUND — ' + JSON.stringify(eur) : 'NOT FOUND');
  } catch (e) {
    console.log('===== EUR check ERROR ' + e.message);
  }

  process.exit(0);
}

main().catch((e) => {
  console.error('Recon failed:', e.message);
  process.exit(1);
});
