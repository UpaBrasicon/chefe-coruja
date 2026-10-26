// ─────────────────────────────────────────────────────────────────────────────
// Central do Farmacêutico (P/index.html 9600–9800; fase 4.5/4.9 e onda 8).
// Disponibilidade com limites e padrão da unidade, sinalizar falta e enviar
// lista; diluição padrão da unidade (ajustar linha, voltar ao modelo, flebite,
// alta vigilância); rascunhos; faltas; validação. Toda regra é do servidor
// (migrations 20260929000008 e 20261009000001); aqui só se mostra e se pede.
//
// Revisão visual 3.7 (opção C do RT, 26/10/2026): abas sublinhadas, com a
// contagem da validação; validação como caixa de entrada por paciente; situação
// em ponto + texto e blocos sem sombra; alta vigilância e falta seguem em selo.
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, ClipboardPlus, FlaskConical, Search, ShieldCheck, SlidersHorizontal } from 'lucide-react'
import * as React from 'react'

import { dataHora, numero } from '@/lib/formato'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { useUnidade } from '@/contexts/UnidadeContext'
import { Chip, TituloPagina, Vazio } from '@/components/monitor/Pagina'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Diluicoes from './Diluicoes'
import { EnviarArquivo } from './EnviarArquivo'
import { PainelFarmacia, type FaltaPriorizada } from './PainelFarmacia'
import { MensagemErro } from '@/components/ui/mensagem-erro'
import { Estado } from '@/components/porta/Estado'
import { tomDaVariante } from '@/components/porta/tomEstado'
import { SeloAltaVigilancia } from '@/components/farmacia/SeloAltaVigilancia'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { BotaoLinha } from '@/components/ui/botao-linha'

const ABAS = [
  ['painel', 'Painel'], ['disponibilidade', 'Disponibilidade'], ['diluicao', 'Diluição'],
  ['faltas', 'Faltas'], ['validacao', 'Validação'],
] as const
type Aba = (typeof ABAS)[number][0]
const hora = (iso: string | null) => (iso ? dataHora(iso) : '—')
const num = (x: string) => (x.trim() === '' ? null : Number(x.replace(',', '.')))
const fmt = (n: number | null | undefined) => (n == null ? '—' : numero(n))

