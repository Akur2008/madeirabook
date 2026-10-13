const { google } = require('googleapis');

async function main() {
  const sm = await fetch('https://madeirabook.com/sitemap.xml').then(r => r.text());
  const urls = [...sm.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1]);
  console.log('URLs to ping:', urls.length);

  const auth = new google.auth.GoogleAuth({
    keyFile: './service-account.json',
    scopes: ['https://www.googleapis.com/auth/indexing'],
  });
  const client = await auth.getClient();
  const indexing = google.indexing({ version: 'v3', auth: client });

  let ok = 0, fail = 0;
  for (const url of urls) {
    try {
      await indexing.urlNotifications.publish({
        requestBody: { url, type: 'URL_UPDATED' },
      });
      console.log('OK  ', url);
      ok++;
    } catch (e) {
      console.log('FAIL', url, '-', e.message);
      fail++;
    }
    await new Promise(r => setTimeout(r, 250));
  }
  console.log(`\nDone. OK: ${ok}, FAIL: ${fail}`);
}
main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
