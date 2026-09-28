import { useState } from 'react'

import { DOSES_DERMATOSES, DOSES_FIXAS_DERMATOSES, ERRATA_DERMATOSES, dosesDermatoses, fichaDermatosesAdulto } from '@/clinico/adulto/dermatoses'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { Bloco, CampoPeso, LinhaManual } from './PecasLoteC'
import { Erratas } from './PecasLoteE7'
import { br, faixa } from './loteE7Formato'

/** Dermatoses graves do adulto: doses por peso e fixas (cap. 96 do manual do HCFMUSP). */
export function DermatosesGravesAdulto() {
  const [peso, setPeso] = useState(0)
  const d = dosesDermatoses(peso)
  const D = DOSES_DERMATOSES

  return (
    <ToolLayout
      title="Dermatoses graves — doses (adulto)"
      description="SSJ/NET e DRESS com doses por peso, farmacodermias leves, herpes-zóster, erisipela e celulite, pelo manual do HC. RegiSCAR e os itens do SCORTEN estão em ferramentas próprias. Adulto (14 anos ou mais)."
      ficha={fichaDermatosesAdulto}
    >
      <CampoPeso id="der-peso" peso={peso} onChange={setPeso} />

      <Bloco titulo="SSJ/NET e DRESS (p. 1282, 1285)">
        <LinhaManual nome="SSJ/NET — prednisona" texto={D.ssjNetPrednisona.texto} conta={d ? <strong>{faixa(d.ssjNetPrednisonaMg, 0)} mg/dia</strong> : 'informe o peso'} pagina={D.ssjNetPrednisona.pagina} />
        <LinhaManual nome="SSJ/NET — ciclosporina" texto={D.ssjNetCiclosporina.texto} conta={d ? <strong>{faixa(d.ssjNetCiclosporinaMg, 0)} mg/dia</strong> : 'informe o peso'} pagina={D.ssjNetCiclosporina.pagina} />
        <LinhaManual nome="DRESS — prednisona" texto={`${D.dressPrednisona.texto}, até normalizar os exames e por 6-8 semanas depois`} conta={d ? <strong>{br(d.dressPrednisonaMg, 0)} mg/dia</strong> : 'informe o peso'} pagina={D.dressPrednisona.pagina} />
      </Bloco>

      <Bloco titulo="Outras doses do capítulo (p. 1279–1292)">
        {DOSES_FIXAS_DERMATOSES.map((x) => <LinhaManual key={x.nome} nome={x.nome} texto={x.texto} pagina={x.pagina} />)}
      </Bloco>

      <Bloco titulo="Errata e notas">
        <Erratas itens={ERRATA_DERMATOSES} />
      </Bloco>
    </ToolLayout>
  )
}
