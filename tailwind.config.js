/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#00215B',
          dark: '#001640',
          light: '#E8EEF8',
          navy: '#00215B',
          gold: '#C4972A',
          'gold-dark': '#A67E20',
          'gold-light': '#F5EDD4',
        },
      },
      fontFamily: {
        sans: ['Lato', 'system-ui', 'sans-serif'],
        display: ['Kanit', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
