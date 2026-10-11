// ─────────────────────────────────────────────────────────────────────────────
// Histórico de regulação do paciente (Fase 4, tarefa 5; decisões do RT de
// 11/10/2026): no Resumo do leito e no Prontuário completo.
//
// • Pedidos de toda a rede (mesmo CPF/CNS ou cadastro unificado na organização).
// • Só o médico e o gestor da unidade veem; a enfermagem não.
// • A lista não registra acesso; abrir o detalhe grava no registro de acesso ao
//   prontuário, na unidade do pedido (aparece na Auditoria do gestor dela).
// Migration 20261111000001_historico_regulacao.sql.
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery } from '@tanstack/react-query'
import { Waypoints } from 'lucide-react'
import * as React from 'react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { useUnidade } from '@/contexts/UnidadeContext'
import { fmtDataHora } from '@/lib/datas'
import {
  CARATER, INTERNACAO_PSIQUIATRICA, MOTIVOS_NEGACAO, PRIORIDADES, STATUS, TIPOS_LEITO, TRANSPORTES, VULNERABILIDADES, resumoPedido,
  type Carater, type MotivoNegacao, type Prioridade, type StatusRegulacao, type TipoSolicitacao, type Vulnerabilidade,
} from '@/lib/regulacao'
import { supabase } from '@/lib/supabase'

type ItemHistorico = {
  id: string; numero: number; criada_em: string; status: StatusRegulacao; tipo: TipoSolicitacao
  especialidade: string | null; procedimento: string | null; procedimento_nome: string | null
  tipo_leito: string | null; transporte: string | null; prioridade: Prioridade; carater: Carater; cid: string
  origem: string | null; outra_unidade: boolean; destino: string | null
}
type DetalheHistorico = {
  numero: number; quadro_clinico: string; tempo_evolucao: string | null; sinais_vitais: string | null; exames: string | null
  medicacoes: string | null; hipotese: string | null; cid: string; cid_descricao: string | null
  tipo_leito: string | null; internacao_psiquiatrica: string | null; vulnerabilidades: Vulnerabilidade[]
  solicitante: string | null; medico_assistente: string | null; prioridade_regulador_motivo: string | null
  observacao_decisao: string | null; motivo_negacao: MotivoNegacao | null; motivo_devolucao: string | null
  transporte_central: string | null; data_prevista: string | null; outra_unidade: boolean
  eventos: { evento: string; por: string | null; em: string }[]
}

const TOM: Record<string, 'destructive' | 'warning' | 'info' | 'secondary'> = {
  critico: 'destructive', atencao: 'warning', info: 'info', neutro: 'secondary',
}

