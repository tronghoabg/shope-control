import type { Config } from 'tailwindcss'

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: { brand: { DEFAULT: '#ee4d2d', 600: '#e8431f', 700: '#c9381a' } },
    },
  },
  plugins: [],
} satisfies Config
