// ─────────────────────────────────────────────────────────────────────────────
// Central do Farmacêutico (P/index.html 9600–9800; fase 4.5/4.9 e onda 8).
// Disponibilidade com limites e padrão da unidade, sinalizar falta e enviar
// lista; diluição padrão da unidade (ajustar linha, voltar ao modelo, flebite,
// alta vigilância); rascunhos; faltas; validação. Toda regra é do servidor
// (migrations 20260929000008 e 20261009000001); aqui só se mostra e se pede.
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, ClipboardPlus, FlaskConical, Search, ShieldCheck, SlidersHorizontal } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { useUnidade } from '@/contexts/UnidadeContext'
import { TituloPagina, Vazio } from '@/components/monitor/Pagina'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Diluicoes from './Diluicoes'
import { EnviarArquivo } from './EnviarArquivo'

const ABAS = [
  ['disponibilidade', 'Disponibilidade'], ['diluicao', 'Diluição padrão'], ['rascunhos', 'Rascunhos'],
  ['faltas', 'Faltas'], ['validacao', 'Validação'],
] as const
type Aba = (typeof ABAS)[number][0]
const hora = (iso: string | null) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }) : '—')
const num = (x: string) => (x.trim() === '' ? null : Number(x.replace(',', '.')))
const fmt = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString('pt-BR'))

export function Erro({ texto }: { texto: string | null }) {
  if (!texto) return null
  return <p role="alert" className="rounded-container border border-critico/30 bg-alerta-critico px-3.5 py-2.5 text-apoio text-critico">{texto}</p>
}

export function Abas<K extends string>({ abas, valor, onChange, rotulo }: {
  abas: readonly (readonly [K, string])[]; valor: K; onChange: (k: K) => void; rotulo: string
}) {
  return (
    <div role="tablist" aria-label={rotulo} className="mb-[18px] flex flex-wrap gap-1.5">
      {abas.map(([k, r]) => (
        <button key={k} type="button" role="tab" aria-selected={valor === k} onClick={() => onChange(k)}
          className={cn('rounded-capsula border px-[13px] py-[5px] text-apoio transition-colors',
            valor === k ? 'border-acao bg-acao font-medium text-white' : 'border-fio bg-superficie text-tinta-apoio hover:border-acao hover:text-acao')}>
          {r}
        </button>
      ))}
    </div>
  )
}

export function Filtro({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={ativo} onClick={onClick}
      className={cn('inline-flex items-center gap-1.5 rounded-capsula border px-3 py-[5px] text-apoio whitespace-nowrap transition-colors',
        ativo ? 'border-marca bg-alerta-marca font-medium text-acao' : 'border-fio bg-superficie text-tinta-apoio hover:border-marca hover:text-acao')}>
      {children}
    </button>
  )
}

export default function Farmacia() {
  const [aba, setAba] = React.useState<Aba>('disponibilidade')
  const [rascunho, setRascunho] = React.useState<string | null>(null)
  const { unidadeAtiva } = useUnidade()
  const unidade = unidadeAtiva?.unidade_id
  return (
    <div className="flex w-full max-w-5xl flex-col">
      <TituloPagina icone={FlaskConical} titulo="Central do Farmacêutico"
        descricao="O que existe na unidade, como se dilui e o que volta para correção" />
      <Abas abas={ABAS} valor={aba} onChange={setAba} rotulo="Central do Farmacêutico" />
      {unidade && aba === 'disponibilidade' && <Disponibilidade unidade={unidade} />}
      {unidade && aba === 'diluicao' && <PadraoUnidade unidade={unidade} abrirRascunho={(id) => { setRascunho(id); setAba('rascunhos') }} />}
      {aba === 'rascunhos' && <Diluicoes embutido selecionadaInicial={rascunho} />}
      {unidade && aba === 'faltas' && <Faltas unidade={unidade} />}
      {unidade && aba === 'validacao' && <Validacao unidade={unidade} />}
    </div>
  )
}

