'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { trackDemo } from '@/lib/analytics'

type Crumb = { name: string; href: string }

/**
 * Breadcrumbs com Schema.org BreadcrumbList (JSON-LD).
 * Checklist item 14.
 */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const pathname = usePathname()
  const crumbs = [{ name: 'Início', href: '/' }, ...items]

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://chefecoruja.com.br'}${c.href}`,
    })),
  }

  return (
    <nav aria-label="Trilha de navegação" className="py-4">
      <ol className="flex flex-wrap items-center gap-1 text-sm text-slate-500">
        {crumbs.map((c, i) => {
          const isLast = i === crumbs.length - 1
          const isAtual = pathname === c.href
          return (
            <li key={c.href} className="flex items-center gap-1">
              {isLast ? (
                <span aria-current="page" className="font-medium text-slate-800">
                  {c.name}
                </span>
              ) : (
                <>
                  <Link href={c.href} onClick={() => trackDemo(`breadcrumb-${c.href}`)} className="hover:text-primary">
                    {c.name}
                  </Link>
                  <span aria-hidden="true">/</span>
                </>
              )}
              {isAtual && !isLast ? null : null}
            </li>
          )
        })}
      </ol>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </nav>
  )
}
