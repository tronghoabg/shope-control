import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/app/',                 // host tại https://toolmktai.com/app/
  plugins: [react()],
  server: { port: 5173, strictPort: true },
})
