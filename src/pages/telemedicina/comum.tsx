/* eslint-disable react-refresh/only-export-components */
// Peças comuns às telas da telemedicina (P/index.html 5919–6240): o cartão
// da teleinterconsulta, a lista da unidade e a disponibilidade no topo
// (Disponível / Ausente / Em consulta), gravada no banco
// (migration 20261009000002).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as React from 'react'

import { TituloSecao } from '@/components/monitor/Pagina'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { useAgora } from '@/hooks/useAgora'
import { fmtData, fmtDataHora } from '@/lib/datas'
import { dataIso, hora } from '@/lib/formato'
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
  iso ? hora(iso) : '—'

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
        <div className="mt-2 rounded-controle border border-conforme/30 bg-alerta-conforme px-3 py-2 text-apoio">
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
  disponivel: 'border-acao/30 bg-alerta-marca text-acao',
  ausente: 'border-fio bg-trilha text-tinta-apoio',
  em_consulta: 'border-critico/30 bg-alerta-critico text-critico',
}
const PONTO: Record<Situacao['estado'], string> = { disponivel: 'bg-acao', ausente: 'bg-tinta-sussurro', em_consulta: 'bg-critico' }

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
  return <span aria-hidden className={cn('size-[7px] shrink-0 rounded-capsula', PONTO[estado])} />
}

/** O banco responde "Acesso negado." a quem não está no plantão da unidade (sem check-in). */
export const semPlantaoTele = (e: unknown) => !!e && /^Acesso negado/.test((e as Error).message ?? '')

type PlantaoEscala = { id: string; perfil_id: string; papel: string | null; setor_id: string; data: string; turno: string; inicio: string; duracao_min: number }
type Presenca = { id: string; checkin_em: string | null; checkout_em: string | null; escala_plantao_id: string | null; data: string; turno: string }

/**
 * O plantão remoto de agora, tirado da escala e do check-in (CH2, RT 24/11/2026).
 * `minha_situacao_tele.de_plantao` vem de plantoes_agora(), que depois da
 * tolerância só conta com check-in; por isso a escala é lida aqui à parte. Só
 * conta o plantão escalado na categoria telemedicina (conferência do RT na
 * homologação, 24/11/2026: um plantão de outra categoria no mesmo setor, com
 * check-in, aparecia como "De plantão"), e só o check-in desse plantão, casado
 * como em plantoes_agora(): pelo plantão, pelo dia e turno, ou pela hora.
 */
export function usePlantaoRemoto(unidadeId: string) {
  const { perfil } = useAuth()
  const qc = useQueryClient()
  const agora = useAgora(30_000)
  const hoje = dataIso(agora)
  const ontem = dataIso(agora - 86_400_000)
  const escala = useQuery({
    queryKey: ['tele-escala-hoje', unidadeId, ontem, hoje],
    enabled: !!perfil,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('escala_da_unidade', { p_unidade: unidadeId, p_de: ontem, p_ate: hoje })
      if (error) throw error
      return ((data ?? []) as PlantaoEscala[]).filter((p) => p.perfil_id === perfil!.id && p.papel === 'telemedicina')
    },
  })
  const setores = useQuery({
    queryKey: ['escala-setores', unidadeId],
    queryFn: async () => {
      const { data, error } = await supabase.from('setores').select('id, nome').eq('unidade_id', unidadeId).eq('ativo', true).order('ordem', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })
  const presenca = useQuery({
    queryKey: ['presenca-remota', unidadeId, perfil?.id],
    enabled: !!perfil,
    queryFn: async () => {
      const { data, error } = await supabase.from('presenca_plantonista').select('id, checkin_em, checkout_em, escala_plantao_id, data, turno')
        .eq('unidade_id', unidadeId).eq('perfil_id', perfil!.id).not('checkin_em', 'is', null).is('checkout_em', null)
        .order('checkin_em', { ascending: false }).limit(10)
      if (error) throw error
      return (data ?? []) as Presenca[]
    },
  })
  const invalidar = () => {
    for (const k of ['presenca-remota', 'situacao-tele', 'teleinterconsultas', 'tele-escala-hoje', 'tele-outras', 'nota-tele']) void qc.invalidateQueries({ queryKey: [k] })
  }
  const entrar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('registrar_checkin', { p_unidade: unidadeId })
      if (error) throw error
    },
    onSuccess: invalidar,
  })
  const sair = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('registrar_checkout', { p_registro: id })
      if (error) throw error
    },
    onSuccess: invalidar,
  })
  const fim = (p: PlantaoEscala) => new Date(p.inicio).getTime() + p.duracao_min * 60_000
  const turno = (escala.data ?? []).find((p) => new Date(p.inicio).getTime() <= agora && agora < fim(p)) ?? null
  const setor = turno ? setores.data?.find((s) => s.id === turno.setor_id)?.nome ?? null : null
  // o check-in aberto deste plantão remoto; o de outro plantão (outra categoria) não conta
  const checkin = turno ? (presenca.data ?? []).find((x) => x.escala_plantao_id === turno.id
    || (x.data === turno.data && x.turno === turno.turno)
    || (!!x.checkin_em && new Date(x.checkin_em).getTime() >= new Date(turno.inicio).getTime() && new Date(x.checkin_em).getTime() < fim(turno))) ?? null : null
  return {
    carregando: escala.isLoading || presenca.isLoading,
    turno: turno ? { inicio: turno.inicio, fim: new Date(fim(turno)).toISOString(), setor } : null,
    checkin,
    entrar, sair,
  }
}

