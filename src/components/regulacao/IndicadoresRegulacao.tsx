// ─────────────────────────────────────────────────────────────────────────────
// Indicadores de regulação (Fase 4, tarefa 10; decisões do RT de 11/10/2026).
//
// Tempos (mediana e percentil 90) até a decisão da central, o aceite do
// destino e a chegada; fila atual; volume; desfechos; cumprimento dos prazos
// e gargalos. A central e os papéis de rede veem a rede; o gestor vê a
// unidade dele como origem e como destino. Só números; exporta CSV.
// Migration 20261118000001_indicadores_regulacao.sql.
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery } from '@tanstack/react-query'
import { Download, LineChart } from 'lucide-react'
import * as React from 'react'

import { Vazio } from '@/components/monitor/Pagina'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { baixarCsv, gerarCsv, nomeArquivoCsv } from '@/lib/csv'
import {
  filtrosIndicadoresParaEnvio, linhasCsvIndicadores, taxa, tempo,
  type BlocoTempo, type FiltrosIndicadores, type Indicadores,
} from '@/lib/indicadoresRegulacao'
import { MOTIVOS_NEGACAO, MOTIVOS_RECUSA_DESTINO, PRIORIDADES, TIPOS, TIPOS_LEITO, type Prioridade, type TipoSolicitacao } from '@/lib/regulacao'
import { supabase } from '@/lib/supabase'
import type { Json } from '@/types/database'

const SELECT = 'h-8 rounded-controle border border-fio bg-campo px-2'
const hoje = () => new Date().toLocaleDateString('sv-SE')
const diasAtras = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toLocaleDateString('sv-SE') }
const ROTULO_TEMPO = { decisao: 'Até a decisão da central', aceite: 'Até o aceite do destino', chegada: 'Até a chegada' }
const ROTULO_PRAZO = { fila: 'Fila (decisão da central)', pendencia: 'Resposta à pendência', evolucao: 'Evolução do pedido', destino: 'Resposta do destino' }

function rotuloGrupo(g: string): string {
  if (g in PRIORIDADES) return PRIORIDADES[g as Prioridade].rotulo
  if (g in TIPOS) return TIPOS[g as TipoSolicitacao]
  return g
}

