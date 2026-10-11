p = 'src/routes/gateways.js'
s = open(p, encoding='utf-8').read()

# 1. Плашка вниз (не в центре) + чуть больше padding снизу
old1 = "  .overlay { position: relative; z-index: 2; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px 16px; }"
new1 = "  .overlay { position: relative; z-index: 2; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; padding: 20px 16px 60px 16px; }"

if old1 not in s: print('FAIL 1'); exit(1)
s = s.replace(old1, new1, 1)

# 2. Плашка прозрачнее
old2 = "  .glass { background: rgba(10,10,10,0.08); backdrop-filter: blur(24px) saturate(120%); -webkit-backdrop-filter: blur(24px) saturate(120%); border: 1px solid rgba(var(--accent-rgb), 0.25); border-radius: 20px; padding: 28px 24px; max-width: 480px; width: 100%; box-shadow: 0 8px 32px rgba(0,0,0,0.3); }"
new2 = "  .glass { background: rgba(10,10,10,0.04); backdrop-filter: blur(14px) saturate(110%); -webkit-backdrop-filter: blur(14px) saturate(110%); border: 1px solid rgba(var(--accent-rgb), 0.20); border-radius: 20px; padding: 24px 22px; max-width: 480px; width: 100%; box-shadow: 0 8px 32px rgba(0,0,0,0.25); }"

if old2 not in s: print('FAIL 2'); exit(1)
s = s.replace(old2, new2, 1)

open(p, 'w', encoding='utf-8').write(s)
print('OK')
