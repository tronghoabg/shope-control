/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#ee4d2d', 600: '#e8431f', 700: '#c9381a' },
        // Sắc độ trung gian được dùng trong UI (Tailwind mặc định không có) → khai báo để class hiển thị đúng.
        slate: { 150: '#eaeff5', 205: '#dfe6ef', 250: '#d7dfe9', 350: '#b0bccd', 405: '#92a1b6', 850: '#172033' },
        indigo: { 550: '#595ceb', 650: '#493fd7' },
        red: { 650: '#cb2121' },
      },
      spacing: { 4.5: '1.125rem', 8.5: '2.125rem' },
      scale: { 98: '.98' },
      keyframes: {
        fadeIn: { '0%': { opacity: '0', transform: 'translateY(4px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
      },
      animation: { fadeIn: 'fadeIn .25s ease-out' },
    },
  },
  plugins: [],
}