export function IndicadoresRegulacao({ unidadeId, unidades = [] }: { unidadeId: string; unidades?: { id: string; nome: string }[] }) {
  const [filtros, setFiltros] = React.useState<FiltrosIndicadores>(() => ({ de: diasAtras(29), ate: hoje() }))
  const ind = useQuery({
    queryKey: ['regulacao-indicadores', unidadeId, filtros],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('regulacao_indicadores', {
        p_unidade: unidadeId, p_filtros: filtrosIndicadoresParaEnvio(filtros) as unknown as Json,
      })
      if (error) throw error
      return data as unknown as Indicadores
    },
  })
  const set = (k: keyof FiltrosIndicadores, v: string) => setFiltros((x) => ({ ...x, [k]: v }))
  const exportar = () => {
    const d = ind.data!
    const csv = gerarCsv(['Seção', 'Indicador', 'Grupo', 'Valor'], linhasCsvIndicadores(d, { tempo: ROTULO_TEMPO, grupo: rotuloGrupo }), {
      contexto: [['Indicadores de regulação', ''], ['Período', `${d.periodo.de} a ${d.periodo.ate}`], ['Alcance', d.escopo === 'rede' ? 'rede' : 'unidades']],
    })
    baixarCsv(nomeArquivoCsv('indicadores_regulacao', hoje()), csv)
  }
  const d = ind.data
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <LineChart className="size-4" aria-hidden /> Indicadores de regulação
          {d && <Badge variant="secondary">{d.total} pedidos no período</Badge>}
          {d && <Button size="xs" variant="outline" className="ml-auto" onClick={exportar}><Download className="size-3.5" /> Exportar CSV</Button>}
        </CardTitle>
        <CardDescription>
          Tempos em mediana e percentil 90 (os 10% mais demorados). Pedidos criados no período; a fila atual não depende do período. Só números.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-apoio">
        <div className="flex flex-wrap items-end gap-2">
          <Filtro id="ind-de" rotulo="De"><Input id="ind-de" type="date" className="h-8" value={filtros.de} onChange={(e) => set('de', e.target.value)} /></Filtro>
          <Filtro id="ind-ate" rotulo="Até"><Input id="ind-ate" type="date" className="h-8" value={filtros.ate} onChange={(e) => set('ate', e.target.value)} /></Filtro>
          <Filtro id="ind-tipo" rotulo="Tipo">
            <select id="ind-tipo" className={SELECT} value={filtros.tipo ?? ''} onChange={(e) => set('tipo', e.target.value)}>
              <option value="">Todos</option>
              {(Object.keys(TIPOS) as TipoSolicitacao[]).map((k) => <option key={k} value={k}>{TIPOS[k]}</option>)}
            </select>
          </Filtro>
          <Filtro id="ind-pri" rotulo="Prioridade">
            <select id="ind-pri" className={SELECT} value={filtros.prioridade ?? ''} onChange={(e) => set('prioridade', e.target.value)}>
              <option value="">Todas</option>
              {(Object.keys(PRIORIDADES) as Prioridade[]).map((k) => <option key={k} value={k}>{PRIORIDADES[k].rotulo}</option>)}
            </select>
          </Filtro>
          {unidades.length > 0 && (
            <>
              <Filtro id="ind-orig" rotulo="Origem">
                <select id="ind-orig" className={SELECT} value={filtros.origem_id ?? ''} onChange={(e) => set('origem_id', e.target.value)}>
                  <option value="">Todas</option>
                  {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                </select>
              </Filtro>
              <Filtro id="ind-dest" rotulo="Destino">
                <select id="ind-dest" className={SELECT} value={filtros.destino_id ?? ''} onChange={(e) => set('destino_id', e.target.value)}>
                  <option value="">Todos</option>
                  {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                </select>
              </Filtro>
            </>
          )}
        </div>

        {ind.isLoading ? <Spinner /> : ind.error ? <p role="alert" className="text-critico">{(ind.error as Error).message}</p> : !d ? null
          : d.total === 0 && Object.keys(d.fila_atual.por_tipo).length === 0 ? (
            <Vazio icone={LineChart} titulo="Sem pedidos" texto="Nenhum pedido de regulação com esses filtros." />
          ) : (
            <>
              <Secao titulo="Tempos">
                <div className="grid gap-3 md:grid-cols-3">
                  {(Object.keys(ROTULO_TEMPO) as (keyof typeof ROTULO_TEMPO)[]).map((k) => <Tempo key={k} titulo={ROTULO_TEMPO[k]} b={d.tempos[k]} />)}
                </div>
              </Secao>

              <Secao titulo="Fila agora">
                <div className="flex flex-wrap gap-1.5">
                  {Object.keys(d.fila_atual.por_tipo).length === 0 ? <span className="text-tinta-sussurro">Nada esperando decisão.</span> : (
                    <>
                      {Object.entries(d.fila_atual.por_tipo).map(([k, n]) => <Badge key={k} variant="info">{rotuloGrupo(k)}: {n}</Badge>)}
                      {Object.entries(d.fila_atual.por_prioridade).map(([k, n]) => <Badge key={k} variant="secondary">{rotuloGrupo(k)}: {n}</Badge>)}
                    </>
                  )}
                </div>
              </Secao>

              <Secao titulo="Desfechos">
                <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-3">
                  <Item rotulo="Autorizadas" valor={`${d.desfechos.autorizadas} (${taxa(d.desfechos.autorizadas, d.total)})`} />
                  <Item rotulo="Negadas" valor={`${d.desfechos.negadas} (${taxa(d.desfechos.negadas, d.total)})`} />
                  <Item rotulo="Devolvidas" valor={`${d.desfechos.devolvidas} (${taxa(d.desfechos.devolvidas, d.total)})`} />
                  <Item rotulo="Recusas do destino" valor={`${d.desfechos.recusas_destino} de ${d.desfechos.respostas_destino} respostas (${taxa(d.desfechos.recusas_destino, d.desfechos.respostas_destino)})`} />
                  <Item rotulo="Canceladas" valor={`${d.desfechos.canceladas} (${taxa(d.desfechos.canceladas, d.total)})`} />
                  <Item rotulo="Faltas" valor={`${d.desfechos.faltas} (${taxa(d.desfechos.faltas, d.desfechos.faltas + d.desfechos.realizadas)} dos que deviam chegar)`} />
                </dl>
                <Motivos titulo="Negação por motivo" m={d.desfechos.negacao_por_motivo} rotulo={(k) => MOTIVOS_NEGACAO[k as keyof typeof MOTIVOS_NEGACAO] ?? k} />
                <Motivos titulo="Recusa do destino por motivo" m={d.desfechos.recusa_por_motivo} rotulo={(k) => MOTIVOS_RECUSA_DESTINO[k as keyof typeof MOTIVOS_RECUSA_DESTINO] ?? k} />
              </Secao>

              <Secao titulo="Cumprimento dos prazos">
                <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
                  {(Object.keys(ROTULO_PRAZO) as (keyof typeof ROTULO_PRAZO)[]).map((k) => (
                    <Item key={k} rotulo={ROTULO_PRAZO[k]}
                      valor={d.prazos[k].n ? `${taxa(d.prazos[k].no_prazo, d.prazos[k].n)} no prazo (${d.prazos[k].no_prazo} de ${d.prazos[k].n})` : 'sem casos (ou sem prazo cadastrado)'} />
                  ))}
                </dl>
              </Secao>

              <Secao titulo="Gargalos">
                <Tabela cab={['Origem', 'Pedidos', 'Mediana da decisão', 'Devolvidas', 'Negadas']}
                  linhas={d.gargalos.por_origem.map((o) => [o.unidade, o.n, tempo(o.decisao_mediana), o.devolvidas, o.negadas])} />
                <Tabela cab={['Destino', 'Respostas', 'Recusas', 'Mediana do aceite']}
                  linhas={d.gargalos.por_destino.map((o) => [o.unidade, o.respostas, o.recusas, tempo(o.aceite_mediana)])} />
                <Tabela cab={['Tipo de leito', 'Pedidos', 'Mediana da decisão', 'Recusas']}
                  linhas={d.gargalos.por_tipo_leito.map((o) => [TIPOS_LEITO[o.tipo_leito] ?? o.tipo_leito, o.n, tempo(o.decisao_mediana), o.recusas])} />
              </Secao>

              <Secao titulo="Volume por dia">
                <PorDia dias={d.volume.por_dia} />
              </Secao>
            </>
          )}
      </CardContent>
    </Card>
  )
}

