import type { LucideIcon } from 'lucide-react'
import { Minus, TrendingDown, TrendingUp } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

// Faixa de Parâmetros — componente-assinatura do Monitor de Cabeceira
// (02-gramatica-visual.md). Duas regras:
//   · A identidade pertence à grandeza: rótulo e barra na cor da grandeza.
//   · O estado pertence ao numeral: cor e corpo (30/36/42px) do estado.
// A barra que tem limiar o desenha (marca de 2px grafite) e o escreve por
// extenso; barra sem limiar não recebe marca — a ausência é informação.

export type Grandeza = 'leitos' | 'observacao' | 'turno' | 'suprimento'
export type Nivel = 'ok' | 'atencao' | 'critico'

const COR_GRANDEZA: Record<Grandeza, string> = {
  leitos: 'text-leitos',
  observacao: 'text-observacao',
  turno: 'text-turno',
  suprimento: 'text-suprimento',
}
const BARRA_GRANDEZA: Record<Grandeza, string> = {
  leitos: 'bg-leitos',
  observacao: 'bg-observacao',
  turno: 'bg-turno',
  suprimento: 'bg-suprimento',
}
const NUMERAL: Record<Nivel, string> = {
  ok: 'text-ok text-numeral-ok',
  atencao: 'text-atencao text-numeral-atencao',
  critico: 'text-critico text-numeral-critico',
}
const ESTADO_TEXTO: Record<Nivel, string> = {
  ok: 'text-tinta-apoio',
  atencao: 'text-atencao',
  critico: 'text-critico',
}

// Tendência: a cor responde a uma pergunta só — o movimento vai em direção
// ao limite (âmbar) ou se afasta dele (verde)? Tempo passando fica cinza.
export type Tendencia = {
  dir: 'sobe' | 'desce' | 'estavel'
  texto: string
  sentido: 'piora' | 'melhora' | 'neutro'
}
const TEND_ICONE = { sobe: TrendingUp, desce: TrendingDown, estavel: Minus }
const TEND_COR = { piora: 'text-observacao', melhora: 'text-leitos', neutro: 'text-tinta-sussurro' }
const TEND_LEITURA = {
  piora: 'movimento em direção ao limite',
  melhora: 'movimento se afastando do limite',
  neutro: 'sem carga de alarme',
}

export type ParametroProps = {
  grandeza: Grandeza
  icone: LucideIcon
  rotulo: string
  valor: ReactNode
  unidade?: string
  /** Estado escrito ao lado da cor — cor nunca é o único canal. */
  estado: string
  nivel: Nivel
  /** Preenchimento da barra, de 0 a 1. Ausente = sem barra. */
  pct?: number
  /** Posição do limite, de 0 a 1. Ausente = sem marca (e isso é informação). */
  limite?: number
  /** O limite por extenso: "limite 85%", "mínimo 12". */
  limiteTexto?: string
  tend?: Tendencia
  /** Leitura antiga: perde a cor de grandeza, a barra vira hachura, a tendência sai. */
  velho?: string
  onClick?: () => void
}

const limitar = (n: number) => Math.max(0, Math.min(1, n))

