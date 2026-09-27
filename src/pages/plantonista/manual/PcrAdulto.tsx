import { useState, type ReactNode } from 'react'

import { CHOQUE_PCR, DROGAS_PCR, KCL_ATAQUE_MEQ, calcularPcr, fichaPcrAdulto, type Faixa } from '@/clinico/adulto/pcr'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { Bloco, CampoPeso, LinhaManual } from './PecasLoteC'

const br = (x: number, casas = 1) => (Math.round(x * 10 ** casas) / 10 ** casas).toLocaleString('pt-BR')
const faixa = (f: Faixa, casas = 1) => (f[0] === f[1] ? br(f[0], casas) : `${br(f[0], casas)}–${br(f[1], casas)}`)

/** Drogas e cargas de choque na PCR do adulto (cap. 2 do manual do HCFMUSP). */
export function PcrAdulto() {
  const [peso, setPeso] = useState(0)
  const r = calcularPcr(peso)
  const semPeso = 'informe o peso'

  const conta: Record<string, ReactNode> = {
    lidocaina: r ? <strong>{faixa(r.lidocainaMg, 0)} mg</strong> : semPeso,
    bicarbonato: r ? <><strong>{faixa(r.bicarbonatoMEq, 0)} mEq</strong> · adicional {faixa(r.bicarbonatoAdicionalMEq, 0)} mEq</> : semPeso,
    emulsao: r ? <><strong>{br(r.emulsaoBolusMl, 0)} mL</strong> em 1 min · {br(r.emulsaoMlMin)} mL/min ({br(r.emulsaoMlH, 0)} mL/h) · {faixa(r.emulsaoInfusaoMl, 0)} mL em 30–60 min</> : semPeso,
    kcl: <><strong>{KCL_ATAQUE_MEQ} mEq</strong> em 10 min</>,
  }

  return (
    <ToolLayout
      title="PCR — drogas e desfibrilação (adulto)"
      description="Tabela 2 do manual do HC com as doses por peso calculadas, e a carga do choque. Adulto (14 anos ou mais)."
      ficha={fichaPcrAdulto}
    >
      <CampoPeso id="pcr-peso" peso={peso} onChange={setPeso} />

      <Bloco titulo="Desfibrilação" descricao="FV e TV sem pulso.">
        <LinhaManual
          nome="Carga do choque"
          texto={`${CHOQUE_PCR.monofasicoJ} J se monofásico; ${CHOQUE_PCR.bifasicoJ} J ou a carga indicada pelo fabricante se bifásico; choque único e retorno imediato à RCP`}
          conta={<><strong>{CHOQUE_PCR.monofasicoJ} J</strong> mono · <strong>{CHOQUE_PCR.bifasicoJ} J</strong> bi</>}
          pagina={CHOQUE_PCR.pagina}
        />
      </Bloco>

      <Bloco titulo="Medicações (Tabela 2)">
        {DROGAS_PCR.map((d) => (
          <LinhaManual key={d.id} nome={d.nome} texto={`${d.dose} — ${d.quando}`} conta={conta[d.id]} pagina={d.pagina} errata={d.errata} nota={d.nota} />
        ))}
      </Bloco>
    </ToolLayout>
  )
}
