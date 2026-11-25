// ─────────────────────────────────────────────────────────────────────────────
// Resumo do leito como painel em blocos (RS2, revisão da Internação aprovada
// pelo RT em 24/11/2026: "Todas, segue"). Sem sub-abas: cada bloco diz o que
// importa agora, com a contagem e o atalho para a aba que resolve.
//
// Blocos: diagnóstico e plano da última evolução médica; sinais vitais com o
// NEWS2/PEWS e a tendência (os números como foram aferidos); prescrição ativa e
// vencida; exames aguardando e resultados novos; pendências; regulação. Abaixo,
// a passagem, a contenção ativa e as intercorrências (o resumo do caso, os
// agravos e o histórico na unidade saíram em 24/11/2026). A admissão médica ainda não
// registrada aparece no topo, com o atalho para registrar (MA1).
// Só leitura do que já existe: toda regra continua no servidor.
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, ChevronDown, ClipboardList, FlaskConical, Pill, Stethoscope, Waypoints } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { useAgora } from '@/hooks/useAgora'
import { resumoValidade, type ComValidade } from '@/lib/validadePrescricao'
import { PENDENTE, type SituacaoExame } from '@/lib/exames'
import { admissaoVigente } from '@/lib/admissaoReavaliacao'
import { STATUS } from '@/lib/regulacao'
import type { PedidoResumo } from '@/lib/regulacaoPaciente'
import { useDocumentosEpisodio } from '@/components/documento/documentos'
import { useContextoEvolucao, diaHora as diaHoraEvol } from '@/components/evolucao/dados'
import { Button } from '@/components/ui/button'

import { useDiagnosticos } from './diagnosticos'

export type DestinoResumo = 'evol' | 'receituario' | 'exames' | 'regulacao' | 'admissao'

