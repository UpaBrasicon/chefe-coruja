'use client'

/**
 * Camada de rastreamento GA4.
 * Uso: track('click_demo', { page: '/contato' })
 * Requer NEXT_PUBLIC_GA_ID configurado (ver README).
 */

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
    dataLayer?: Record<string, unknown>[]
  }
}

const GA_ID = process.env.NEXT_PUBLIC_GA_ID

export function track(event: string, params: Record<string, unknown> = {}) {
  if (typeof window === 'undefined' || !GA_ID) return
  window.gtag?.('event', event, params)
}

// Atalhos usados em todo o site
export function trackWhatsapp() {
  track('click_whatsapp', { event_category: 'conversao', event_label: 'whatsapp' })
}

export function trackDemo(local: string) {
  track('click_demo', { event_category: 'conversao', event_label: local })
}

export function trackViewPricing() {
  track('view_pricing', { event_category: 'navegacao' })
}