// ── Disponibilidade ─────────────────────────────────────────────────────────
type Estoque = {
  medicamento_id: string; principio_ativo: string; apresentacao: string | null; alta_vigilancia: boolean; quantidade: number | null
  limite_critico: number | null; limite_falta: number | null; limite_proprio: boolean; situacao: string
  atualizado_em: string | null; atualizado_por: string | null; falta_id: string | null; falta_situacao: string | null
}
const SELO: Record<string, { rotulo: string; variante: 'destructive' | 'warning' | 'success' | 'secondary' }> = {
  falta: { rotulo: 'em falta', variante: 'destructive' }, critico: { rotulo: 'crítico', variante: 'warning' },
  ok: { rotulo: 'ok', variante: 'success' }, nao_informado: { rotulo: 'não informado', variante: 'secondary' },
}

function Disponibilidade({ unidade }: { unidade: string }) {
  const qc = useQueryClient()
  const [filtro, setFiltro] = React.useState('')
  const [soAv, setSoAv] = React.useState(false)
  const [erro, setErro] = React.useState<string | null>(null)
  const lista = useQuery({
    queryKey: ['farmacia-estoque', unidade],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('farmacia_estoque', { p_unidade: unidade })
      if (error) throw error
      return (data ?? []) as Estoque[]
    },
  })
  const recarregar = () => {
    void qc.invalidateQueries({ queryKey: ['farmacia-estoque'] })
    void qc.invalidateQueries({ queryKey: ['disponibilidade'] })
    void qc.invalidateQueries({ queryKey: ['faltas'] })
  }
  const termo = filtro.trim().toLowerCase()
  const visiveis = (lista.data ?? []).filter((d) => (!soAv || d.alta_vigilancia)
    && (d.principio_ativo.toLowerCase().includes(termo) || (d.apresentacao ?? '').toLowerCase().includes(termo)))
  const informados = (lista.data ?? []).filter((d) => d.quantidade != null).length
  return (
    <div className="flex flex-col gap-4">
      <EnviarArquivo unidade={unidade} tipo="lista_medicacoes" icone={ClipboardPlus} rotulo="Enviar lista de medicações"
        ajuda="Planilha, documento ou PDF da farmácia central (.xlsx, .xls, .csv, .doc, .docx, .pdf). Fica registrado quem enviou e quando; o saldo abaixo é o que você informa." />
      <LimitesPadrao unidade={unidade} aoMudar={recarregar} />
      <Erro texto={erro ?? (lista.error ? (lista.error as Error).message : null)} />
      <section className="overflow-hidden rounded-cartao border border-fio bg-superficie shadow-repouso">
        <div className="flex flex-wrap items-center gap-2.5 border-b border-trilha px-5 py-3">
          <span className="text-apoio text-tinta-sussurro">Saldo da unidade: {informados} de {(lista.data ?? []).length} itens informados. O que está em falta ou crítico vem primeiro.</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <label className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-tinta-sussurro" aria-hidden />
              <Input aria-label="Filtrar medicamento" className="h-8 w-56 pl-8" placeholder="Filtrar medicamento" value={filtro} onChange={(e) => setFiltro(e.target.value)} />
            </label>
            <Filtro ativo={soAv} onClick={() => setSoAv(!soAv)}><AlertTriangle className="size-3.5" aria-hidden /> Só alta vigilância</Filtro>
          </div>
        </div>
        {lista.isLoading && <p className="px-5 py-4 text-apoio text-tinta-sussurro">Carregando…</p>}
        {!lista.isLoading && visiveis.length === 0 && <p className="px-5 py-4 text-apoio text-tinta-sussurro">Nenhum medicamento com esse termo.</p>}
        <ul>
          {visiveis.slice(0, 80).map((d) => (
            <LinhaEstoque key={d.medicamento_id} d={d} unidade={unidade} aoErro={setErro} aoMudar={recarregar} />
          ))}
        </ul>
        {visiveis.length > 80 && <p className="border-t border-trilha px-5 py-2.5 text-rotulo text-tinta-sussurro">Mostrando 80 de {visiveis.length}. Filtre para achar o item.</p>}
      </section>
    </div>
  )
}

