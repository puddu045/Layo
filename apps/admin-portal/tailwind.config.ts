import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: { 900: '#0B2545', 700: '#13335C', 500: '#1D4E89' },
        teal: { 500: '#1FA2A6', 100: '#E3F6F5' },
        surface: '#FFFFFF',
        background: '#F7F9FC',
        border: '#E3E8F0',
      },
      borderRadius: {
        lg: '14px',
        xl: '20px',
      },
    },
  },
  plugins: [],
};

export default config;
