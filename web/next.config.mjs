/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Extension versions already published inject the bridge at /app/*.
  // Keep /app/ intact instead of canonicalizing it to /app so they continue
  // working without requiring an extension update.
  skipTrailingSlashRedirect: true,
  // Control panel (Vite SPA) build vào public/app → phục vụ tại /app
  async rewrites() {
    return [
      { source: '/app/', destination: '/app/index.html' },
    ]
  },
}
export default nextConfig