function LimitesPadrao({ unidade, aoMudar }: { unidade: string; aoMudar: () => void }) {
  const padrao = useQuery({
    queryKey: ['farmacia-limites-padrao', unidade],
    queryFn: async () => {
      const { data, error } = await supabase.from('farmacia_limites_padrao' as never).select('limite_critico, limite_falta').eq('unidade_id', unidade).maybeSingle()
      if (error) throw error
      return data as { limite_critico: number | null; limite_falta: number | null } | null
    },
  })
  const [abrir, setAbrir] = React.useState(false)
  const [c, setC] = React.useState('')
  const [f, setF] = React.useState('')
  const [erro, setErro] = React.useState<string | null>(null)
  const p = padrao.data
  const resumo = p && (p.limite_critico != null || p.limite_falta != null)
    ? `crítico ≤ ${fmt(p.limite_critico)} · em falta ≤ ${fmt(p.limite_falta)}` : 'sem padrão: o item sem limite próprio fica só com o saldo'
  return (
    <div className="flex flex-col gap-2.5 rounded-cartao border border-fio bg-superficie px-5 py-3.5 shadow-repouso">
      <div className="flex flex-wrap items-center gap-2.5">
        <SlidersHorizontal className="size-4 text-marca" aria-hidden />
        <span className="text-apoio font-semibold text-tinta">Padrão da unidade</span>
        <span className="text-apoio text-tinta-sussurro">{resumo}</span>
        <Button size="xs" variant="outline" className="ml-auto" onClick={() => {
          setC(p?.limite_critico?.toString() ?? ''); setF(p?.limite_falta?.toString() ?? ''); setAbrir(!abrir)
        }}>{abrir ? 'Fechar' : 'Definir padrão'}</Button>
      </div>
      {abrir && (
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-apoio text-grafite">Crítico quando ≤
            <Input className="h-8 w-24" inputMode="decimal" value={c} onChange={(e) => setC(e.target.value)} /></label>
          <label className="flex flex-col gap-1 text-apoio text-grafite">Em falta quando ≤
            <Input className="h-8 w-24" inputMode="decimal" value={f} onChange={(e) => setF(e.target.value)} /></label>
          <Button size="sm" onClick={async () => {
            const { error } = await supabase.rpc('definir_limites_padrao_farmacia', { p_unidade: unidade, p_limite_critico: num(c) as number, p_limite_falta: num(f) as number }) // nulo limpa o limite (a função SQL aceita)
            if (error) return setErro(error.message)
            setErro(null); setAbrir(false); void padrao.refetch(); aoMudar()
          }}>Salvar padrão</Button>
          <span className="basis-full text-rotulo text-tinta-sussurro">Vale para todo item sem limite próprio. "Voltar ao padrão" no item apaga o limite dele e ele passa a seguir este.</span>
          <div className="basis-full"><Erro texto={erro} /></div>
        </div>
      )}
    </div>
  )
}