/** Bloco do painel: título com a contagem e o atalho para a aba. */
export function BlocoResumo({ titulo, icone, contagem, tom = 'neutro', irPara, rotuloIr, children, className }: {
  titulo: string
  icone?: React.ReactNode
  contagem?: React.ReactNode
  tom?: 'neutro' | 'atencao' | 'critico'
  irPara?: () => void
  rotuloIr?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section aria-label={titulo} className={cn('flex min-w-0 flex-col gap-2 rounded-container border border-fio bg-superficie px-4 py-3',
      tom === 'critico' && 'border-critico/30', tom === 'atencao' && 'border-atencao/40', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-2 text-controle font-semibold text-tinta">{icone}{titulo}</span>
        {contagem !== undefined && (
          <span className={cn('text-apoio tabular-nums', tom === 'critico' ? 'font-semibold text-critico' : tom === 'atencao' ? 'text-atencao' : 'text-tinta-sussurro')}>
            {contagem}
          </span>
        )}
        {irPara && (
          <Button variant="link" size="xs" className="ml-auto min-h-0 gap-1 px-0" onClick={irPara}>
            {rotuloIr ?? 'Abrir'} <ArrowRight className="size-3" aria-hidden />
          </Button>
        )}
      </div>
      {children}
    </section>
  )
}

type ItemValidade = ComValidade & { tipo: string; descricao: string }
type ExameResumo = { id: string; exame: string; situacao: string; resultado: string | null; pedido_em: string; critico: boolean; resultado_visto_em: string | null }

/** Diagnóstico vigente e o A/P da última evolução médica estruturada. */
function BlocoDiagnosticoPlano({ internacaoId, irPara }: { internacaoId: string; irPara: () => void }) {
  const diag = useDiagnosticos(internacaoId)
  const ctx = useContextoEvolucao(internacaoId)
  const vigentes = (diag.data ?? []).filter((d) => !d.encerrado_em)
    .sort((a, b) => (a.tipo === b.tipo ? 0 : a.tipo === 'primario' ? -1 : 1))
  const ultima = ctx.data?.ultima_estruturada
  const a = ultima?.dados.a?.trim()
  const pl = ultima?.dados.p?.trim()
  return (
    <BlocoResumo titulo="Diagnóstico e plano" icone={<Stethoscope className="size-4 text-acao" aria-hidden />}
      contagem={vigentes.length ? `${vigentes.length} ${vigentes.length === 1 ? 'problema' : 'problemas'}` : undefined}
      irPara={irPara} rotuloIr="Evolução">
      {diag.isLoading ? <span className="text-apoio text-tinta-sussurro">Carregando…</span>
        : vigentes.length === 0 ? <span className="text-apoio text-atencao">Sem diagnóstico registrado.</span>
          : (
            <ul className="flex flex-col gap-0.5">
              {vigentes.map((d) => (
                <li key={d.id} className="text-apoio text-tinta">
                  {d.cid}{d.descricao ? ` — ${d.descricao}` : ''}
                  <span className="text-tinta-sussurro"> · {d.tipo === 'primario' ? 'principal' : 'secundário'} · {d.status === 'confirmado' ? 'confirmado' : 'hipótese'}</span>
                </li>
              ))}
            </ul>
          )}
      {ultima ? (
        <div className="flex flex-col gap-1 border-t border-trilha pt-2">
          <span className="text-rotulo text-tinta-sussurro">Última evolução médica · {diaHoraEvol(ultima.criado_em)}</span>
          {a && <p className="line-clamp-3 text-apoio text-pretty text-grafite"><b className="font-medium">Avaliação:</b> {a}</p>}
          {pl && <p className="line-clamp-3 text-apoio text-pretty text-grafite"><b className="font-medium">Plano:</b> {pl}</p>}
          {!a && !pl && <span className="text-apoio text-tinta-sussurro">Sem avaliação nem plano escritos.</span>}
        </div>
      ) : !ctx.isLoading && <span className="border-t border-trilha pt-2 text-apoio text-tinta-sussurro">Nenhuma evolução médica estruturada nesta internação.</span>}
    </BlocoResumo>
  )
}

function BlocoPrescricao({ pacienteId, irPara }: { pacienteId: string; irPara: () => void }) {
  const agora = useAgora()
  // as mesmas leituras (e o mesmo cache) da aba Prescrição
  const vigente = useQuery({
    queryKey: ['prescricao-vigente', pacienteId],
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('prescricao_vigente', { p_paciente: pacienteId })
      if (error) throw error
      return (data ?? []) as unknown as ItemValidade[]
    },
  })
  const porta = useQuery({
    queryKey: ['prescricao-porta-ativa', pacienteId],
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('prescricao_porta_ativa', { p_paciente: pacienteId })
      if (error) throw error
      return (data ?? []) as unknown as ItemValidade[]
    },
  })
  const itens = [...(vigente.data ?? []), ...(porta.data ?? [])]
  const r = resumoValidade(itens, agora)
  const meds = itens.filter((i) => i.tipo === 'medicamento').length
  const tom = r.vencidos ? 'critico' : r.vencendo ? 'atencao' : 'neutro'
  return (
    <BlocoResumo titulo="Prescrição" icone={<Pill className="size-4 text-acao" aria-hidden />} tom={tom}
      contagem={`${itens.length} ${itens.length === 1 ? 'item ativo' : 'itens ativos'}`} irPara={irPara} rotuloIr="Prescrição">
      {vigente.isLoading ? <span className="text-apoio text-tinta-sussurro">Carregando…</span> : (
        <div className="flex flex-col gap-0.5 text-apoio">
          {r.vencidos > 0 && <span className="font-semibold text-critico">{r.vencidos} {r.vencidos === 1 ? 'vencido' : 'vencidos'}: a enfermagem não administra até renovar</span>}
          {r.vencendo > 0 && <span className="text-atencao">{r.vencendo} vencendo em até 2 horas</span>}
          <span className="text-tinta-apoio">{meds} {meds === 1 ? 'medicamento' : 'medicamentos'}{porta.data?.length ? ` · ${porta.data.length} vindos da porta` : ''}</span>
          {itens.length === 0 && <span className="text-tinta-sussurro">Nenhum item prescrito.</span>}
        </div>
      )}
    </BlocoResumo>
  )
}

