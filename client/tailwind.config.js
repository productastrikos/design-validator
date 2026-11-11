/** @type {import('tailwindcss').Config} */
/* Astrikos UI Theme v2.0 §5.2: the stock ramps are re-pointed at the brand, so no
   utility can land on Tailwind's default blue-grey. */
const graphite = { 50:'#F7F7FA',100:'#E8E6F2',200:'#D6D6D6',300:'#B4B4B4',400:'#8E8E8E',500:'#6E6E6E',600:'#4A4A4A',700:'#333333',800:'#242424',900:'#1A1A1A',950:'#121212' };
const periwinkle = { 50:'#F2F0FF',100:'#E4DFFF',200:'#D9D3FF',300:'#C8BEFF',400:'#BCB0FF',500:'#A597FF',600:'#7B5FE0',700:'#6849CC',800:'#5B3FB8',900:'#463091',950:'#2A1C5C' };
const brandGreen = { 50:'#E8FBF0',100:'#C6F5DA',200:'#94EBBB',300:'#6EE7A4',400:'#34D47C',500:'#0EBC53',600:'#0BA648',700:'#098A3C',800:'#076B2F',900:'#054F23',950:'#032E14' };
const brandRed = { 50:'#FDEEEE',100:'#F9D5D5',200:'#F2B4B4',300:'#EFA8A8',400:'#E86A6A',500:'#D43434',600:'#BE2E2E',700:'#A82828',800:'#8A2020',900:'#6B1919',950:'#3F0F0F' };
const brandAmber = { 50:'#FEF7EA',100:'#FCEBCB',200:'#F8D89B',300:'#F5C87A',400:'#F0B65C',500:'#E8A33D',600:'#C4882F',700:'#A87226',800:'#87591D',900:'#664215',950:'#3D270C' };
const brandOrange = { 50:'#FEF3EB',100:'#FCE2CE',200:'#F8C79F',300:'#F5B681',400:'#F2A365',500:'#EE8B3D',600:'#CC7430',700:'#A85E27',800:'#854A1F',900:'#633717',950:'#3B210E' };
const brandAzure = { 50:'#EFF4FF',100:'#DAE5FF',200:'#BFD2FF',300:'#A6C4FF',400:'#8AAEFF',500:'#6E9BFF',600:'#5C87F0',700:'#4A72D6',800:'#3A5CAD',900:'#2B4483',950:'#1A294F' };
const brandTeal = { 50:'#E9FBF8',100:'#C9F4ED',200:'#A3ECE0',300:'#8FE9DA',400:'#6FD9C8',500:'#4FC9BA',600:'#2F9E91',700:'#25837A',800:'#1D6660',900:'#154B47',950:'#0C2C2A' };

const tone = (t) => ({
  [t]: `var(--app-${t})`,
  [`${t}-bg`]: `var(--app-${t}-bg)`,
  [`${t}-border`]: `var(--app-${t}-border)`,
});

module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        astrikos: {
          ink: '#353248', carbon: '#2F2E33', steel: '#565559', mist: '#E8E6F2', paper: '#F7F7FA',
          lilac: '#D9D3FF', periwinkle: '#A597FF', iris: '#8B82C3', slate: '#7D7A91',
          go: '#0EBC53', stop: '#D43434',
        },
        /* Live CSS-variable aliases: these follow the active theme. */
        app: {
          bg: 'var(--app-bg)', chrome: 'var(--app-chrome-bg)', panel: 'var(--app-panel)',
          surface: 'var(--app-surface)', 'surface-soft': 'var(--app-surface-soft)',
          'surface-raised': 'var(--app-surface-raised)', elevated: 'var(--app-bg-elevated)',
          border: 'var(--app-border)', 'border-soft': 'var(--app-border-soft)', 'border-strong': 'var(--app-border-strong)',
          text: 'var(--app-text)', muted: 'var(--app-text-muted)', faint: 'var(--app-text-faint)',
          ...tone('accent'), 'accent-strong': 'var(--app-accent-strong)',
          btn: 'var(--app-btn)', 'btn-hover': 'var(--app-btn-hover)', 'btn-text': 'var(--app-btn-text)',
          'on-color': 'var(--app-on-color)',
          ...tone('success'), ...tone('warning'), ...tone('danger'), ...tone('info'),
          advisory: 'var(--app-advisory)', 'advisory-soft': 'var(--app-advisory-soft)',
          'advisory-strong': 'var(--app-advisory-strong)', 'advisory-border': 'var(--app-advisory-border)',
          'violet-bg': 'var(--app-violet-bg)',
        },
        slate: graphite, gray: graphite, zinc: graphite, neutral: graphite, stone: graphite,
        purple: periwinkle, violet: periwinkle, indigo: periwinkle, fuchsia: periwinkle, pink: periwinkle,
        green: brandGreen, emerald: brandGreen, lime: brandGreen,
        red: brandRed, rose: brandRed,
        amber: brandAmber, yellow: brandAmber, orange: brandOrange,
        blue: brandAzure, sky: brandAzure,
        teal: brandTeal, cyan: brandTeal,
      },
      fontFamily: {
        display: ['"Lexend Deca"', 'system-ui', 'sans-serif'],
        sans: ['Lato', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      /* One radius family (§4.2): the utilities already in the markup land on it. */
      borderRadius: { DEFAULT: '6px', sm: '6px', md: '8px', lg: '9px', xl: '14px', '2xl': '14px', '3xl': '14px', brand: '10px', panel: '14px' },
      boxShadow: {
        'app-xs': 'var(--app-shadow-xs)', 'app-sm': 'var(--app-shadow-sm)',
        'app-md': 'var(--app-shadow-md)', 'app-lg': 'var(--app-shadow-lg)',
        'app-edge': 'var(--app-edge-light)',
      },
    },
  },
  plugins: [],
};
