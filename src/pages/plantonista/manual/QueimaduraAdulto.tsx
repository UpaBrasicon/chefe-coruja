import { useState } from 'react'

import { QUEIMADURA, RECOMENDACOES_ABA, fichaQueimaduraAdulto, reposicaoQueimado } from '@/clinico/adulto/queimadura'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { numero } from '@/lib/formato'
import { cn } from '@/lib/utils'

import { Bloco, CampoPeso } from './PecasLoteC'

const ml = (x: number) => numero(Math.round(x))

/** Queimadura do adulto: reposição inicial do choque pela ABA 2024. */
export function QueimaduraAdulto() {
  const [peso, setPeso] = useState(0)
  const [scq, setScq] = useState(0)
  const r = reposicaoQueimado(peso, scq)

  return (
    <ToolLayout
      title="Queimadura — reposição inicial (adulto)"
      description="Volume inicial do choque do queimado pela American Burn Association 2024, com os limites que pedem vigilância. Adulto com 20% ou mais de superfície corporal queimada."
      ficha={fichaQueimaduraAdulto}
    >
      <CampoPeso id="qa-peso" peso={peso} onChange={setPeso}>
        <NumberField id="qa-scq" label="Superfície corporal queimada" unit="%" value={scq} onChange={setScq} min={0} max={100} />
      </CampoPeso>
      <p className="text-apoio text-tinta-sussurro">A diretriz não traz como estimar a SCQ (regra dos nove ou Lund-Browder) nem como dividir o volume nas primeiras horas; a tela não inventa esses dados. A queimadura da criança tem tela própria na Pediatria.</p>

      {r && (
        <div role="status" className={cn('rounded-cartao border px-4 py-3', r.aplica ? 'border-fio' : 'border-atencao')}>
          {r.aplica ? (
            <>
              <p className="text-corpo font-semibold text-tinta">Início a {QUEIMADURA.inicioMlKgScq} mL/kg/%SCQ: {ml(r.volume24hMl)} mL em 24 h</p>
              <p className="text-apoio text-tinta-apoio">
                Só a taxa inicial: titular pela resposta. Para comparação, o Parkland ({QUEIMADURA.parklandMlKgScq} mL/kg/%SCQ) daria {ml(r.parkland24hMl)} mL.
                Vigilância (pressão intra-abdominal e intraocular) se o volume de 24 h, real ou previsto, se aproximar de {ml(r.limiteVigilanciaMl)} mL ({r.limiteVigilancia}).
              </p>
            </>
          ) : (
            <p className="text-apoio text-tinta">A diretriz da ABA 2024 trata de adultos com {QUEIMADURA.scqMinima}% ou mais de SCQ; abaixo disso, ela não se aplica.</p>
          )}
        </div>
      )}

      <Bloco titulo="Recomendações da ABA 2024">
        {RECOMENDACOES_ABA.map((x) => <p key={x.texto} className="text-apoio text-tinta-apoio">{x.texto} ({x.pagina})</p>)}
      </Bloco>
    </ToolLayout>
  )
}
