import { useState } from 'react'

import { INTERMACAO, RECOMENDACOES_SCCM, avaliarResfriamento, fichaIntermacaoAdulto, taxaParaAlvo } from '@/clinico/adulto/intermacao'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { numero } from '@/lib/formato'
import { cn } from '@/lib/utils'

import { Bloco } from './PecasLoteC'

const c1 = (x: number) => numero(Math.round(x * 10) / 10)
const c3 = (x: number) => numero(Math.round(x * 1000) / 1000)

/** Intermação do adulto: meta e taxa de resfriamento (SCCM 2025). */
export function IntermacaoAdulto() {
  const [inicial, setInicial] = useState(0)
  const [atual, setAtual] = useState(0)
  const [minutos, setMinutos] = useState(0)
  const necessaria = inicial > 0 ? taxaParaAlvo(inicial) : null
  const r = inicial > 0 && atual > 0 ? avaliarResfriamento(inicial, atual, minutos) : null

  return (
    <ToolLayout
      title="Intermação — resfriamento e meta"
      description={`Temperatura central acima de ${INTERMACAO.definicaoC} °C com alteração do SNC. Alvo abaixo de ${INTERMACAO.alvoC} °C em até ${INTERMACAO.minutosAteAlvo} minutos, pela diretriz da SCCM 2025. Adulto (14 anos ou mais).`}
      ficha={fichaIntermacaoAdulto}
    >
      <Bloco titulo="Acompanhar o resfriamento" descricao="Temperatura central (a diretriz define a intermação pela temperatura central). Informe a primeira medida, a mais recente e os minutos entre elas.">
        <div className="grid gap-4 md:grid-cols-3">
          <NumberField id="int-ini" label="Temperatura inicial" unit="°C" value={inicial} onChange={setInicial} min={0} step={0.1} />
          <NumberField id="int-atual" label="Temperatura agora" unit="°C" value={atual} onChange={setAtual} min={0} step={0.1} />
          <NumberField id="int-min" label="Minutos entre as medidas" unit="min" value={minutos} onChange={setMinutos} min={0} />
        </div>
        {necessaria !== null && (
          <p className="text-apoio text-tinta-apoio">Para chegar abaixo de {INTERMACAO.alvoC} °C em {INTERMACAO.minutosAteAlvo} min a partir de {c1(inicial)} °C: <strong className="text-tinta">{c3(necessaria)} °C/min</strong>. A diretriz pede métodos de {numero(INTERMACAO.taxaMinimaCMin)} °C/min ou mais (Boa prática 4).</p>
        )}
        {r && (
          <div role="status" className={cn('rounded-cartao border px-4 py-3', r.noAlvo ? 'border-acao' : r.taxaSuficiente ? 'border-fio' : 'border-atencao')}>
            <p className="text-corpo font-semibold text-tinta">
              {r.noAlvo ? `Abaixo de ${INTERMACAO.alvoC} °C: alvo atingido` : `${c3(r.taxaCMin)} °C/min — ${r.taxaSuficiente ? 'taxa dentro da meta' : 'abaixo de 0,155 °C/min'}`}
            </p>
            {!r.noAlvo && (
              <p className="text-apoio text-tinta-apoio">
                {r.minutosAteAlvo !== null ? `Mantida a taxa, faltam cerca de ${Math.ceil(r.minutosAteAlvo)} min para o alvo.` : 'A temperatura não está caindo.'}
                {r.taxaNecessariaCMin !== null && ` Para fechar os ${INTERMACAO.minutosAteAlvo} min, seriam necessários ${c3(r.taxaNecessariaCMin)} °C/min daqui em diante.`}
                {!r.taxaSuficiente && ' Sem imersão, a diretriz orienta o método ou a combinação mais rápida disponível.'}
              </p>
            )}
          </div>
        )}
      </Bloco>

      <Bloco titulo="Recomendações da SCCM 2025">
        <ul className="flex flex-col gap-1.5 text-apoio">
          {RECOMENDACOES_SCCM.map((x) => <li key={x.texto}><span className="text-tinta">{x.texto}</span> <span className="text-tinta-sussurro">({x.grau})</span></li>)}
        </ul>
      </Bloco>
    </ToolLayout>
  )
}
