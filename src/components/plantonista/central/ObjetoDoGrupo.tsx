import type { IconeCategoria } from '@/content/inicioCelular'
import { cn } from '@/lib/utils'

// Objetos do pronto-socorro desenhados para os cartões do início do celular
// (cartões visuais, opção 2 do protótipo, escolhida pelo RT em 23/11/2026 a
// partir de telas do Refero). Desenhos próprios, sem imagem de terceiros. O
// traço é a tinta do app; a cor do grupo entra só num detalhe, por
// currentColor (a classe de cor vem de fora). Tudo por token: muda com o tema.

const COR: Record<IconeCategoria, string> = {
  urgencias: 'text-critico', doses: 'text-secao-farmacia', calculadoras: 'text-secao-calculadoras',
  escores: 'text-secao-neurologia', intoxicacao: 'text-secao-toxicologia', todas: 'text-acao',
}

const TRACO = 'stroke-tinta'
const VIDRO = 'fill-superficie'
const NEUTRO = 'fill-trilha'

function Monitor() {
  return (
    <>
      <rect x="14" y="10" width="92" height="56" rx="8" className="fill-tinta" />
      <rect x="20" y="16" width="80" height="38" rx="4" className="fill-grafite" />
      <polyline points="22,38 38,38 44,38 48,26 53,48 58,32 62,38 78,38 82,30 86,38 98,38" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx="28" cy="60" r="2.4" fill="currentColor" />
      <rect x="44" y="66" width="32" height="6" rx="2" className="fill-fio-forte" />
    </>
  )
}

function AmpolaESeringa() {
  return (
    <>
      <path d="M30 14h12v8l4 6v40a4 4 0 0 1-4 4H30a4 4 0 0 1-4-4V28l4-6z" className={cn(VIDRO, TRACO)} strokeWidth="1.6" />
      <rect x="26" y="40" width="20" height="14" fill="currentColor" />
      <rect x="26" y="40" width="20" height="14" fill="none" className={TRACO} strokeWidth="1.6" />
      <path d="M30 18h12" className={TRACO} strokeWidth="1.6" />
      <g transform="rotate(-28 82 44)">
        <rect x="58" y="38" width="44" height="12" rx="2" className={cn(VIDRO, TRACO)} strokeWidth="1.6" />
        <rect x="60" y="40" width="22" height="8" fill="currentColor" fillOpacity="0.35" />
        <path d="M66 38v4M72 38v4M78 38v4M84 38v4M90 38v4" className={TRACO} strokeWidth="1.2" />
        <rect x="102" y="41" width="8" height="6" className="fill-tinta" />
        <path d="M58 44h-10" className={TRACO} strokeWidth="1.6" />
      </g>
    </>
  )
}

function Calculadora() {
  const teclas = [0, 1, 2].flatMap((r) => [0, 1, 2].map((k) => ({ r, k })))
  return (
    <>
      <rect x="34" y="8" width="52" height="66" rx="8" className={cn(VIDRO, TRACO)} strokeWidth="1.6" />
      <rect x="40" y="14" width="40" height="18" rx="3" className={cn(NEUTRO, 'stroke-fio-forte')} />
      <text x="44" y="27" className="fill-tinta-apoio font-mono" fontSize="7">Na</text>
      <text x="76" y="27" textAnchor="end" fill="currentColor" className="font-mono" fontSize="10">128</text>
      {teclas.map(({ r, k }) => (
        <rect key={`${r}-${k}`} x={41 + k * 13} y={37 + r * 11} width="10" height="8" rx="2"
          className={cn('stroke-fio-forte', r === 2 && k === 2 ? '' : NEUTRO)} fill={r === 2 && k === 2 ? 'currentColor' : undefined} />
      ))}
    </>
  )
}

function Medidor() {
  return (
    <>
      <path d="M22 60a38 38 0 0 1 76 0" fill="none" className="stroke-trilha" strokeWidth="12" />
      <path d="M22 60a38 38 0 0 1 20-33.5" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="12" />
      <path d="M42 26.5a38 38 0 0 1 36 0" fill="none" stroke="currentColor" strokeOpacity="0.65" strokeWidth="12" />
      <path d="M78 26.5a38 38 0 0 1 20 33.5" fill="none" stroke="currentColor" strokeWidth="12" />
      <line x1="60" y1="60" x2="80" y2="34" className={TRACO} strokeWidth="3" strokeLinecap="round" />
      <circle cx="60" cy="60" r="5" className="fill-tinta" />
    </>
  )
}

function FrascoEGota() {
  return (
    <>
      <rect x="44" y="8" width="24" height="10" rx="2" className="fill-tinta" />
      <path d="M46 18h20v8c6 3 10 8 10 14v28a4 4 0 0 1-4 4H40a4 4 0 0 1-4-4V40c0-6 4-11 10-14z" className={cn(VIDRO, TRACO)} strokeWidth="1.6" />
      <rect x="36" y="44" width="40" height="18" fill="currentColor" />
      <rect x="36" y="44" width="40" height="18" fill="none" className={TRACO} strokeWidth="1.6" />
      <path d="M50 53h12M56 47v12" className="stroke-superficie" strokeWidth="3" strokeLinecap="round" />
      <path d="M88 38c0 0-8 10-8 15a8 8 0 0 0 16 0c0-5-8-15-8-15z" fill="currentColor" fillOpacity="0.4" className={TRACO} strokeWidth="1.4" />
    </>
  )
}

const DESENHO: Record<IconeCategoria, () => React.JSX.Element | null> = {
  urgencias: Monitor, doses: AmpolaESeringa, calculadoras: Calculadora, escores: Medidor, intoxicacao: FrascoEGota, todas: () => null,
}

function ObjetoDoGrupo({ icone, className }: { icone: IconeCategoria; className?: string }) {
  const Desenho = DESENHO[icone]
  return (
    <svg aria-hidden viewBox="0 0 120 80" className={cn('h-auto', COR[icone], className)}>
      <Desenho />
    </svg>
  )
}

/** Fundo da vitrine: a cor do grupo bem diluída. Classes por extenso para o Tailwind. */
const FUNDO_DO_GRUPO: Record<IconeCategoria, string> = {
  urgencias: 'bg-critico/6', doses: 'bg-secao-farmacia/6', calculadoras: 'bg-secao-calculadoras/6',
  escores: 'bg-secao-neurologia/6', intoxicacao: 'bg-secao-toxicologia/6', todas: 'bg-acao/6',
}

/** A vitrine do cartão: o objeto do grupo sobre a cor do grupo bem diluída. */
export function VitrineDoGrupo({ icone, largo }: { icone: IconeCategoria; largo?: boolean }) {
  return (
    <span className={cn('flex h-24 w-full items-center justify-center', FUNDO_DO_GRUPO[icone])}>
      <ObjetoDoGrupo icone={icone} className={largo ? 'w-32' : 'w-28'} />
    </span>
  )
}
