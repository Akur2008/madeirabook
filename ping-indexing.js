const { google } = require('googleapis');
async function main() {
  const url = process.argv[2] || 'https://madeirabook.com/';
  const auth = new google.auth.GoogleAuth({ keyFile: './service-account.json', scopes: ['https://www.googleapis.com/auth/indexing'] });
  const client = await auth.getClient();
  const indexing = google.indexing({ version: 'v3', auth: client });
  try {
    const res = await indexing.urlNotifications.publish({ requestBody: { url, type: 'URL_UPDATED' } });
    console.log('OK:', JSON.stringify(res.data, null, 2));
  } catch (e) {
    console.error('FAIL:', e.message);
    if (e.response && e.response.data) console.error(JSON.stringify(e.response.data, null, 2));
  }
}
main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
