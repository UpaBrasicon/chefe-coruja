/* eslint-disable react-refresh/only-export-components */
// Peças comuns às telas da telemedicina (P/index.html 5919–6240): o cartão
// da teleinterconsulta, a lista da unidade e a disponibilidade no topo
// (Disponível / Ausente / Em consulta), gravada no banco
// (migration 20261009000002).
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as React from 'react'

import { Badge } from '@/components/ui/badge'
import { fmtData, fmtDataHora } from '@/lib/datas'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

export type Tele = {
  id: string
  paciente_id: string
  paciente_nome: string
  paciente_nascimento: string | null
  setor_nome: string | null
  solicitante_nome: string
  consultor_nome: string | null
  pergunta: string
  urgencia: 'rotina' | 'urgente'
  consentimento: string
  status: 'aberta' | 'em_atendimento' | 'respondida' | 'cancelada'
  criada_em: string
  aceita_em: string | null
  resposta: string | null
  respondida_em: string | null
  documento_solicitacao_numero: string | null
  documento_resposta_numero: string | null
  minha: boolean
}

export const STATUS: Record<Tele['status'], { rotulo: string; variante: 'warning' | 'info' | 'success' | 'secondary' }> = {
  aberta: { rotulo: 'Aguardando teleconsultor', variante: 'warning' },
  em_atendimento: { rotulo: 'Em atendimento', variante: 'info' },
  respondida: { rotulo: 'Respondida', variante: 'success' },
  cancelada: { rotulo: 'Cancelada', variante: 'secondary' },
}

export const hhmm = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }) : '—'

/** "há 12 min", "há 2 h". */
export function ha(iso: string | null | undefined) {
  if (!iso) return ''
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  return min < 60 ? `há ${min} min` : `há ${Math.floor(min / 60)} h${min % 60 ? String(min % 60).padStart(2, '0') : ''}`
}

export function useTeles(unidadeId?: string, dias = 7) {
  return useQuery({
    queryKey: ['teleinterconsultas', unidadeId, dias],
    enabled: !!unidadeId,
    refetchInterval: 20_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('teleinterconsultas_da_unidade', { p_unidade: unidadeId!, p_dias: dias })
      if (error) throw error
      return (data ?? []) as Tele[]
    },
  })
}

export function Cartao({ t, children }: { t: Tele; children?: React.ReactNode }) {
  return (
    <li className={cn('rounded-cartao border bg-superficie px-5 py-3.5 shadow-repouso', t.urgencia === 'urgente' && t.status === 'aberta' ? 'border-critico/40' : 'border-fio')}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-corpo font-semibold text-tinta">{t.paciente_nome}</span>
        {t.paciente_nascimento && <span className="text-apoio text-tinta-sussurro">nasc. {fmtData(t.paciente_nascimento)}</span>}
        {t.setor_nome && <span className="text-apoio text-tinta-sussurro">· {t.setor_nome}</span>}
        <span className="ml-auto flex flex-wrap items-center gap-1.5">
          {t.urgencia === 'urgente' && <Badge variant="destructive">urgente</Badge>}
          <Badge variant={STATUS[t.status].variante}>{STATUS[t.status].rotulo}</Badge>
        </span>
      </div>
      <div className="mt-0.5 text-rotulo text-tinta-sussurro">
        Solicitada por {t.solicitante_nome} em {fmtDataHora(t.criada_em)}
        {t.status === 'aberta' ? ` · esperando ${ha(t.criada_em).replace('há ', '')}` : ''}
        {t.documento_solicitacao_numero ? ` · documento nº ${t.documento_solicitacao_numero}` : ''}
        {t.consultor_nome ? ` · teleconsultor ${t.consultor_nome}` : ''}
      </div>
      <p className="mt-2 rounded-controle bg-trilha/60 px-3 py-2 text-apoio text-tinta"><span className="font-medium">Pergunta: </span>{t.pergunta}</p>
      {t.resposta && (
        <div className="mt-2 rounded-controle border border-conforme/30 bg-conforme/[0.05] px-3 py-2 text-apoio">
          <div className="text-rotulo text-tinta-sussurro">
            Parecer em {t.respondida_em ? fmtDataHora(t.respondida_em) : ''}{t.documento_resposta_numero ? ` · documento nº ${t.documento_resposta_numero}` : ''}
          </div>
          <p className="mt-1 whitespace-pre-wrap text-tinta">{t.resposta}</p>
          <p className="mt-1 text-rotulo text-tinta-sussurro">A conduta é do médico assistente presencial.</p>
        </div>
      )}
      {children}
    </li>
  )
}

