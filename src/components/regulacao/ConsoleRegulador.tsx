// ─────────────────────────────────────────────────────────────────────────────
// Console do médico regulador no modelo do RT (25/11/2026; "manter a ideia
// inicial", mesmo dia), RG1, RG6–RG8 e os indicadores da fila agora.
// • Abas do topo no estilo do modelo (AbasConsole), com a contagem; o que não
//   cabe na largura vai para "Mais" (RO1 da revisão unslop). "Atualizado" e
//   "Nova solicitação" ficam na linha do título (Regulacao.tsx).
// • Filtros numa linha (RC1 da revisão unslop, RT 25/11/2026): busca ("/"),
//   "Filtros" (menu com prioridade, leito, isolamento, município, unidade,
//   status), as fichas só dos filtros ligados e "Exibição" (Agrupar e
//   Ordenar). Os atalhos com contagem ficam na linha de baixo; os zerados, em
//   cinza. Na origem os atalhos são os dela (RO2): "A central perguntou",
//   "Evolução vencida", "Devolvidos" e "Risco de cancelamento"; mandado
//   judicial e vulnerabilidade vão para o menu Filtros.
// • Fila densa (~410 px) à esquerda e dossiê no resto, as duas colunas com a
//   altura que sobra na janela (sem rolagem dupla) e rolagem própria; grupos
//   em caixa de frase ("1 · Emergência 6", RC2); linha com #nº, nome, etiqueta
//   do leito, município · unidade e, numa coluna à direita, o tempo na fila e
//   "evol." (fonte mono só no nº e nos tempos); isolamento com a situação e o
//   agente (RO3). No celular, uma coisa por vez, com "Voltar à fila". J/K e as
//   setas navegam.
// • FilaDensa é a mesma na central (ConsoleRegulador: regulacao_fila +
//   regulacao_fila_extras) e, no perfil Médico regulador numa unidade de
//   origem, nas abas Esperando decisão / Enviados / Recebidos (ConsoleOrigem),
//   com as ações e regras do lado da origem no dossiê.
// Lógica em src/lib/regulacaoFila.ts; migrations 20270425000020 e 20270426000044.
// ─────────────────────────────────────────────────────────────────────────────
import { Menu } from '@base-ui/react/menu'
import { Popover } from '@base-ui/react/popover'
import { ChevronDown, ChevronRight, ListFilter, Search, SlidersHorizontal, Waypoints, X } from 'lucide-react'
import * as React from 'react'

import { DossieRegulador, PontoPrioridade, type ControleDecisao, type ConversaSlot } from '@/components/regulacao/DossieRegulador'
import { useFilaCentral, useFilaOrigem, useVagasCentral, type AbaOrigem, type ItemConsole } from '@/components/regulacao/useRegulacaoCentral'
import { Chip, Vazio } from '@/components/monitor/Pagina'
import { BotaoLinha } from '@/components/ui/botao-linha'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CampoSelecao } from '@/components/ui/campo-selecao'
import { EsqueletoLinhas } from '@/components/ui/esqueleto-linhas'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MensagemErro } from '@/components/ui/mensagem-erro'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { hora } from '@/lib/formato'
import {
  ISOLAMENTOS, PRIORIDADES, STATUS, TIPOS_LEITO, formatarEspera, prioridadeEfetiva,
  type Prioridade, type StatusRegulacao,
} from '@/lib/regulacao'
import {
  AGRUPAMENTOS, ATALHOS, ATALHOS_ORIGEM, MARCAS, ORDENS, agrupar, contarAtalhos, demandaIsolamento, distribuicaoPrioridade, ehJudicial,
  esperaPorLeito, filtrarLocal, horasSemEvolucao, idsVisiveis, nivelEvolucao, ordenar, porMunicipio, seloIsolamento, temIsolamento, vizinho,
  type Agrupamento, type Atalho, type Ordem,
} from '@/lib/regulacaoFila'
import { cn } from '@/lib/utils'
import { tempoSemEvolucao } from '@/lib/tempoSemEvolucao'

// ── abas do topo ────────────────────────────────────────────────────────────
export type AbaConsole<K extends string> = { chave: K; rotulo: string; contagem?: number | string }

const LARGURA_MAIS = 96

/**
 * Abas do topo do modelo: sublinhado na ativa, contagem em etiqueta. As que
 * não cabem vão para o menu "Mais" (RO1); a ativa escondida aparece no botão.
 */
