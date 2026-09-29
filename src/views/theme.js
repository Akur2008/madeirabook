// Дизайн-токены портала madeirabook.com (источник: madeirabook-site/index.html).
// В репозитории нет Tailwind/globals.css, поэтому токены живут здесь и
// раздаются как один inline-стиль для всех серверных страниц.

const tokens = {
  fontSans: "-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif",
  brand: '#1a3a2e',
  accent: '#10b981',
  accentDark: '#059669',
  ink: '#0f172a',
  body: '#334155',
  muted: '#64748b',
  border: '#e2e8f0',
  surface: '#ffffff',
  surfaceMuted: '#f8fafc',
  footerBg: '#0f172a',
  footerText: '#94a3b8',
  footerBorder: '#1e293b',
  radius: '12px',
  radiusLg: '16px',
  contentWidth: '1024px'
};

const styles = `
*{margin:0;padding:0;box-sizing:border-box;}
html{background:${tokens.surfaceMuted};-webkit-text-size-adjust:100%;}
body{font-family:${tokens.fontSans};color:${tokens.body};
background:${tokens.surfaceMuted};line-height:1.7;
display:flex;flex-direction:column;min-height:100vh;}
a{color:${tokens.accentDark};}
a:hover{color:${tokens.accent};}

.nav{position:sticky;top:0;z-index:50;background:rgba(255,255,255,0.95);
backdrop-filter:saturate(180%) blur(8px);
border-bottom:1px solid ${tokens.border};padding:16px 24px;}
.nav-inner{max-width:${tokens.contentWidth};margin:0 auto;display:flex;
align-items:center;justify-content:space-between;gap:12px;}
.nav-brand{font-weight:900;font-size:20px;color:${tokens.ink};
text-decoration:none;letter-spacing:-0.02em;}
.nav-links{display:flex;gap:20px;align-items:center;font-size:14px;
font-weight:500;overflow-x:auto;}
.nav-links a{color:#334155;text-decoration:none;white-space:nowrap;}
.nav-links a:hover{color:${tokens.accentDark};}
.nav-cta{background:${tokens.accentDark};color:#fff;font-size:14px;
font-weight:700;padding:10px 20px;border-radius:10px;text-decoration:none;
transition:background 0.2s;white-space:nowrap;}
.nav-cta:hover{background:#047857;color:#fff;}
@media(max-width:720px){.nav-links{display:none;}}

.page{flex:1;width:100%;max-width:${tokens.contentWidth};margin:0 auto;
padding:48px 24px 72px;}
.card{background:${tokens.surface};border:1px solid ${tokens.border};
border-radius:${tokens.radiusLg};padding:48px;
box-shadow:0 2px 12px rgba(15,23,42,0.05);}
@media(max-width:640px){.card{padding:28px 20px;}.page{padding:28px 16px 48px;}}

.eyebrow{text-transform:uppercase;letter-spacing:0.15em;font-size:12px;
font-weight:700;color:${tokens.accentDark};margin-bottom:12px;}
.card h1{font-size:clamp(28px,4vw,40px);line-height:1.15;font-weight:900;
letter-spacing:-0.02em;color:${tokens.ink};margin-bottom:12px;}
.card h2{font-size:22px;font-weight:800;letter-spacing:-0.01em;
color:${tokens.ink};margin:40px 0 12px;padding-top:24px;
border-top:1px solid ${tokens.border};}
.card h2:first-of-type{border-top:0;padding-top:0;margin-top:28px;}
.card h3{font-size:17px;font-weight:700;color:${tokens.ink};margin:24px 0 8px;}
.card p{margin:0 0 16px;}
.card ul,.card ol{margin:0 0 16px;padding-left:22px;}
.card li{margin-bottom:8px;}
.card li b,.card p b{color:${tokens.ink};}
.card hr{border:0;border-top:1px solid ${tokens.border};margin:32px 0;}
.meta{display:inline-block;font-size:13px;color:${tokens.muted};
background:${tokens.surfaceMuted};border:1px solid ${tokens.border};
border-radius:999px;padding:4px 12px;margin-bottom:8px;}
.lead{font-size:18px;color:${tokens.muted};margin-bottom:24px;}

.btn{display:inline-block;background:${tokens.accent};color:#fff;
padding:14px 32px;border-radius:${tokens.radius};font-weight:700;
text-decoration:none;box-shadow:0 8px 24px rgba(16,185,129,0.3);
transition:background 0.2s,transform 0.2s;}
.btn:hover{background:${tokens.accentDark};color:#fff;transform:translateY(-1px);}
.btn-ghost{display:inline-block;padding:14px 28px;border-radius:${tokens.radius};
border:1px solid ${tokens.border};color:${tokens.ink};font-weight:600;
text-decoration:none;background:${tokens.surface};}
.btn-ghost:hover{border-color:${tokens.accent};color:${tokens.accentDark};}
.actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:8px;}

.status{font-size:clamp(24px,3vw,32px);font-weight:900;letter-spacing:-0.02em;
margin-bottom:16px;}
.status-ok{color:${tokens.accentDark};}
.status-warn{color:#b45309;}
.summary{list-style:none;padding:0;margin:0 0 24px;border-top:1px solid ${tokens.border};}
.summary li{display:flex;justify-content:space-between;gap:16px;
padding:12px 0;border-bottom:1px solid ${tokens.border};margin:0;}
.summary span{color:${tokens.muted};}
.summary b{color:${tokens.ink};text-align:right;}

.footer{background:${tokens.footerBg};color:${tokens.footerText};
padding:56px 24px 28px;font-size:14px;}
.footer-inner{max-width:1200px;margin:0 auto;display:grid;
grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:40px;}
.footer h4{color:#fff;font-weight:700;font-size:15px;margin-bottom:14px;}
.footer-brand h4{font-size:18px;font-weight:800;margin-bottom:12px;}
.footer p{line-height:1.6;}
.footer ul{list-style:none;padding:0;line-height:2;}
.footer a{color:${tokens.footerText};text-decoration:none;}
.footer a:hover{color:#fff;}
.footer-bottom{max-width:1200px;margin:44px auto 0;
border-top:1px solid ${tokens.footerBorder};padding-top:22px;text-align:center;
font-size:13px;color:${tokens.muted};}
`;

module.exports = { tokens, styles };
