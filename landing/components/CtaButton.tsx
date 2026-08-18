'use client'

import Link from 'next/link'

import { trackDemo } from '@/lib/analytics'

/** Botão CTA "Agendar demonstração" — com evento GA4 click_demo + data-event. */
export function CtaButton({
  href = '/contato',
  children = 'Agendar demonstração',
  variant = 'primary',
  className = '',
}: {
  href?: string
  children?: React.ReactNode
  variant?: 'primary' | 'outline'
  className?: string
}) {
  return (
    <Link
      href={href}
      onClick={() => trackDemo(`cta-${href}`)}
      data-event="click_demo"
      data-utm="true"
      className={`${variant === 'primary' ? 'btn-primary' : 'btn-outline'} ${className}`}
    >
      {children}
    </Link>
  )
}