function LinhaEstoque({ d, unidade, aoErro, aoMudar }: { d: Estoque; unidade: string; aoErro: (m: string | null) => void; aoMudar: () => void }) {
  const [q, setQ] = React.useState(d.quantidade?.toString() ?? '')
  const [editando, setEditando] = React.useState(false)
  const [c, setC] = React.useState('')
  const [f, setF] = React.useState('')
  const s = SELO[d.situacao] ?? SELO.nao_informado
  const chamar = async (p: PromiseLike<{ error: { message: string } | null }>) => {
    const { error } = await p
    if (error) { aoErro(error.message); return false }
    aoErro(null); aoMudar(); return true
  }
  const limiteResumo = d.limite_critico == null && d.limite_falta == null ? 'sem limite'
    : `crítico ≤ ${fmt(d.limite_critico)} · falta ≤ ${fmt(d.limite_falta)}${d.limite_proprio ? '' : ' (padrão)'}`
  return (
    <li className="border-b border-trilha px-5 py-3 last:border-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex min-w-[220px] flex-1 flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-2 text-corpo font-medium text-tinta">
            {d.principio_ativo}
            {d.alta_vigilancia && <Badge variant="warning">alta vigilância</Badge>}
          </span>
          <span className="text-rotulo text-tinta-sussurro">{d.apresentacao ?? '—'}{d.atualizado_em ? ` · atualizado ${hora(d.atualizado_em)}${d.atualizado_por ? ` por ${d.atualizado_por}` : ''}` : ''}</span>
        </div>
        <button type="button" onClick={() => { setC(d.limite_proprio ? d.limite_critico?.toString() ?? '' : ''); setF(d.limite_proprio ? d.limite_falta?.toString() ?? '' : ''); setEditando(!editando) }}
          className="inline-flex items-center gap-1.5 rounded-controle border border-fio bg-superficie px-2.5 py-1 text-rotulo text-tinta-apoio hover:border-marca hover:text-acao">
          <SlidersHorizontal className="size-3.5" aria-hidden /> {limiteResumo}
        </button>
        <div className="flex items-center gap-1.5">
          <Input aria-label={`Saldo de ${d.principio_ativo}`} className="h-8 w-20 tabular-nums" inputMode="decimal" value={q} onChange={(e) => setQ(e.target.value)} placeholder="saldo" />
          <Button size="xs" variant="outline" disabled={q.trim() === '' || num(q) === d.quantidade}
            onClick={() => void chamar(supabase.rpc('atualizar_estoque', { p_unidade: unidade, p_medicamento: d.medicamento_id, p_quantidade: num(q)! }))}>Salvar</Button>
        </div>
        <Badge variant={s.variante}>{s.rotulo}</Badge>
        {d.falta_id ? (
          <span className="inline-flex items-center gap-1 text-rotulo font-medium text-conforme"><ShieldCheck className="size-3.5" aria-hidden />Falta enviada</span>
        ) : (d.situacao === 'falta' || d.situacao === 'critico') ? (
          <Button size="xs" variant="outline" className="border-critico/40 text-critico hover:bg-alerta-critico"
            onClick={() => void chamar(supabase.rpc('sinalizar_falta', { p_unidade: unidade, p_medicamento: d.medicamento_id, p_observacao: `Saldo ${fmt(d.quantidade)} na farmácia` }))}>
            Sinalizar falta
          </Button>
        ) : null}
      </div>
      {editando && (
        <div className="mt-2.5 flex flex-wrap items-end gap-3 rounded-controle bg-trilha/60 px-3.5 py-3">
          <label className="flex flex-col gap-1 text-apoio text-grafite">Crítico quando ≤
            <Input className="h-8 w-24" inputMode="decimal" value={c} onChange={(e) => setC(e.target.value)} placeholder={d.limite_proprio ? '' : fmt(d.limite_critico)} /></label>
          <label className="flex flex-col gap-1 text-apoio text-grafite">Em falta quando ≤
            <Input className="h-8 w-24" inputMode="decimal" value={f} onChange={(e) => setF(e.target.value)} placeholder={d.limite_proprio ? '' : fmt(d.limite_falta)} /></label>
          <span className="min-w-[220px] flex-1 text-rotulo text-pretty text-tinta-sussurro">É este limite que decide o selo, o que chega ao médico como falta e o que o gestor vê no painel.</span>
          {d.limite_proprio && (
            <Button size="sm" variant="outline" onClick={async () => {
              if (await chamar(supabase.rpc('limites_voltar_ao_padrao', { p_unidade: unidade, p_medicamento: d.medicamento_id }))) setEditando(false)
            }}>Voltar ao padrão</Button>
          )}
          <Button size="sm" disabled={(c.trim() === '' && f.trim() === '') || (d.quantidade == null && q.trim() === '')} onClick={async () => {
            const ok = await chamar(supabase.rpc('atualizar_estoque', { p_unidade: unidade, p_medicamento: d.medicamento_id,
              p_quantidade: num(q) ?? d.quantidade ?? 0, p_limite_critico: num(c) ?? undefined, p_limite_falta: num(f) ?? undefined }))
            if (ok) setEditando(false)
          }}>Salvar limites</Button>
          {d.quantidade == null && q.trim() === '' && <span className="basis-full text-rotulo text-atencao">Informe o saldo antes de definir o limite do item.</span>}
        </div>
      )}
    </li>
  )
}

// ── Diluição padrão da unidade ──────────────────────────────────────────────
type Campos = Record<string, unknown>
type LinhaPadrao = {
  id: string; medicamento_id: string; principio_ativo: string; apresentacao: string; via: string; versao: number; da_unidade: boolean
  texto: string; campos: Campos; modelo: { id: string; versao: number; texto: string; campos: Campos } | null
  alta_vigilancia: boolean; risco_flebite: boolean | null; fonte: string; revisor_crf: string | null; motivo_alteracao: string | null
  publicado_por: string | null; vigente_desde: string | null; rascunho_id: string | null
}
const CAMPOS_PADRAO: [string, string, (v: unknown) => string][] = [
  ['reconstituicao_diluente', 'Reconstituir com', (v) => String(v)],
  ['diluicao_solucao', 'Diluir em', (v) => (Array.isArray(v) ? v.join(' ou ') : String(v))],
  ['diluicao_volume_min_ml', 'Volume mínimo', (v) => `${v} mL`],
  ['concentracao_maxima', 'Concentração máxima', (v) => String(v)],
  ['tempo_infusao_min', 'Tempo de infusão', (v) => `${v} min`],
  ['acesso', 'Acesso', (v) => String(v)],
  ['estabilidade_ta_h', 'Estabilidade em TA', (v) => `${v} h`],
]
const valorCampo = (c: Campos, k: string, f: (v: unknown) => string) => {
  const v = c[k]
  return v == null || (Array.isArray(v) && v.length === 0) ? '—' : f(v)
}

