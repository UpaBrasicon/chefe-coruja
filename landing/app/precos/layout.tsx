import type { Metadata } from 'next'
import type { ReactNode } from 'react'

// A página de preços é de cliente (evento do GA4) e não exporta metadados; sem
// este layout ela herdava o canônico "/" da raiz, que redireciona para o app
// (pedido 8, J5).
export const metadata: Metadata = {
  title: 'Preços',
  alternates: { canonical: '/precos' },
}

export default function PrecosLayout({ children }: { children: ReactNode }) {
  return children
}
