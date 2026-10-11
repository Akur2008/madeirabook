import re

TAG = '<script src="/whatsapp.js" defer></script>'
files = ['src/routes/pages.js', 'src/routes/gateways.js', 'src/routes/guides.js', 'src/routes/oasis.js']

total = 0
for f in files:
    try:
        s = open(f, encoding='utf-8').read()
    except FileNotFoundError:
        print('skip:', f)
        continue
    if '/whatsapp.js' in s:
        print(f + ': already has whatsapp.js')
        continue
    new_s, n = re.subn(r'</body>', TAG + '</body>', s)
    if n == 0:
        print(f + ': no </body>')
        continue
    open(f, 'w', encoding='utf-8').write(new_s)
    print(f + ': inserted ' + str(n) + ' times')
    total += n

print('TOTAL:', total)