export function HistoricoRegulacao({ pacienteId }: { pacienteId: string }) {
  const { papeisDaUnidade } = useUnidade()
  const pode = papeisDaUnidade.includes('plantonista') || papeisDaUnidade.includes('gestor')
  const lista = useQuery({
    queryKey: ['regulacao-historico', pacienteId],
    enabled: pode && !!pacienteId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('regulacao_historico_paciente', { p_paciente: pacienteId })
      if (error) throw error
      return (data ?? []) as unknown as ItemHistorico[]
    },
  })
  const [aberta, setAberta] = React.useState<string | null>(null)
  if (!pode) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Waypoints className="size-4" aria-hidden /> Regulações</CardTitle>
        <CardDescription>Pedidos à central de regulação, desta e das outras unidades da rede. Abrir um pedido fica registrado no acesso ao prontuário.</CardDescription>
      </CardHeader>
      <CardContent className="text-apoio">
        {lista.isLoading ? <Spinner /> : lista.error ? <p className="text-critico">{(lista.error as Error).message}</p>
          : (lista.data ?? []).length === 0 ? <p className="text-tinta-sussurro">Nenhum pedido de regulação para este paciente.</p> : (
          <ul className="flex flex-col divide-y divide-fio">
            {lista.data!.map((r) => (
              <li key={r.id} className="py-2">
                <button type="button" className="flex w-full flex-wrap items-center gap-2 text-left" onClick={() => setAberta(aberta === r.id ? null : r.id)}>
                  <span className="text-tinta-sussurro">{fmtDataHora(r.criada_em)}</span>
                  <Badge variant={TOM[PRIORIDADES[r.prioridade].tom]}>{PRIORIDADES[r.prioridade].rotulo}</Badge>
                  <span className="font-medium text-tinta">{resumoPedido(r)}</span>
                  <span className="text-tinta-sussurro">{CARATER[r.carater]} · CID {r.cid}</span>
                  {r.outra_unidade && <Badge variant="secondary">{r.origem}</Badge>}
                  {r.destino && <span className="text-tinta-apoio">→ {r.destino}</span>}
                  <Badge variant="info" className="ml-auto">{STATUS[r.status]}</Badge>
                  <span className="text-tinta-sussurro">nº {r.numero}</span>
                </button>
                {aberta === r.id && <Detalhe pacienteId={pacienteId} id={r.id} />}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function Linha({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  if (valor == null || valor === '') return null
  return <div><dt className="inline text-tinta-sussurro">{rotulo}: </dt><dd className="inline">{valor}</dd></div>
}

function Detalhe({ pacienteId, id }: { pacienteId: string; id: string }) {
  const d = useQuery({
    queryKey: ['regulacao-historico-detalhe', pacienteId, id],
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('regulacao_historico_detalhe', { p_paciente: pacienteId, p_id: id })
      if (error) throw error
      return data as unknown as DetalheHistorico
    },
  })
  if (d.isLoading) return <Spinner />
  if (d.error || !d.data) return <p className="text-critico">{d.error ? (d.error as Error).message : 'Não encontrado.'}</p>
  const s = d.data
  return (
    <dl className="mt-2 flex flex-col gap-1 rounded-md border border-fio bg-campo p-3 text-tinta">
      {s.outra_unidade && <p className="text-rotulo text-tinta-sussurro">Pedido de outra unidade da rede; o acesso ficou registrado nela.</p>}
      <Linha rotulo="CID" valor={`${s.cid} ${s.cid_descricao ?? ''}`} />
      {s.tipo_leito && <Linha rotulo="Leito" valor={TIPOS_LEITO[s.tipo_leito] + (s.internacao_psiquiatrica ? ` · ${INTERNACAO_PSIQUIATRICA[s.internacao_psiquiatrica]}` : '')} />}
      {(s.vulnerabilidades ?? []).length > 0 && <Linha rotulo="Vulnerabilidade" valor={s.vulnerabilidades.map((v) => VULNERABILIDADES[v]).join(', ')} />}
      <div><dt className="text-tinta-sussurro">Quadro clínico</dt><dd className="whitespace-pre-wrap">{s.quadro_clinico}</dd></div>
      <Linha rotulo="Tempo de evolução" valor={s.tempo_evolucao} />
      <Linha rotulo="Sinais vitais" valor={s.sinais_vitais} />
      <Linha rotulo="Exames" valor={s.exames} />
      <Linha rotulo="Tratamento e medicações" valor={s.medicacoes} />
      <Linha rotulo="Hipótese" valor={s.hipotese} />
      <Linha rotulo="Solicitante" valor={s.solicitante} />
      <Linha rotulo="Médico assistente" valor={s.medico_assistente} />
      <Linha rotulo="Motivo da prioridade (central)" valor={s.prioridade_regulador_motivo} />
      <Linha rotulo="Transporte definido" valor={s.transporte_central ? TRANSPORTES[s.transporte_central] ?? s.transporte_central : null} />
      <Linha rotulo="Previsto para" valor={s.data_prevista ? fmtDataHora(s.data_prevista) : null} />
      <Linha rotulo="Negação" valor={s.motivo_negacao ? `${MOTIVOS_NEGACAO[s.motivo_negacao]}${s.observacao_decisao ? ` — ${s.observacao_decisao}` : ''}` : null} />
      {!s.motivo_negacao && <Linha rotulo="Observação da central" valor={s.observacao_decisao} />}
      <Linha rotulo="Devolução" valor={s.motivo_devolucao} />
      <ul className="mt-1 text-rotulo text-tinta-sussurro">
        {(s.eventos ?? []).map((e, i) => <li key={i}>{fmtDataHora(e.em)} · {e.evento.replace(/_/g, ' ')} · {e.por ?? '—'}</li>)}
      </ul>
    </dl>
  )
}
