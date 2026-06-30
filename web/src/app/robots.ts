import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/app', '/admin', '/dashboard', '/api/'],
    },
    sitemap: 'https://toolmktai.com/sitemap.xml',
    host: 'https://toolmktai.com',
  }
}
