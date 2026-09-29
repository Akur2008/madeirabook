import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';

// Брендовые токены портала madeirabook.com.
const config: Config = {
  content: ['./src/**/*.js', './src/styles/globals.css'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#1a3a2e', // тёмно-зелёный фон hero на сайте
          ink: '#0f172a', // заголовки и футер
          muted: '#64748b'
        },
        emerald: {
          500: '#10b981',
          600: '#059669',
          700: '#047857'
        }
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'system-ui',
          'sans-serif'
        ]
      },
      maxWidth: {
        content: '64rem' // 1024px — ширина контейнера шапки и контента
      },
      borderRadius: {
        brand: '12px',
        card: '16px'
      },
      boxShadow: {
        card: '0 2px 12px rgba(15, 23, 42, 0.05)',
        cta: '0 8px 24px rgba(16, 185, 129, 0.3)'
      },
      fontSize: {
        display: ['clamp(1.75rem, 4vw, 2.5rem)', { lineHeight: '1.15' }],
        status: ['clamp(1.5rem, 3vw, 2rem)', { lineHeight: '1.2' }]
      },
      letterSpacing: {
        eyebrow: '0.15em'
      },
      typography: () => ({
        brand: {
          css: {
            '--tw-prose-body': '#334155',
            '--tw-prose-headings': '#0f172a',
            '--tw-prose-bold': '#0f172a',
            '--tw-prose-links': '#059669',
            '--tw-prose-bullets': '#cbd5e1',
            '--tw-prose-hr': '#e2e8f0',
            maxWidth: 'none',
            h2: {
              fontSize: '1.375rem',
              marginTop: '2.5rem',
              paddingTop: '1.5rem',
              borderTop: '1px solid #e2e8f0'
            },
            'h2:first-of-type': { borderTop: '0', paddingTop: '0' },
            h3: { fontSize: '1.0625rem' },
            li: { margin: '0.35rem 0' }
          }
        }
      })
    }
  },
  plugins: [typography]
};

export default config;
