// ─────────────────────────────────────────────────────────────────────────────
// Fila do médico regulador no modelo do RT (25/11/2026), RG1, RG6–RG8 e os
// indicadores da fila agora. Duas colunas: a fila densa à esquerda (nº,
// paciente, tipo de leito, município · unidade, tempo na fila, horas sem
// evolução em âmbar/vermelho pelos prazos reais da central, isolamento e
// agente, borda pela prioridade) e o dossiê à direita (DossieRegulador). No
// celular, uma coisa por vez, com "Voltar à fila".
// Barra: busca ("/"), Agrupar por, Ordenar, selects e atalhos com contagem;
// J/K e as setas navegam. Dados: regulacao_fila (a mesma da tela anterior) e
// regulacao_fila_extras (migration 20270425000020). Lógica em
// src/lib/regulacaoFila.ts.
// ─────────────────────────────────────────────────────────────────────────────
import { ChevronDown, ChevronRight, Search, Waypoints } from 'lucide-react'
import * as React from 'react'

import { DossieRegulador, PontoPrioridade, type ControleDecisao, type ConversaSlot } from '@/components/regulacao/DossieRegulador'
import { useFilaCentral, useVagasCentral, type ItemConsole } from '@/components/regulacao/useRegulacaoCentral'
import { Chip, Vazio } from '@/components/monitor/Pagina'
import { Badge } from '@/components/ui/badge'
import { BotaoLinha } from '@/components/ui/botao-linha'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CampoSelecao } from '@/components/ui/campo-selecao'
import { EsqueletoLinhas } from '@/components/ui/esqueleto-linhas'
import { Input } from '@/components/ui/input'
import { MensagemErro } from '@/components/ui/mensagem-erro'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { hora } from '@/lib/formato'
import {
  ISOLAMENTOS, PRIORIDADES, STATUS, TIPOS_LEITO, formatarEspera, prioridadeEfetiva,
  type Prioridade, type StatusRegulacao,
} from '@/lib/regulacao'
import {
  AGRUPAMENTOS, ATALHOS, ORDENS, agrupar, contarAtalhos, demandaIsolamento, distribuicaoPrioridade, ehJudicial,
  esperaPorLeito, filtrarLocal, horasSemEvolucao, idsVisiveis, nivelEvolucao, ordenar, porMunicipio, rotuloIsolamento, temIsolamento, vizinho,
  type Agrupamento, type Atalho, type Ordem,
} from '@/lib/regulacaoFila'
import { cn } from '@/lib/utils'

const BORDA: Record<string, string> = { critico: 'border-l-critico', atencao: 'border-l-atencao', info: 'border-l-acao', neutro: 'border-l-fio' }
const COR_EVOL = { em_dia: 'text-tinta-sussurro', vencida: 'text-atencao font-medium', risco: 'text-critico font-medium' } as const