// ── disponibilidade no topo ─────────────────────────────────────────────────
export type Situacao = {
  estado: 'disponivel' | 'ausente' | 'em_consulta'
  escolhido: 'disponivel' | 'ausente'
  de_plantao: boolean
  plantao_inicio: string | null
  plantao_fim: string | null
  setor: string | null
  fila: number
  salas: number
  assinaturas: number
}

export const ROTULO_SITUACAO: Record<Situacao['estado'], string> = { disponivel: 'Disponível', ausente: 'Ausente', em_consulta: 'Em consulta' }
export const COR_SITUACAO: Record<Situacao['estado'], string> = {
  disponivel: 'border-marca/30 bg-alerta-marca text-acao',
  ausente: 'border-fio bg-trilha text-tinta-apoio',
  em_consulta: 'border-critico/30 bg-alerta-critico text-critico',
}
const PONTO: Record<Situacao['estado'], string> = { disponivel: 'bg-marca', ausente: 'bg-tinta-sussurro', em_consulta: 'bg-critico' }

export function useSituacaoTele(unidadeId?: string) {
  return useQuery({
    queryKey: ['situacao-tele', unidadeId],
    enabled: !!unidadeId,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('minha_situacao_tele', { p_unidade: unidadeId! })
      if (error) throw error
      return data as unknown as Situacao
    },
  })
}

export function PontoSituacao({ estado }: { estado: Situacao['estado'] }) {
  return <span aria-hidden className={cn('size-[7px] shrink-0 rounded-full', PONTO[estado])} />
}

/** O seletor de disponibilidade e a situação do plantão remoto. */
export function TopoTele({ unidadeId }: { unidadeId: string }) {
  const qc = useQueryClient()
  const s = useSituacaoTele(unidadeId)
  const [erro, setErro] = React.useState<string | null>(null)
  const d = s.data
  if (!d) return null
  const alternar = async () => {
    const { error } = await supabase.rpc('definir_minha_disponibilidade_tele', { p_estado: d.escolhido === 'disponivel' ? 'ausente' : 'disponivel' })
    if (error) return setErro(error.message)
    setErro(null); void qc.invalidateQueries({ queryKey: ['situacao-tele'] })
  }
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <span className="text-rotulo text-tinta-sussurro">
        {d.de_plantao ? `De plantão até ${hhmm(d.plantao_fim)}${d.setor ? ` · ${d.setor}` : ''}` : 'Fora da escala agora'}
      </span>
      <button type="button" onClick={() => void alternar()} disabled={d.estado === 'em_consulta'}
        title={d.estado === 'em_consulta' ? 'Em consulta enquanto houver teleinterconsulta aceita sem parecer' : 'Alternar disponibilidade'}
        className={cn('inline-flex items-center gap-[7px] rounded-capsula border py-1 pr-[11px] pl-[9px] text-apoio font-medium whitespace-nowrap', COR_SITUACAO[d.estado],
          d.estado !== 'em_consulta' && 'cursor-pointer hover:opacity-85')}>
        <PontoSituacao estado={d.estado} />
        {ROTULO_SITUACAO[d.estado]}
      </button>
      {erro && <span role="alert" className="basis-full text-right text-rotulo text-critico">{erro}</span>}
    </div>
  )
}

export function Secao({ titulo, extra, children }: { titulo: string; extra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-rotulo font-semibold tracking-[0.05em] text-tinta-sussurro uppercase">{titulo}</h2>
        {extra && <span className="text-rotulo text-tinta-sussurro">{extra}</span>}
      </div>
      {children}
    </section>
  )
}

export function Nota({ children, icone }: { children: React.ReactNode; icone?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-container border border-fio bg-trilha/50 px-3.5 py-2.5 text-apoio text-pretty text-tinta-apoio">
      {icone && <span className="mt-0.5 shrink-0 text-tinta-sussurro [&_svg]:size-3.5">{icone}</span>}
      <span>{children}</span>
    </div>
  )
}

export function VazioLinha({ children }: { children: React.ReactNode }) {
  return <p className="rounded-cartao border border-dashed border-fio px-5 py-4 text-apoio text-tinta-sussurro">{children}</p>
}
