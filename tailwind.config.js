/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#C07000', dark: '#A06000', light: '#FAEEDA' },
      },
    },
  },
  plugins: [],
}
