import type { SVGProps } from 'react'

import { cn } from '@/lib/utils'

// Os ícones próprios do protótipo (P/assets/css/icons.css): órgãos e rostos
// que o lucide não tem, no mesmo traço de 2px e grade de 24. Mesma API dos
// ícones do lucide (className, aria-hidden), para entrarem nos mesmos lugares.

type Props = SVGProps<SVGSVGElement>

function Base({ children, className, ...props }: Props & { children: React.ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-4', className)}
      {...props}
    >
      {children}
    </svg>
  )
}

export function OssoQuebrado(props: Props) {
  return (
    <Base {...props}>
      <path d="M17 10c.7-.7 1.69 0 2.5 0a2.5 2.5 0 1 0 0-5 .5.5 0 0 1-.5-.5 2.5 2.5 0 1 0-5 0c0 .81.7 1.8 0 2.5l-7 7c-.7.7-1.69 0-2.5 0a2.5 2.5 0 0 0 0 5c.28 0 .5.22.5.5a2.5 2.5 0 1 0 5 0c0-.81-.7-1.8 0-2.5Z" />
      <path d="m10.6 10.6 1.6 1.6-1.4 1.4 1.6 1.6" />
    </Base>
  )
}

export function Rim(props: Props) {
  return (
    <Base {...props}>
      <path d="M15 2.5c3.6 0 6.5 4 6.5 9 0 6-3.7 10.5-8 10.5-3 0-5.5-2.2-5.5-5 0-2 1.1-3.1 2.4-4 1.2-.8 1.3-1.9.4-2.7C9.4 9 7.5 7.8 7.5 5.7 7.5 3.6 9.2 2 11.3 2c1.2 0 2.2.5 3 1.2" />
      <path d="M12.5 12h-2.2" />
    </Base>
  )
}

export function Pulmoes(props: Props) {
  return (
    <Base {...props}>
      <path d="M12 3v7.5" />
      <path d="M12 10.5c-1 0-2-1-3.5-1C6 9.5 4 12 4 15.5V19c0 1.6 1.7 2.5 3.1 1.7L12 18" />
      <path d="M12 10.5c1 0 2-1 3.5-1C18 9.5 20 12 20 15.5V19c0 1.6-1.7 2.5-3.1 1.7L12 18" />
    </Base>
  )
}

export function Estomago(props: Props) {
  return (
    <Base {...props}>
      <path d="M9.6 3.2C9.6 6 11 7.4 13.4 8.4 16.2 9.5 18 11.3 18 14.1 18 17.4 15.2 19.8 11.4 19.8 7.6 19.8 4.8 17.4 4.8 13.7 4.8 10.9 6.2 9 7.1 7.1 7.9 5.5 8.1 4.4 8.1 3.2Z" />
      <path d="M17.6 16.4c1.5.4 2.7-.2 3.3-1.5" />
      <path d="M8.1 3.2h1.5" />
    </Base>
  )
}

export function Tireoide(props: Props) {
  return (
    <Base {...props}>
      <path d="M12 7v11" />
      <path d="M9 9.5h6" />
      <path d="M12 10.5C10.4 8.3 7.6 7 5.7 7.9 3.8 8.8 3.3 11.6 4.3 14.4c1 2.7 3 4.3 4.9 4.1 1.7-.2 2.8-1.6 2.8-3.5" />
      <path d="M12 10.5c1.6-2.2 4.4-3.5 6.3-2.6 1.9.9 2.4 3.7 1.4 6.5-1 2.7-3 4.3-4.9 4.1-1.7-.2-2.8-1.6-2.8-3.5" />
    </Base>
  )
}

export function Virus(props: Props) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="5" />
      <path d="M12 2.5V7" />
      <path d="M12 17v4.5" />
      <path d="M2.5 12H7" />
      <path d="M17 12h4.5" />
      <path d="m5.6 5.6 3.2 3.2" />
      <path d="m15.2 15.2 3.2 3.2" />
      <path d="m18.4 5.6-3.2 3.2" />
      <path d="m8.8 15.2-3.2 3.2" />
    </Base>
  )
}

/** Rosto adulto, par do bebê (lucide Baby) no seletor Adulto/Pediátrico. */
export function Adulto(props: Props) {
  return (
    <Base {...props}>
      <path d="M9 10h.01" />
      <path d="M15 10h.01" />
      <path d="M9 15c.6.6 1.6 1 3 1s2.4-.4 3-1" />
      <path d="M12 2a8 8 0 0 0-8 8v1.5a2 2 0 0 0 0 4A8 8 0 0 0 12 22a8 8 0 0 0 8-8.5 2 2 0 0 0 0-4V10a8 8 0 0 0-8-8Z" />
    </Base>
  )
}

/**
 * Glifo químico (Na⁺, K⁺, Ca²⁺, Mg²⁺, P, H₂O): texto no lugar do ícone,
 * no mesmo quadrado, para as ferramentas de eletrólitos.
 */
export function Quim({ simbolo, className }: { simbolo: 'Na' | 'K' | 'Ca' | 'Mg' | 'P' | 'H2O'; className?: string }) {
  const texto = { Na: 'Na⁺', K: 'K⁺', Ca: 'Ca²⁺', Mg: 'Mg²⁺', P: 'P', H2O: 'H₂O' }[simbolo]
  return (
    <span
      aria-hidden
      className={cn('inline-flex size-4 items-center justify-center text-[0.78em] leading-none font-semibold tracking-[-0.03em] tabular', className)}
    >
      {texto}
    </span>
  )
}
