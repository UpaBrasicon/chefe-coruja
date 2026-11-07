// ─────────────────────────────────────────────────────────────────────────────
// Observações que você abriu (decisão do RT em 06/11/2026: "Sim, mostrar";
// migrations 20270305000001 e 20270305000002). O médico da porta que pôs o
// paciente em observação, sem escala no setor da observação, vê o paciente
// aqui só para ENCERRAR a observação: a única ação é "Encerrar observação", que
// abre o mesmo painel de desfecho do box. Sem atender, prescrever, evoluir,
// protocolo, passagem ou prancheta: o cuidado segue com a equipe escalada.
// O servidor decide quem vê (observacoes_que_abri); quem já vê o paciente no
// painel normal não ganha um cartão repetido.
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Clock } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { dataIso } from '@/lib/formato'
import { nomeExibido, semDuplicar, type ObservacaoQueAbri } from '@/lib/observacoesQueAbri'
import { rotuloIdade } from '@/domain/idade'
import { TituloSecao } from '@/components/monitor/Pagina'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

import { TOM_TEXTO, hhmm, msgErro, relogioPermanencia, type Acao } from './modelo'
import { PainelDesfecho } from './PaineisCartao'

export function ObservacoesQueAbri({ unidadeId, agora, noPainel }: {
  unidadeId: string
  agora: number
  /** internações que já aparecem no painel normal (não repetir o cartão) */
  noPainel: string[]
}) {
  const lista = useQuery({
    queryKey: ['observacoes-que-abri', unidadeId],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('observacoes_que_abri', { p_unidade: unidadeId })
      // função ausente (banco sem a 20270305000002 ou rollback): a seção some
      if (error?.code === 'PGRST202') return []
      if (error) throw error
      return (data ?? []) as unknown as ObservacaoQueAbri[]
    },
  })

  const minhas = semDuplicar(lista.data ?? [], noPainel)
  if (lista.error) {
    return <p className="rounded-container border border-critico/30 bg-alerta-critico px-4 py-3 text-apoio text-critico">{msgErro(lista.error)}</p>
  }
  if (minhas.length === 0) return null

  return (
    <section aria-label="Observações que você abriu" className="flex flex-col">
      <TituloSecao className="mb-1" extra={minhas.length === 1 ? '1 paciente' : `${minhas.length} pacientes`}>Observações que você abriu</TituloSecao>
      <p className="mb-2.5 text-apoio text-tinta-sussurro">
        Você pôs estes pacientes em observação pela porta. Aqui você só encerra a observação; o cuidado segue com a equipe escalada no setor.
      </p>
      <div className="overflow-hidden rounded-cartao border border-fio bg-superficie">
        <Table aria-label="Observações que você abriu">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-5">Box</TableHead>
              <TableHead>Paciente</TableHead>
              <TableHead>Na observação</TableHead>
              <TableHead>Prazo de 6 h</TableHead>
              <TableHead className="pr-5 text-right"><span className="sr-only">Ações</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {minhas.map((o) => <LinhaQueAbri key={o.internacao_id} o={o} agora={agora} unidadeId={unidadeId} />)}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}

function LinhaQueAbri({ o, agora, unidadeId }: { o: ObservacaoQueAbri; agora: number; unidadeId: string }) {
  const qc = useQueryClient()
  const [aberto, setAberto] = React.useState(false)
  const [erro, setErro] = React.useState<string | null>(null)
  const fechar = () => { setErro(null); setAberto(false) }

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
          </div>
        </TableCell>
        <TableCell className="tabular-nums">
          <span className={cn(rel.acima ? 'font-semibold text-observacao' : 'text-tinta-apoio')}>{rel.permanencia}</span>
          <div className="text-rotulo text-tinta-sussurro">desde {hhmm(o.entrada)}</div>
        </TableCell>
        <TableCell className="tabular-nums">
          <span className={cn('flex items-center gap-1 font-semibold', TOM_TEXTO[rel.tom])}>
            <Clock className="size-3" aria-hidden /> {rel.contagem}
          </span>
          <div className={cn('text-rotulo', rel.acima ? 'text-observacao' : 'text-tinta-sussurro')}>
            {rel.acima ? 'Definir conduta ou internar' : `até ${hhmm(o.prazo)}`}
          </div>
        </TableCell>
        <TableCell className="pr-5">
          <div className="flex justify-end">
            <Button size="sm" variant="outline" aria-expanded={aberto} onClick={() => { setErro(null); setAberto((a) => !a) }}>Encerrar observação</Button>
          </div>
        </TableCell>
      </TableRow>
      {aberto && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={5} className="px-0 pt-0 pb-0 whitespace-normal">
            <PainelDesfecho linha={o} unidadeId={unidadeId} acao={acao} fechar={fechar} erro={erro} />
          </TableCell>
        </TableRow>
      )}
    </>
  )
}
