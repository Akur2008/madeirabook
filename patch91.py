p = 'src/app.js'
s = open(p, encoding='utf-8').read()

# Ищем роут /sounds.js и добавляем рядом /whatsapp.js
old = """app.get('/sounds.js', (req, res) => {
  res.type('application/javascript');
  res.sendFile(require('path').join(__dirname, '..', 'public', 'sounds.js'));
});"""

new = """app.get('/sounds.js', (req, res) => {
  res.type('application/javascript');
  res.sendFile(require('path').join(__dirname, '..', 'public', 'sounds.js'));
});

app.get('/whatsapp.js', (req, res) => {
  res.type('application/javascript');
  res.sendFile(require('path').join(__dirname, '..', 'public', 'whatsapp.js'));
});"""

if old not in s: print('FAIL: не нашёл /sounds.js роут'); exit(1)
s = s.replace(old, new, 1)
open(p, 'w', encoding='utf-8').write(s)
print('OK')
