import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/app/',                       // control panel phục vụ tại {domain}/app
  plugins: [
    react(),
    // Gỡ crossorigin (cùng origin, không cần) — tránh CDN/Cloudflare chặn nạp CSS/JS
    { name: 'strip-crossorigin', enforce: 'post', transformIndexHtml: (html) => html.replace(/\s+crossorigin/g, '') },
  ],
  server: { port: 5173, strictPort: true },
  build: { outDir: '../web/public/app', emptyOutDir: true },  // build thẳng vào web (Next phục vụ /app)
})
