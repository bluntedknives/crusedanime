import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Neutral near-black elevation ramp. Kept strictly neutral (no blue
        // cast) so poster art is the only source of colour on the page.
        base: {
          DEFAULT: '#08090b',
          900: '#0b0c0f',
          850: '#101114',
          800: '#16171b',
          750: '#1c1d22',
          700: '#232429',
          650: '#2c2d33',
          600: '#383940',
          550: '#4a4b53',
        },
        // Warm gold. Reads as theatrical / cinematic rather than the default
        // SaaS violet, and sits opposite the cool poster art.
        accent: {
          DEFAULT: '#c8a44d',
          soft: '#e0c477',
          dim: '#8f7433',
        },
        // Cool counterpoint, used sparingly for live/airing state.
        signal: {
          DEFAULT: '#4cc9a0',
          dim: '#2b7f66',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem',
      },
      animation: {
        'fade-in': 'fadeIn .28s ease-out',
        'fade-up': 'fadeUp .34s cubic-bezier(.22,1,.36,1)',
        'slide-in': 'slideIn .3s cubic-bezier(.22,1,.36,1)',
        shimmer: 'shimmer 1.6s linear infinite',
        'scale-in': 'scaleIn .18s ease-out',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateX(-12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-500px 0' },
          '100%': { backgroundPosition: '500px 0' },
        },
        kenburns: {
          '0%': { transform: 'scale(1.05) translate3d(0,0,0)' },
          '100%': { transform: 'scale(1.16) translate3d(-1.5%,-1.5%,0)' },
        },
      },
    },
  },
  plugins: [],
}
export default config
