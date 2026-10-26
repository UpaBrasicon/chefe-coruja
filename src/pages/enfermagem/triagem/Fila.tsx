import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Activity, MapPin, Volume2 } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { rotuloIdade } from '@/domain/idade'
import { homonimos } from '@/domain/homonimos'
import { rotulosPrioridade } from '@/domain/prioridade'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Chip } from '@/components/monitor/Pagina'
import { ExcluirDaFila } from '@/components/porta/Chamada'
import { SeloHomonimo } from '@/components/porta/SeloHomonimo'
import { Estado } from '@/pages/plantao/porta/Estado'
import { dataSP, esperaMin, hora, nomeDe, type NaFila } from './comum'
import type { SalaTriagem, SalaTriagemCtx, UltimaChamada } from './useSalaTriagem'

// Fila da triagem: sala escolhida uma vez no topo (guardada no aparelho),
// tabela com paciente, queixa, espera, situação da chamada e Chamar · Triar ·
// Excluir da fila (com motivo e justificativa). Revisão visual 3.4, opção B do
// RT (25/10/2026): abas e tabela como a fila do Pronto-Socorro; a situação em
// ponto + texto (`porta/Estado`), sem pílula nem sombra.

function BarraSala({ salas, escolhidas, escolher }: { salas: SalaTriagem[]; escolhidas: Record<string, string>; escolher: (setor: string, sala: string) => void }) {
  const porSetor = [...new Set(salas.map((s) => s.setor_id))]
  if (porSetor.length === 0) {
    return (
      <div className="flex items-center gap-2.5 text-apoio text-tinta-sussurro">
        <MapPin className="size-[15px] text-acao" aria-hidden /> Nenhuma sala de triagem cadastrada nesta porta. O gestor cadastra em Setores.
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      {porSetor.map((setor) => {
        const doSetor = salas.filter((s) => s.setor_id === setor)
        const atual = doSetor.find((s) => s.id === escolhidas[setor])
        return (
          <div key={setor} className="flex flex-wrap items-center gap-2.5">
            <MapPin className="size-[15px] text-acao" aria-hidden />
            <span className="text-apoio font-medium text-grafite">
              {porSetor.length > 1 && `${doSetor[0].setor?.nome ?? 'Porta'} · `}
              {atual ? `Sua sala: ${atual.nome}` : 'Escolha sua sala para poder chamar no painel'}
            </span>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Sala de triagem">
              {doSetor.map((s) => (
                <Chip key={s.id} ativo={s.id === atual?.id} onClick={() => escolher(setor, s.id)}>{s.nome}</Chip>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Barra da sala acima das abas da triagem; some enquanto não há fila nem salas. */
export function BarraSalaTriagem({ sala }: { sala: SalaTriagemCtx }) {
  if (sala.setores.length === 0 || !sala.salas) return null
  return <BarraSala salas={sala.salas} escolhidas={sala.escolhidas} escolher={sala.escolher} />
}

/** Situação da chamada em ponto + texto: vazio aguardando, âmbar chamado, vermelho na 3ª chamada sem resposta. */
function SituacaoChamada({ ch }: { ch: UltimaChamada | undefined }) {
  if (!ch) return <Estado tom="cinza">Aguardando</Estado>
  const base = `Chamado${ch.numero > 1 ? ` ${ch.numero}ª vez` : ''}`
  return (
    <div className="flex flex-col items-start gap-0.5">
      {ch.numero >= 3 ? <Estado tom="vermelho">{base} · sem resposta</Estado> : <Estado tom="ambar">{base}</Estado>}
      <span className="pl-[17px] text-rotulo text-tinta-sussurro">{ch.sala ? `${ch.sala} · ` : ''}{hora(ch.em)}</span>
    </div>
  )
}

function BotaoChamar({ ep, salaId, chamadas }: { ep: NaFila; salaId: string | undefined; chamadas: number }) {
  const queryClient = useQueryClient()
  const chamar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('chamar_paciente', { p_episodio: ep.id, p_sala: salaId! })
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['triagem-chamadas'] })
      void queryClient.invalidateQueries({ queryKey: ['chamadas-contagem'] })
    },
  })
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant="outline"
        disabled={!salaId || chamar.isPending}
        title={salaId ? 'Chamar no painel' : 'Escolha sua sala antes de chamar'}
        onClick={() => chamar.mutate()}
      >
        <Volume2 /> {chamadas > 0 ? 'Chamar de novo' : 'Chamar'}
      </Button>
      {chamar.error && <span className="text-rotulo text-critico">{(chamar.error as Error).message}</span>}
    </div>
  )
}

/** Nome e idade; embaixo, a prioridade legal e o aviso de homônimo, quando há. */
export function CelulaPaciente({ e, iguais }: { e: NaFila; iguais: Set<string> }) {
  const prios = rotulosPrioridade(e.prioridades_legais)
  return (
    <div className="flex flex-col items-start gap-0.5">
      <span>
        <span className="font-medium text-tinta">{nomeDe(e)}</span>{' '}
        <span className="text-tinta-sussurro">{e.paciente?.data_nascimento ? rotuloIdade(e.paciente.data_nascimento, dataSP()) : 'idade não informada'}</span>
      </span>
      {prios.length > 0 && <span className="text-rotulo text-tinta-sussurro">Prioridade: {prios.join(', ')}</span>}
      {iguais.has(e.id) && <SeloHomonimo paciente={e.paciente} />}
    </div>
  )
}

export const QueixaCelula = ({ texto }: { texto: string }) => (
  <TableCell className="max-w-[220px] truncate text-tinta-apoio" title={texto}>{texto}</TableCell>
)

export function FilaTriagem({ fila, carregando, erro, sala, onTriar }: {
  fila: NaFila[]; carregando: boolean; erro: Error | null; sala: SalaTriagemCtx; onTriar: (ep: NaFila) => void
}) {
  // re-render a cada 30 s para a espera andar
  const [, tique] = React.useState(0)
  React.useEffect(() => {
    const t = setInterval(() => tique((x) => x + 1), 30_000)
    return () => clearInterval(t)
  }, [])

  const iguais = homonimos(fila)

  return (
    <section className="overflow-hidden rounded-cartao border border-fio bg-superficie">
      <p className="border-b border-trilha px-5 py-2.5 text-apoio text-tinta-sussurro">80+ primeiro, depois as demais prioridades legais, depois a chegada</p>
      {carregando && <p className="px-5 py-5 text-controle text-tinta-sussurro">Carregando a fila…</p>}
      {erro && <p className="px-5 py-5 text-controle text-critico">{erro.message}</p>}
      {!carregando && !erro && fila.length === 0 && <p className="px-5 py-5 text-controle text-tinta-sussurro">Nenhuma ficha aguardando triagem.</p>}
      {fila.length > 0 && (
        <Table aria-label="Aguardando triagem">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Paciente</TableHead>
              <TableHead>Queixa</TableHead>
              <TableHead>Espera</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="text-right"><span className="sr-only">Ações</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fila.map((e) => {
              const ch = sala.chamadas?.get(e.id)
              return (
                <TableRow key={e.id}>
                  <TableCell><CelulaPaciente e={e} iguais={iguais} /></TableCell>
                  <QueixaCelula texto={e.queixa} />
                  <TableCell className="tabular-nums" title={`Ficha às ${hora(e.chegada_em)}; espera desde a ficha da recepção`}>{esperaMin(e.chegada_em)} min</TableCell>
                  <TableCell><SituacaoChamada ch={ch} /></TableCell>
                  <TableCell>
                    <div className="flex flex-nowrap items-start justify-end gap-[7px]">
                      <BotaoChamar ep={e} salaId={sala.salaDoSetor(e.setor_id)} chamadas={ch?.numero ?? 0} />
                      <Button size="sm" onClick={() => onTriar(e)}>
                        <Activity /> Triar
                      </Button>
                      <ExcluirDaFila episodioId={e.id} nome={nomeDe(e)} />
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </section>
  )
}