/** Botão "Fazer check-in" do plantão remoto (sem localização: telemedicina). */
export function BotaoCheckinTele({ unidadeId, variante = 'default' }: { unidadeId: string; variante?: 'default' | 'outline' }) {
  const { entrar } = usePlantaoRemoto(unidadeId)
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button size="sm" variant={variante} onClick={() => entrar.mutate()} disabled={entrar.isPending}>Fazer check-in</Button>
      {entrar.error && <span role="alert" className="text-apoio text-critico">{(entrar.error as Error).message}</span>}
    </span>
  )
}

/**
 * Um selo só de situação no topo dos Chamados (CH2): tirado da escala e do
 * check-in, com a ação que cabe (check-in, ficar ausente, encerrar). Substitui
 * os três selos de antes ("Fora do plantão", "Fora da escala agora" e
 * "Disponível"), que se contradiziam.
 */
export function SituacaoTele({ unidadeId }: { unidadeId: string }) {
  const qc = useQueryClient()
  const r = usePlantaoRemoto(unidadeId)
  const s = useSituacaoTele(unidadeId)
  const [erro, setErro] = React.useState<string | null>(null)
  if (r.carregando) return null
  const d = s.data
  const alternar = async () => {
    if (!d) return
    const { error } = await supabase.rpc('definir_minha_disponibilidade_tele', { p_estado: d.escolhido === 'disponivel' ? 'ausente' : 'disponivel' })
    if (error) return setErro(error.message)
    setErro(null); void qc.invalidateQueries({ queryKey: ['situacao-tele'] })
  }
  const ate = r.turno ? ` até ${hhmm(r.turno.fim)}` : ''
  const setor = r.turno?.setor ? ` · ${r.turno.setor}` : ''
  let tom: 'conforme' | 'atencao' | 'neutro' = 'neutro'
  let texto: string
  if (r.turno && r.checkin) {
    tom = 'conforme'
    texto = d?.estado === 'em_consulta' ? `Em atendimento · de plantão${ate}${setor}`
      : d?.estado === 'ausente' ? `De plantão${ate}${setor} · ausente` : `De plantão${ate}${setor}`
  } else if (r.turno) {
    tom = 'atencao'
    texto = `Na escala${ate}${setor} · falta check-in`
  } else {
    texto = 'Fora da escala agora'
  }
  const pilula = {
    conforme: 'border-conforme/30 bg-alerta-conforme text-conforme',
    atencao: 'border-atencao/30 bg-alerta-atencao text-atencao',
    neutro: 'border-fio bg-trilha text-tinta-apoio',
  }[tom]
  const erroAcao = r.entrar.error ?? r.sair.error
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span role="status" className={cn('inline-flex items-center gap-2 rounded-capsula border px-3 py-1 text-apoio font-medium', pilula)}>
        <span aria-hidden className={cn('size-2 shrink-0 rounded-capsula', tom === 'conforme' ? 'bg-conforme' : tom === 'atencao' ? 'bg-atencao' : 'bg-tinta-sussurro')} />
        {texto}
      </span>
      {r.turno && !r.checkin && (
        <Button size="sm" onClick={() => r.entrar.mutate()} disabled={r.entrar.isPending}>Fazer check-in</Button>
      )}
      {r.turno && r.checkin && d && d.estado !== 'em_consulta' && (
        <Button size="sm" variant="ghost" onClick={() => void alternar()}>{d.escolhido === 'disponivel' ? 'Ficar ausente' : 'Ficar disponível'}</Button>
      )}
      {r.turno && r.checkin && (
        <Button size="sm" variant="outline" onClick={() => r.sair.mutate(r.checkin!.id)} disabled={r.sair.isPending}>Encerrar plantão remoto</Button>
      )}
      {(erro || erroAcao) && <span role="alert" className="basis-full text-apoio text-critico">{erro ?? (erroAcao as Error).message}</span>}
    </div>
  )
}

export function Secao({ titulo, extra, children }: { titulo: string; extra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <TituloSecao className="mb-0 flex-wrap gap-2" extra={extra}>{titulo}</TituloSecao>
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