function LinhaFila({ s, selecionado, agora, onClick }: { s: ItemConsole; selecionado: boolean; agora: number; onClick: () => void }) {
  const p = PRIORIDADES[prioridadeEfetiva(s)]
  const h = horasSemEvolucao(s.sla, agora)
  const nivel = nivelEvolucao(s.sla)
  return (
    <BotaoLinha variante="linha" role="option" aria-selected={selecionado} data-id={s.id} onClick={onClick}
      className={cn('flex-col gap-0.5 border-l-4 px-3 py-2 text-apoio', BORDA[p.tom], selecionado && 'bg-campo')}>
      <span className="flex items-center gap-2">
        <span className="tabular-nums text-tinta-sussurro">{s.numero}</span>
        <span className="min-w-0 flex-1 truncate font-medium text-tinta">{s.paciente.nome}</span>
        {ehJudicial(s) && <Badge variant="destructive" title="Mandado judicial">Judicial</Badge>}
        {s.tipo_leito && <span className="shrink-0 text-rotulo text-tinta-apoio">{TIPOS_LEITO[s.tipo_leito] ?? s.tipo_leito}</span>}
      </span>
      <span className="flex items-center gap-2 text-rotulo">
        <span className="min-w-0 flex-1 truncate text-tinta-apoio">{[s.municipio, s.origem.nome].filter(Boolean).join(' · ')}</span>
        <span className="shrink-0 tabular-nums text-tinta-apoio">{formatarEspera(s.espera_segundos)}</span>
        {h != null && <span className={cn('shrink-0 tabular-nums', COR_EVOL[nivel])} title="Horas sem evolução">{h} h s/ evol.</span>}
      </span>
      {temIsolamento(s) && (
        <span className="flex items-center gap-2 text-rotulo">
          <Badge variant="warning">{rotuloIsolamento(s.isolamento_tipo)}</Badge>
          {s.agente && <span className="min-w-0 truncate text-tinta-apoio" title={s.agente}>{s.agente}</span>}
        </span>
      )}
    </BotaoLinha>
  )
}

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
  const [busca, setBusca] = React.useState('')
  const [agruparPor, setAgruparPor] = React.useState<Agrupamento>('prioridade')
  const [ordem, setOrdem] = React.useState<Ordem>('gravidade')
  const [prioridade, setPrioridade] = React.useState<Prioridade | ''>('')
  const [leito, setLeito] = React.useState('')
  const [isolamento, setIsolamento] = React.useState('')
  const [municipio, setMunicipio] = React.useState(municipioInicial ?? '')
  const [unidade, setUnidade] = React.useState('')
  const [atalhos, setAtalhos] = React.useState<Atalho[]>([])
  const [recolhidos, setRecolhidos] = React.useState<Set<string>>(new Set())
  const buscaRef = React.useRef<HTMLInputElement>(null)
  const listaRef = React.useRef<HTMLDivElement>(null)
  // horas sem evolução contadas da hora da leitura da fila (relê a cada 30 s)
  const agora = atualizadoEm

  const base = itens.filter((s) => (!prioridade || prioridadeEfetiva(s) === prioridade) && (!leito || s.tipo_leito === leito) && (!unidade || s.origem.id === unidade))
  const contagens = contarAtalhos(filtrarLocal(base, { busca, isolamento, municipio }))
  const filtrados = filtrarLocal(base, { busca, isolamento, municipio, atalhos })
  const grupos = agrupar(ordenar(filtrados, ordem), agruparPor)
  const ids = idsVisiveis(grupos, recolhidos)
  const municipios = [...new Set(itens.map((s) => s.municipio).filter((m): m is string => !!m))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  const unidades = [...new Map(itens.map((s) => [s.origem.id, s.origem.nome])).entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))
  const temFiltro = !!(busca || prioridade || leito || isolamento || municipio || unidade || status || atalhos.length)
  const limpar = () => { setBusca(''); setPrioridade(''); setLeito(''); setIsolamento(''); setMunicipio(''); setUnidade(''); setStatus(''); setAtalhos([]) }
  const item = itens.find((s) => s.id === selecionado) ?? null

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

  const erro = fila.error ?? extras.error
  return (
    <div className="flex flex-col gap-3">
      <section aria-label="Filtros e agrupamento" className="flex flex-col gap-2 rounded-cartao border border-fio bg-superficie p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-tinta-sussurro" aria-hidden />
            <Input ref={buscaRef} aria-label="Buscar na fila" className="h-8 pl-7" value={busca} onChange={(e) => setBusca(e.target.value)}
              placeholder="Paciente, nº, CID, município, unidade ou agente" />
            <kbd className="absolute top-1/2 right-2 -translate-y-1/2 rounded-controle border border-fio px-1 text-rotulo text-tinta-sussurro">/</kbd>
          </div>
          <CampoSelecao aria-label="Agrupar por" tamanho="compacto" value={agruparPor} onChange={(e) => setAgruparPor(e.target.value as Agrupamento)}>
            {(Object.keys(AGRUPAMENTOS) as Agrupamento[]).map((k) => <option key={k} value={k}>Agrupar: {AGRUPAMENTOS[k]}</option>)}
          </CampoSelecao>
          <CampoSelecao aria-label="Ordenar" tamanho="compacto" value={ordem} onChange={(e) => setOrdem(e.target.value as Ordem)}>
            {(Object.keys(ORDENS) as Ordem[]).map((k) => <option key={k} value={k}>Ordenar: {ORDENS[k]}</option>)}
          </CampoSelecao>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CampoSelecao aria-label="Prioridade" tamanho="compacto" value={prioridade} onChange={(e) => setPrioridade(e.target.value as Prioridade | '')}>
            <option value="">Prioridade: todas</option>
            {(Object.keys(PRIORIDADES) as Prioridade[]).map((k) => <option key={k} value={k}>{PRIORIDADES[k].rotulo}</option>)}
          </CampoSelecao>
          <CampoSelecao aria-label="Tipo de leito" tamanho="compacto" value={leito} onChange={(e) => setLeito(e.target.value)}>
            <option value="">Leito: todos</option>
            {Object.entries(TIPOS_LEITO).map(([k, r]) => <option key={k} value={k}>{r}</option>)}
          </CampoSelecao>
          <CampoSelecao aria-label="Isolamento" tamanho="compacto" value={isolamento} onChange={(e) => setIsolamento(e.target.value)}>
            <option value="">Isolamento: todos</option>
            <option value="qualquer">Qualquer isolamento</option>
            <option value="nenhum">Sem isolamento</option>
            {Object.entries(ISOLAMENTOS).map(([k, r]) => <option key={k} value={k}>{r}</option>)}
          </CampoSelecao>
          <CampoSelecao aria-label="Município" tamanho="compacto" value={municipio} onChange={(e) => setMunicipio(e.target.value)}>
            <option value="">Município: todos</option>
            {municipios.map((m) => <option key={m} value={m}>{m}</option>)}
          </CampoSelecao>
          <CampoSelecao aria-label="Unidade de origem" tamanho="compacto" value={unidade} onChange={(e) => setUnidade(e.target.value)}>
            <option value="">Unidade: todas</option>
            {unidades.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
          </CampoSelecao>
          <CampoSelecao aria-label="Status" tamanho="compacto" value={status} onChange={(e) => setStatus(e.target.value as StatusRegulacao | '')}>
            <option value="">Status: em aberto</option>
            {(Object.keys(STATUS) as StatusRegulacao[]).map((k) => <option key={k} value={k}>{STATUS[k]}</option>)}
          </CampoSelecao>
        </div>
        <div role="group" aria-label="Atalhos" className="flex flex-wrap items-center gap-2">
          {ATALHOS.map(([a, r]) => (
            <Chip key={a} ativo={atalhos.includes(a)} contagem={contagens[a]} tom={a === 'risco' ? 'critico' : 'acao'}
              onClick={() => setAtalhos((x) => (x.includes(a) ? x.filter((y) => y !== a) : [...x, a]))}>{r}</Chip>
          ))}
          {temFiltro && <Button size="xs" variant="outline" className="ml-auto" onClick={limpar}>Limpar filtros</Button>}
        </div>
      </section>
      <MensagemErro texto={erro ? (erro as Error).message : null} />

      <div className={cn('grid items-start gap-4', 'lg:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]')}>
        <aside aria-label="Fila da central" className={cn('flex flex-col overflow-hidden rounded-cartao border border-fio bg-superficie', selecionado && 'hidden lg:flex')}>
          <div className="flex items-center justify-between gap-2 border-b border-fio px-3 py-1.5 text-rotulo text-tinta-sussurro">
            <span className="tabular-nums">Mostrando {filtrados.length} de {itens.length}</span>
            <span className="hidden lg:inline">J/K navegam · / busca</span>
          </div>
          <div ref={listaRef} role="listbox" aria-label="Pedidos na fila" className="max-h-[calc(100dvh-280px)] min-h-40 overflow-y-auto">
            {fila.isLoading ? <div className="p-3"><EsqueletoLinhas linhas={6} rotulo="Carregando a fila…" /></div>
              : filtrados.length === 0 ? <div className="p-3"><Vazio icone={Waypoints} titulo="Fila vazia" texto={temFiltro ? 'Nenhum pedido com esses filtros.' : 'Nenhum pedido esperando decisão.'} /></div>
              : grupos.map((g) => (
                <div key={g.chave || 'sem'} role="group" aria-label={g.rotulo}>
                  {agruparPor !== 'nenhum' && (
                    <BotaoLinha variante="linha" aria-expanded={!recolhidos.has(g.chave)}
                      onClick={() => setRecolhidos((r) => { const n = new Set(r); if (n.has(g.chave)) n.delete(g.chave); else n.add(g.chave); return n })}
                      className="items-center gap-1.5 bg-campo px-3 py-1 text-rotulo font-medium text-tinta-apoio">
                      {recolhidos.has(g.chave) ? <ChevronRight className="size-3.5" aria-hidden /> : <ChevronDown className="size-3.5" aria-hidden />}
                      {agruparPor === 'prioridade' ? <PontoPrioridade p={g.chave as Prioridade} /> : g.rotulo}
                      <span className="ml-auto tabular-nums">{g.itens.length}</span>
                    </BotaoLinha>
                  )}
                  {!recolhidos.has(g.chave) && g.itens.map((s) => (
                    <LinhaFila key={s.id} s={s} agora={agora} selecionado={s.id === selecionado} onClick={() => aoSelecionar(s.id)} />
                  ))}
                </div>
              ))}
          </div>
        </aside>
        <section aria-label="Dossiê do pedido" className={cn('min-w-0 rounded-cartao border border-fio bg-superficie', !selecionado && 'hidden lg:block')}>
          {selecionado ? (
            <DossieRegulador key={selecionado} id={selecionado} centralId={centralId} souRegulador={souRegulador} decisao={decisao} conversa={conversa}
              aoVoltar={() => aoSelecionar(null)} aoFechar={() => aoSelecionar(null)}
              fila={item ? {
                espera_segundos: item.espera_segundos, assumida_por: item.assumida_por, assumida_por_mim: item.assumida_por_mim,
                municipio: item.municipio, situacao: item.situacao, agente: item.agente,
                origem_coord: { latitude: item.origem_latitude ?? null, longitude: item.origem_longitude ?? null },
              } : null} />
          ) : (
            <p className="p-6 text-center text-tinta-sussurro">Escolha um pedido na fila para abrir o dossiê.</p>
          )}
        </section>
      </div>
    </div>
  )
}

/** "Atualizado hh:mm" da fila (RG8). */
export function AtualizadoEm({ em }: { em: number }) {
  if (!em) return null
  return <span className="text-rotulo text-tinta-sussurro">Atualizado {hora(new Date(em).toISOString())}</span>
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
