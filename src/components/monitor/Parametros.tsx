import type { LucideIcon } from 'lucide-react'
import { ArrowRight, Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { Children, isValidElement, type ReactElement, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Faixa de Parâmetros — componente-assinatura do Monitor de Cabeceira
// (02-gramatica-visual.md). Duas regras:
//   · A identidade pertence à grandeza: o fio do rótulo e a barra na cor da grandeza.
//   · O estado pertence ao numeral: a cor do número é a do estado.
// Forma de régua (revisão visual 3.1, opção "B" do RT, 21/10/2026): cada
// parâmetro é uma linha — rótulo, número, a escala e o estado por extenso. A
// escala é a leitura: o limite fica desenhado (marca grafite) e escrito junto do
// número ("7h20 · limite 6h", ajuste de 21/10/2026 a partir das páginas de cota
// do Refero: Appwrite, Cohere); escala sem limite não recebe marca — a ausência
// é informação. Sem o número gigante de painel nem o ícone em cada célula. Em
// célula estreita (as grades do gestor) a linha empilha: rótulo e número, a
// escala, o estado. Na faixa do topo das telas, os mesmos parâmetros passam
// pelo `ResumoParametros` (opção "F"): primeiro o que pede ação.

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
  /** Texto do caminho na linha de ação da faixa ("Ver observação"); sem ele, "Abrir". */
  acao?: string
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
        {/* o limite junto do número ("7h20 · limite 6h"), como nas páginas de cota (Appwrite, Cohere) */}
        {limiteTexto && <span className="text-rotulo font-medium whitespace-nowrap text-tinta-sussurro">· {limiteTexto}</span>}
      </span>
      {pct !== undefined ? (
        <span className="cc-param-campo relative block" aria-hidden>
          <span className="absolute inset-x-0 top-[5px] h-1.5 rounded-capsula bg-trilha" />
          <span
            className={cn('absolute top-[5px] left-0 h-1.5 max-w-full rounded-capsula', velho ? 'bg-[repeating-linear-gradient(45deg,#CBD5E1_0_3px,transparent_3px_6px)]' : BARRA_GRANDEZA[grandeza])}
            style={{ width: `${limitar(pct) * 100}%` }}
          />
          {limite !== undefined && (
            <span className="absolute top-0 h-4 w-0.5 bg-grafite" style={{ left: `calc(${limitar(limite) * 100}% - 1px)` }} />
          )}
        </span>
      ) : (
        <span className="cc-param-campo cc-param-sem-escala" aria-hidden />
      )}
      <span className={cn('cc-param-est flex min-w-0 flex-wrap items-center gap-x-2 text-apoio leading-[1.35]', velho ? 'text-tinta-sussurro' : ESTADO_TEXTO[nivel])}>
        <span>{estado}</span>
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
 * Resumo dos parâmetros, "primeiro o que pede ação" (revisão visual 3.1,
 * opção "F" do RT, 21/10/2026; referências do Refero: grupos de SLA da Linear
 * e o "Immediate Action Required" da Factory). Recebe os mesmos `<Parametro>`
 * e os separa pelo nível: o que está em atenção ou crítico vira uma linha com o
 * número na cor do estado, o que aconteceu e o caminho; o que está em ordem
 * vira uma linha quieta embaixo. Sem nada fora do limite, sobra só a linha
 * quieta. O crítico vem antes da atenção; dentro de cada nível, a ordem é a de
 * quem chama.
 */
export function ResumoParametros({ children, className }: { children: ReactNode; className?: string }) {
  const itens = Children.toArray(children).filter((c): c is ReactElement<ParametroProps> => isValidElement(c)).map((c) => c.props)
  const peso = (p: ParametroProps) => (p.velho ? 0 : p.nivel === 'critico' ? 2 : p.nivel === 'atencao' ? 1 : 0)
  const acao = itens.filter((p) => peso(p) > 0).sort((a, b) => peso(b) - peso(a))
  const quietos = itens.filter((p) => peso(p) === 0)
  return (
    <div className={cn('cc-resumo', className)}>
      {/* As linhas de ação dividem uma grade (subgrid): a coluna do número tem a
          largura do maior número da faixa, e os textos começam no mesmo ponto. */}
      {acao.length > 0 && (
      <div className="sm:grid sm:grid-cols-[max-content_minmax(0,1fr)_auto]">
      {acao.map((p) => (
        <div key={p.rotulo} className="flex flex-col gap-1 border-b border-trilha px-5 py-3 sm:col-span-3 sm:grid sm:grid-cols-subgrid sm:items-baseline sm:gap-x-proximo">
          <span className={cn('flex shrink-0 flex-wrap items-baseline gap-x-1.5 text-secao font-semibold tabular sm:max-w-56', NUMERAL[p.nivel])}>
            {p.valor}
            {p.unidade && <span className="text-apoio font-medium">{p.unidade}</span>}
          </span>
          <span className="min-w-0 flex-1 text-controle text-pretty text-tinta-apoio">
            <b className="font-semibold text-tinta">{p.rotulo}.</b> {p.estado}
            {p.limiteTexto && <span className="text-tinta-sussurro"> · {p.limiteTexto}</span>}
            {p.tend && <span className={cn('ml-2 text-rotulo font-medium', TEND_COR[p.tend.sentido])}>{p.tend.texto}</span>}
          </span>
          {p.onClick && (
            <Button variant="link" onClick={p.onClick} className="h-auto min-h-0 self-start p-0 text-controle font-medium sm:self-auto">
              {p.acao ?? 'Abrir'}
              <ArrowRight className="size-3.5" aria-hidden />
            </Button>
          )}
        </div>
      ))}
      </div>
      )}
      {quietos.length > 0 && (
        <p className="flex flex-wrap gap-x-secao gap-y-1 bg-campo px-5 py-2.5 text-controle text-tinta-apoio">
          {quietos.map((p) => (
            <span key={p.rotulo}>
              {p.rotulo}:{' '}
              <b className={cn('font-semibold tabular', p.velho ? 'text-tinta-sussurro' : 'text-tinta')}>
                {p.valor}{p.unidade ? ` ${p.unidade}` : ''}
              </b>
              <span className="text-tinta-sussurro"> · {p.velho ?? p.estado}</span>
            </span>
          ))}
        </p>
      )}
    </div>
  )
}

/**
 * A faixa: o resumo logo abaixo do título da página inicial do papel, como um
 * bloco da coluna do conteúdo (mesma borda e canto das peças da página). Não
 * fica fixa ao rolar. Quem a posiciona é o TituloPagina (FaixaDaPagina).
 */
export function FaixaParametros({ children, rotulo = 'Parâmetros do plantão', fita }: { children: ReactNode; rotulo?: string; fita?: ReactNode }) {
  return (
    <section aria-label={rotulo} className="mb-[22px] overflow-hidden rounded-container border border-fio bg-superficie">
      {fita}
      <ResumoParametros>{children}</ResumoParametros>
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
