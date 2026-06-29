/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Control panel (Vite SPA) build vào public/app → phục vụ tại /app
  async rewrites() {
    return [
      { source: '/app', destination: '/app/index.html' },
      { source: '/app/', destination: '/app/index.html' },
    ]
  },
}
export default nextConfig
