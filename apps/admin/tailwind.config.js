/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Dark-first SaaS palette matching Pico's purple identity.
        surface: {
          DEFAULT: '#0b0b10',
          soft: '#12121a',
          card: '#16161f',
          line: '#232332',
        },
        ink: {
          DEFAULT: '#f1f1f6',
          soft: '#b8b8c6',
          muted: '#7a7a8c',
        },
        brand: {
          300: '#b3a1f0',
          400: '#9a7fe8',
          500: '#7c5ce0',
          600: '#6744cf',
        },
      },
    },
  },
  plugins: [],
};
