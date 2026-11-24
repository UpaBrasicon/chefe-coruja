import * as React from 'react'

import { AcoesLeito } from '@/components/leito/AcoesLeito'
import { rotuloMotivoBloqueio } from '@/components/leito/motivos'
import { useUnidade } from '@/contexts/UnidadeContext'

import { Bloco } from './Pecas'
import { leitoSemPaciente, msgErro, situacaoDoLeito, useSituacaoLeitos, type SituacaoLeito } from './useEnfermagem'
import { dataHora, hora } from '@/lib/formato'
import { Estado } from '@/components/porta/Estado'

// lacuna 5 (O5): o leito do óbito segue ocupado, com o corpo, até a liberação
const ROTULO: Record<string, string> = { livre: 'Livre', reservado: 'Reservado', higienizacao: 'Em higienização', bloqueado: 'Bloqueado', aguardando_corpo: 'Aguardando liberação do corpo' }
const TOM: Record<string, 'verde' | 'teal' | 'ambar' | 'vermelho'> = { livre: 'verde', reservado: 'teal', higienizacao: 'ambar', bloqueado: 'vermelho', aguardando_corpo: 'vermelho' }

/**
 * Um leito sem paciente, numa linha: o estado e as ações de quem pode. O que
 * cada um pode fazer vem do servidor (situacao_leitos); TE4 (RT 24/11/2026):
 * no perfil Técnico o leito só mostra o estado (bloquear, desbloquear e
 * reservar ficam com o enfermeiro e o gestor), e a higienização continua.
 */
export function LinhaLeito({ l, unidadeId, onErro, mostrarSetor = false }: { l: SituacaoLeito; unidadeId: string | undefined; onErro: (m: string | null) => void; mostrarSetor?: boolean }) {
  const { papelAtivo } = useUnidade()
  const tecnico = papelAtivo === 'tecnico_enfermagem'
  const s = situacaoDoLeito(l)
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-trilha px-5 py-3 last:border-0">
      <span className="w-14 shrink-0 text-apoio font-semibold text-tinta-apoio">{l.identificador}</span>
      <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-0.5">
        <span className="text-apoio text-tinta"><Estado tom={TOM[s] ?? 'teal'}>{ROTULO[s] ?? l.status}</Estado>{mostrarSetor && <span className="text-tinta-sussurro"> {l.setor_nome}</span>}</span>
        {l.status === 'reservado' ? (
          <span className="text-apoio text-tinta-sussurro">
            {[l.reserva_paciente ? `para ${l.reserva_paciente}` : l.reserva_motivo, l.reserva_expira_em && `até ${hora(l.reserva_expira_em)}`]
              .filter(Boolean).join(' · ')}
          </span>
        ) : (l.motivo || l.desde) && l.status !== 'livre' && (
          <span className="text-apoio text-tinta-sussurro">
            {[s === 'aguardando_corpo' ? 'a liberação do corpo fica em "Óbitos com pendência"' : rotuloMotivoBloqueio(l.motivo), l.desde && `desde ${dataHora(l.desde)}`]
              .filter(Boolean).join(' · ')}
          </span>
        )}
      </div>
      <AcoesLeito
        leitoId={l.leito_id}
        identificador={l.identificador}
        status={l.status}
        podeHigienizar={l.pode_higienizar}
        podeBloquear={l.pode_bloquear && !tecnico}
        podeReservar={l.pode_reservar && !tecnico}
        podeCancelarReserva={l.pode_cancelar_reserva && !tecnico}
        unidadeId={unidadeId}
        invalidar={[['situacao-leitos'], ['enfermagem-leitos']]}
        onErro={onErro}
      />
    </div>
  )
}

/**
 * Leitos livres, reservados, em higienização e bloqueados dos setores dados
 * (Fase 0, tarefas 6 e 7). Fica no Pronto-Socorro da enfermagem, para os
 * setores de porta e observação (TE3); na Internação os leitos vêm leito a
 * leito, junto dos ocupados (IN1).
 */
export function LeitosParaLiberar({ unidadeId, setores }: { unidadeId: string | undefined; setores: string[] }) {
  const [erro, setErro] = React.useState<string | null>(null)
  const { data, error } = useSituacaoLeitos(unidadeId, setores.length > 0)

  const lista = (data ?? []).filter((l) => setores.includes(l.setor_id) && leitoSemPaciente(l))
    .sort((a, b) => a.setor_nome.localeCompare(b.setor_nome) || a.identificador.localeCompare(b.identificador, 'pt-BR', { numeric: true }))
  if (error) return <p className="text-apoio text-critico">{msgErro(error)}</p>
  if (lista.length === 0) return null

  return (
    <Bloco titulo="Leitos sem paciente">
      {erro && <p role="alert" className="px-5 pt-3 text-apoio text-critico">{erro}</p>}
      {lista.map((l) => <LinhaLeito key={l.leito_id} l={l} unidadeId={unidadeId} onErro={setErro} mostrarSetor={setores.length > 1} />)}
    </Bloco>
  )
}
