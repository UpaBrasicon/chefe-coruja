// Telas do médico de telemedicina (P/index.html 5967–6240; navegação
// 32231–32238): salas em andamento, minha agenda com o extrato,
// telemonitoramento, assinaturas pendentes, histórico e auditoria, unidades e
// credenciais. A "Minha fila" é a Teleinterconsulta.tsx. Tudo lido do banco
// (migrations 20261001000003 e 20261009000002). O protótipo é de salas de
// vídeo com transcrição; no app a teleinterconsulta é escrita — a "sala" é o
// pedido aceito, e "entrar" é ler o prontuário e escrever o parecer.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Activity, BookOpen, CalendarClock, FileText, History, Lock, Receipt, Send, ShieldCheck, Video } from 'lucide-react'
import * as React from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'

import { TituloPagina } from '@/components/monitor/Pagina'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { useUnidade } from '@/contexts/UnidadeContext'
import { fmtDataHora } from '@/lib/datas'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

import { Cartao, COR_SITUACAO, ha, hhmm, Nota, PontoSituacao, ROTULO_SITUACAO, Secao, TopoTele, useTeles, VazioLinha, type Situacao } from './comum'

const TELAS = {
  salas: { icone: Video, titulo: 'Salas em andamento', descricao: 'As suas, para responder; as dos outros teleconsultores da unidade, só para saber que existem' },
  agenda: { icone: CalendarClock, titulo: 'Minha agenda', descricao: 'Minha escala de plantão remoto e o extrato do mês' },
  telemonitoramento: { icone: Activity, titulo: 'Telemonitoramento', descricao: 'Setores da unidade cobertos pela telemedicina: quem cobre e quando' },
  assinaturas: { icone: FileText, titulo: 'Assinaturas pendentes', descricao: 'Pareceres por escrever e pareceres emitidos que esperam a assinatura digital' },
  historico: { icone: History, titulo: 'Histórico e auditoria', descricao: 'Suas teleinterconsultas e a trilha de quem abriu o quê, com data e hora' },
  credenciais: { icone: ShieldCheck, titulo: 'Unidades e credenciais', descricao: 'Onde você pode atender e com que inscrição — a CFM 2.314 exige identificação do médico em toda teleconsulta' },
} as const
type Tela = keyof typeof TELAS

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const TURNO: Record<string, string> = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite', madrugada: 'Madrugada' }
const diaSemana = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { weekday: 'short', timeZone: 'America/Sao_Paulo' }).replace('.', '')
const diaMes = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })
const isoDia = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })

export default function Telemedicina() {
  const { tela } = useParams<{ tela: string }>()
  const { unidadeAtiva } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  if (!tela || !(tela in TELAS)) return <Navigate to="/teleinterconsulta" replace />
  if (!unidadeId) return <Spinner />
  const t = TELAS[tela as Tela]
  return (
    <div className="flex w-full max-w-4xl flex-col">
      <TituloPagina icone={t.icone} titulo={t.titulo} descricao={t.descricao} acoes={<TopoTele unidadeId={unidadeId} />} />
      {tela === 'salas' && <Salas unidadeId={unidadeId} />}
      {tela === 'agenda' && <Agenda />}
      {tela === 'telemonitoramento' && <Telemonitoramento unidadeId={unidadeId} />}
      {tela === 'assinaturas' && <Assinaturas />}
      {tela === 'historico' && <Historico />}
      {tela === 'credenciais' && <Credenciais />}
    </div>
  )
}

function Erro({ e }: { e: unknown }) {
  return e ? <p role="alert" className="text-apoio text-critico">{(e as Error).message}</p> : null
}

