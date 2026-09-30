import { useState } from 'react'

import { AAN_SGB, IGIV_SGB, PLASMAFERESE_SGB, RED_FLAGS_SGB, contaImunoterapiaSgb, fichaSgbAdulto, lerLcrSgb } from '@/clinico/adulto/guillainBarre'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { Bloco, CampoPeso, LinhaManual } from './PecasLoteC'
import { br } from './loteE7Formato'

/** Síndrome de Guillain-Barré: imunoterapia por peso, LCR e AAN (cap. 44 do manual do HCFMUSP). */
export function GuillainBarreAdulto() {
  const [peso, setPeso] = useState(0)
  const [proteina, setProteina] = useState(0)
  const [celulas, setCelulas] = useState(0)
  const [lcrInformado, setLcrInformado] = useState(false)
  const c = contaImunoterapiaSgb(peso)
  const lcr = lcrInformado ? lerLcrSgb(proteina, celulas) : null

  return (
    <ToolLayout
      title="Síndrome de Guillain-Barré — imunoterapia e LCR (adulto)"
      description="Imunoglobulina e plasmaférese por peso, leitura do liquor e recomendações da AAN, pelo manual do HC. Critérios de ventilação, escore de incapacidade e EGOS estão em ferramentas próprias. Adulto (14 anos ou mais)."
      ficha={fichaSgbAdulto}
    >
      <CampoPeso id="sgb-peso" peso={peso} onChange={setPeso} />

      <Bloco titulo="Imunoterapia (p. 604)" descricao="Resultados equivalentes; benefício demonstrado até 4 semanas do início dos sintomas; sem evidência do uso concomitante.">
        <LinhaManual
          nome="Imunoglobulina intravenosa"
          texto={`${br(IGIV_SGB.gKgDia)} g/kg/dia durante ${IGIV_SGB.dias} dias consecutivos`}
          conta={c ? <><strong>{br(c.igivGDia)} g/dia</strong> · total {br(c.igivGTotal)} g</> : 'informe o peso'}
          pagina={IGIV_SGB.pagina}
        />
        <LinhaManual
          nome="Plasmaférese"
          texto={`${PLASMAFERESE_SGB.mlKgTotal} mL/kg divididos em ${PLASMAFERESE_SGB.sessoes} sessões em ${PLASMAFERESE_SGB.intervalo}`}
          conta={c ? <><strong>{br(c.plasmaMlSessao, 0)} mL/sessão</strong> · total {br(c.plasmaMlTotal, 0)} mL</> : 'informe o peso'}
          pagina={PLASMAFERESE_SGB.pagina}
        />
      </Bloco>

      <Bloco titulo="Recomendações da AAN (2003) — Tabela 6 (p. 605–606)">
        {AAN_SGB.map((a) => <LinhaManual key={a.terapia + a.texto} nome={`${a.terapia} (${a.nivel})`} texto={a.texto} pagina="p. 605–606" />)}
      </Bloco>

      <Bloco titulo="Liquor (p. 603–604)">
        <div className="grid gap-3 md:grid-cols-2">
          <NumberField id="sgb-prot" label="Proteína" unit="mg/dL" value={proteina} onChange={(v) => { setProteina(v); setLcrInformado(true) }} min={0} />
          <NumberField id="sgb-cel" label="Células" unit="/mm³" value={celulas} onChange={(v) => { setCelulas(v); setLcrInformado(true) }} min={0} />
        </div>
        {lcr ? <ul className="list-disc pl-5 text-sm">{lcr.achados.map((a) => <li key={a}>{a}</li>)}</ul> : <p className="text-sm text-tinta-sussurro">Informe proteína e células.</p>}
        <p className="text-sm font-medium">Red flags para diagnóstico alternativo (p. 603–604)</p>
        <ul className="list-disc pl-5 text-sm">{RED_FLAGS_SGB.map((r) => <li key={r}>{r}</li>)}</ul>
      </Bloco>
    </ToolLayout>
  )
}
