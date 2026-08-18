import type { MetadataRoute } from 'next'

import { SITE_URL } from '@/lib/site'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  const staticRoutes = [
    { path: '', changeFrequency: 'weekly', priority: 1 },
    { path: 'funcionalidades', changeFrequency: 'monthly', priority: 0.9 },
    { path: 'precos', changeFrequency: 'monthly', priority: 0.8 },
    { path: 'contato', changeFrequency: 'yearly', priority: 0.7 },
    { path: 'privacidade', changeFrequency: 'yearly', priority: 0.3 },
  ] as const

  return staticRoutes.map((r) => ({
    url: `${SITE_URL}/${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }))
}
