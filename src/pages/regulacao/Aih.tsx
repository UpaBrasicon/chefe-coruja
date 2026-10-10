// ─────────────────────────────────────────────────────────────────────────────
// AIH da unidade (Fase 3, tarefa 1; decisões do RT de 09/10/2026).
//
// O laudo de AIH emitido pelo médico vira uma AIH "solicitada". O médico
// regulador aprova (número de 13 dígitos e competência, sugerida pelo mês da
// alta) ou rejeita (motivo); ajusta a competência de AIH aprovada (motivo) e
// cancela (motivo). Cada passo fica no histórico. O gestor acompanha, sem agir.
// Migration 20261102000002_aih_ciclo.sql.
// ─────────────────────────────────────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText } from 'lucide-react'
import * as React from 'react'

import { TituloPagina, Vazio } from '@/components/monitor/Pagina'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { useUnidade } from '@/contexts/UnidadeContext'
import {
  competenciaNaTela, EVENTO_AIH, lerCompetencia, MINIMO_AJUSTE, MINIMO_CANCELAMENTO, MINIMO_REJEICAO, numeroAih, numeroAihValido,
  STATUS_AIH, type AihFila, type EventoAih, type StatusAih,
} from '@/lib/aih'
import { fmtData, fmtDataHora } from '@/lib/datas'
import { supabase } from '@/lib/supabase'
import { Abas, Erro } from '@/pages/farmacia/Farmacia'

type Filtro = StatusAih | 'todas'
const ABAS: readonly (readonly [Filtro, string])[] = [
  ['solicitada', 'Solicitadas'], ['aprovada', 'Aprovadas'], ['rejeitada', 'Rejeitadas'], ['cancelada', 'Canceladas'], ['todas', 'Todas'],
]

export default function Aih() {
  const { unidadeAtiva, papelAtivo } = useUnidade()
  const unidade = unidadeAtiva?.unidade_id
  const regulador = papelAtivo === 'regulador'
  const [filtro, setFiltro] = React.useState<Filtro>('solicitada')
  const lista = useQuery({
    queryKey: ['aihs-da-unidade', unidade, filtro],
    enabled: !!unidade,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('aihs_da_unidade', { p_unidade: unidade!, p_status: filtro === 'todas' ? undefined : filtro })
      if (error) throw error
      return (data ?? []) as unknown as AihFila[]
    },
  })

  return (
    <div className="flex w-full max-w-5xl flex-col">
      <TituloPagina icone={FileText} titulo={regulador ? 'Pedidos de AIH' : 'AIH da unidade'}
        descricao={regulador
          ? 'Laudos de AIH emitidos na unidade. Aprove com o número da AIH e a competência, ou rejeite com o motivo.'
          : 'Acompanhamento das AIHs da unidade. Quem decide é o médico regulador.'} />
      <Abas abas={ABAS} valor={filtro} onChange={setFiltro} rotulo="Situação da AIH" />
      {lista.isLoading ? <Spinner /> : lista.error ? <Erro texto={(lista.error as Error).message} /> : (lista.data ?? []).length === 0 ? (
        <Vazio icone={FileText} titulo="Nenhuma AIH aqui" texto="Quando o médico emitir o laudo de AIH, ele aparece em Solicitadas." />
      ) : (
        <div className="flex flex-col gap-3">
          {(lista.data ?? []).map((a) => <CartaoAih key={a.id} a={a} regulador={regulador} />)}
        </div>
      )}
    </div>
  )
}

type Acao = 'aprovar' | 'rejeitar' | 'competencia' | 'cancelar' | null

