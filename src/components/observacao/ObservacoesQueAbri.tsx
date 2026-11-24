// ─────────────────────────────────────────────────────────────────────────────
// Observações que você abriu (decisão do RT em 06/11/2026: "Sim, mostrar";
// migrations 20270305000001 e 20270305000002). O médico da porta que pôs o
// paciente em observação, sem escala no setor da observação, vê o paciente
// aqui para pedir parecer, marcar a reavaliação (decisão do RT em 07/11/2026,
// migration 20270307000005) e ENCERRAR a observação, com os mesmos painéis do
// box. Sem atender, prescrever, evoluir, protocolo, passagem ou prancheta: o
// cuidado segue com a equipe escalada.
// O servidor decide quem vê (observacoes_que_abri); quem já vê o paciente no
// painel normal não ganha um cartão repetido.
//
// M1 da revisão do médico (RT, 24/11/2026): a linha entra na lista única da
// observação, no grupo "Que abri"; "Definir conduta" é o botão da linha e o
// resto fica no menu "…"; a alergia aparece como ficha no nome.
// ─────────────────────────────────────────────────────────────────────────────
import { useQueryClient } from '@tanstack/react-query'
import * as React from 'react'

import { cn } from '@/lib/utils'
import { dataIso } from '@/lib/formato'
import { nomeExibido, type ObservacaoQueAbri } from '@/lib/observacoesQueAbri'
import { rotuloIdade } from '@/domain/idade'
import { Button } from '@/components/ui/button'
import { TableCell, TableRow } from '@/components/ui/table'
import { Estado } from '@/components/porta/Estado'
import { AlergiasEventos, SeloAlergia } from '@/components/paciente/AlergiasEventos'
import { MenuMais } from '@/components/plantao/MenuMais'

import { hhmm, msgErro, relogioPermanencia, type Acao } from './modelo'
import { Painel, PainelDesfecho, PainelReavaliar } from './PaineisCartao'
import { PrazoSeisHoras } from './PrazoSeisHoras'
import { AbaParecer } from '@/components/parecer/AbaParecer'

type PainelQueAbri = 'desfecho' | 'reavaliar' | 'parecer' | 'alergias'

export function LinhaQueAbri({ o, agora, unidadeId }: { o: ObservacaoQueAbri; agora: number; unidadeId: string }) {
  const qc = useQueryClient()
  const [painel, setPainel] = React.useState<PainelQueAbri | null>(null)
  const aberto = painel !== null
  const [erro, setErro] = React.useState<string | null>(null)
  const fechar = () => { setErro(null); setPainel(null) }
  const alternar = (p: PainelQueAbri) => { setErro(null); setPainel((atual) => (atual === p ? null : p)) }

  const acao: Acao = async (fn) => {
    try {
      await fn()
      setErro(null)
      for (const k of ['observacoes-que-abri', 'painel-observacao', 'pendencias', 'pacientes-internados', 'ocupacao-setores', 'pendencias-observacao'])
        void qc.invalidateQueries({ queryKey: [k] })
      return true
    } catch (e) {
      setErro(msgErro(e))
      return false
    }
  }

  const rel = relogioPermanencia(o.entrada, o.prazo, agora)
  const idade = o.data_nascimento ? rotuloIdade(o.data_nascimento, dataIso()) : null

  return (
    <>
      <TableRow className={cn('align-top', aberto && 'border-b-0')}>
        <TableCell className="pl-5 font-semibold text-acao">{o.box ?? 'Sem box'}</TableCell>
        <TableCell className="whitespace-normal">
          <div className="flex min-w-[200px] flex-col gap-1">
            <span className="text-corpo font-medium text-tinta">
              {nomeExibido(o)} {idade && <span className="text-apoio font-normal text-tinta-sussurro">{idade}</span>}
            </span>
            <span className="text-apoio text-tinta-sussurro">{o.setor_nome}</span>
            <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1"><SeloAlergia pacienteId={o.paciente_id} /></span>
          </div>
        </TableCell>
        <TableCell className="whitespace-normal">
          <div className="flex min-w-[160px] flex-col items-start gap-0.5">
            <Estado tom="cinza">Com a equipe do setor</Estado>
            <span className="pl-[17px] text-rotulo text-tinta-sussurro">Você abriu esta observação pela porta</span>
          </div>
        </TableCell>
        <TableCell className="tabular-nums">
          <span className={cn(rel.acima ? 'font-semibold text-observacao' : 'text-tinta-apoio')}>{rel.permanencia}</span>
          <div className="text-rotulo text-tinta-sussurro">desde {hhmm(o.entrada)}</div>
        </TableCell>
        <TableCell className="tabular-nums"><PrazoSeisHoras entrada={o.entrada} prazo={o.prazo} agora={agora} /></TableCell>
        <TableCell className="pr-5">
          <div className="flex flex-nowrap justify-end gap-[7px]">
            <Button size="sm" aria-expanded={painel === 'desfecho'} onClick={() => alternar('desfecho')}>Definir conduta</Button>
            <MenuMais icone rotuloAcessivel={`Mais ações para ${nomeExibido(o)}`} itens={[
              { chave: 'reavaliar', rotulo: 'Reavaliar', ativo: painel === 'reavaliar', onSelecionar: () => alternar('reavaliar') },
              { chave: 'parecer', rotulo: 'Pedir parecer', ativo: painel === 'parecer', onSelecionar: () => alternar('parecer') },
              { chave: 'alergias', rotulo: 'Alergias', ativo: painel === 'alergias', onSelecionar: () => alternar('alergias') },
            ]} />
          </div>
        </TableCell>
      </TableRow>
      {aberto && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={6} className="px-0 pt-0 pb-0 whitespace-normal">
            {painel === 'desfecho' && <PainelDesfecho linha={o} unidadeId={unidadeId} acao={acao} fechar={fechar} erro={erro} />}
            {painel === 'reavaliar' && <PainelReavaliar linha={o} acao={acao} fechar={fechar} erro={erro} />}
            {painel === 'parecer' && (
              <Painel titulo="Parecer">
                <AbaParecer pacienteId={o.paciente_id} internacaoId={o.internacao_id} />
              </Painel>
            )}
            {/* quem abriu registra alergia enquanto a observação está aberta (RT, 08/11/2026) */}
            {painel === 'alergias' && (
              <Painel titulo="Alergias e eventos adversos">
                <AlergiasEventos pacienteId={o.paciente_id} />
              </Painel>
            )}
          </TableCell>
        </TableRow>
      )}
    </>
  )
}