export function AbasConsole<K extends string>({ abas, valor, onChange }: {
  abas: AbaConsole<K>[]; valor: K; onChange: (k: K) => void
}) {
  const caixa = React.useRef<HTMLDivElement>(null)
  const medida = React.useRef<HTMLDivElement>(null)
  const [cabem, setCabem] = React.useState(abas.length)
  const chaves = abas.map((a) => `${a.chave}:${a.rotulo}:${a.contagem ?? ''}`).join('|')
  React.useLayoutEffect(() => {
    const medir = () => {
      const largura = caixa.current?.clientWidth ?? 0
      const tabs = [...(medida.current?.children ?? [])] as HTMLElement[]
      if (!largura || tabs.length === 0) return
      const total = tabs.reduce((t, el) => t + el.offsetWidth, 0)
      if (total <= largura) { setCabem(tabs.length); return }
      let soma = LARGURA_MAIS, n = 0
      for (const el of tabs) { if (soma + el.offsetWidth > largura) break; soma += el.offsetWidth; n++ }
      setCabem(Math.max(1, n))
    }
    medir()
    const ro = new ResizeObserver(medir)
    if (caixa.current) ro.observe(caixa.current)
    return () => ro.disconnect()
  }, [chaves])
  const visiveis = abas.slice(0, cabem)
  const resto = abas.slice(cabem)
  const ativaNoResto = resto.find((a) => a.chave === valor)
  const conteudo = (a: AbaConsole<K>) => (
    <>
      {a.rotulo}
      {a.contagem !== undefined && (
        <span className="rounded-controle border border-fio bg-campo px-1.5 text-rotulo tabular-nums text-tinta-apoio">{a.contagem}</span>
      )}
    </>
  )
  const classe = (ativa: boolean) => cn('-mb-px w-auto shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-2.5 py-2 text-apoio last:border-b-2 hover:bg-campo',
    ativa ? 'border-b-acao font-medium text-tinta' : 'border-b-transparent text-tinta-apoio')
  return (
    <div ref={caixa} className="relative border-b border-fio">
      {/* medida: as abas todas, invisíveis, para saber quantas cabem */}
      <div ref={medida} aria-hidden className="pointer-events-none invisible absolute top-0 left-0 flex h-0 overflow-hidden">
        {abas.map((a) => <span key={a.chave} className={cn(classe(a.chave === valor), 'inline-flex')}>{conteudo(a)}</span>)}
      </div>
      <div role="tablist" aria-label="Regulação" className="flex min-w-0 items-end gap-x-0.5">
        {visiveis.map((a) => (
          <BotaoLinha key={a.chave} variante="linha" role="tab" aria-selected={valor === a.chave} onClick={() => onChange(a.chave)} className={classe(valor === a.chave)}>
            {conteudo(a)}
          </BotaoLinha>
        ))}
        {resto.length > 0 && (
          <Menu.Root>
            <Menu.Trigger className={cn(classe(!!ativaNoResto), 'inline-flex border-x-0 border-t-0 bg-transparent')}>
              {ativaNoResto ? `Mais: ${ativaNoResto.rotulo}` : 'Mais'} <ChevronDown className="size-3.5" aria-hidden />
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner side="bottom" align="end" sideOffset={4} className="z-[80]">
                <Menu.Popup className="flex min-w-[200px] flex-col overflow-hidden rounded-container border border-fio bg-superficie py-1 text-tinta shadow-popover outline-none">
                  {resto.map((a) => (
                    <Menu.Item key={a.chave} onClick={() => onChange(a.chave)}
                      className={cn('flex cursor-default items-center gap-1.5 px-4 py-2 text-apoio outline-none select-none data-highlighted:bg-campo', valor === a.chave && 'font-medium')}>
                      {conteudo(a)}
                    </Menu.Item>
                  ))}
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        )}
      </div>
    </div>
  )
}

/** "Atualizado hh:mm" da fila (RG8). */
export function AtualizadoEm({ em }: { em: number }) {
  if (!em) return null
  return <span className="text-rotulo text-tinta-sussurro">Atualizado {hora(new Date(em).toISOString())}</span>
}

// ── linha e grupo ───────────────────────────────────────────────────────────
const BORDA: Record<string, string> = { critico: 'border-l-critico', atencao: 'border-l-atencao', info: 'border-l-acao', neutro: 'border-l-fio' }
const COR_EVOL = { em_dia: 'text-tinta-sussurro', vencida: 'text-atencao font-medium', risco: 'text-critico font-medium' } as const
const ETIQUETA = 'shrink-0 rounded-controle border px-1 text-rotulo leading-snug'
/** coluna dos tempos, à direita, com a mesma largura nas duas linhas */
const TEMPO = 'w-[5.5rem] shrink-0 text-right font-mono tabular-nums'