function Filtro({ id, rotulo, children }: { id: string; rotulo: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-1"><Label htmlFor={id} className="text-xs">{rotulo}</Label>{children}</div>
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return <section className="flex flex-col gap-2"><h3 className="font-medium text-tinta">{titulo}</h3>{children}</section>
}

function Item({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return <div><dt className="inline text-tinta-sussurro">{rotulo}: </dt><dd className="inline tabular-nums text-tinta">{valor}</dd></div>
}

function Tempo({ titulo, b }: { titulo: string; b: BlocoTempo }) {
  const grupos = [...b.por_prioridade, ...b.por_tipo]
  return (
    <div className="flex flex-col gap-1 rounded-md border border-fio p-3">
      <span className="text-rotulo text-tinta-sussurro">{titulo}</span>
      {b.geral && b.geral.n > 0 ? (
        <>
          <span className="text-lg font-semibold tabular-nums text-tinta">{tempo(b.geral.mediana)}</span>
          <span className="text-rotulo text-tinta-apoio">p90 {tempo(b.geral.p90)} · {b.geral.n} pedido(s)</span>
          <ul className="mt-1 text-rotulo text-tinta-apoio">
            {grupos.map((g) => <li key={g.grupo}>{rotuloGrupo(g.grupo)}: {tempo(g.mediana)} (p90 {tempo(g.p90)}, {g.n})</li>)}
          </ul>
        </>
      ) : <span className="text-tinta-sussurro">Sem casos no período.</span>}
    </div>
  )
}

function Motivos({ titulo, m, rotulo }: { titulo: string; m: Record<string, number>; rotulo: (k: string) => string }) {
  const itens = Object.entries(m).sort((a, b) => b[1] - a[1])
  if (itens.length === 0) return null
  return <p className="text-tinta-apoio"><span className="text-tinta-sussurro">{titulo}: </span>{itens.map(([k, n]) => `${rotulo(k)} ${n}`).join(' · ')}</p>
}

function Tabela({ cab, linhas }: { cab: string[]; linhas: (string | number)[][] }) {
  if (linhas.length === 0) return null
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[28rem] text-left">
        <thead className="text-rotulo text-tinta-sussurro"><tr>{cab.map((c) => <th key={c} className="py-1 font-normal">{c}</th>)}</tr></thead>
        <tbody className="tabular-nums">
          {linhas.map((l, i) => <tr key={i} className="border-t border-fio">{l.map((v, j) => <td key={j} className={j === 0 ? 'py-1 text-tinta' : ''}>{v}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  )
}

function PorDia({ dias }: { dias: { dia: string; n: number }[] }) {
  if (dias.length === 0) return <span className="text-tinta-sussurro">Sem pedidos no período.</span>
  const max = Math.max(...dias.map((x) => x.n))
  return (
    <ul className="flex flex-col gap-0.5">
      {dias.map((x) => (
        <li key={x.dia} className="flex items-center gap-2 text-rotulo">
          <span className="w-20 tabular-nums text-tinta-sussurro">{x.dia.split('-').reverse().slice(0, 2).join('/')}</span>
          <span className="h-2 rounded-full bg-acao/60" style={{ width: `${Math.max(4, (x.n / max) * 100)}%`, maxWidth: '70%' }} aria-hidden />
          <span className="tabular-nums text-tinta">{x.n}</span>
        </li>
      ))}
    </ul>
  )
}