function PadraoUnidade({ unidade, abrirRascunho }: { unidade: string; abrirRascunho: (id: string) => void }) {
  const qc = useQueryClient()
  const [busca, setBusca] = React.useState('')
  const [soUnidade, setSoUnidade] = React.useState(false)
  const [soAv, setSoAv] = React.useState(false)
  const [erro, setErro] = React.useState<string | null>(null)
  const lista = useQuery({
    queryKey: ['padrao-diluicao-unidade', unidade],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('padrao_diluicao_unidade', { p_unidade: unidade })
      if (error) throw error
      return (data ?? []) as unknown as LinhaPadrao[]
    },
  })
  const todas = lista.data ?? []
  const termo = busca.trim().toLowerCase()
  const visiveis = todas.filter((l) => (!soUnidade || l.da_unidade) && (!soAv || l.alta_vigilancia)
    && (l.principio_ativo.toLowerCase().includes(termo) || l.apresentacao.toLowerCase().includes(termo)))
  const recarregar = () => {
    void qc.invalidateQueries({ queryKey: ['padrao-diluicao-unidade'] })
    void qc.invalidateQueries({ queryKey: ['diluicoes-farmacia'] })
  }
  return (
    <div className="flex flex-col gap-4">
      <EnviarArquivo unidade={unidade} tipo="padrao_diluicao" icone={FlaskConical} rotulo="Enviar padrão da unidade"
        ajuda="O padrão de diluição da unidade no formato em que a farmácia já mantém. Fica registrado como comprovante; o que chega ao prescritor é o que você publica linha a linha abaixo." />
      <Erro texto={erro ?? (lista.error ? (lista.error as Error).message : null)} />
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-tinta-sussurro" aria-hidden />
          <Input aria-label="Buscar linha do padrão" className="h-8 w-64 pl-8" placeholder="Princípio ativo ou apresentação…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </label>
        <Filtro ativo={soUnidade} onClick={() => setSoUnidade(!soUnidade)}>Só as ajustadas pela unidade</Filtro>
        <Filtro ativo={soAv} onClick={() => setSoAv(!soAv)}><AlertTriangle className="size-3.5" aria-hidden /> Só alta vigilância</Filtro>
        <span className="text-apoio text-tinta-sussurro">{todas.length} linhas valendo · {todas.filter((l) => l.da_unidade).length} ajustadas pela unidade</span>
      </div>
      <p className="text-apoio text-pretty text-tinta-sussurro">
        Base: o modelo da rede publicado pela farmácia, com a fonte de cada linha. Ajustar cria um rascunho da unidade que só chega ao prescritor depois de publicado (CRF, fonte e o que mudou).
      </p>
      {lista.isLoading && <p className="text-apoio text-tinta-sussurro">Carregando…</p>}
      {!lista.isLoading && todas.length === 0 && (
        <Vazio icone={FlaskConical} titulo="Nenhuma diluição publicada" texto="Publique as linhas na aba Rascunhos; elas aparecem aqui como o padrão que vale para a unidade." />
      )}
      {!lista.isLoading && todas.length > 0 && visiveis.length === 0 && <p className="text-apoio text-tinta-sussurro">Nenhuma linha do padrão com esse termo.</p>}
      <ul className="flex flex-col gap-3">
        {visiveis.map((l) => (
          <LinhaDiluicao key={l.id} l={l} unidade={unidade} aoErro={setErro} aoMudar={recarregar} abrirRascunho={abrirRascunho} />
        ))}
      </ul>
    </div>
  )
}

