import type { MetadataRoute } from 'next'

const BASE = 'https://toolmktai.com'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return [
    { url: BASE, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/cai-dat`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/register`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/login`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ]
}
