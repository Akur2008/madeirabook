function tg() {
  return window.Telegram && window.Telegram.WebApp;
}

function initData() {
  return tg() ? tg().initData : '';
}

async function apiFetch(path, options) {
  const opts = options || {};
  const headers = Object.assign({}, opts.headers, {
    'Content-Type': 'application/json',
    'X-Telegram-Init-Data': initData()
  });
  const res = await fetch(path, Object.assign({}, opts, { headers: headers }));
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    data = null;
  }
  return { ok: res.ok, status: res.status, data: data };
}