// ── salas em andamento ──────────────────────────────────────────────────────
function Salas({ unidadeId }: { unidadeId: string }) {
  const qc = useQueryClient()
  const teles = useTeles(unidadeId)
  const [respostas, setRespostas] = React.useState<Record<string, string>>({})
  const outras = useQuery({
    queryKey: ['tele-outras', unidadeId],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('tele_outras_em_atendimento', { p_unidade: unidadeId })
      if (error) throw error
      return data ?? []
    },
  })
  const responder = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('responder_teleinterconsulta', { p_id: id, p_resposta: (respostas[id] ?? '').trim() })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['teleinterconsultas'] })
      void qc.invalidateQueries({ queryKey: ['situacao-tele'] })
      void qc.invalidateQueries({ queryKey: ['tele-pendencias'] })
    },
  })
  const minhas = (teles.data ?? []).filter((t) => t.minha && t.status === 'em_atendimento')
  return (
    <div className="flex flex-col gap-5">
      <Secao titulo={`Minhas (${minhas.length})`}>
        {teles.isLoading && <Spinner />}
        <Erro e={teles.error} />
        {!teles.isLoading && minhas.length === 0 && <VazioLinha>Nenhuma sala sua aberta agora. Aceite um chamado em Minha fila.</VazioLinha>}
        <ul className="flex flex-col gap-3">
          {minhas.map((t) => (
            <Cartao key={t.id} t={t}>
              <div className="mt-2.5 flex flex-col gap-2">
                <span className="flex flex-wrap items-center gap-2 text-rotulo text-tinta-sussurro">
                  <span className="inline-flex items-center gap-1.5 font-semibold tracking-[0.05em] text-critico uppercase"><PontoSituacao estado="em_consulta" />em atendimento</span>
                  desde {hhmm(t.aceita_em)} ({ha(t.aceita_em)}) · registro escrito na plataforma
                </span>
                <Button size="sm" variant="outline" className="w-fit" render={<Link to={`/prontuarios/${t.paciente_id}`} />} nativeButton={false}><BookOpen className="size-4" />Ler prontuário</Button>
                <Textarea rows={4} placeholder="Parecer: hipóteses, o que sugere e em que condição reavaliar." value={respostas[t.id] ?? ''}
                  onChange={(e) => setRespostas((r) => ({ ...r, [t.id]: e.target.value }))} />
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" onClick={() => responder.mutate(t.id)} disabled={responder.isPending || (respostas[t.id]?.trim().length ?? 0) < 20}>
                    <Send className="size-4" />Enviar parecer
                  </Button>
                  <span className="text-rotulo text-tinta-sussurro">O parecer entra no prontuário como documento numerado seu e vai ao médico que pediu.</span>
                </div>
              </div>
            </Cartao>
          ))}
        </ul>
        <Erro e={responder.error} />
      </Secao>
      <Secao titulo="Outras salas da unidade">
        <Erro e={outras.error} />
        {outras.data?.length === 0 && <VazioLinha>Nenhum outro teleconsultor em atendimento nesta unidade.</VazioLinha>}
        <ul className="overflow-hidden rounded-cartao border border-fio bg-superficie empty:hidden">
          {(outras.data ?? []).map((o) => (
            <li key={o.id} className="flex flex-wrap items-center gap-2.5 border-b border-trilha px-5 py-3 last:border-0">
              <span className="flex-1 text-apoio text-tinta">{o.setor ?? 'Setor não informado'} <span className="text-tinta-sussurro">· {o.consultor}</span></span>
              {o.urgencia === 'urgente' && <Badge variant="destructive">urgente</Badge>}
              <span className="text-rotulo text-tinta-sussurro">desde {hhmm(o.aceita_em)}</span>
            </li>
          ))}
        </ul>
        <Nota icone={<Lock />}>O paciente das salas dos outros não aparece: só quem aceitou lê o prontuário.</Nota>
      </Secao>
    </div>
  )
}

// ── agenda e extrato ────────────────────────────────────────────────────────
function Agenda() {
  const hoje = new Date()
  const de = isoDia(hoje)
  const ate = isoDia(new Date(hoje.getTime() + 13 * 86400000))
  const escala = useQuery({
    queryKey: ['tele-minha-escala', de, ate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('tele_minha_escala', { p_de: de, p_ate: ate })
      if (error) throw error
      return data ?? []
    },
  })
  return (
    <div className="flex flex-col gap-6">
      <Secao titulo="Minha escala de plantão remoto" extra="próximos 14 dias">
        <Erro e={escala.error} />
        {escala.isLoading && <Spinner />}
        {escala.data?.length === 0 && <VazioLinha>Nenhum plantão remoto na sua escala nos próximos 14 dias.</VazioLinha>}
        <ul className="overflow-hidden rounded-cartao border border-fio bg-superficie shadow-repouso empty:hidden">
          {(escala.data ?? []).map((e) => (
            <li key={e.escala_id} className="flex flex-wrap items-center gap-3 border-b border-trilha px-5 py-2.5 last:border-0">
              <span className={cn('grid w-12 shrink-0 place-items-center rounded-controle border py-1.5 text-rotulo font-semibold leading-tight',
                e.agora ? 'border-marca/30 bg-alerta-marca text-acao' : 'border-fio bg-trilha/60 text-tinta-apoio')}>
                <span className="capitalize">{diaSemana(e.inicio)}</span><span className="font-normal">{diaMes(e.inicio)}</span>
              </span>
              <span className="w-28 text-apoio tabular-nums text-tinta">{hhmm(e.inicio)}–{hhmm(e.fim)}</span>
              <span className="min-w-[180px] flex-1 text-apoio text-tinta-apoio">{e.unidade} · {e.setor} · {TURNO[e.turno] ?? e.turno}</span>
              {e.agora && <Badge variant="default">agora</Badge>}
              {e.checkin_em && <span className="text-rotulo text-tinta-sussurro">check-in {hhmm(e.checkin_em)}{e.checkout_em ? ` · check-out ${hhmm(e.checkout_em)}` : ''}</span>}
            </li>
          ))}
        </ul>
        <Nota>Não há teleconsulta eletiva marcada no app: a teleinterconsulta é por chamado do médico presencial e chega na Minha fila durante o plantão.</Nota>
      </Secao>
      <Extrato />
    </div>
  )
}