function CartaoAih({ a, regulador }: { a: AihFila; regulador: boolean }) {
  const qc = useQueryClient()
  const [acao, setAcao] = React.useState<Acao>(null)
  const [numero, setNumero] = React.useState('')
  const [competencia, setCompetencia] = React.useState(competenciaNaTela(a.competencia ?? a.competencia_sugerida))
  const [motivo, setMotivo] = React.useState('')
  const [historico, setHistorico] = React.useState(false)
  const st = STATUS_AIH[a.status]

  const fazer = useMutation({
    mutationFn: async () => {
      const comp = lerCompetencia(competencia)
      const r = acao === 'aprovar'
        ? await supabase.rpc('decidir_aih', { p_aih: a.id, p_aprovar: true, p_numero: numeroAih(numero), p_competencia: comp ?? undefined, p_motivo: motivo.trim() || undefined })
        : acao === 'rejeitar'
          ? await supabase.rpc('decidir_aih', { p_aih: a.id, p_aprovar: false, p_motivo: motivo.trim() })
          : acao === 'competencia'
            ? await supabase.rpc('ajustar_competencia_aih', { p_aih: a.id, p_competencia: comp ?? '', p_motivo: motivo.trim() })
            : await supabase.rpc('cancelar_aih', { p_aih: a.id, p_motivo: motivo.trim() })
      if (r.error) throw r.error
    },
    onSuccess: () => {
      setAcao(null); setMotivo(''); setNumero('')
      void qc.invalidateQueries({ queryKey: ['aihs-da-unidade'] })
      void qc.invalidateQueries({ queryKey: ['eventos-aih', a.id] })
    },
  })

  const compOk = lerCompetencia(competencia) !== null
  const pode = acao === 'aprovar' ? numeroAihValido(numero) && compOk
    : acao === 'rejeitar' ? motivo.trim().length >= MINIMO_REJEICAO
      : acao === 'competencia' ? compOk && motivo.trim().length >= MINIMO_AJUSTE
        : acao === 'cancelar' ? motivo.trim().length >= MINIMO_CANCELAMENTO : false
  const ativa = a.status === 'solicitada' || a.status === 'aprovada'

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-fio bg-superficie px-4 py-3 text-apoio">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-medium text-tinta">{a.paciente}</span>
        <span className="text-tinta-sussurro">{a.local ?? '—'}</span>
        {a.nascimento && <span className="text-tinta-sussurro">nasc. {fmtData(a.nascimento)}</span>}
        {a.sexo && <span className="text-tinta-sussurro">{a.sexo}</span>}
        <Badge variant={st.variante} className="ml-auto">{st.rotulo}</Badge>
      </div>
      <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
        <span><span className="text-tinta-sussurro">Procedimento: </span>{a.proc_cod ?? '—'} {a.proc_desc ? `· ${a.proc_desc}` : ''}</span>
        <span><span className="text-tinta-sussurro">CID principal: </span>{a.cid ?? '—'}{a.cid_sec ? ` · secundário ${a.cid_sec}` : ''}</span>
        <span><span className="text-tinta-sussurro">Diagnóstico: </span>{a.diagnostico ?? '—'}</span>
        <span><span className="text-tinta-sussurro">Caráter · clínica: </span>{a.carater ?? '—'} · {a.clinica ?? '—'}</span>
        <span><span className="text-tinta-sussurro">CNS: </span>{a.cns ?? '—'}</span>
        <span><span className="text-tinta-sussurro">Laudo: </span>nº {a.laudo_numero ?? '—'}{a.laudo_versao > 1 ? ` (versão ${a.laudo_versao})` : ''}</span>
      </div>
      <span className="text-xs text-tinta-sussurro">
        Solicitada por {a.solicitada_por ?? '—'}, {fmtDataHora(a.solicitada_em)}
        {a.decidida_em && <> · {a.status === 'rejeitada' ? 'rejeitada' : 'decidida'} por {a.decidida_por ?? '—'}, {fmtDataHora(a.decidida_em)}</>}
      </span>
      {a.status === 'aprovada' && (
        <span className="text-conforme">AIH nº {a.numero} · competência {competenciaNaTela(a.competencia)}</span>
      )}
      {a.motivo && (a.status === 'rejeitada' || a.status === 'cancelada') && (
        <span className={a.status === 'rejeitada' ? 'text-critico' : 'text-tinta-apoio'}>Motivo: {a.motivo}</span>
      )}

      {regulador && ativa && !acao && (
        <div className="flex flex-wrap gap-1.5">
          {a.status === 'solicitada' && <Button size="xs" onClick={() => setAcao('aprovar')}>Aprovar</Button>}
          {a.status === 'solicitada' && <Button size="xs" variant="outline" onClick={() => setAcao('rejeitar')}>Rejeitar</Button>}
          {a.status === 'aprovada' && <Button size="xs" variant="outline" onClick={() => setAcao('competencia')}>Ajustar competência</Button>}
          <Button size="xs" variant="ghost" onClick={() => setAcao('cancelar')}>Cancelar AIH</Button>
        </div>
      )}
      {acao && (
        <div className="flex flex-col gap-2 rounded-md border border-fio p-2.5">
          {acao === 'aprovar' && (
            <div className="flex flex-wrap gap-2">
              <Input className="h-8 w-56" inputMode="numeric" placeholder="Número da AIH (13 dígitos)" value={numero} onChange={(e) => setNumero(e.target.value)} />
              <Input className="h-8 w-32" placeholder="MM/AAAA" value={competencia} onChange={(e) => setCompetencia(e.target.value)} aria-label="Competência" />
              <span className="self-center text-xs text-tinta-sussurro">Competência sugerida: {competenciaNaTela(a.competencia_sugerida)} ({a.alta_em ? 'mês da alta' : 'internado: mês corrente'})</span>
            </div>
          )}
          {acao === 'competencia' && (
            <Input className="h-8 w-32" placeholder="MM/AAAA" value={competencia} onChange={(e) => setCompetencia(e.target.value)} aria-label="Nova competência" />
          )}
          <Input className="h-8" value={motivo} onChange={(e) => setMotivo(e.target.value)}
            placeholder={acao === 'aprovar' ? 'Observação (opcional)' : acao === 'rejeitar' ? 'Motivo da rejeição' : acao === 'competencia' ? 'Motivo do ajuste' : 'Motivo do cancelamento'} />
          {fazer.error && <Erro texto={(fazer.error as Error).message} />}
          <div className="flex gap-1.5">
            <Button size="xs" disabled={!pode || fazer.isPending} onClick={() => fazer.mutate()}>
              {acao === 'aprovar' ? 'Aprovar AIH' : acao === 'rejeitar' ? 'Rejeitar AIH' : acao === 'competencia' ? 'Salvar competência' : 'Cancelar AIH'}
            </Button>
            <Button size="xs" variant="ghost" onClick={() => { setAcao(null); fazer.reset() }}>Voltar</Button>
          </div>
        </div>
      )}

      <div>
        <Button size="xs" variant="ghost" onClick={() => setHistorico(!historico)}>{historico ? 'Esconder histórico' : 'Ver histórico'}</Button>
      </div>
      {historico && <HistoricoAih aih={a.id} />}
    </div>
  )
}

function HistoricoAih({ aih }: { aih: string }) {
  const eventos = useQuery({
    queryKey: ['eventos-aih', aih],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('eventos_aih', { p_aih: aih })
      if (error) throw error
      return (data ?? []) as unknown as EventoAih[]
    },
  })
  if (eventos.isLoading) return <Spinner />
  if (eventos.error) return <Erro texto={(eventos.error as Error).message} />
  return (
    <ol className="flex flex-col gap-1 border-l border-fio pl-3 text-xs">
      {(eventos.data ?? []).map((e, i) => (
        <li key={i}>
          <span className="font-medium text-tinta">{EVENTO_AIH[e.evento]}</span> · {e.por ?? '—'}, {fmtDataHora(e.em)}
          {e.evento === 'aprovada' && <> · nº {e.numero} · competência {competenciaNaTela(e.competencia)}</>}
          {e.evento === 'competencia_ajustada' && <> · nova competência {competenciaNaTela(e.competencia)}</>}
          {e.motivo && <span className="text-tinta-apoio"> — “{e.motivo}”</span>}
        </li>
      ))}
    </ol>
  )
}