export function Parametro({
  grandeza, icone: Icone, rotulo, valor, unidade, estado, nivel,
  pct, limite, limiteTexto, tend, velho, onClick,
}: ParametroProps) {
  const TendIcone = tend ? TEND_ICONE[tend.dir] : null
  const conteudo = (
    <>
      <div className={cn('rotulo flex min-h-[2.5em] items-start gap-1.5 [grid-area:rot]', velho ? 'text-tinta-sussurro' : COR_GRANDEZA[grandeza])}>
        <Icone className="mt-px size-3 shrink-0" aria-hidden />
        <span>{rotulo}</span>
      </div>
      {velho ? (
        <span className="self-start text-rotulo font-medium text-tinta-sussurro tabular [grid-area:tend]">{velho}</span>
      ) : tend && TendIcone ? (
        <span
          className={cn('flex items-center gap-1 self-start text-rotulo font-medium whitespace-nowrap tabular [grid-area:tend]', TEND_COR[tend.sentido])}
          title={TEND_LEITURA[tend.sentido]}
        >
          <TendIcone className="size-3" aria-hidden />
          {tend.texto}
          <span className="sr-only">, {TEND_LEITURA[tend.sentido]}</span>
        </span>
      ) : null}
      <div className="flex items-baseline gap-1.5 leading-none font-semibold tracking-[-0.03em] tabular [grid-area:val]">
        <span className={velho ? 'text-numeral-ok text-tinta-sussurro' : NUMERAL[nivel]}>{valor}</span>
        {unidade && <span className="text-rotulo font-medium tracking-normal text-tinta-apoio">{unidade}</span>}
      </div>
      <div className={cn('text-rotulo leading-[1.3] [grid-area:est]', velho ? 'text-tinta-sussurro' : ESTADO_TEXTO[nivel])}>
        {estado}
        {limiteTexto && <span className="text-tinta-sussurro"> · {limiteTexto}</span>}
      </div>
      {pct !== undefined && (
        <div className="relative mt-1 h-1.5 rounded-capsula bg-trilha [grid-area:campo]" aria-hidden>
          <div
            className={cn('absolute inset-y-0 left-0 max-w-full rounded-capsula', velho ? 'bg-[repeating-linear-gradient(45deg,#CBD5E1_0_3px,transparent_3px_6px)]' : BARRA_GRANDEZA[grandeza])}
            style={{ width: `${limitar(pct) * 100}%` }}
          />
          {limite !== undefined && (
            <div className="absolute -top-0.5 -bottom-0.5 w-0.5 bg-grafite" style={{ left: `calc(${limitar(limite) * 100}% - 1px)` }} />
          )}
        </div>
      )}
    </>
  )
  const classe = 'grid min-w-0 grid-cols-[minmax(0,1fr)_auto] content-start gap-x-2.5 gap-y-[5px] px-5 pt-[13px] pb-[15px] text-left [grid-template-areas:"rot_tend"_"val_val"_"est_est"_"campo_campo"]'
  // Nenhum número de risco sem caminho: se há destino, a célula inteira é o link.
  return onClick ? (
    <button type="button" onClick={onClick} className={cn(classe, 'cursor-pointer transition-colors hover:bg-campo')}>
      {conteudo}
    </button>
  ) : (
    <div className={classe}>{conteudo}</div>
  )
}

/**
 * A faixa: quatro células sticky logo abaixo do topo, na mesma coluna do conteúdo.
 * Em telas estreitas vira carrossel com scroll-snap e continua imóvel.
 */
export function FaixaParametros({ children, rotulo = 'Parâmetros do plantão', fita }: { children: ReactNode; rotulo?: string; fita?: ReactNode }) {
  return (
    <section aria-label={rotulo} className="sticky top-0 z-[9] -mx-4 mb-6 border-b border-fio bg-superficie md:-mx-7 lg:top-[var(--cc-topo)]">
      {fita}
      <div className="mx-auto grid max-w-[var(--cc-coluna)] snap-x snap-mandatory auto-cols-[78%] grid-flow-col overflow-x-auto [&>*+*]:border-l [&>*+*]:border-trilha min-[900px]:grid-flow-row min-[900px]:grid-cols-2 min-[900px]:overflow-visible min-[1024px]:grid-cols-4 [&>*]:snap-start">
        {children}
      </div>
    </section>
  )
}

/** Fita de dado velho / sem sinal: cinza, porque ausência não é alarme clínico. */
export function FitaSinal({ texto, acao, onAcao }: { texto: string; acao: string; onAcao: () => void }) {
  return (
    <div role="status" className="flex flex-wrap items-center gap-2.5 border-b border-fio px-5 py-2 text-rotulo leading-[1.35] text-tinta-apoio">
      {texto}
      <button type="button" onClick={onAcao} className="ml-auto rounded-lg border border-fio bg-superficie px-2.5 py-1 font-medium text-tinta-apoio hover:border-[#94A3B8] hover:text-tinta">
        {acao}
      </button>
    </div>
  )
}