function Extrato() {
  const hoje = new Date()
  const [mes, setMes] = React.useState(() => isoDia(hoje).slice(0, 7))
  const [ano, m] = mes.split('-').map(Number)
  const de = `${mes}-01`
  const ate = isoDia(new Date(Date.UTC(ano, m, 0, 12)))
  const q = useQuery({
    queryKey: ['tele-extrato', de, ate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('tele_extrato', { p_de: de, p_ate: ate })
      if (error) throw error
      return data ?? []
    },
  })
  const linhas = q.data ?? []
  const soma = (sit: string[]) => linhas.filter((l) => sit.includes(l.situacao)).reduce((s, l) => s + Number(l.valor || 0), 0)
  const emCurso = linhas.find((l) => l.situacao === 'em_curso')
  const pareceres = linhas.reduce((s, l) => s + Number(l.pareceres || 0), 0)
  const horasFechadas = linhas.filter((l) => l.situacao === 'fechado').reduce((s, l) => s + Number(l.horas || 0), 0)
  const nomeMes = new Date(Date.UTC(ano, m - 1, 15)).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const trocar = (delta: number) => { const d = new Date(Date.UTC(ano, m - 1 + delta, 15)); setMes(d.toISOString().slice(0, 7)) }
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid size-[34px] place-items-center rounded-controle bg-marca/10 text-acao" aria-hidden><Receipt className="size-4" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-secao font-semibold text-tinta">Extrato · {nomeMes}</h2>
          <p className="text-apoio text-tinta-sussurro">Plantão conta pelo valor da unidade para o setor e o turno escalados; o parecer respondido aparece no plantão em que foi escrito</p>
        </div>
        <div className="flex gap-1.5">
          <Button size="xs" variant="outline" onClick={() => trocar(-1)}>Mês anterior</Button>
          <Button size="xs" variant="outline" onClick={() => trocar(1)}>Próximo</Button>
        </div>
      </div>
      <Erro e={q.error} />
      {linhas.length > 0 && linhas.every((l) => Number(l.valor) === 0) && (
        <Nota>A unidade ainda não tem valor de plantão configurado para estes setores e turnos (o gestor define em Configuração → Valores de plantão). Por isso os valores aparecem zerados; horas e pareceres são reais.</Nota>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ['Fechado até agora', brl(soma(['fechado'])), `${horasFechadas.toLocaleString('pt-BR')} h de plantão encerradas`],
          ['Plantão em curso', emCurso ? brl(Number(emCurso.valor)) : '—', emCurso ? `${emCurso.unidade} · até ${hhmm(emCurso.fim)}` : 'nenhum agora'],
          ['Previsto no mês', brl(soma(['fechado', 'em_curso', 'previsto'])), 'pela escala do mês'],
        ].map(([rot, v, sub]) => (
          <div key={rot} className="flex flex-col gap-1 rounded-cartao border border-fio bg-superficie px-4 py-3.5 shadow-repouso">
            <span className="text-rotulo font-semibold tracking-[0.05em] text-tinta-sussurro uppercase">{rot}</span>
            <span className="text-[26px] leading-none font-semibold tracking-[-0.03em] tabular-nums text-tinta">{v}</span>
            <span className="text-rotulo text-tinta-sussurro">{sub}</span>
          </div>
        ))}
      </div>
      {q.isLoading && <Spinner />}
      {q.data?.length === 0 && <VazioLinha>Nenhum plantão remoto na sua escala neste mês.</VazioLinha>}
      <ul className="overflow-hidden rounded-cartao border border-fio bg-superficie shadow-repouso empty:hidden">
        {linhas.slice().reverse().map((l) => (
          <li key={l.escala_id} className="flex flex-wrap items-center gap-3 border-b border-trilha px-5 py-2.5 last:border-0">
            <span className="w-12 text-apoio font-semibold tabular-nums text-tinta">{diaMes(l.inicio)}</span>
            <div className="flex min-w-[200px] flex-1 flex-col gap-0.5">
              <span className="text-apoio text-tinta">{capital(diaSemana(l.inicio))} {hhmm(l.inicio)}–{hhmm(l.fim)} <span className="text-tinta-sussurro">· {l.unidade} · {l.setor}</span></span>
              <span className="text-rotulo text-tinta-sussurro">
                {Number(l.horas).toLocaleString('pt-BR')} h escaladas · {l.pareceres} {Number(l.pareceres) === 1 ? 'parecer respondido' : 'pareceres respondidos'}
                {l.checkin_em ? ` · check-in ${hhmm(l.checkin_em)}` : l.situacao !== 'previsto' ? ' · sem check-in' : ''}{l.checkout_em ? ` · check-out ${hhmm(l.checkout_em)}` : ''}
              </span>
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <span className={cn('text-corpo font-semibold tabular-nums', l.situacao === 'em_curso' ? 'text-atencao' : 'text-tinta')}>{brl(Number(l.valor))}</span>
              <span className={cn('text-rotulo', l.situacao === 'em_curso' ? 'text-atencao' : 'text-tinta-sussurro')}>
                {l.situacao === 'fechado' ? 'Fechado' : l.situacao === 'em_curso' ? 'Em curso' : 'Previsto'}
              </span>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-rotulo text-pretty text-tinta-sussurro">
        {pareceres} {pareceres === 1 ? 'parecer respondido' : 'pareceres respondidos'} nos plantões do mês. O valor de cada plantão é o que o gestor configurou para a unidade (o mesmo do extrato do plantonista); a rede não tem valor por parecer cadastrado, então parecer não entra na soma.
      </p>
    </section>
  )
}
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// ── telemonitoramento ───────────────────────────────────────────────────────
function Telemonitoramento({ unidadeId }: { unidadeId: string }) {
  const q = useQuery({
    queryKey: ['tele-cobertura', unidadeId],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('tele_cobertura', { p_unidade: unidadeId, p_dias: 7 })
      if (error) throw error
      return data ?? []
    },
  })
  const agora = (q.data ?? []).filter((c) => c.agora)
  const depois = (q.data ?? []).filter((c) => !c.agora)
  const Linha = ({ c }: { c: NonNullable<typeof q.data>[number] }) => (
    <li className={cn('flex flex-wrap items-center gap-3 border-b border-trilha px-5 py-3 last:border-0', c.minha && 'bg-alerta-marca/40')}>
      <span aria-hidden className={cn('size-2 shrink-0 rounded-full', c.agora ? 'bg-marca' : 'bg-fio')} />
      <div className="flex min-w-[200px] flex-1 flex-col gap-0.5">
        <span className="text-apoio font-medium text-tinta">{c.setor}</span>
        <span className="text-rotulo text-tinta-sussurro">{c.minha ? 'Minha escala' : `Coberto por ${c.medico}`} · {capital(diaSemana(c.inicio))} {diaMes(c.inicio)} {hhmm(c.inicio)}–{hhmm(c.fim)}</span>
      </div>
      {c.situacao && (
        <span className={cn('inline-flex items-center gap-[7px] rounded-capsula border py-1 pr-[11px] pl-[9px] text-rotulo font-medium', COR_SITUACAO[c.situacao as Situacao['estado']])}>
          <PontoSituacao estado={c.situacao as Situacao['estado']} />{ROTULO_SITUACAO[c.situacao as Situacao['estado']]}
        </span>
      )}
    </li>
  )
  return (
    <div className="flex flex-col gap-5">
      <Erro e={q.error} />
      {q.isLoading && <Spinner />}
      <Secao titulo={`Cobertos agora (${agora.length})`}>
        {q.data && agora.length === 0 && <VazioLinha>Nenhum setor com telemedicina de plantão neste momento.</VazioLinha>}
        <ul className="overflow-hidden rounded-cartao border border-fio bg-superficie shadow-repouso empty:hidden">{agora.map((c, i) => <Linha key={i} c={c} />)}</ul>
      </Secao>
      <Secao titulo="Próximos 7 dias">
        {q.data && depois.length === 0 && <VazioLinha>Nenhuma cobertura escalada nos próximos 7 dias.</VazioLinha>}
        <ul className="overflow-hidden rounded-cartao border border-fio bg-superficie shadow-repouso empty:hidden">{depois.map((c, i) => <Linha key={i} c={c} />)}</ul>
      </Secao>
      <Nota>A cobertura vem da escala da telemedicina na unidade. A escala não abre os pacientes do setor: o prontuário só abre pela teleinterconsulta aceita.</Nota>
    </div>
  )
}

// ── assinaturas pendentes ───────────────────────────────────────────────────
type Pendencias = {
  sem_parecer: { teleinterconsulta_id: string; aceita_em: string; urgencia: string; paciente: string; unidade: string; setor: string | null; solicitante: string }[]
  sem_assinatura: { teleinterconsulta_id: string; documento_id: string; numero: string; emitido_em: string; paciente: string; unidade: string; setor: string | null; solicitante: string }[]
}
function Assinaturas() {
  const q = useQuery({
    queryKey: ['tele-pendencias'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('tele_pendencias')
      if (error) throw error
      return data as unknown as Pendencias
    },
  })
  const d = q.data
  return (
    <div className="flex flex-col gap-5">
      <Erro e={q.error} />
      {q.isLoading && <Spinner />}
      {d && (
        <>
          <Secao titulo={`Parecer por escrever (${d.sem_parecer.length})`}>
            {d.sem_parecer.length === 0 && <VazioLinha>Nenhum pedido aceito esperando o seu parecer.</VazioLinha>}
            <ul className="overflow-hidden rounded-cartao border border-fio bg-superficie shadow-repouso empty:hidden">
              {d.sem_parecer.map((p) => (
                <li key={p.teleinterconsulta_id} className="flex flex-wrap items-center gap-3 border-b border-trilha px-5 py-3 last:border-0">
                  <div className="flex min-w-[200px] flex-1 flex-col gap-0.5">
                    <span className="text-apoio font-medium text-tinta">{p.paciente} <span className="font-normal text-tinta-sussurro">· {p.setor ?? p.unidade}</span></span>
                    <span className="text-rotulo text-tinta-sussurro">Pedido de {p.solicitante} · aceito às {hhmm(p.aceita_em)} ({ha(p.aceita_em)})</span>
                  </div>
                  {p.urgencia === 'urgente' && <Badge variant="destructive">urgente</Badge>}
                  <Button size="sm" variant="outline" render={<Link to="/telemedicina/salas" />} nativeButton={false}><Video className="size-3.5" aria-hidden />Responder</Button>
                </li>
              ))}
            </ul>
          </Secao>
          <Secao titulo={`Emitidos sem assinatura digital (${d.sem_assinatura.length})`}>
            {d.sem_assinatura.length === 0 && <VazioLinha>Nenhum parecer seu esperando assinatura.</VazioLinha>}
            <ul className="overflow-hidden rounded-cartao border border-fio bg-superficie shadow-repouso empty:hidden">
              {d.sem_assinatura.map((p) => (
                <li key={p.documento_id} className="flex flex-wrap items-center gap-3 border-b border-trilha px-5 py-3 last:border-0">
                  <div className="flex min-w-[200px] flex-1 flex-col gap-0.5">
                    <span className="text-apoio font-medium text-tinta">Parecer nº {p.numero} <span className="font-normal text-tinta-sussurro">· {p.paciente} · {p.setor ?? p.unidade}</span></span>
                    <span className="text-rotulo text-tinta-sussurro">Emitido em {fmtDataHora(p.emitido_em)} · pedido de {p.solicitante}</span>
                  </div>
                  <Badge variant="warning">aguarda ICP-Brasil</Badge>
                </li>
              ))}
            </ul>
          </Secao>
          <Nota icone={<ShieldCheck />}>
            A assinatura com certificado ICP-Brasil (Res. CFM 2.314/2022, art. 13) entra com a etapa 4.8, que ainda não tem provedor escolhido. Até lá o parecer vale pela emissão numerada no prontuário, com o seu CRM, e já chegou ao médico que pediu. Nada aqui é assinado.
          </Nota>
        </>
      )}
    </div>
  )
}

// ── histórico e auditoria ───────────────────────────────────────────────────
type Historico = {
  consultas: { id: string; paciente: string; unidade: string; setor: string | null; solicitante: string; pergunta: string; resposta: string | null
    status: string; urgencia: string; criada_em: string; aceita_em: string | null; respondida_em: string | null
    numero_solicitacao: string | null; numero_parecer: string | null; assinado_em: string | null }[]
  trilha: { em: string; acao: string; paciente: string; unidade: string; por: string }[]
}
const ACAO: Record<string, string> = {
  solicitar_teleinterconsulta: 'Pedido aberto', aceitar_teleinterconsulta: 'Aceitou', responder_teleinterconsulta: 'Respondeu (parecer emitido)',
  cancelar_teleinterconsulta: 'Pedido cancelado', leitura_prontuario: 'Abriu o prontuário', leitura_documento: 'Abriu documento',
}
function Historico() {
  const [dias, setDias] = React.useState(30)
  const [aberto, setAberto] = React.useState<string | null>(null)
  const q = useQuery({
    queryKey: ['tele-historico', dias],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('tele_historico', { p_dias: dias })
      if (error) throw error
      return data as unknown as Historico
    },
  })
  const d = q.data
  return (
    <div className="flex flex-col gap-5">
      <div role="group" aria-label="Período" className="flex flex-wrap gap-1.5">
        {[7, 30, 90].map((n) => (
          <button key={n} type="button" aria-pressed={dias === n} onClick={() => setDias(n)}
            className={cn('rounded-capsula border px-[13px] py-[5px] text-apoio', dias === n ? 'border-acao bg-acao font-medium text-white' : 'border-fio bg-superficie text-tinta-apoio hover:border-acao hover:text-acao')}>
            {n} dias
          </button>
        ))}
      </div>
      <Erro e={q.error} />
      {q.isLoading && <Spinner />}
      {d && (
        <>
          <Secao titulo={`Minhas teleinterconsultas (${d.consultas.length})`}>
            {d.consultas.length === 0 && <VazioLinha>Nenhuma teleinterconsulta sua no período.</VazioLinha>}
            <ul className="overflow-hidden rounded-cartao border border-fio bg-superficie shadow-repouso empty:hidden">
              {d.consultas.map((c) => (
                <li key={c.id} className="border-b border-trilha px-5 py-3 last:border-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex min-w-[200px] flex-1 flex-col gap-0.5">
                      <span className="text-apoio font-medium text-tinta">{c.paciente} <span className="font-normal text-tinta-sussurro">· {c.setor ?? ''} · {c.unidade}</span></span>
                      <span className="text-rotulo text-tinta-sussurro">
                        Pedido de {c.solicitante} em {fmtDataHora(c.criada_em)}{c.respondida_em ? ` · respondida em ${fmtDataHora(c.respondida_em)}` : ''}
                        {c.numero_parecer ? ` · parecer nº ${c.numero_parecer}` : ''}
                      </span>
                    </div>
                    <Badge variant={c.status === 'respondida' ? 'success' : 'info'}>{c.status === 'respondida' ? 'respondida' : 'em atendimento'}</Badge>
                    <Button size="xs" variant="outline" onClick={() => setAberto(aberto === c.id ? null : c.id)}><FileText className="size-3.5" aria-hidden />{aberto === c.id ? 'Fechar' : 'Pergunta e parecer'}</Button>
                  </div>
                  {aberto === c.id && (
                    <div className="mt-2.5 flex flex-col gap-2 text-apoio">
                      <p className="rounded-controle bg-trilha/60 px-3 py-2 text-tinta"><span className="font-medium">Pergunta: </span>{c.pergunta}</p>
                      {c.resposta && <p className="rounded-controle border border-conforme/30 bg-conforme/[0.05] px-3 py-2 whitespace-pre-wrap text-tinta"><span className="font-medium">Parecer: </span>{c.resposta}</p>}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Secao>
          <Secao titulo="Trilha de auditoria" extra="pedidos, aceites, pareceres e aberturas de prontuário">
            {d.trilha.length === 0 && <VazioLinha>Nada registrado no período.</VazioLinha>}
            <ul className="overflow-hidden rounded-cartao border border-fio bg-superficie shadow-repouso empty:hidden">
              {d.trilha.map((t, i) => (
                <li key={i} className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-3 gap-y-0.5 border-b border-trilha px-5 py-2 last:border-0 sm:grid-cols-[120px_180px_minmax(0,1fr)_minmax(0,1fr)]">
                  <span className="text-rotulo tabular-nums text-tinta-sussurro">{fmtDataHora(t.em)}</span>
                  <span className="text-apoio font-medium text-tinta">{ACAO[t.acao] ?? t.acao}</span>
                  <span className="text-apoio text-tinta-apoio">{t.paciente} · {t.unidade}</span>
                  <span className="text-rotulo text-tinta-sussurro">{t.por}</span>
                </li>
              ))}
            </ul>
          </Secao>
        </>
      )}
    </div>
  )
}

// ── unidades e credenciais ──────────────────────────────────────────────────
type Credenciais = {
  perfil: { nome: string; crm: string | null; uf_crm: string | null; conselho: string | null; registro_numero: string | null; registro_uf: string | null }
  especialidades: string[]
  unidades: { unidade_id: string; nome: string; uf: string | null; municipio: string | null; de_plantao: boolean; proximo: string | null }[]
}
function Credenciais() {
  const q = useQuery({
    queryKey: ['tele-credenciais'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('tele_credenciais')
      if (error) throw error
      return data as unknown as Credenciais
    },
  })
  const d = q.data
  const crm = d?.perfil.crm ? `CRM ${d.perfil.crm}${d.perfil.uf_crm ? `/${d.perfil.uf_crm}` : ''}` : null
  return (
    <div className="flex flex-col gap-5">
      <Erro e={q.error} />
      {q.isLoading && <Spinner />}
      {d && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ['Inscrição', crm ?? 'CRM não cadastrado', crm ? 'do seu cadastro; vai em todo parecer' : 'peça ao gestor para completar o cadastro'],
              ['Especialidade', d.especialidades.length ? d.especialidades.join(', ') : 'nenhuma declarada', 'declarada por você; o RQE não é conferido pelo app'],
              ['Assinatura digital', 'Não configurada', 'ICP-Brasil entra com a etapa 4.8 (provedor a escolher)'],
            ].map(([rot, v, sub]) => (
              <div key={rot} className="flex flex-col gap-1 rounded-cartao border border-fio bg-superficie px-4 py-3.5 shadow-repouso">
                <span className="text-rotulo font-semibold tracking-[0.05em] text-tinta-sussurro uppercase">{rot}</span>
                <span className="text-corpo font-semibold text-tinta">{v}</span>
                <span className="text-rotulo text-tinta-sussurro">{sub}</span>
              </div>
            ))}
          </div>
          <Secao titulo={`Unidades com papel de telemedicina (${d.unidades.length})`}>
            <ul className="overflow-hidden rounded-cartao border border-fio bg-superficie shadow-repouso">
              {d.unidades.map((u) => (
                <li key={u.unidade_id} className="flex flex-wrap items-center gap-3 border-b border-trilha px-5 py-3 last:border-0">
                  <span className="rounded-capsula bg-trilha px-2 py-[3px] text-rotulo font-semibold tracking-[0.05em] text-tinta-apoio">{u.uf ?? '—'}</span>
                  <span className="min-w-[180px] flex-1 text-apoio font-medium text-tinta">{u.nome}{u.municipio ? <span className="font-normal text-tinta-sussurro"> · {u.municipio}</span> : null}</span>
                  <span className={cn('text-apoio', u.de_plantao ? 'text-conforme' : 'text-tinta-sussurro')}>
                    {u.de_plantao ? 'cobrindo agora' : u.proximo ? `próximo plantão ${capital(diaSemana(u.proximo))} ${diaMes(u.proximo)} às ${hhmm(u.proximo)}` : 'fora da minha escala'}
                  </span>
                </li>
              ))}
            </ul>
          </Secao>
          <Nota icone={<Lock />}>
            Este papel não entra na Central do Plantonista, no Plantão nem nos leitos da unidade. O prontuário do paciente abre só pela teleinterconsulta que você aceitou, e cada abertura vai para a trilha de auditoria.
          </Nota>
        </>
      )}
    </div>
  )
}