function LinhaFila({ s, selecionado, agora, comMunicipio, onClick }: {
  s: ItemConsole; selecionado: boolean; agora: number; comMunicipio: boolean; onClick: () => void
}) {
  const p = PRIORIDADES[prioridadeEfetiva(s)]
  const h = horasSemEvolucao(s.sla, agora)
  const nivel = nivelEvolucao(s.sla)
  return (
    <BotaoLinha variante="linha" role="option" aria-selected={selecionado} data-id={s.id} onClick={onClick}
      className={cn('flex-col gap-0.5 border-b-fio border-l-[3px] px-3 py-1.5 text-apoio hover:bg-campo', BORDA[p.tom], selecionado && 'bg-alerta-marca')}>
      <span className="flex w-full items-center gap-2">
        <span className="shrink-0 font-mono text-rotulo tabular-nums text-tinta-sussurro">#{s.numero}</span>
        <span className="min-w-0 flex-1 truncate font-medium text-tinta">{s.paciente.nome}</span>
        {ehJudicial(s) && <span className={cn(ETIQUETA, 'border-critico/40 text-critico')} title="Mandado judicial">Judicial</span>}
        {s.tipo_leito && <span className={cn(ETIQUETA, 'border-fio text-tinta-apoio')}>{TIPOS_LEITO[s.tipo_leito] ?? s.tipo_leito}</span>}
        <span className={cn(TEMPO, 'text-rotulo text-tinta-apoio')} title="Tempo na fila">{formatarEspera(s.espera_segundos)}</span>
      </span>
      <span className="flex w-full items-center gap-2 text-rotulo">
        <span className="min-w-0 flex-1 truncate text-tinta-apoio">{(comMunicipio ? [s.municipio, s.origem.nome] : [s.origem.nome]).filter(Boolean).join(' · ')}</span>
        {h != null && <span className={cn(TEMPO, COR_EVOL[nivel])} title="Tempo sem evolução">evol. {tempoSemEvolucao(h)}</span>}
      </span>
      {temIsolamento(s) && (
        <span className="flex w-full items-center gap-2 text-rotulo">
          <span className={cn(ETIQUETA, 'border-atencao/50 bg-alerta-atencao text-atencao')}>{seloIsolamento(s)}</span>
          {s.agente && <span className="min-w-0 truncate text-tinta-apoio" title={s.agente}>{s.agente}</span>}
        </span>
      )}
    </BotaoLinha>
  )
}

/** Segmentos (Agrupar por), um de cada vez. */
function Segmentos<K extends string>({ rotulo, opcoes, valor, onChange }: { rotulo: string; opcoes: [K, string][]; valor: K; onChange: (k: K) => void }) {
  return (
    <div role="radiogroup" aria-label={rotulo} className="inline-flex flex-wrap rounded-controle border border-fio bg-campo p-0.5">
      {opcoes.map(([k, r]) => (
        <BotaoLinha key={k} variante="linha" role="radio" aria-checked={valor === k} onClick={() => onChange(k)}
          className={cn('w-auto items-center rounded-controle border-0 px-2 py-0.5 text-rotulo',
            valor === k ? 'bg-superficie font-medium text-tinta shadow-xs hover:bg-superficie' : 'text-tinta-apoio hover:bg-superficie')}>
          {r}
        </BotaoLinha>
      ))}
    </div>
  )
}

