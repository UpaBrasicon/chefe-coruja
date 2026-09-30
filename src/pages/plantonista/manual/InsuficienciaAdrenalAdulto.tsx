import { useState } from 'react'

import {
  CHOQUE_SEPTICO_REFRATARIO, CRISE_ADRENAL, DIVERGENCIA_FIGURA_IA, FORA_ENDOCRINO, fichaInsuficienciaAdrenal, leituraCortisolActh, leituraCortisolBasal,
  totaisCriseAdrenal, volumeCriseAdrenal,
} from '@/clinico/adulto/endocrino'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { Bloco, Resultado, Trecho } from './LoteAPecas'
import { faixaBr } from './loteAFormato'
import { CampoPeso, LinhaManual } from './PecasLoteC'
import { Errata, Fora } from './PecasLoteE6'

/** Insuficiência adrenal e crise adrenal (cap. 72 do manual do HCFMUSP). */
export function InsuficienciaAdrenalAdulto() {
  const [peso, setPeso] = useState(0)
  const [basal, setBasal] = useState(0)
  const [acth, setActh] = useState(0)
  const lb = basal > 0 ? leituraCortisolBasal(basal) : null
  const la = acth > 0 ? leituraCortisolActh(acth) : null
  const t = totaisCriseAdrenal()
  const vol = volumeCriseAdrenal(peso)
  const C = CRISE_ADRENAL

  return (
    <ToolLayout
      title="Insuficiência adrenal e crise adrenal — adulto"
      description="Cortes do cortisol basal e após ACTH, hidrocortisona, fludrocortisona e volume, como o manual do HCFMUSP traz. Adulto (14 anos ou mais)."
      ficha={fichaInsuficienciaAdrenal}
    >
      <CampoPeso id="ia-peso" peso={peso} onChange={setPeso} />

      <Bloco titulo="Cortisol" descricao="Coleta às 8 h; teste com ACTH 250 µg EV ou IM e cortisol 30 min depois (p. 969).">
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField id="ia-basal" label="Cortisol basal" unit="µg/dL" value={basal} onChange={setBasal} step={0.1} />
          <NumberField id="ia-acth" label="Cortisol 30 min após ACTH" unit="µg/dL" value={acth} onChange={setActh} step={0.1} />
        </div>
        {lb && <Trecho texto={lb.texto} pagina={lb.pagina} />}
        {la && <Trecho texto={la.texto} pagina={la.pagina} />}
        <p className="text-tinta-sussurro">{DIVERGENCIA_FIGURA_IA}</p>
      </Bloco>

      <Bloco titulo="Crise adrenal aguda" descricao={`${C.pagina}.`}>
        <LinhaManual nome="Hidrocortisona" texto={`dose inicial de ${C.hidrocortisonaAtaqueMg} mg EV, seguida de 50–100 mg EV a cada 6 horas; após 48–72 h, reduzir até a habitual (${C.habitual})`} pagina="cap. 72, p. 969"
          conta={<strong>{C.hidrocortisonaAtaqueMg} mg; depois {faixaBr(t.hidrocortisonaMgDia, 0)} mg/dia</strong>} />
        <LinhaManual nome="Fludrocortisona (flúor-hidrocortisona)" texto={C.fludrocortisona.texto} pagina="cap. 72, p. 969"
          conta={<strong>{C.fludrocortisona.ug} µg 8/8 h = {t.fludrocortisonaUgDia} µg/dia</strong>} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Resultado rotulo="Volume no texto (p. 969)" valor={`até ${C.volumeLH} L/h de cristaloide no início`} />
          <Resultado rotulo="Volume na Figura 1 (20–30 mL/kg, p. 971)" valor={vol ? `${faixaBr(vol.figuraMl, 0)} mL` : 'informe o peso'} />
        </div>
        <p>Hipoglicemia: {C.glicose.replace('hipoglicemia: ', '')} (p. 969).</p>
      </Bloco>

      <Bloco titulo="Choque séptico refratário a vasoativos" descricao={CHOQUE_SEPTICO_REFRATARIO.cruzamento}>
        <LinhaManual nome="Hidrocortisona" texto={`${CHOQUE_SEPTICO_REFRATARIO.hidrocortisonaMg} mg de 6/6 horas`} pagina={CHOQUE_SEPTICO_REFRATARIO.pagina}
          conta={<strong>{t.hidrocortisonaChoqueMgDia} mg/dia</strong>} />
        <LinhaManual nome="Fludrocortisona" texto={`impresso: "${CHOQUE_SEPTICO_REFRATARIO.fludrocortisonaImpresso}"`} pagina={CHOQUE_SEPTICO_REFRATARIO.pagina} conta="sem conta" />
        <Errata texto={CHOQUE_SEPTICO_REFRATARIO.errata} />
      </Bloco>

      <Bloco titulo="O que o manual não traz">
        <Fora itens={FORA_ENDOCRINO} />
      </Bloco>
    </ToolLayout>
  )
}
