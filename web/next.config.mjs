/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Extension versions already published inject the bridge at /app/*.
  // Keep /app/ intact instead of canonicalizing it to /app so they continue
  // working without requiring an extension update.
  skipTrailingSlashRedirect: true,
  // Control panel (Vite SPA) build vào public/app → phục vụ tại /app
  async redirects() {
    return [
      // Chrome Web Store versions inject dashboard_bridge.js at /app/* only.
      // Redirect old bookmarks before the document loads so Chrome matches it.
      { source: '/app', destination: '/app/', permanent: false },
    ]
  },
  async rewrites() {
    return [
      { source: '/app/', destination: '/app/index.html' },
    ]
  },
}
export default nextConfig