/** Botão que abre um painel pequeno (Filtros, Exibição). */
function BotaoPainel({ rotulo, icone: Icone, contagem, children }: {
  rotulo: string; icone: typeof ListFilter; contagem?: number; children: React.ReactNode
}) {
  return (
    <Popover.Root>
      <Popover.Trigger className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-controle border border-fio bg-superficie px-2.5 text-apoio text-tinta transition-colors hover:border-acao/40 hover:text-acao data-popup-open:border-acao/40 data-popup-open:text-acao">
        <Icone className="size-4" aria-hidden />{rotulo}
        {!!contagem && <span className="rounded-capsula bg-acao px-1.5 text-rotulo tabular-nums text-sobre-acao">{contagem}</span>}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="start" sideOffset={6} className="z-[80]">
          <Popover.Popup aria-label={rotulo} className="flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2.5 rounded-container border border-fio bg-superficie p-3 text-apoio text-tinta shadow-popover outline-none">
            {children}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

function CampoDoPainel({ id, rotulo, children }: { id: string; rotulo: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-2">
      <Label htmlFor={id} className="text-rotulo text-tinta-apoio">{rotulo}</Label>
      {children}
    </div>
  )
}

/** Altura que sobra na janela abaixo da fila (tela larga), para a página não rolar junto com a fila e o dossiê. */
function useAlturaRestante(ref: React.RefObject<HTMLElement | null>, gatilho: React.RefObject<HTMLElement | null>) {
  const [altura, setAltura] = React.useState<number | null>(null)
  React.useLayoutEffect(() => {
    const medir = () => {
      const el = ref.current
      if (!el || !window.matchMedia('(min-width: 1024px)').matches) { setAltura(null); return }
      const rolagem = el.closest('main')
      const topo = el.getBoundingClientRect().top + (rolagem?.scrollTop ?? window.scrollY)
      // o main da casca reserva 72 px no pé (md:pb-[72px])
      setAltura(Math.max(480, Math.floor(window.innerHeight - topo - 72)))
    }
    medir()
    const ro = new ResizeObserver(medir)
    if (gatilho.current) ro.observe(gatilho.current)
    window.addEventListener('resize', medir)
    return () => { ro.disconnect(); window.removeEventListener('resize', medir) }
  }, [ref, gatilho])
  return altura
}

// ── fila densa + dossiê ─────────────────────────────────────────────────────
type FiltroStatus = { valor: StatusRegulacao | ''; onChange: (v: StatusRegulacao | '') => void; rotuloVazio: string }

export function FilaDensa({ itens, carregando, erro, atualizadoEm, selecionado, aoSelecionar, painel, municipioInicial, status, comMunicipio, vazio, lado = 'central' }: {
  itens: ItemConsole[]; carregando: boolean; erro: unknown; atualizadoEm: number
  selecionado: string | null; aoSelecionar: (id: string | null) => void
  painel: (id: string, item: ItemConsole | null) => React.ReactNode
  municipioInicial?: string
  /** select de status (a central lê do banco por status) */
  status?: FiltroStatus
  /** município da unidade que pede: só na central */
  comMunicipio: boolean
  vazio: string
  /** RO2: na origem, os atalhos dela; mandado judicial e vulnerabilidade no menu Filtros */
  lado?: 'central' | 'origem'
}) {
  const [busca, setBusca] = React.useState('')
  const [agruparPor, setAgruparPor] = React.useState<Agrupamento>('prioridade')
  const [ordem, setOrdem] = React.useState<Ordem>('gravidade')
  const [prioridade, setPrioridade] = React.useState<Prioridade | ''>('')
  const [leito, setLeito] = React.useState('')
  const [isolamento, setIsolamento] = React.useState('')
  const [municipio, setMunicipio] = React.useState(municipioInicial ?? '')
  const [unidade, setUnidade] = React.useState('')
  const [marca, setMarca] = React.useState<Atalho | ''>('')
  const [atalhos, setAtalhos] = React.useState<Atalho[]>([])
  const [recolhidos, setRecolhidos] = React.useState<Set<string>>(new Set())
  const buscaRef = React.useRef<HTMLInputElement>(null)
  const listaRef = React.useRef<HTMLDivElement>(null)
  const filtrosRef = React.useRef<HTMLElement>(null)
  const gradeRef = React.useRef<HTMLDivElement>(null)
  const altura = useAlturaRestante(gradeRef, filtrosRef)
  // horas sem evolução contadas da hora da leitura (a lista relê sozinha)
  const agora = atualizadoEm
  const listaAtalhos = lado === 'origem' ? ATALHOS_ORIGEM : ATALHOS

  const base = itens.filter((s) => (!prioridade || prioridadeEfetiva(s) === prioridade) && (!leito || s.tipo_leito === leito) && (!unidade || s.origem.nome === unidade))
  const comMarca = marca ? [marca] : []
  const contagens = contarAtalhos(filtrarLocal(base, { busca, isolamento, municipio, atalhos: comMarca }), listaAtalhos)
  const filtrados = filtrarLocal(base, { busca, isolamento, municipio, atalhos: [...atalhos, ...comMarca] })
  const agrupamentos = (Object.keys(AGRUPAMENTOS) as Agrupamento[]).filter((k) => comMunicipio || k !== 'municipio')
  const grupos = agrupar(ordenar(filtrados, ordem), agruparPor)
  const ids = idsVisiveis(grupos, recolhidos)
  const municipios = [...new Set(itens.map((s) => s.municipio).filter((m): m is string => !!m))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  const unidades = [...new Set(itens.map((s) => s.origem.nome).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  const item = itens.find((s) => s.id === selecionado) ?? null

  // fichas dos filtros ligados (RC1): cada uma diz o filtro e tira só ele
  const ligados: { chave: string; texto: string; tirar: () => void }[] = [
    ...(prioridade ? [{ chave: 'prioridade', texto: PRIORIDADES[prioridade].rotulo, tirar: () => setPrioridade('') }] : []),
    ...(leito ? [{ chave: 'leito', texto: TIPOS_LEITO[leito] ?? leito, tirar: () => setLeito('') }] : []),
    ...(isolamento ? [{ chave: 'isolamento', texto: isolamento === 'qualquer' ? 'Com isolamento' : isolamento === 'nenhum' ? 'Sem isolamento' : `Isolamento: ${ISOLAMENTOS[isolamento] ?? isolamento}`, tirar: () => setIsolamento('') }] : []),
    ...(municipio ? [{ chave: 'municipio', texto: municipio, tirar: () => setMunicipio('') }] : []),
    ...(unidade ? [{ chave: 'unidade', texto: unidade, tirar: () => setUnidade('') }] : []),
    ...(status?.valor ? [{ chave: 'status', texto: STATUS[status.valor], tirar: () => status.onChange('') }] : []),
    ...(marca ? [{ chave: 'marca', texto: MARCAS.find(([k]) => k === marca)?.[1] ?? marca, tirar: () => setMarca('') }] : []),
  ]
  const temFiltro = !!(busca || ligados.length || atalhos.length)
  const limpar = () => { setBusca(''); for (const l of ligados) l.tirar(); setAtalhos([]) }

  // "/" busca; J/K e setas navegam (fora de campos de texto)
  const idsRef = React.useRef(ids)
  const selRef = React.useRef(selecionado)
  React.useEffect(() => { idsRef.current = ids; selRef.current = selecionado })
  React.useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null
      if (alvo && (alvo.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName))) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === '/') { e.preventDefault(); buscaRef.current?.focus(); return }
      const passo = e.key === 'j' || e.key === 'J' || e.key === 'ArrowDown' ? 1 : e.key === 'k' || e.key === 'K' || e.key === 'ArrowUp' ? -1 : 0
      if (!passo) return
      e.preventDefault()
      const prox = vizinho(idsRef.current, selRef.current, passo as 1 | -1)
      if (prox) {
        aoSelecionar(prox)
        listaRef.current?.querySelector(`[data-id="${prox}"]`)?.scrollIntoView({ block: 'nearest' })
      }
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [aoSelecionar])

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <section ref={filtrosRef} aria-label="Filtros e exibição" className="flex flex-col gap-2 rounded-cartao border border-fio bg-superficie px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-52 flex-1 lg:max-w-md">
            <Search className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-tinta-sussurro" aria-hidden />
            <Input ref={buscaRef} aria-label="Buscar na fila" className="h-8 pl-7" value={busca} onChange={(e) => setBusca(e.target.value)}
              placeholder={comMunicipio ? 'Paciente, nº, CID, município, unidade ou agente' : 'Paciente, nº, CID, unidade ou agente'} />
            <kbd className="absolute top-1/2 right-2 -translate-y-1/2 rounded-controle border border-fio px-1 font-mono text-rotulo text-tinta-sussurro">/</kbd>
          </div>
          <BotaoPainel rotulo="Filtros" icone={ListFilter} contagem={ligados.length}>
            <CampoDoPainel id="fila-prioridade" rotulo="Prioridade">
              <CampoSelecao id="fila-prioridade" tamanho="compacto" value={prioridade} onChange={(e) => setPrioridade(e.target.value as Prioridade | '')}>
                <option value="">Todas</option>
                {(Object.keys(PRIORIDADES) as Prioridade[]).map((k) => <option key={k} value={k}>{PRIORIDADES[k].rotulo}</option>)}
              </CampoSelecao>
            </CampoDoPainel>
            <CampoDoPainel id="fila-leito" rotulo="Leito">
              <CampoSelecao id="fila-leito" tamanho="compacto" value={leito} onChange={(e) => setLeito(e.target.value)}>
                <option value="">Todos</option>
                {Object.entries(TIPOS_LEITO).map(([k, r]) => <option key={k} value={k}>{r}</option>)}
              </CampoSelecao>
            </CampoDoPainel>
            <CampoDoPainel id="fila-isolamento" rotulo="Isolamento">
              <CampoSelecao id="fila-isolamento" tamanho="compacto" value={isolamento} onChange={(e) => setIsolamento(e.target.value)}>
                <option value="">Todos</option>
                <option value="qualquer">Qualquer isolamento</option>
                <option value="nenhum">Sem isolamento</option>
                {Object.entries(ISOLAMENTOS).map(([k, r]) => <option key={k} value={k}>{r}</option>)}
              </CampoSelecao>
            </CampoDoPainel>
            {comMunicipio && (
              <CampoDoPainel id="fila-municipio" rotulo="Município">
                <CampoSelecao id="fila-municipio" tamanho="compacto" value={municipio} onChange={(e) => setMunicipio(e.target.value)}>
                  <option value="">Todos</option>
                  {municipios.map((m) => <option key={m} value={m}>{m}</option>)}
                </CampoSelecao>
              </CampoDoPainel>
            )}
            {unidades.length > 1 && (
              <CampoDoPainel id="fila-unidade" rotulo="Unidade de origem">
                <CampoSelecao id="fila-unidade" tamanho="compacto" value={unidade} onChange={(e) => setUnidade(e.target.value)}>
                  <option value="">Todas</option>
                  {unidades.map((u) => <option key={u} value={u}>{u}</option>)}
                </CampoSelecao>
              </CampoDoPainel>
            )}
            {status && (
              <CampoDoPainel id="fila-status" rotulo="Status">
                <CampoSelecao id="fila-status" tamanho="compacto" value={status.valor} onChange={(e) => status.onChange(e.target.value as StatusRegulacao | '')}>
                  <option value="">{status.rotuloVazio}</option>
                  {(Object.keys(STATUS) as StatusRegulacao[]).map((k) => <option key={k} value={k}>{STATUS[k]}</option>)}
                </CampoSelecao>
              </CampoDoPainel>
            )}
            {lado === 'origem' && (
              <CampoDoPainel id="fila-marca" rotulo="Marcação">
                <CampoSelecao id="fila-marca" tamanho="compacto" value={marca} onChange={(e) => setMarca(e.target.value as Atalho | '')}>
                  <option value="">Todas</option>
                  {MARCAS.map(([k, r]) => <option key={k} value={k}>{r}</option>)}
                </CampoSelecao>
              </CampoDoPainel>
            )}
          </BotaoPainel>
          {ligados.map((l) => (
            <button key={l.chave} type="button" onClick={l.tirar} aria-label={`Tirar o filtro ${l.texto}`}
              className="inline-flex h-7 max-w-56 items-center gap-1 rounded-capsula border border-acao/40 bg-acao/10 px-2.5 text-rotulo text-acao hover:bg-acao/15">
              <span className="truncate">{l.texto}</span><X className="size-3 shrink-0" aria-hidden />
            </button>
          ))}
          <span className="ml-auto flex items-center gap-2">
            {temFiltro && <Button size="xs" variant="ghost" onClick={limpar}>Limpar filtros</Button>}
            <BotaoPainel rotulo="Exibição" icone={SlidersHorizontal}>
              <div className="flex flex-col gap-1">
                <span className="text-rotulo text-tinta-apoio">Agrupar por</span>
                <Segmentos rotulo="Agrupar por" opcoes={agrupamentos.map((k) => [k, AGRUPAMENTOS[k]])} valor={agruparPor} onChange={setAgruparPor} />
              </div>
              <CampoDoPainel id="fila-ordem" rotulo="Ordenar">
                <CampoSelecao id="fila-ordem" tamanho="compacto" value={ordem} onChange={(e) => setOrdem(e.target.value as Ordem)}>
                  {(Object.keys(ORDENS) as Ordem[]).map((k) => <option key={k} value={k}>{ORDENS[k]}</option>)}
                </CampoSelecao>
              </CampoDoPainel>
            </BotaoPainel>
          </span>
        </div>
        <div role="group" aria-label="Atalhos" className="flex flex-wrap items-center gap-1.5">
          {listaAtalhos.map(([a, r]) => {
            const n = contagens[a] ?? 0
            const ativo = atalhos.includes(a)
            return (
              <Chip key={a} ativo={ativo} contagem={n} tom={a === 'risco' ? 'critico' : 'acao'} desabilitado={!ativo && n === 0}
                onClick={() => setAtalhos((x) => (x.includes(a) ? x.filter((y) => y !== a) : [...x, a]))}>{r}</Chip>
            )
          })}
        </div>
      </section>
      <MensagemErro texto={erro ? (erro as Error).message : null} />

      <div ref={gradeRef} style={altura ? { height: altura } : undefined}
        className="grid min-w-0 items-stretch overflow-hidden rounded-cartao border border-fio bg-superficie lg:min-h-[480px] lg:grid-cols-[410px_minmax(0,1fr)]">
        <aside aria-label="Fila" className={cn('flex min-h-0 flex-col lg:border-r lg:border-fio', selecionado && 'hidden lg:flex')}>
          <div className="flex items-center justify-between gap-2 border-b border-fio bg-campo px-3 py-1 text-rotulo text-tinta-sussurro">
            <span className="tabular-nums">Mostrando {filtrados.length} de {itens.length}</span>
            <span className="hidden lg:inline">J/K navegar · / buscar</span>
          </div>
          <div ref={listaRef} role="listbox" aria-label="Pedidos" className="min-h-40 flex-1 overflow-y-auto">
            {carregando ? <div className="p-3"><EsqueletoLinhas linhas={6} rotulo="Carregando…" /></div>
              : filtrados.length === 0 ? <div className="p-3"><Vazio icone={Waypoints} titulo="Nada aqui" texto={temFiltro || marca ? 'Nenhum pedido com esses filtros.' : vazio} /></div>
              : grupos.map((g) => (
                <div key={g.chave || 'sem'} role="group" aria-label={g.rotulo}>
                  {agruparPor !== 'nenhum' && (
                    <BotaoLinha variante="linha" aria-expanded={!recolhidos.has(g.chave)}
                      onClick={() => setRecolhidos((r) => { const n = new Set(r); if (n.has(g.chave)) n.delete(g.chave); else n.add(g.chave); return n })}
                      className="sticky top-0 z-[1] items-center gap-1.5 border-b border-fio bg-campo px-3 py-1 text-rotulo font-medium text-tinta-apoio hover:bg-trilha">
                      {recolhidos.has(g.chave) ? <ChevronRight className="size-3.5" aria-hidden /> : <ChevronDown className="size-3.5" aria-hidden />}
                      {agruparPor === 'prioridade' ? <PontoPrioridade p={g.chave as Prioridade} /> : g.rotulo}
                      <span className="ml-auto tabular-nums">{g.itens.length}</span>
                    </BotaoLinha>
                  )}
                  {!recolhidos.has(g.chave) && g.itens.map((s) => (
                    <LinhaFila key={s.id} s={s} agora={agora} comMunicipio={comMunicipio} selecionado={s.id === selecionado} onClick={() => aoSelecionar(s.id)} />
                  ))}
                </div>
              ))}
          </div>
        </aside>
        <section aria-label="Dossiê do pedido" className={cn('min-h-0 min-w-0 overflow-y-auto', !selecionado && 'hidden lg:block')}>
          {selecionado ? painel(selecionado, item) : (
            <p className="p-6 text-center text-tinta-sussurro">Escolha um pedido na fila para abrir o dossiê.</p>
          )}
        </section>
      </div>
    </div>
  )
}

// ── central ─────────────────────────────────────────────────────────────────
export function ConsoleRegulador({ centralId, souRegulador, selecionado, aoSelecionar, decisao, conversa, municipioInicial }: {
  centralId: string; souRegulador: boolean
  selecionado: string | null; aoSelecionar: (id: string | null) => void
  decisao: (id: string, ctrl: ControleDecisao, aoFim: () => void) => React.ReactNode
  conversa?: ConversaSlot
  /** "Filtrar fila" da aba Por município (quem monta remonta a fila com key) */
  municipioInicial?: string
}) {
  const [status, setStatus] = React.useState<StatusRegulacao | ''>('')
  const { fila, extras, itens, atualizadoEm } = useFilaCentral(centralId, status)
  return (
    <FilaDensa itens={itens} carregando={fila.isLoading} erro={fila.error ?? extras.error} atualizadoEm={atualizadoEm}
      selecionado={selecionado} aoSelecionar={aoSelecionar} municipioInicial={municipioInicial} comMunicipio
      status={{ valor: status, onChange: setStatus, rotuloVazio: 'Status: em aberto' }} vazio="Nenhum pedido esperando decisão."
      painel={(id, item) => (
        <DossieRegulador key={id} id={id} lado="central" centralId={centralId} souRegulador={souRegulador} decisao={decisao} conversa={conversa}
          aoVoltar={() => aoSelecionar(null)} aoFechar={() => aoSelecionar(null)}
          fila={item ? {
            espera_segundos: item.espera_segundos, assumida_por: item.assumida_por, assumida_por_mim: item.assumida_por_mim,
            municipio: item.municipio, situacao: item.situacao, agente: item.agente,
            origem_coord: { latitude: item.origem_latitude ?? null, longitude: item.origem_longitude ?? null },
          } : null} />
      )} />
  )
}

// ── unidade de origem, perfil Médico regulador ──────────────────────────────
/**
 * Esperando decisão, Enviados e Recebidos da central no leiaute do console.
 * O dossiê fica no lado da origem: as ações e as regras de sempre (cancelar,
 * responder, reenviar, saída, aceite do destino), sem decidir nem reservar.
 */
export function ConsoleOrigem({ unidadeId, aba, selecionado, aoSelecionar, decisao, conversa }: {
  unidadeId: string; aba: AbaOrigem
  selecionado: string | null; aoSelecionar: (id: string | null) => void
  decisao: (id: string, ctrl: ControleDecisao, aoFim: () => void) => React.ReactNode
  conversa?: ConversaSlot
}) {
  const { itens, carregando, erro, atualizadoEm } = useFilaOrigem(unidadeId, aba)
  return (
    <FilaDensa key={aba} itens={itens} carregando={carregando} erro={erro} atualizadoEm={atualizadoEm}
      selecionado={selecionado} aoSelecionar={aoSelecionar} comMunicipio={false} lado="origem"
      vazio={aba === 'esperando' ? 'Nenhum pedido da unidade esperando decisão.' : aba === 'enviados' ? 'Quando a central decidir um pedido da unidade, ele passa para cá.' : 'Nenhum pedido mandado pela central para esta unidade.'}
      painel={(id, item) => (
        <DossieRegulador key={id} id={id} lado="origem" unidadeId={unidadeId} centralId="" souRegulador={false} decisao={decisao} conversa={conversa}
          aoVoltar={() => aoSelecionar(null)} aoFechar={() => aoSelecionar(null)}
          fila={item ? { espera_segundos: item.espera_segundos, assumida_por: null, assumida_por_mim: false, situacao: item.situacao, agente: item.agente } : null} />
      )} />
  )
}

/** RG6: demanda por município de origem, com "Filtrar fila". */
export function PorMunicipio({ centralId, aoFiltrar }: { centralId: string; aoFiltrar: (municipio: string) => void }) {
  const { fila, itens } = useFilaCentral(centralId)
  const linhas = porMunicipio(itens)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-corpo">Por município / origem</CardTitle>
        <CardDescription>Pedidos em aberto na fila, pelo município da unidade que pede (cadastro da unidade).</CardDescription>
      </CardHeader>
      <CardContent className="text-apoio">
        {fila.isLoading ? <EsqueletoLinhas linhas={4} rotulo="Carregando…" /> : linhas.length === 0 ? (
          <Vazio icone={Waypoints} titulo="Fila vazia" texto="Nenhum pedido em aberto." />
        ) : (
          <div className="overflow-x-auto">
            <Table variante="referencia" className="w-full text-left">
              <TableHeader className="text-rotulo text-tinta-apoio">
                <TableRow className="border-b border-fio">
                  <TableHead className="py-1.5 pr-2 font-medium">Município</TableHead><TableHead className="py-1.5 pr-2 font-medium">Unidades solicitantes</TableHead>
                  <TableHead className="py-1.5 pr-2 font-medium">Total</TableHead><TableHead className="py-1.5 pr-2 font-medium">Prioridade 1</TableHead>
                  <TableHead className="py-1.5 pr-2 font-medium">Prioridade 2</TableHead><TableHead className="py-1.5 pr-2 font-medium">Em isolamento</TableHead>
                  <TableHead className="py-1.5 pr-2 font-medium">Risco de cancelamento</TableHead><TableHead className="py-1.5 font-medium" />
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-fio tabular-nums">
                {linhas.map((l) => (
                  <TableRow key={l.municipio || 'sem'}>
                    <TableCell className="py-1.5 pr-2 font-medium text-tinta">{l.municipio || 'Não informado'}</TableCell>
                    <TableCell className="py-1.5 pr-2 text-tinta-apoio">{l.unidades.join(', ')}</TableCell>
                    <TableCell className="py-1.5 pr-2">{l.total}</TableCell><TableCell className="py-1.5 pr-2">{l.p1}</TableCell><TableCell className="py-1.5 pr-2">{l.p2}</TableCell>
                    <TableCell className="py-1.5 pr-2">{l.isolamento}</TableCell><TableCell className="py-1.5 pr-2">{l.risco}</TableCell>
                    <TableCell className="py-1.5 text-right">{l.municipio && <Button size="xs" variant="outline" onClick={() => aoFiltrar(l.municipio)}>Filtrar fila</Button>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function Tabela({ titulo, descricao, cab, linhas }: { titulo: string; descricao: string; cab: string[]; linhas: React.ReactNode[][] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-corpo">{titulo}</CardTitle>
        <CardDescription>{descricao}</CardDescription>
      </CardHeader>
      <CardContent className="text-apoio">
        {linhas.length === 0 ? <p className="text-tinta-sussurro">Nada na fila agora.</p> : (
          <div className="overflow-x-auto">
            <Table variante="referencia" className="w-full text-left">
              <TableHeader className="text-rotulo text-tinta-apoio"><TableRow className="border-b border-fio">{cab.map((c) => <TableHead key={c} className="py-1.5 pr-2 font-medium">{c}</TableHead>)}</TableRow></TableHeader>
              <TableBody className="divide-y divide-fio tabular-nums">
                {linhas.map((l, i) => <TableRow key={i}>{l.map((c, j) => <TableCell key={j} className={cn('py-1.5 pr-2', j === 0 && 'text-tinta')}>{c}</TableCell>)}</TableRow>)}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/** Indicadores da fila agora: isolamento × oferta, prioridade e espera por tipo de leito. */
export function IndicadoresFila({ centralId }: { centralId: string }) {
  const { fila, itens } = useFilaCentral(centralId)
  const vagas = useVagasCentral(centralId)
  if (fila.isLoading || vagas.isLoading) return <EsqueletoLinhas linhas={4} rotulo="Carregando a fila…" />
  const unidades = vagas.data?.unidades ?? []
  return (
    <div className="flex flex-col gap-3">
      <Tabela titulo="Demanda por isolamento × oferta" cab={['Isolamento', 'Aguardando', 'Oferta compatível (livres agora)']}
        descricao="Pedidos em aberto por tipo de isolamento e os leitos livres que servem na rede (aerossol e contato + aerossol só com pressão negativa)."
        linhas={demandaIsolamento(itens, unidades).map((l) => [l.rotulo, l.aguardando, l.oferta])} />
      <Tabela titulo="Distribuição por prioridade" cab={['Prioridade', 'Casos', '% da fila', 'Evolução vencida', 'Risco de cancelamento']}
        descricao="Pedidos em aberto pela prioridade que vale (a do regulador, se houver). Prazos de evolução da central."
        linhas={distribuicaoPrioridade(itens).map((l) => [PRIORIDADES[l.prioridade].rotulo, l.casos, `${l.pct}%`, l.evolucao_vencida, l.risco])} />
      <Tabela titulo="Espera média por tipo de leito" cab={['Tipo de leito', 'Aguardando', 'Com isolamento', 'Espera média', 'Livres gerais', 'Livres isolamento', 'Livres pressão negativa']}
        descricao="Tempo na fila dos pedidos em aberto e os livres do mapa de vagas no mesmo tipo de leito."
        linhas={esperaPorLeito(itens, unidades).map((l) => [l.rotulo, l.aguardando, l.com_isolamento, formatarEspera(l.espera_media_seg),
          l.livres.geral, l.livres.isolamento, l.livres.pressao_negativa])} />
    </div>
  )
}