function LinhaDiluicao({ l, unidade, aoErro, aoMudar, abrirRascunho }: {
  l: LinhaPadrao; unidade: string; aoErro: (m: string | null) => void; aoMudar: () => void; abrirRascunho: (id: string) => void
}) {
  const [voltando, setVoltando] = React.useState(false)
  const [motivo, setMotivo] = React.useState('')
  const flebite = l.risco_flebite == null ? 'não informado' : l.risco_flebite ? 'sim' : 'não'
  return (
    <li className="overflow-hidden rounded-cartao border border-fio bg-superficie shadow-repouso">
      <div className="flex flex-wrap items-center gap-2 border-b border-trilha px-5 py-3">
        <span className="text-corpo font-semibold text-tinta">{l.principio_ativo}</span>
        <span className="text-apoio text-tinta-sussurro">{l.apresentacao} · {l.via}</span>
        {l.alta_vigilancia && <Badge variant="warning">alta vigilância</Badge>}
        <Badge variant={l.da_unidade ? 'info' : 'secondary'} className="ml-auto">{l.da_unidade ? `da unidade · v${l.versao}` : `modelo da rede · v${l.versao}`}</Badge>
      </div>
      <div className="flex flex-col gap-3 px-5 py-3.5">
        <dl className="grid gap-x-5 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
          {CAMPOS_PADRAO.map(([k, rot, f]) => {
            const atual = valorCampo(l.campos, k, f)
            const original = l.modelo ? valorCampo(l.modelo.campos, k, f) : null
            return (
              <div key={k} className="flex flex-col gap-0.5">
                <dt className="text-rotulo font-medium text-grafite">{rot}</dt>
                <dd className="text-apoio text-tinta">
                  {atual}
                  {original != null && original !== atual && <span className="ml-1.5 text-tinta-sussurro line-through" title="Valor do modelo da rede">{original}</span>}
                </dd>
              </div>
            )
          })}
          <div className="flex flex-col gap-0.5">
            <dt className="text-rotulo font-medium text-grafite">Risco de flebite</dt>
            <dd className={cn('text-apoio', l.risco_flebite ? 'font-medium text-atencao' : 'text-tinta')}>{flebite}</dd>
          </div>
        </dl>
        <p className="text-rotulo text-tinta-sussurro">
          Fonte: {l.fonte}{l.revisor_crf ? ` · revisado por ${l.revisor_crf}` : ''}{l.publicado_por ? ` · publicado por ${l.publicado_por}` : ''}{l.vigente_desde ? ` em ${hora(l.vigente_desde)}` : ''}
        </p>
        {l.da_unidade && l.motivo_alteracao && (
          <p className="rounded-controle bg-alerta-marca px-3 py-2 text-apoio text-acao">Por que muda: {l.motivo_alteracao}</p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={async () => {
            if (l.rascunho_id) return abrirRascunho(l.rascunho_id)
            const { data, error } = await supabase.rpc('ajustar_diluicao_unidade', { p_diluicao: l.id, p_unidade: unidade })
            if (error) return aoErro(error.message)
            aoErro(null); aoMudar(); abrirRascunho(data)
          }}><FlaskConical className="size-3.5" aria-hidden />{l.rascunho_id ? 'Continuar o ajuste' : 'Ajustar esta linha'}</Button>
          {l.da_unidade && l.modelo && !voltando && <Button size="sm" variant="ghost" onClick={() => setVoltando(true)}>Voltar ao modelo</Button>}
        </div>
        {voltando && (
          <div className="flex flex-wrap items-end gap-2.5 rounded-controle bg-trilha/60 px-3.5 py-3">
            <label className="flex min-w-[260px] flex-1 flex-col gap-1 text-apoio text-grafite">Por que volta ao modelo
              <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Fica registrado junto da linha encerrada" /></label>
            <Button size="sm" variant="ghost" onClick={() => { setVoltando(false); setMotivo('') }}>Cancelar</Button>
            <Button size="sm" disabled={motivo.trim().length < 10} onClick={async () => {
              const { error } = await supabase.rpc('diluicao_voltar_ao_modelo', { p_diluicao: l.id, p_motivo: motivo.trim() })
              if (error) return aoErro(error.message)
              aoErro(null); setVoltando(false); aoMudar()
            }}>Voltar ao modelo v{l.modelo?.versao}</Button>
            <span className="basis-full text-rotulo text-tinta-sussurro">A prescrição da unidade volta a receber o modelo da rede a partir de agora. A linha da unidade fica no histórico como substituída.</span>
          </div>
        )}
      </div>
    </li>
  )
}

// ── Faltas ──────────────────────────────────────────────────────────────────
type Falta = { id: string; situacao: string; observacao: string | null; sinalizada_em: string; medicamento: { principio_ativo: string; apresentacao: string | null } | null
  sinalizante: { nome_completo: string } | null }
const SIT_FALTA: Record<string, string> = { registrada: 'Registrada', em_cotacao: 'Em cotação', reposta: 'Reposta' }

function Faltas({ unidade }: { unidade: string }) {
  const qc = useQueryClient()
  const [erro, setErro] = React.useState<string | null>(null)
  const lista = useQuery({
    queryKey: ['faltas', unidade],
    queryFn: async () => {
      const { data, error } = await supabase.from('faltas_medicamento')
        .select('id, situacao, observacao, sinalizada_em, medicamento:medicamento(principio_ativo, apresentacao), sinalizante:perfis!faltas_medicamento_sinalizada_por_fkey(nome_completo)')
        .eq('unidade_id', unidade).order('sinalizada_em', { ascending: false }).limit(100)
      if (error) throw error
      return (data ?? []) as unknown as Falta[]
    },
  })
  const avancar = async (id: string, situacao: string) => {
    const { error } = await supabase.rpc('avancar_falta', { p_falta: id, p_situacao: situacao })
    if (error) return setErro(error.message)
    setErro(null)
    void qc.invalidateQueries({ queryKey: ['faltas'] })
    void qc.invalidateQueries({ queryKey: ['farmacia-estoque'] })
  }
  if (lista.data?.length === 0) return <Vazio icone={AlertTriangle} titulo="Nenhuma falta sinalizada" texto="O plantão sinaliza pela prescrição e você pela Disponibilidade; tudo aparece aqui." />
  return (
    <div className="flex flex-col gap-3">
      <p className="text-apoio text-tinta-sussurro">O que a unidade já sinalizou. A farmácia recebe na hora e o gestor vê no painel.</p>
      <Erro texto={erro ?? (lista.error ? (lista.error as Error).message : null)} />
      <ul className="overflow-hidden rounded-cartao border border-fio bg-superficie shadow-repouso">
        {(lista.data ?? []).map((f) => (
          <li key={f.id} className="flex flex-wrap items-center gap-2.5 border-b border-trilha px-5 py-3 last:border-0">
            <div className="flex min-w-[220px] flex-1 flex-col gap-0.5">
              <span className="text-corpo font-medium text-tinta">{f.medicamento?.principio_ativo} <span className="font-normal text-tinta-apoio">{f.medicamento?.apresentacao}</span></span>
              {f.observacao && <span className="text-apoio text-tinta-apoio">{f.observacao}</span>}
              <span className="text-rotulo text-tinta-sussurro">{f.sinalizante?.nome_completo ?? '—'} · {hora(f.sinalizada_em)}</span>
            </div>
            <Badge variant={f.situacao === 'reposta' ? 'success' : f.situacao === 'em_cotacao' ? 'warning' : 'destructive'}>{SIT_FALTA[f.situacao]}</Badge>
            {f.situacao === 'registrada' && <Button size="xs" variant="outline" onClick={() => void avancar(f.id, 'em_cotacao')}>Em cotação</Button>}
            {f.situacao !== 'reposta' && <Button size="xs" onClick={() => void avancar(f.id, 'reposta')}>Reposta</Button>}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── Validação ───────────────────────────────────────────────────────────────
type ItemFila = {
  item_id: string; paciente_nome: string; local: string | null; descricao: string; dose: string | null; via: string | null
  posologia: string | null; se_necessario: boolean; peso_kg: number | null; diluicao_versao: number | null; diluicao_texto: string | null
  diluicao_divergente: boolean; justificativa_divergencia: string | null; incompatibilidades: string[] | null
  alta_vigilancia: boolean; prescrito_por: string | null; prescrito_em: string; ultima_situacao: string | null; ultimo_motivo: string | null
}

function Validacao({ unidade }: { unidade: string }) {
  const qc = useQueryClient()
  const [erro, setErro] = React.useState<string | null>(null)
  const fila = useQuery({
    queryKey: ['fila-validacao', unidade],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('fila_validacao', { p_unidade: unidade })
      if (error) throw error
      return (data ?? []) as ItemFila[]
    },
  })
  if (fila.data?.length === 0) return <Vazio icone={CheckCircle2} titulo="Nada para validar" texto="Itens novos de prescrição aparecem aqui até serem conferidos." />
  const itens = fila.data ?? []
  return (
    <div className="flex flex-col gap-3">
      <p className="text-apoio text-tinta-sussurro">
        {itens.length} {itens.length === 1 ? 'item a conferir' : 'itens a conferir'}{itens.some((i) => i.diluicao_divergente) ? ` · ${itens.filter((i) => i.diluicao_divergente).length} fora do padrão de diluição` : ''} · o que não confere volta para quem prescreveu, com o motivo.
      </p>
      <Erro texto={erro ?? (fila.error ? (fila.error as Error).message : null)} />
      {itens.map((i) => (
        <LinhaValidacao key={i.item_id} i={i} aoErro={setErro} aoMudar={() => {
          void qc.invalidateQueries({ queryKey: ['fila-validacao'] })
          void qc.invalidateQueries({ queryKey: ['nota-fila-validacao'] })
        }} />
      ))}
    </div>
  )
}

function LinhaValidacao({ i, aoErro, aoMudar }: { i: ItemFila; aoErro: (m: string | null) => void; aoMudar: () => void }) {
  const [motivo, setMotivo] = React.useState('')
  const [devolvendo, setDevolvendo] = React.useState(false)
  const validar = async (confere: boolean) => {
    const { error } = await supabase.rpc('validar_item', { p_item: i.item_id, p_confere: confere, p_motivo: confere ? undefined : motivo })
    if (error) return aoErro(error.message)
    aoErro(null); setMotivo(''); setDevolvendo(false); aoMudar()
  }
  return (
    <div className={cn('flex flex-col gap-2 rounded-cartao border bg-superficie px-5 py-3.5 shadow-repouso',
      i.alta_vigilancia || i.diluicao_divergente ? 'border-atencao/40' : 'border-fio')}>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-corpo font-semibold text-tinta">{i.local ? `${i.local} · ` : ''}{i.descricao}</span>
        {i.alta_vigilancia && <Badge variant="warning">alta vigilância</Badge>}
        {i.ultima_situacao === 'devolvido' && <Badge variant="destructive">devolvido</Badge>}
      </div>
      <span className="text-apoio text-tinta">{[i.dose, i.via, i.posologia].filter(Boolean).join(' · ')}{i.se_necessario ? ' · se necessário' : ''}</span>
      <span className="text-rotulo text-tinta-sussurro">{i.paciente_nome} · prescrito por {i.prescrito_por ?? '—'} · {hora(i.prescrito_em)}{i.peso_kg ? ` · peso de referência ${i.peso_kg} kg` : ''}</span>
      {i.diluicao_texto && (
        <p className={cn('text-apoio', i.diluicao_divergente ? 'text-atencao' : 'text-tinta-apoio')}>
          {i.diluicao_divergente ? `Diluição fora do padrão: ${i.diluicao_texto} — ${i.justificativa_divergencia}` : `Diluição padrão v${i.diluicao_versao}: ${i.diluicao_texto}`}
        </p>
      )}
      {i.incompatibilidades?.length ? <p className="text-apoio text-atencao">Incompatibilidades (diluição publicada): {i.incompatibilidades.join(', ')}</p> : null}
      {i.ultima_situacao === 'devolvido' && <p className="text-apoio text-critico">Devolvido: {i.ultimo_motivo}</p>}
      <div className="flex flex-wrap items-center gap-2 pt-0.5">
        <Button size="sm" onClick={() => void validar(true)}><ShieldCheck className="size-3.5" aria-hidden />Confere</Button>
        {!devolvendo && <Button size="sm" variant="outline" onClick={() => setDevolvendo(true)}>Devolver para correção</Button>}
        {devolvendo && (
          <>
            <Input className="h-8 min-w-56 flex-1" placeholder="Motivo que volta para quem prescreveu (mínimo de 10 letras)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            <Button size="sm" variant="ghost" onClick={() => { setDevolvendo(false); setMotivo('') }}>Cancelar</Button>
            <Button size="sm" variant="outline" disabled={motivo.trim().length < 10} onClick={() => void validar(false)}>Devolver</Button>
          </>
        )}
      </div>
    </div>
  )
}