function BlocoExames({ pacienteId, irPara }: { pacienteId: string; irPara: () => void }) {
  const agora = useAgora()
  // a mesma chave e as mesmas colunas da lista de exames (cache comum)
  const exames = useQuery({
    queryKey: ['exames-pedidos', pacienteId],
    queryFn: async () => {
      const { data, error } = await supabase.from('exames_pedidos').select('id, exame, situacao, resultado, motivo_cancelamento, pedido_em, procedimento, urgencia, critico, resultado_visto_em')
        .eq('paciente_id', pacienteId).order('pedido_em', { ascending: false }).limit(40)
      if (error) throw error
      return (data ?? []) as ExameResumo[]
    },
  })
  const lista = exames.data ?? []
  const aguardando = lista.filter((e) => PENDENTE.includes(e.situacao as SituacaoExame))
  const atrasados = aguardando.filter((e) => agora - Date.parse(e.pedido_em) > 48 * 3600_000).length
  const novos = lista.filter((e) => e.situacao === 'resultado' && !e.resultado_visto_em)
  const criticos = novos.filter((e) => e.critico).length
  const tom = criticos ? 'critico' : novos.length || atrasados ? 'atencao' : 'neutro'
  return (
    <BlocoResumo titulo="Exames" icone={<FlaskConical className="size-4 text-acao" aria-hidden />} tom={tom}
      contagem={`${aguardando.length} aguardando`} irPara={irPara} rotuloIr="Exames">
      {exames.isLoading ? <span className="text-apoio text-tinta-sussurro">Carregando…</span> : (
        <div className="flex flex-col gap-0.5 text-apoio">
          {novos.length > 0 && (
            <span className={criticos ? 'font-semibold text-critico' : 'text-acao'}>
              {novos.length} {novos.length === 1 ? 'resultado novo' : 'resultados novos'}{criticos ? `, ${criticos} crítico${criticos === 1 ? '' : 's'}` : ''}:{' '}
              {novos.slice(0, 3).map((e) => e.exame).join(', ')}{novos.length > 3 ? '…' : ''}
            </span>
          )}
          {atrasados > 0 && <span className="text-atencao">{atrasados} pedido{atrasados === 1 ? '' : 's'} há mais de 48 horas sem resultado</span>}
          {aguardando.length === 0 && novos.length === 0 && <span className="text-tinta-sussurro">Nenhum exame aguardando resultado.</span>}
        </div>
      )}
    </BlocoResumo>
  )
}

function BlocoRegulacao({ pacienteId, unidadeId, irPara }: { pacienteId: string; unidadeId?: string; irPara: () => void }) {
  // a mesma leitura da aba Regulação (cache comum)
  const q = useQuery({
    queryKey: ['regulacao-pacientes', 'paciente', unidadeId ?? '', pacienteId],
    enabled: !!unidadeId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('regulacao_do_paciente', { p_unidade: unidadeId!, p_paciente: pacienteId })
      if (error) throw error
      return data as unknown as { pode_solicitar: boolean; pedidos: PedidoResumo[] }
    },
  })
  const pedidos = q.data?.pedidos ?? []
  const abertos = pedidos.filter((p) => p.em_aberto)
  const esperando = abertos.filter((p) => p.status === 'pendencia' || p.status === 'devolvida' || p.conversa.novas > 0).length
  return (
    <BlocoResumo titulo="Regulação" icone={<Waypoints className="size-4 text-acao" aria-hidden />} tom={esperando ? 'atencao' : 'neutro'}
      contagem={abertos.length ? `${abertos.length} em aberto` : undefined} irPara={irPara} rotuloIr="Regulação">
      {q.isLoading ? <span className="text-apoio text-tinta-sussurro">Carregando…</span>
        : abertos.length === 0 ? <span className="text-apoio text-tinta-sussurro">{pedidos.length ? 'Nenhum pedido em aberto.' : 'Nenhum pedido de regulação.'}</span>
          : (
            <ul className="flex flex-col gap-0.5 text-apoio">
              {abertos.slice(0, 3).map((p) => (
                <li key={p.id} className="text-tinta">
                  nº {p.numero} · {STATUS[p.status]}{p.destino ? ` → ${p.destino}` : ''}
                  {p.status === 'pendencia' && <span className="text-atencao"> · a central perguntou</span>}
                  {p.conversa.novas > 0 && <span className="text-atencao"> · {p.conversa.novas} mensagem nova{p.conversa.novas === 1 ? '' : 's'}</span>}
                </li>
              ))}
            </ul>
          )}
    </BlocoResumo>
  )
}

