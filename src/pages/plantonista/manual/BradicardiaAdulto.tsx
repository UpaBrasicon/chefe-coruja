import { useState } from 'react'

import {
  ADRENALINA_BRADI, ATROPINA, DOPAMINA_BRADI, OUTRAS_BRADI, adrenalinaBradiMlH, dopaminaUgMin, esquemaAtropina, fichaBradicardiaAdulto, type Faixa,
} from '@/clinico/adulto/pcr'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { Bloco, CampoPeso, LinhaManual } from './PecasLoteC'

const br = (x: number, casas = 1) => (Math.round(x * 10 ** casas) / 10 ** casas).toLocaleString('pt-BR')
const faixa = (f: Faixa, casas = 1) => (f[0] === f[1] ? br(f[0], casas) : `${br(f[0], casas)}–${br(f[1], casas)}`)

/** Bradicardia sintomática do adulto (cap. 15 do manual do HCFMUSP). */
export function BradicardiaAdulto() {
  const [peso, setPeso] = useState(0)
  const at = esquemaAtropina()
  const dopa = dopaminaUgMin(peso)
  return (
    <ToolLayout
      title="Bradicardia sintomática — adulto"
      description="Atropina, dopamina e adrenalina enquanto se prepara o marca-passo, com as contas feitas. Adulto (14 anos ou mais)."
      ficha={fichaBradicardiaAdulto}
    >
      <CampoPeso id="bradi-peso" peso={peso} onChange={setPeso} />

      <Bloco titulo="Farmacoterapia (p. 229)" descricao="O manual cita atropina em sintomas graves ou instabilidade; em geral não funciona em Mobitz II nem em BAV total, e não deve ser usada em transplantados (Figura 3, p. 231).">
        <LinhaManual
          nome="Atropina"
          texto={`${br(ATROPINA.doseMg)} mg EV repetida a cada ${ATROPINA.intervaloMin} minutos até o máximo de ${ATROPINA.maximoMg} mg`}
          conta={<><strong>{at.doses} doses</strong> · máximo atingido em {at.minutosAteUltima} min</>}
          pagina={ATROPINA.pagina}
        />
        <LinhaManual
          nome="Dopamina"
          texto={`${faixa(DOPAMINA_BRADI, 0)} µg/kg/min`}
          conta={dopa ? <><strong>{faixa(dopa, 0)} µg/min</strong></> : 'informe o peso'}
          pagina="p. 229"
          nota="O livro não traz preparo padrão de dopamina, por isso o mL/h não é calculado."
        />
        <LinhaManual
          nome="Adrenalina"
          texto={`${faixa(ADRENALINA_BRADI.ugMin, 0)} µg/min (corrigido — ver errata)`}
          conta={<><strong>{faixa(ADRENALINA_BRADI.ugMin, 0)} µg/min</strong> = {faixa(adrenalinaBradiMlH())} mL/h no preparo do Anexo 1 (60 µg/mL)</>}
          pagina={ADRENALINA_BRADI.pagina}
          errata={ADRENALINA_BRADI.errata}
        />
        {OUTRAS_BRADI.map((d) => <LinhaManual key={d.id} nome={d.nome} texto={`${d.dose} — ${d.quando}`} pagina={d.pagina} />)}
      </Bloco>
    </ToolLayout>
  )
}