export function Filtro({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  // Adaptador para o Chip único (monitor/Pagina): filtro que liga e desliga.
  return <Chip ativo={ativo} onClick={onClick}>{children}</Chip>
}

export default function Farmacia() {
  const [aba, setAba] = React.useState<Aba>('painel')
  const { unidadeAtiva, papelAtivo } = useUnidade()
  const unidade = unidadeAtiva?.unidade_id
  const aConferir = useFilaValidacao(unidade).data?.length
  return (
    <div className="flex w-full max-w-5xl flex-col">
      <TituloPagina icone={FlaskConical} titulo="Central do Farmacêutico"
        descricao="O que existe na unidade, como se dilui e o que volta para correção" />
      <Tabs value={aba} onValueChange={(v) => setAba(v as Aba)} className="mb-[18px]">
        <TabsList aria-label="Central do Farmacêutico">
          {ABAS.map(([k, r]) => (
            <TabsTrigger key={k} value={k}>
              {r}
              {k === 'validacao' && !!aConferir && <span className="text-rotulo font-semibold text-acao tabular-nums">{aConferir}</span>}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {/* Fase 2, tarefa 9: painel de críticos e faltas */}
      {unidade && aba === 'painel' && <PainelFarmacia unidade={unidade} podeAgir irPara={setAba} semNumeros={papelAtivo === 'farmaceutico'} />}
      {unidade && aba === 'disponibilidade' && <Disponibilidade unidade={unidade} />}
      {/* revisão visual 3.7b: diluição padrão e rascunhos numa aba só (opção B do RT) */}
      {unidade && aba === 'diluicao' && <Diluicoes unidade={unidade} />}
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
/** Falta e crítico são alerta (selo); ok e não informado, situação (ponto + texto). */
function SeloEstoque({ situacao }: { situacao: string }) {
  const s = SELO[situacao] ?? SELO.nao_informado
  if (situacao === 'falta' || situacao === 'critico') return <Badge variant={s.variante} className="tracking-normal normal-case">{s.rotulo}</Badge>
  return <Estado tom={tomDaVariante(s.variante)}>{s.rotulo}</Estado>
}

// Revisão visual 3.7b (opção C do RT, 26/10/2026): o padrão da unidade e a
// última lista numa linha no topo; à esquerda a tabela curta (falta e crítico
// primeiro, como o servidor ordena), à direita a ficha do item escolhido com
// saldo, limites próprios, quem atualizou e a falta. No celular a ficha vem antes.
function Disponibilidade({ unidade }: { unidade: string }) {
  const qc = useQueryClient()
  const [filtro, setFiltro] = React.useState('')
  const [soAv, setSoAv] = React.useState(false)
  const [escolhido, setEscolhido] = React.useState<string | null>(null)
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
  const todos = lista.data ?? []
  const visiveis = todos.filter((d) => (!soAv || d.alta_vigilancia)
    && (d.principio_ativo.toLowerCase().includes(termo) || (d.apresentacao ?? '').toLowerCase().includes(termo)))
  const informados = todos.filter((d) => d.quantidade != null).length
  const sel = visiveis.find((d) => d.medicamento_id === escolhido) ?? visiveis[0]
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <LimitesPadrao unidade={unidade} aoMudar={recarregar} />
        <EnviarArquivo compacto unidade={unidade} tipo="lista_medicacoes" icone={ClipboardPlus} rotulo="Enviar lista de medicações"
          ajuda="Planilha, documento ou PDF da farmácia central (.xlsx, .xls, .csv, .doc, .docx, .pdf). Fica registrado quem enviou e quando; o saldo é o que você informa." />
      </div>
      <MensagemErro texto={erro ?? (lista.error ? (lista.error as Error).message : null)} />
      <div className="grid overflow-hidden rounded-cartao border border-fio bg-superficie md:grid-cols-[minmax(0,1fr)_320px]">
        <section aria-label="Medicamentos da unidade" className="flex min-w-0 flex-col border-fio md:border-r">
          <div className="flex flex-wrap items-center gap-2 border-b border-trilha px-4 py-2.5">
            <span className="text-apoio text-tinta-sussurro">{informados} de {todos.length} com saldo · falta e crítico primeiro</span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <label className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-tinta-sussurro" aria-hidden />
                <Input aria-label="Filtrar medicamento" className="h-8 w-48 pl-8" placeholder="Filtrar medicamento" value={filtro} onChange={(e) => setFiltro(e.target.value)} />
              </label>
              <Filtro ativo={soAv} onClick={() => setSoAv(!soAv)}><AlertTriangle className="size-3.5" aria-hidden /> Só alta vigilância</Filtro>
            </div>
          </div>
          {lista.isLoading && <p className="px-4 py-4 text-apoio text-tinta-sussurro">Carregando…</p>}
          {!lista.isLoading && visiveis.length === 0 && <p className="px-4 py-4 text-apoio text-tinta-sussurro">Nenhum medicamento com esse termo.</p>}
          {visiveis.length > 0 && (
            <Table aria-label="Saldo por medicamento">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">Medicamento</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead className="pr-4">Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visiveis.slice(0, 80).map((d) => (
                  <TableRow key={d.medicamento_id} aria-selected={d.medicamento_id === sel?.medicamento_id}
                    className={cn('cursor-pointer', d.medicamento_id === sel?.medicamento_id && 'bg-alerta-marca hover:bg-alerta-marca')}
                    onClick={() => setEscolhido(d.medicamento_id)}>
                    <TableCell className="pl-4 whitespace-normal">
                      <BotaoLinha variante="linha" className="flex-col gap-0.5 border-0 p-0 hover:bg-transparent" onClick={() => setEscolhido(d.medicamento_id)}>
                        <span className="flex flex-wrap items-center gap-2 font-medium text-tinta">{d.principio_ativo}{d.alta_vigilancia && <SeloAltaVigilancia curto />}</span>
                        <span className="text-rotulo text-tinta-sussurro">{d.apresentacao ?? '—'}</span>
                      </BotaoLinha>
                    </TableCell>
                    <TableCell className={cn('text-right font-semibold tabular-nums', d.situacao === 'falta' ? 'text-critico' : d.situacao === 'critico' ? 'text-atencao' : 'text-tinta')}>
                      {fmt(d.quantidade)}
                    </TableCell>
                    <TableCell className="pr-4"><SeloEstoque situacao={d.situacao} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {visiveis.length > 80 && <p className="border-t border-trilha px-4 py-2.5 text-rotulo text-tinta-sussurro">Mostrando 80 de {visiveis.length}. Filtre para achar o item.</p>}
        </section>
        <div className="order-first border-b border-fio md:order-none md:border-b-0">
          {sel
            ? <FichaEstoque key={sel.medicamento_id} d={sel} unidade={unidade} aoErro={setErro} aoMudar={recarregar} />
            : <p className="px-5 py-4 text-apoio text-tinta-sussurro">Escolha um medicamento na lista.</p>}
        </div>
      </div>
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
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-apoio">
        <SlidersHorizontal className="size-3.5 text-acao" aria-hidden />
        <span className="text-tinta-sussurro"><span className="font-medium text-tinta">Padrão da unidade:</span> {resumo}</span>
        <Button size="xs" variant="ghost" className="text-acao" onClick={() => {
          setC(p?.limite_critico?.toString() ?? ''); setF(p?.limite_falta?.toString() ?? ''); setAbrir(!abrir)
        }}>{abrir ? 'Fechar' : 'Definir padrão'}</Button>
      </div>
      {abrir && (
        <div className="flex flex-wrap items-end gap-3 border-l-2 border-acao/40 pl-3">
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
          <div className="basis-full"><MensagemErro texto={erro} /></div>
        </div>
      )}
    </div>
  )
}

/** A ficha do item escolhido: saldo, limites próprios, quem atualizou e a falta. */
function FichaEstoque({ d, unidade, aoErro, aoMudar }: { d: Estoque; unidade: string; aoErro: (m: string | null) => void; aoMudar: () => void }) {
  const [q, setQ] = React.useState(d.quantidade?.toString() ?? '')
  const [c, setC] = React.useState(d.limite_proprio ? d.limite_critico?.toString() ?? '' : '')
  const [f, setF] = React.useState(d.limite_proprio ? d.limite_falta?.toString() ?? '' : '')
  const chamar = async (p: PromiseLike<{ error: { message: string } | null }>) => {
    const { error } = await p
    if (error) { aoErro(error.message); return false }
    aoErro(null); aoMudar(); return true
  }
  return (
    <section aria-label={`Ficha de ${d.principio_ativo}`} className="flex flex-col gap-4 px-5 py-4">
      <div>
        <h3 className="flex flex-wrap items-center gap-2 text-corpo font-semibold text-tinta">{d.principio_ativo}{d.alta_vigilancia && <SeloAltaVigilancia />}</h3>
        <p className="text-apoio text-tinta-sussurro">{d.apresentacao ?? '—'}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-rotulo font-semibold text-tinta-sussurro">Saldo</span>
        <div className="flex items-center gap-1.5">
          <Input aria-label={`Saldo de ${d.principio_ativo}`} className="h-8 w-24 tabular-nums" inputMode="decimal" value={q} onChange={(e) => setQ(e.target.value)} placeholder="saldo" />
          <Button size="xs" variant="outline" disabled={q.trim() === '' || num(q) === d.quantidade}
            onClick={() => void chamar(supabase.rpc('atualizar_estoque', { p_unidade: unidade, p_medicamento: d.medicamento_id, p_quantidade: num(q)! }))}>Salvar</Button>
        </div>
        <span className="text-rotulo text-tinta-sussurro">
          {d.atualizado_em ? `Atualizado ${hora(d.atualizado_em)}${d.atualizado_por ? ` por ${d.atualizado_por}` : ''}` : 'Saldo nunca informado'}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-rotulo font-semibold text-tinta-sussurro">Limites do item</span>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-rotulo text-grafite">Crítico quando ≤
            <Input className="h-8 w-24" inputMode="decimal" value={c} onChange={(e) => setC(e.target.value)} placeholder={d.limite_proprio ? '' : fmt(d.limite_critico)} /></label>
          <label className="flex flex-col gap-1 text-rotulo text-grafite">Em falta quando ≤
            <Input className="h-8 w-24" inputMode="decimal" value={f} onChange={(e) => setF(e.target.value)} placeholder={d.limite_proprio ? '' : fmt(d.limite_falta)} /></label>
        </div>
        <span className="text-rotulo text-pretty text-tinta-sussurro">
          {d.limite_proprio ? 'Limite próprio do item.' : 'Segue o padrão da unidade.'} É este limite que decide a situação, o que chega ao médico como falta e o que o gestor vê no painel.
        </span>
        <div className="flex flex-wrap gap-2">
          {d.limite_proprio && (
            <Button size="xs" variant="outline" onClick={() => void chamar(supabase.rpc('limites_voltar_ao_padrao', { p_unidade: unidade, p_medicamento: d.medicamento_id }))}>
              Voltar ao padrão
            </Button>
          )}
          <Button size="xs" disabled={(c.trim() === '' && f.trim() === '') || (d.quantidade == null && q.trim() === '')}
            onClick={() => void chamar(supabase.rpc('atualizar_estoque', { p_unidade: unidade, p_medicamento: d.medicamento_id,
              p_quantidade: num(q) ?? d.quantidade ?? 0, p_limite_critico: num(c) ?? undefined, p_limite_falta: num(f) ?? undefined }))}>
            Salvar limites
          </Button>
        </div>
        {d.quantidade == null && q.trim() === '' && <span className="text-rotulo text-atencao">Informe o saldo antes de definir o limite do item.</span>}
      </div>

      <div className="flex flex-col gap-1.5 border-t border-fio pt-3">
        <span className="text-rotulo font-semibold text-tinta-sussurro">Situação</span>
        <div className="flex flex-wrap items-center gap-2">
          <SeloEstoque situacao={d.situacao} />
          {d.falta_id ? (
            <span className="inline-flex items-center gap-1 text-rotulo font-medium text-conforme"><ShieldCheck className="size-3.5" aria-hidden />Falta enviada</span>
          ) : (d.situacao === 'falta' || d.situacao === 'critico') ? (
            <Button size="xs" variant="outline" className="border-critico/40 text-critico hover:bg-alerta-critico"
              onClick={() => void chamar(supabase.rpc('sinalizar_falta', { p_unidade: unidade, p_medicamento: d.medicamento_id, p_observacao: `Saldo ${fmt(d.quantidade)} na farmácia` }))}>
              Sinalizar falta
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  )
}

// ── Faltas ──────────────────────────────────────────────────────────────────
type Falta = { id: string; situacao: string; observacao: string | null; sinalizada_em: string; medicamento: { principio_ativo: string; apresentacao: string | null } | null
  sinalizante: { nome_completo: string } | null }

// Revisão visual 3.7b (opção C do RT com ressalva, 26/10/2026): a lista por
// situação, cada situação numa aba para não poluir quando houver muitas faltas.
// As abertas vêm da lista priorizada do painel (alta vigilância, pacientes com o
// medicamento prescrito, a mais antiga), com a mesma chave de cache; as repostas,
// das últimas faltas da unidade.
type AbaFalta = 'registrada' | 'em_cotacao' | 'reposta'

function Faltas({ unidade }: { unidade: string }) {
  const qc = useQueryClient()
  const [erro, setErro] = React.useState<string | null>(null)
  const [aba, setAba] = React.useState<AbaFalta>('registrada')
  // "há quanto" anda a cada minuto
  const [agora, setAgora] = React.useState(() => Date.now())
  React.useEffect(() => {
    const t = window.setInterval(() => setAgora(Date.now()), 60_000)
    return () => window.clearInterval(t)
  }, [])
  const abertas = useQuery({
    queryKey: ['faltas-priorizadas', unidade],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('faltas_priorizadas', { p_unidade: unidade })
      if (error) throw error
      return (data ?? []) as unknown as FaltaPriorizada[]
    },
  })
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
    for (const k of ['faltas', 'faltas-priorizadas', 'farmacia-estoque']) void qc.invalidateQueries({ queryKey: [k] })
  }
  const abertasLista = abertas.data ?? []
  const porSituacao = (sit: string) => abertasLista.filter((f) => f.situacao === sit)
  const repostas = (lista.data ?? []).filter((f) => f.situacao === 'reposta')
  const contagem: Record<AbaFalta, number> = { registrada: porSituacao('registrada').length, em_cotacao: porSituacao('em_cotacao').length, reposta: repostas.length }
  const maisAntiga = abertasLista.reduce<string | null>((m, f) => (!m || f.sinalizada_em < m ? f.sinalizada_em : m), null)
  const av = abertasLista.filter((f) => f.alta_vigilancia).length
  if (abertas.data?.length === 0 && lista.data?.length === 0) {
    return <Vazio icone={AlertTriangle} titulo="Nenhuma falta sinalizada" texto="O plantão sinaliza pela prescrição e você pela Disponibilidade; tudo aparece aqui." />
  }
  return (
    <div className="flex flex-col gap-3">
      <MensagemErro texto={erro ?? ((abertas.error ?? lista.error) ? ((abertas.error ?? lista.error) as Error).message : null)} />
      <Tabs value={aba} onValueChange={(v) => setAba(v as AbaFalta)} className="gap-3">
        <div className="flex flex-wrap items-end gap-x-4 gap-y-1 border-b border-fio">
          <TabsList aria-label="Faltas por situação" className="w-auto max-w-full flex-[1_0_auto] gap-5 border-b-0">
            <TabsTrigger value="registrada">Registradas <span className={cn('text-rotulo font-semibold tabular-nums', contagem.registrada ? 'text-critico' : 'text-acao')}>{contagem.registrada}</span></TabsTrigger>
            <TabsTrigger value="em_cotacao">Em cotação <span className="text-rotulo font-semibold text-acao tabular-nums">{contagem.em_cotacao}</span></TabsTrigger>
            <TabsTrigger value="reposta">Repostas <span className="text-rotulo font-semibold text-acao tabular-nums">{contagem.reposta}</span></TabsTrigger>
          </TabsList>
          {abertasLista.length > 0 && (
            <span className="pb-2.5 text-apoio text-tinta-sussurro">
              {maisAntiga && `mais antiga há ${haQuanto(maisAntiga, agora)}`}
              {av > 0 && <span className="font-medium text-atencao"> · {av} de alta vigilância</span>}
            </span>
          )}
        </div>
        {(['registrada', 'em_cotacao'] as const).map((sit) => (
          <TabsContent key={sit} value={sit}>
            <ListaFaltas vazio={sit === 'registrada' ? 'Nenhuma falta registrada esperando cotação.' : 'Nenhuma falta em cotação.'}>
              {porSituacao(sit).map((f) => (
                <LinhaFaltaAberta key={f.id} f={f} agora={agora} avancar={avancar} />
              ))}
            </ListaFaltas>
          </TabsContent>
        ))}
        <TabsContent value="reposta">
          <ListaFaltas vazio="Nenhuma falta reposta entre as últimas sinalizadas.">
            {repostas.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-trilha px-5 py-2.5 last:border-b-0">
                <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-0.5">
                  <span className="flex flex-wrap items-baseline gap-2"><span className="font-medium text-tinta">{f.medicamento?.principio_ativo}</span><span className="text-tinta-apoio">{f.medicamento?.apresentacao}</span></span>
                  <span className="text-rotulo text-tinta-sussurro">{f.observacao ? `${f.observacao} · ` : ''}sinalizada por {f.sinalizante?.nome_completo ?? '—'}, {hora(f.sinalizada_em)}</span>
                </div>
                <Estado tom="verde">Reposta</Estado>
              </li>
            ))}
          </ListaFaltas>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ListaFaltas({ vazio, children }: { vazio: string; children: React.ReactNode }) {
  const itens = React.Children.toArray(children)
  return (
    <div className="overflow-hidden rounded-cartao border border-fio bg-superficie">
      {itens.length === 0 ? <p className="px-5 py-4 text-apoio text-tinta-sussurro">{vazio}</p> : <ul>{itens}</ul>}
    </div>
  )
}

/** Uma falta aberta: o que falta, quem sinalizou, há quanto, quantos pacientes e a próxima etapa. */
function LinhaFaltaAberta({ f, agora, avancar }: { f: FaltaPriorizada; agora: number; avancar: (id: string, situacao: string) => Promise<void> }) {
  return (
    <li className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-b border-trilha px-5 py-2.5 last:border-b-0">
      <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-tinta">{f.principio_ativo}</span>
          <span className="text-tinta-apoio">{f.apresentacao}</span>
          {f.alta_vigilancia && <SeloAltaVigilancia />}
        </span>
        <span className="text-rotulo text-tinta-sussurro">{f.observacao ? `${f.observacao} · ` : ''}sinalizada por {f.sinalizada_por ?? '—'}</span>
        {f.retorno && <span className="text-rotulo text-conforme">Retorno ao plantão: “{f.retorno.texto}”</span>}
      </div>
      <span className="w-24 text-apoio text-tinta-apoio tabular-nums">há {haQuanto(f.sinalizada_em, agora)}</span>
      <span className="w-36 text-rotulo text-tinta-apoio">
        {f.pacientes > 0 ? `${f.pacientes} ${f.pacientes === 1 ? 'paciente' : 'pacientes'} com prescrição` : 'sem paciente com prescrição'}
        {f.setores.length > 0 && <span className="block text-tinta-sussurro">{f.setores.join(', ')}</span>}
      </span>
      <div className="flex gap-2">
        {f.situacao === 'registrada' && <Button size="xs" variant="outline" onClick={() => void avancar(f.id, 'em_cotacao')}>Em cotação</Button>}
        <Button size="xs" onClick={() => void avancar(f.id, 'reposta')}>Reposta</Button>
      </div>
    </li>
  )
}

// ── Validação ───────────────────────────────────────────────────────────────
type ItemFila = {
  item_id: string; paciente_nome: string; local: string | null; descricao: string; dose: string | null; via: string | null
  posologia: string | null; se_necessario: boolean; peso_kg: number | null; diluicao_versao: number | null; diluicao_texto: string | null
  diluicao_divergente: boolean; justificativa_divergencia: string | null; incompatibilidades: string[] | null
  alta_vigilancia: boolean; prescrito_por: string | null; prescrito_em: string; ultima_situacao: string | null; ultimo_motivo: string | null
}

/** A fila de validação (a cada 60 s): a aba mostra quantos, a caixa de entrada mostra quais. */
function useFilaValidacao(unidade: string | undefined) {
  return useQuery({
    queryKey: ['fila-validacao', unidade],
    enabled: !!unidade,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('fila_validacao', { p_unidade: unidade! })
      if (error) throw error
      return (data ?? []) as ItemFila[]
    },
  })
}

/** Itens da fila juntos por paciente, na ordem em que chegam do servidor. */
type GrupoFila = { chave: string; local: string | null; paciente: string; itens: ItemFila[] }
function agrupar(itens: ItemFila[]): GrupoFila[] {
  const grupos = new Map<string, GrupoFila>()
  for (const i of itens) {
    const chave = `${i.local ?? ''}|${i.paciente_nome}`
    const g = grupos.get(chave) ?? { chave, local: i.local, paciente: i.paciente_nome, itens: [] }
    g.itens.push(i)
    grupos.set(chave, g)
  }
  return [...grupos.values()]
}

/** "40min", "2h", "1h 55min", "1 dia", "3 dias" desde o instante. */
function haQuanto(iso: string, agora: number) {
  const m = Math.max(0, Math.round((agora - Date.parse(iso)) / 60_000))
  if (m < 60) return `${m}min`
  if (m < 24 * 60) return m % 60 === 0 ? `${m / 60}h` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}min`
  const d = Math.floor(m / (24 * 60))
  return d === 1 ? '1 dia' : `${d} dias`
}

// Revisão visual 3.7 (opção C do RT, 26/10/2026): a validação como caixa de
// entrada. À esquerda, um paciente por linha, com quantos itens, há quanto tempo
// e os sinais (alta vigilância, fora do padrão, devolvido); à direita, a
// prescrição do paciente escolhido, com Confere e Devolver em cada item.
function Validacao({ unidade }: { unidade: string }) {
  const qc = useQueryClient()
  const [erro, setErro] = React.useState<string | null>(null)
  const [escolhido, setEscolhido] = React.useState<string | null>(null)
  // "há quanto" anda a cada minuto, junto com a fila
  const [agora, setAgora] = React.useState(() => Date.now())
  React.useEffect(() => {
    const t = window.setInterval(() => setAgora(Date.now()), 60_000)
    return () => window.clearInterval(t)
  }, [])
  const fila = useFilaValidacao(unidade)
  if (fila.data?.length === 0) return <Vazio icone={CheckCircle2} titulo="Nada para validar" texto="Itens novos de prescrição aparecem aqui até serem conferidos." />
  const itens = fila.data ?? []
  const grupos = agrupar(itens)
  // o paciente escolhido some quando o último item dele é conferido: passa ao próximo
  const sel = grupos.find((g) => g.chave === escolhido) ?? grupos[0]
  const fora = itens.filter((i) => i.diluicao_divergente).length
  return (
    <div className="flex flex-col gap-3">
      <p className="text-apoio text-tinta-sussurro">
        {itens.length} {itens.length === 1 ? 'item' : 'itens'} de {grupos.length} {grupos.length === 1 ? 'paciente' : 'pacientes'}
        {fora > 0 && <span className="text-atencao"> · {fora} fora do padrão de diluição</span>} · o que não confere volta para quem prescreveu, com o motivo.
      </p>
      <MensagemErro texto={erro ?? (fila.error ? (fila.error as Error).message : null)} />
      {sel && (
        <div className="grid overflow-hidden rounded-cartao border border-fio bg-superficie md:grid-cols-[300px_minmax(0,1fr)]">
          <ul aria-label="Pacientes com itens a conferir" className="border-b border-fio md:border-r md:border-b-0">
            {grupos.map((g) => {
              const primeiro = g.itens[0]
              return (
                <li key={g.chave}>
                  <BotaoLinha variante="linha" aria-current={g.chave === sel.chave ? 'true' : undefined} onClick={() => setEscolhido(g.chave)}
                    className={cn('flex-col gap-0.5 px-4', g.chave === sel.chave && 'bg-alerta-marca')}>
                    <span className="flex w-full items-baseline justify-between gap-2">
                      <span className="text-apoio font-semibold text-tinta">{g.local && <span className="text-acao">{g.local} · </span>}{g.paciente}</span>
                      <span className="shrink-0 text-rotulo text-tinta-sussurro tabular-nums">há {haQuanto(primeiro.prescrito_em, agora)}</span>
                    </span>
                    <span className="text-rotulo text-tinta-apoio">
                      {g.itens.length} {g.itens.length === 1 ? 'item' : 'itens'} · {g.itens.map((i) => i.descricao).join(', ')}
                    </span>
                    <span className="flex flex-wrap gap-x-2 text-rotulo font-semibold empty:hidden">
                      {g.itens.some((i) => i.alta_vigilancia) && <span className="text-atencao">alta vigilância</span>}
                      {g.itens.some((i) => i.diluicao_divergente) && <span className="text-atencao">fora do padrão</span>}
                      {g.itens.some((i) => i.ultima_situacao === 'devolvido') && <span className="text-critico">devolvido</span>}
                    </span>
                  </BotaoLinha>
                </li>
              )
            })}
          </ul>
          <section aria-label={`Prescrição de ${sel.paciente}`} className="flex min-w-0 flex-col">
            <div className="border-b border-fio px-5 py-3.5">
              <h3 className="text-corpo font-semibold text-tinta">{sel.local ? `${sel.local} · ` : ''}{sel.paciente}</h3>
              <p className="text-apoio text-tinta-sussurro">
                Prescrição de {sel.itens[0].prescrito_por ?? '—'} em {hora(sel.itens[0].prescrito_em)} · há {haQuanto(sel.itens[0].prescrito_em, agora)}
                {sel.itens[0].peso_kg ? ` · peso de referência ${sel.itens[0].peso_kg} kg` : ''} · {sel.itens.length} {sel.itens.length === 1 ? 'item a conferir' : 'itens a conferir'}
              </p>
            </div>
            {sel.itens.map((i) => (
              <LinhaValidacao key={i.item_id} i={i} aoErro={setErro} aoMudar={() => {
                void qc.invalidateQueries({ queryKey: ['fila-validacao'] })
                void qc.invalidateQueries({ queryKey: ['nota-fila-validacao'] })
              }} />
            ))}
          </section>
        </div>
      )}
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
    <div className="flex flex-col gap-2 border-b border-trilha px-5 py-3.5 last:border-b-0">
      <div className="flex flex-wrap items-start gap-x-5 gap-y-2">
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1">
          <span className="flex flex-wrap items-baseline gap-2">
            <span className="text-corpo font-semibold text-tinta">{i.descricao}</span>
            {i.alta_vigilancia && <SeloAltaVigilancia />}
          </span>
          <span className="text-apoio text-tinta">{[i.dose, i.via, i.posologia].filter(Boolean).join(' · ')}{i.se_necessario ? ' · se necessário' : ''}</span>
          {i.diluicao_texto && (
            <span className={cn('text-apoio', i.diluicao_divergente ? 'text-atencao' : 'text-tinta-apoio')}>
              {i.diluicao_divergente ? `Fora do padrão: ${i.diluicao_texto} — ${i.justificativa_divergencia}` : `Padrão v${i.diluicao_versao}: ${i.diluicao_texto}`}
            </span>
          )}
          {i.incompatibilidades?.length ? <span className="text-apoio text-atencao">Incompatibilidades (diluição publicada): {i.incompatibilidades.join(', ')}</span> : null}
          {i.ultima_situacao === 'devolvido' && <Estado tom="vermelho">Devolvido: {i.ultimo_motivo}</Estado>}
        </div>
        {!devolvendo && (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => void validar(true)}><ShieldCheck className="size-3.5" aria-hidden />Confere</Button>
            <Button size="sm" variant="outline" onClick={() => setDevolvendo(true)}>Devolver para correção</Button>
          </div>
        )}
      </div>
      {devolvendo && (
        <div className="flex flex-wrap items-center gap-2">
          <Input className="h-8 min-w-56 flex-1" placeholder="Motivo que volta para quem prescreveu (mínimo de 10 letras)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <Button size="sm" variant="ghost" onClick={() => { setDevolvendo(false); setMotivo('') }}>Cancelar</Button>
          <Button size="sm" variant="outline" disabled={motivo.trim().length < 10} onClick={() => void validar(false)}>Devolver</Button>
        </div>
      )}
    </div>
  )
}