/** MA1: enquanto a admissão médica não foi registrada, uma linha no topo do Resumo. */
function AdmissaoPendente({ pacienteId, internacaoId, irPara }: { pacienteId: string; internacaoId: string; irPara: () => void }) {
  const docs = useDocumentosEpisodio(pacienteId)
  if (!docs.isSuccess) return null
  if (admissaoVigente(docs.data, internacaoId)) return null
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-container border border-atencao/40 bg-alerta-atencao px-4 py-2.5">
      <ClipboardList className="size-4 shrink-0 text-atencao" aria-hidden />
      <span className="text-controle text-atencao">Admissão médica não registrada</span>
      <Button size="xs" variant="outline" className="ml-auto" onClick={irPara}>Registrar</Button>
    </div>
  )
}

/** Grupo recolhido do painel (histórico na unidade e o que não é do dia a dia). */
export function GrupoRecolhido({ titulo, children, inicial = false }: { titulo: string; children: React.ReactNode; inicial?: boolean }) {
  const [aberto, setAberto] = React.useState(inicial)
  return (
    <section className="flex flex-col gap-2">
      <Button variant="ghost" size="sm" aria-expanded={aberto} onClick={() => setAberto(!aberto)} className="self-start px-0 text-tinta-apoio hover:bg-transparent">
        <ChevronDown className={cn('size-4 transition-transform', aberto && 'rotate-180')} aria-hidden /> {titulo}
      </Button>
      {aberto && <div className="flex flex-col gap-3">{children}</div>}
    </section>
  )
}

export function ResumoLeito({ pacienteId, internacaoId, unidadeId, ativa, escreve, irPara, vitais, pendencias, depois }: {
  pacienteId: string
  internacaoId: string
  unidadeId?: string
  ativa: boolean
  /** médico que cuida da internação ativa (o gestor só lê) */
  escreve: boolean
  irPara: (aba: DestinoResumo) => void
  /** o bloco de sinais vitais, NEWS2/PEWS e tendência (BlocoAcuidade) */
  vitais?: React.ReactNode
  /** o bloco das pendências do leito (BlocoPendencias), com a contagem */
  pendencias?: React.ReactNode
  /** o que vem depois dos blocos (resumo do caso, passagem, contenção, intercorrências, histórico) */
  depois?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3.5">
      {ativa && escreve && <AdmissaoPendente pacienteId={pacienteId} internacaoId={internacaoId} irPara={() => irPara('admissao')} />}
      {!ativa && <p className="text-apoio text-tinta-sussurro">Internação encerrada: o painel mostra o que ficou registrado.</p>}
      <div className="grid items-start gap-3.5 lg:grid-cols-2">
        <BlocoDiagnosticoPlano internacaoId={internacaoId} irPara={() => irPara('evol')} />
        {vitais ? <div className="min-w-0">{vitais}</div> : null}
        {ativa && <BlocoPrescricao pacienteId={pacienteId} irPara={() => irPara('receituario')} />}
        <BlocoExames pacienteId={pacienteId} irPara={() => irPara('exames')} />
        <BlocoRegulacao pacienteId={pacienteId} unidadeId={unidadeId} irPara={() => irPara('regulacao')} />
        {pendencias ? <div className="min-w-0">{pendencias}</div> : null}
      </div>
      {depois}
    </div>
  )
}
