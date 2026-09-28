import { useState } from 'react'

import { DOSES_TCE, METAS_TCE, fichaTcePediatrico } from '@/clinico/pediatria/tceDecisao'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { pesoValido } from './formatoP2'
import { AvisoRn, Bloco, CampoPesoRn, LinhaDose, LinhaReferencia, PesoInvalido } from './PecasP2'

/** TCE grave na criança: terapia hiperosmolar por peso e metas (livro do ICr, cap. 16). */
export function TcePediatrico() {
  const [peso, setPeso] = useState(0)
  const [rn, setRn] = useState(false)

  return (
    <ToolLayout
      title="TCE grave — criança"
      description="NaCl 3% e manitol por peso, e as metas do capítulo (PaCO₂, PIC, PPC, osmolaridade) — livro do ICr-HCFMUSP."
      ficha={fichaTcePediatrico}
    >
      <CampoPesoRn id="tce-peso" peso={peso} setPeso={setPeso} rn={rn} setRn={setRn} />
      {rn ? <AvisoRn /> : !pesoValido(peso) ? <PesoInvalido /> : (
        <Bloco titulo="Terapia hiperosmolar (p. 179)">
          {DOSES_TCE.map((d) => <LinhaDose key={d.id} d={d} peso={peso} />)}
        </Bloco>
      )}
      <Bloco titulo="Metas e critérios do capítulo">
        {METAS_TCE.map((m) => <LinhaReferencia key={m.texto} texto={m.texto} pagina={`cap. 16, ${m.pagina}`} />)}
      </Bloco>
    </ToolLayout>
  )
}
