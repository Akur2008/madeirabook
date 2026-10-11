p = 'src/routes/gateways.js'
s = open(p, encoding='utf-8').read()

# 1. Плашка прозрачнее + компактнее
old1 = "  .glass { background: rgba(10,10,10,0.04); backdrop-filter: blur(14px) saturate(110%); -webkit-backdrop-filter: blur(14px) saturate(110%); border: 1px solid rgba(var(--accent-rgb), 0.20); border-radius: 20px; padding: 24px 22px; max-width: 480px; width: 100%; box-shadow: 0 8px 32px rgba(0,0,0,0.25); }"
new1 = "  .glass { background: rgba(10,10,10,0.02); backdrop-filter: blur(4px) saturate(105%); -webkit-backdrop-filter: blur(4px) saturate(105%); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 16px 14px; max-width: 400px; width: 100%; }"
if old1 not in s: print('FAIL 1'); exit(1)
s = s.replace(old1, new1, 1)

# 2. Title меньше
old2 = "  .title { font-size: 34px; font-weight: 800; margin: 0 0 8px 0; letter-spacing: -0.5px; line-height: 1.1; text-shadow: 0 2px 12px rgba(0,0,0,0.65), 0 1px 3px rgba(0,0,0,0.9); }"
new2 = "  .title { font-size: 24px; font-weight: 800; margin: 0 0 6px 0; letter-spacing: -0.3px; line-height: 1.15; text-shadow: 0 2px 12px rgba(0,0,0,0.75), 0 1px 3px rgba(0,0,0,0.9); }"
if old2 not in s: print('FAIL 2'); exit(1)
s = s.replace(old2, new2, 1)

# 3. Subtitle меньше
old3 = "  .subtitle { color: #e0e0e5; font-size: 15px; margin: 0 0 28px 0; line-height: 1.4; text-shadow: 0 1px 6px rgba(0,0,0,0.6); }"
new3 = "  .subtitle { color: #e0e0e5; font-size: 12px; margin: 0 0 16px 0; line-height: 1.35; text-shadow: 0 1px 6px rgba(0,0,0,0.75); }"
if old3 not in s: print('FAIL 3'); exit(1)
s = s.replace(old3, new3, 1)

# 4. Вопрос меньше
old4 = "  .q-title { font-size: 20px; margin-bottom: 16px; font-weight: 600; text-shadow: 0 1px 6px rgba(0,0,0,0.6); }"
new4 = "  .q-title { font-size: 15px; margin-bottom: 10px; font-weight: 600; text-shadow: 0 1px 6px rgba(0,0,0,0.75); }"
if old4 not in s: print('FAIL 4'); exit(1)
s = s.replace(old4, new4, 1)

# 5. Кнопки-ответы компактнее
old5 = "  .btn-answer { display: block; width: 100%; text-align: left; padding: 16px 18px; border-radius: 12px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.14); color: #f5f5f7; font-size: 15px; margin-bottom: 10px; cursor: pointer; transition: all .2s; font-family: Georgia, serif; -webkit-tap-highlight-color: transparent; text-shadow: 0 1px 4px rgba(0,0,0,0.5); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); }"
new5 = "  .btn-answer { display: block; width: 100%; text-align: left; padding: 11px 14px; border-radius: 10px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.12); color: #f5f5f7; font-size: 13px; margin-bottom: 8px; cursor: pointer; transition: all .2s; font-family: Georgia, serif; -webkit-tap-highlight-color: transparent; text-shadow: 0 1px 4px rgba(0,0,0,0.7); }"
if old5 not in s: print('FAIL 5'); exit(1)
s = s.replace(old5, new5, 1)

# 6. Кнопка Open sanctuary — уменьшаем padding и font-size
old6 = 'padding:18px;border-radius:12px;background:rgba(255,255,255,0.04);backdrop-filter:blur(20px) saturate(120%);-webkit-backdrop-filter:blur(20px) saturate(120%);color:#f5f5f7;font-weight:800;font-size:16px;'
new6 = 'padding:12px;border-radius:10px;background:rgba(255,255,255,0.04);backdrop-filter:blur(8px) saturate(105%);-webkit-backdrop-filter:blur(8px) saturate(105%);color:#f5f5f7;font-weight:800;font-size:13px;'
if old6 not in s: print('FAIL 6'); exit(1)
s = s.replace(old6, new6, 1)

# 7. Overlay ниже
old7 = "  .overlay { position: relative; z-index: 2; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; padding: 20px 16px 60px 16px; }"
new7 = "  .overlay { position: relative; z-index: 2; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; padding: 20px 12px 24px 12px; }"
if old7 not in s: print('FAIL 7'); exit(1)
s = s.replace(old7, new7, 1)

open(p, 'w', encoding='utf-8').write(s)
print('OK')
