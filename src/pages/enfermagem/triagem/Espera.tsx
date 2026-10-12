import { RefreshCw } from 'lucide-react'

import { rotuloIdade } from '@/domain/idade'
import { homonimos } from '@/domain/homonimos'
import { rotulosPrioridade } from '@/domain/prioridade'
import { Button } from '@/components/ui/button'
import { PilulaRisco } from '@/components/clinico/PilulaRisco'
import { SeloHomonimo } from '@/components/porta/SeloHomonimo'
import { dataSP, esperaMin, hora, nomeDe, type NaEspera } from './comum'

// Classificados que ainda esperam o médico (correções do portão, tarefa 2):
// a enfermagem reclassifica aqui se o quadro mudou na espera. Quando o médico
// inicia o atendimento, o paciente sai desta lista e só o médico reclassifica.
// A ordem é a da fila médica (cor, 80+, prioridade legal, espera).

export function EsperaMedico({ lista, carregando, erro, onReclassificar }: {
  lista: NaEspera[]; carregando: boolean; erro: Error | null; onReclassificar: (ep: NaEspera) => void
}) {
  const hoje = dataSP()
  const n = lista.length
  const iguais = homonimos(lista)
  return (
    <div className="overflow-hidden rounded-cartao border border-fio bg-superficie shadow-repouso">
      <div className="border-b border-trilha px-5 py-[13px] text-apoio text-tinta-sussurro">
        {n} {n === 1 ? 'classificado aguardando' : 'classificados aguardando'} o médico · reclassifique se o quadro mudou na espera
      </div>
      {carregando && <div className="px-5 py-5 text-controle text-tinta-sussurro">Carregando…</div>}
      {erro && <div className="px-5 py-5 text-controle text-critico">{erro.message}</div>}
      {!carregando && !erro && n === 0 && <div className="px-5 py-[22px] text-controle text-tinta-sussurro">Ninguém classificado aguardando o médico.</div>}
      {lista.map((e) => {
        const prios = rotulosPrioridade(e.prioridades_legais)
        return (
          <div key={e.id} className="flex flex-wrap items-center gap-3.5 border-b border-trilha px-5 py-[13px] last:border-b-0">
            <PilulaRisco cor={e.cor_atual} className="min-w-[70px]" />
            <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-0.5">
              <span className="text-corpo font-medium text-tinta">
                {nomeDe(e)}{' '}
                <span className="text-apoio font-normal text-tinta-sussurro">
                  {e.paciente?.data_nascimento ? rotuloIdade(e.paciente.data_nascimento, hoje) : 'idade não informada'}
                </span>
              </span>
              <span className="text-apoio text-pretty text-tinta-sussurro">
                {[`Queixa: ${e.queixa}`, prios.length ? `Prioridade: ${prios.join(', ')}` : '', `Classificado às ${hora(e.classificado_em)}`].filter(Boolean).join(' · ')}
              </span>
              {iguais.has(e.id) && <SeloHomonimo paciente={e.paciente} />}
            </div>
            <span className="text-apoio whitespace-nowrap tabular-nums text-tinta-apoio" title="Espera desde a ficha da recepção">
              {esperaMin(e.chegada_em)} min
            </span>
            <Button size="sm" variant="outline" onClick={() => onReclassificar(e)}>
              <RefreshCw /> Reclassificar
            </Button>
          </div>
        )
      })}
    </div>
  )
}
