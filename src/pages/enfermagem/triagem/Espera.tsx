import { RefreshCw } from 'lucide-react'

import { homonimos } from '@/domain/homonimos'
import { ALVO_MIN } from '@/domain/risco'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PilulaRisco } from '@/components/clinico/PilulaRisco'
import { esperaMin, hora, type NaEspera } from './comum'
import { CelulaPaciente, QueixaCelula } from './Fila'
import { erroDeLeitura } from '@/lib/offline/erroDeLeitura'

// Classificados que ainda esperam o médico (correções do portão, tarefa 2):
// a enfermagem reclassifica aqui se o quadro mudou na espera. Quando o médico
// inicia o atendimento, o paciente sai desta lista e só o médico reclassifica.
// A ordem é a da fila médica (cor, 80+, prioridade legal, espera). Revisão
// visual 3.4 (opção B do RT): tabela na segunda aba da triagem; a espera desde a
// classificação passa ao vermelho acima do alvo da cor, como na fila do PS.

export function EsperaMedico({ lista, carregando, erro, onReclassificar, ubs = false }: {
  lista: NaEspera[]; carregando: boolean; erro: Error | null; onReclassificar: (ep: NaEspera) => void
  /** escuta da UBS (5A, parte 2.4): o CAB 28 não tem tempo-alvo, e a UBS não reclassifica */
  ubs?: boolean
}) {
  const iguais = homonimos(lista)
  return (
    <section className="overflow-hidden rounded-cartao border border-fio bg-superficie">
      <p className="border-b border-trilha px-5 py-2.5 text-apoio text-tinta-sussurro">{ubs ? 'Na ordem da fila do médico: imediato, prioritário, depois prioridade legal e chegada' : 'Na ordem da fila médica · reclassifique se o quadro mudou na espera'}</p>
      {carregando && <p className="px-5 py-5 text-controle text-tinta-sussurro">Carregando…</p>}
      {erroDeLeitura(erro, lista.length > 0) && <p className="px-5 py-5 text-controle text-critico">{erroDeLeitura(erro, lista.length > 0)}</p>}
      {!carregando && !erro && lista.length === 0 && <p className="px-5 py-5 text-controle text-tinta-sussurro">{ubs ? 'Ninguém escutado aguardando o médico.' : 'Ninguém classificado aguardando o médico.'}</p>}
      {lista.length > 0 && (
        <Table aria-label="Classificados aguardando o médico">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Cor</TableHead>
              <TableHead>Paciente</TableHead>
              <TableHead>Queixa</TableHead>
              <TableHead>Classificado</TableHead>
              <TableHead>Espera</TableHead>
              <TableHead className="text-right"><span className="sr-only">Ações</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lista.map((e) => {
              const desde = esperaMin(e.classificado_em)
              const acima = !ubs && desde > ALVO_MIN[e.cor_atual]
              return (
                <TableRow key={e.id}>
                  <TableCell><PilulaRisco cor={e.cor_atual} className="min-w-[70px]" /></TableCell>
                  <TableCell><CelulaPaciente e={e} iguais={iguais} /></TableCell>
                  <QueixaCelula texto={e.queixa} />
                  <TableCell className="tabular-nums text-tinta-apoio">{hora(e.classificado_em)}</TableCell>
                  <TableCell className={cn('tabular-nums', acima && 'font-semibold text-critico')} title="Espera desde a classificação">
                    {desde} min
                  </TableCell>
                  <TableCell className="text-right">
                    {!ubs && (
                      <Button size="sm" variant="outline" onClick={() => onReclassificar(e)}>
                        <RefreshCw /> Reclassificar
                      </Button>
                    )}
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
