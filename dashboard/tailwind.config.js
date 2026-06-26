/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#ee4d2d', 600: '#e8431f', 700: '#c9381a' },
      },
    },
  },
  plugins: [],
}
