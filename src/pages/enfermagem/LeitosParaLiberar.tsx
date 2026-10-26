import { useQuery } from '@tanstack/react-query'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { AcoesLeito } from '@/components/leito/AcoesLeito'
import { rotuloMotivoBloqueio } from '@/components/leito/motivos'

import { Bloco } from './Pecas'
import { msgErro } from './useEnfermagem'
import { dataHora, hora } from '@/lib/formato'
import { Estado } from '@/components/porta/Estado'

const ROTULO: Record<string, string> = { livre: 'Livre', reservado: 'Reservado', higienizacao: 'Em higienização', bloqueado: 'Bloqueado' }
const TOM: Record<string, 'verde' | 'teal' | 'ambar' | 'vermelho'> = { livre: 'verde', reservado: 'teal', higienizacao: 'ambar', bloqueado: 'vermelho' }

/**
 * Leitos livres, reservados, em higienização e bloqueados dos setores da escala (Fase 0, tarefas 6
 * e 7). A enfermagem conclui a higienização; o enfermeiro bloqueia e desbloqueia
 * com motivo. O que cada um pode fazer vem do servidor (situacao_leitos).
 */
export function LeitosParaLiberar({ unidadeId, setores }: { unidadeId: string | undefined; setores: string[] }) {
  const [erro, setErro] = React.useState<string | null>(null)
  const { data, error } = useQuery({
    queryKey: ['situacao-leitos', unidadeId],
    enabled: !!unidadeId && setores.length > 0,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('situacao_leitos', { p_unidade: unidadeId! })
      if (error) throw error
      return data ?? []
    },
  })

  const lista = (data ?? []).filter((l) => setores.includes(l.setor_id) && l.status !== 'ocupado')
  if (error) return <p className="text-apoio text-critico">{msgErro(error)}</p>
  if (lista.length === 0) return null

  return (
    <Bloco titulo="Leitos livres, reservados, em higienização e bloqueados">
      {erro && <p role="alert" className="px-5 pt-3 text-apoio text-critico">{erro}</p>}
      {lista.map((l) => (
        <div key={l.leito_id} className="flex flex-wrap items-center gap-3.5 border-b border-trilha px-5 py-3 last:border-0">
          <span className="w-11 shrink-0 text-apoio font-semibold text-acao">{l.identificador}</span>
          <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-0.5">
            <span className="text-apoio text-tinta">
              <Estado tom={TOM[l.status] ?? 'teal'}>{ROTULO[l.status] ?? l.status}</Estado>{' '}
              <span className="text-tinta-sussurro">{l.setor_nome}</span>
            </span>
            {l.status === 'reservado' ? (
              <span className="text-apoio text-tinta-sussurro">
                {[l.reserva_paciente ? `para ${l.reserva_paciente}` : l.reserva_motivo,
                  l.reserva_expira_em && `até ${hora(l.reserva_expira_em)}`]
                  .filter(Boolean).join(' · ')}
              </span>
            ) : (l.motivo || l.desde) && l.status !== 'livre' && (
              <span className="text-apoio text-tinta-sussurro">
                {[rotuloMotivoBloqueio(l.motivo), l.desde && `desde ${dataHora(l.desde)}`]
                  .filter(Boolean).join(' · ')}
              </span>
            )}
          </div>
          <AcoesLeito
            leitoId={l.leito_id}
            identificador={l.identificador}
            status={l.status}
            podeHigienizar={l.pode_higienizar}
            podeBloquear={l.pode_bloquear}
            podeReservar={l.pode_reservar}
            podeCancelarReserva={l.pode_cancelar_reserva}
            unidadeId={unidadeId}
            invalidar={[['situacao-leitos'], ['enfermagem-leitos']]}
            onErro={setErro}
          />
        </div>
      ))}
    </Bloco>
  )
}
