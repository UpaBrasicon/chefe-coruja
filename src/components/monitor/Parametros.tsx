import type { LucideIcon } from 'lucide-react'
import { Minus, TrendingDown, TrendingUp } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

// Faixa de Parâmetros — componente-assinatura do Monitor de Cabeceira
// (02-gramatica-visual.md). Duas regras:
//   · A identidade pertence à grandeza: o fio do rótulo e a barra na cor da grandeza.
//   · O estado pertence ao numeral: a cor do número é a do estado.
// Forma de régua (revisão visual 3.1, opção "B" do RT, 21/10/2026): cada
// parâmetro é uma linha — rótulo, número, a escala e o estado por extenso. A
// escala é a leitura: o limite fica desenhado (marca grafite) e escrito embaixo
// dela; escala sem limite não recebe marca — a ausência é informação. Sem o
// número gigante de painel nem o ícone em cada célula. Em célula estreita (as
// grades do gestor) a linha empilha: rótulo e número, a escala, o estado.

export type Grandeza = 'leitos' | 'observacao' | 'turno' | 'suprimento'
export type Nivel = 'ok' | 'atencao' | 'critico'

const BARRA_GRANDEZA: Record<Grandeza, string> = {
  leitos: 'bg-leitos',
  observacao: 'bg-observacao',
  turno: 'bg-turno',
  suprimento: 'bg-suprimento',
}
const NUMERAL: Record<Nivel, string> = {
  ok: 'text-ok',
  atencao: 'text-atencao',
  critico: 'text-critico',
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
  /** Aceito por compatibilidade; a régua não desenha ícone (revisão visual 3.1). */
  icone?: LucideIcon
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
  grandeza, rotulo, valor, unidade, estado, nivel,
  pct, limite, limiteTexto, tend, velho, onClick,
}: ParametroProps) {
  const TendIcone = tend ? TEND_ICONE[tend.dir] : null
  const conteudo = (
    <span className="cc-param-corpo">
      <span className="cc-param-rot flex min-w-0 items-center gap-2 text-controle text-tinta-apoio">
        <span aria-hidden className={cn('h-4 w-[3px] shrink-0 rounded-capsula', velho ? 'bg-fio-forte' : BARRA_GRANDEZA[grandeza])} />
        <span className="min-w-0">{rotulo}</span>
      </span>
      <span className="cc-param-val flex items-baseline justify-end gap-1.5 leading-none font-semibold tabular">
        <span className={cn('text-secao', velho ? 'text-tinta-sussurro' : NUMERAL[nivel])}>{valor}</span>
        {unidade && <span className="text-rotulo font-medium text-tinta-apoio">{unidade}</span>}
      </span>
      {pct !== undefined ? (
        <span className="cc-param-campo relative block" aria-hidden>
          <span className="absolute inset-x-0 top-[5px] h-1.5 rounded-capsula bg-trilha" />
          <span
            className={cn('absolute top-[5px] left-0 h-1.5 max-w-full rounded-capsula', velho ? 'bg-[repeating-linear-gradient(45deg,#CBD5E1_0_3px,transparent_3px_6px)]' : BARRA_GRANDEZA[grandeza])}
            style={{ width: `${limitar(pct) * 100}%` }}
          />
          {limite !== undefined && (
            <span className="absolute top-0 h-4 w-0.5 bg-grafite" style={{ left: `calc(${limitar(limite) * 100}% - 1px)` }}>
              {/* o texto do limite fica sob a marca; perto das pontas, alinha para dentro */}
              {limiteTexto && (
                <span
                  className="absolute top-[17px] text-rotulo whitespace-nowrap text-tinta-sussurro"
                  style={limite > 0.8 ? { right: 0 } : limite < 0.2 ? { left: 0 } : { left: '50%', transform: 'translateX(-50%)' }}
                >
                  {limiteTexto}
                </span>
              )}
            </span>
          )}
        </span>
      ) : (
        <span className="cc-param-campo cc-param-sem-escala" aria-hidden />
      )}
      <span className={cn('cc-param-est flex min-w-0 flex-wrap items-center gap-x-2 text-apoio leading-[1.35]', velho ? 'text-tinta-sussurro' : ESTADO_TEXTO[nivel])}>
        <span>{estado}</span>
        {limiteTexto && limite === undefined && <span className="text-tinta-sussurro">{limiteTexto}</span>}
        {velho ? (
          <span className="cc-tend-idade text-rotulo font-medium text-tinta-sussurro tabular">{velho}</span>
        ) : tend && TendIcone ? (
          <span className={cn('cc-param-tend flex items-center gap-1 text-rotulo font-medium whitespace-nowrap tabular', TEND_COR[tend.sentido])} title={TEND_LEITURA[tend.sentido]}>
            <TendIcone className="size-3" aria-hidden />
            <span className="cc-tend-txt">{tend.texto}</span>
            <span className="sr-only">, {TEND_LEITURA[tend.sentido]}</span>
          </span>
        ) : null}
      </span>
    </span>
  )
  // A grade da linha (e a linha empilhada em célula estreita) vive em
  // index.css, .cc-param e .cc-param-corpo: o modo compacto a reescreve por classe.
  const classe = 'cc-param block w-full min-w-0 px-5 py-2.5 text-left'
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
 * A faixa: as réguas empilhadas logo abaixo do topo, na mesma coluna do
 * conteúdo. Deixou de ser fixa ao rolar: quatro linhas tomariam a tela.
 */
export function FaixaParametros({ children, rotulo = 'Parâmetros do plantão', fita }: { children: ReactNode; rotulo?: string; fita?: ReactNode }) {
  return (
    <section aria-label={rotulo} className="-mx-4 -mt-5 mb-6 border-b border-fio bg-superficie md:-mx-7 md:-mt-7">
      {fita}
      <div className="cc-faixa cc-coluna mx-auto">
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
      <button type="button" onClick={onAcao} className="ml-auto rounded-controle border border-fio bg-superficie px-2.5 py-1 font-medium text-tinta-apoio hover:border-fio-forte hover:text-tinta">
        {acao}
      </button>
    </div>
  )
}
