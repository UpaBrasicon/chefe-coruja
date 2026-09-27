import { useState } from 'react'

import { HNF_EV, NOMOGRAMA_TTPA, ajustarHnf, fichaHnfAdulto, inicioHnf, mlHDeUIH } from '@/clinico/adulto/anticoagulacao'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { Bloco, CampoPeso, LinhaManual } from './PecasLoteC'

const br = (x: number, casas = 1) => (Math.round(x * 10 ** casas) / 10 ** casas).toLocaleString('pt-BR')
const comMl = (uiH: number, conc: number) => {
  const ml = mlHDeUIH(uiH, conc)
  return ml === null ? '' : ` = ${br(ml)} mL/h`
}

/** Heparina não fracionada EV do adulto com o nomograma da Tabela 7 (cap. 32 do manual do HCFMUSP). */
export function HeparinaNaoFracionadaAdulto() {
  const [peso, setPeso] = useState(0)
  const [conc, setConc] = useState(0)
  const [ttpa, setTtpa] = useState(0)
  const [atual, setAtual] = useState(HNF_EV.infusaoUIKgH)
  const ini = inicioHnf(peso)
  const aj = ajustarHnf(ttpa, peso, atual)

  return (
    <ToolLayout
      title="Heparina não fracionada EV — adulto"
      description="Bolus e infusão por peso e ajuste pelo TTPA (Tabela 7 do manual do HC). Adulto (14 anos ou mais)."
      ficha={fichaHnfAdulto}
    >
      <CampoPeso id="hnf-peso" peso={peso} onChange={setPeso}>
        <NumberField id="hnf-conc" label="Concentração do seu preparo (opcional)" unit="UI/mL" value={conc} onChange={setConc} min={0} />
      </CampoPeso>
      <p className="text-sm text-muted-foreground">
        O manual não traz diluição da heparina EV. O mL/h só aparece com a concentração do preparo informada acima.
      </p>

      <Bloco titulo="Início">
        <LinhaManual
          nome="HNF EV"
          texto={`${HNF_EV.bolusUIKg} UI/kg IV em bolus, seguida de ${HNF_EV.infusaoUIKgH} UI/kg/h; ajuste pelo TTPA`}
          conta={ini ? <><strong>{br(ini.bolusUI, 0)} UI</strong> em bolus · <strong>{br(ini.infusaoUIH, 0)} UI/h</strong>{comMl(ini.infusaoUIH, conc)}</> : 'informe o peso'}
          pagina={HNF_EV.pagina}
          nota="O manual cita preferência pela HNF em instabilidade hemodinâmica, disfunção renal, extremos de peso e idade e alto risco de sangramento."
        />
      </Bloco>

      <Bloco titulo="Ajuste pelo TTPA (Tabela 7, adaptada de Raschke et al., 1996)">
        <div className="grid gap-4 md:grid-cols-2">
          <NumberField id="hnf-ttpa" label="TTPA" unit="s" value={ttpa} onChange={setTtpa} min={0} />
          <NumberField id="hnf-atual" label="Infusão atual" unit="UI/kg/h" value={atual} onChange={setAtual} min={0} step={0.5} />
        </div>
        {aj ? (
          <div className="rounded-lg border px-3 py-2 text-sm tabular-nums">
            <p>Linha da tabela: <strong>{aj.linha.faixa}</strong></p>
            {aj.novoBolusUI !== null && <p>Novo bolus: <strong>{br(aj.novoBolusUI, 0)} UI</strong> ({aj.linha.novoBolusUIKg} UI/kg)</p>}
            {aj.linha.pararMin > 0 && <p>Parar a infusão por 1 hora.</p>}
            <p>
              {aj.linha.deltaUIKgH === 0 ? 'Manter' : `${aj.linha.deltaUIKgH > 0 ? 'Aumentar' : 'Diminuir'} ${Math.abs(aj.linha.deltaUIKgH)} UI/kg/h`}
              {' → '}<strong>{br(aj.novaInfusaoUIKgH)} UI/kg/h = {br(aj.novaInfusaoUIH, 0)} UI/h</strong>{comMl(aj.novaInfusaoUIH, conc)}
            </p>
          </div>
        ) : <p className="text-sm text-muted-foreground">Informe peso e TTPA.</p>}
        <table className="w-full text-sm">
          <thead><tr className="text-left text-muted-foreground"><th>TTPA</th><th>Novo bolus</th><th>Ajustar infusão</th></tr></thead>
          <tbody>
            {NOMOGRAMA_TTPA.map((l) => (
              <tr key={l.faixa} className={aj?.linha === l ? 'font-semibold' : undefined}>
                <td>{l.faixa}</td>
                <td>{l.novoBolusUIKg ? `${l.novoBolusUIKg} UI/kg` : l.pararMin ? 'Parar infusão por 1 hora' : '—'}</td>
                <td>{l.deltaUIKgH === 0 ? 'Manter' : `${l.deltaUIKgH > 0 ? 'Aumentar' : 'Diminuir'} ${Math.abs(l.deltaUIKgH)} UI/kg/h`}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-sm text-muted-foreground">
          TTPA fracionado entre duas faixas (p. ex. 45,5 s) é lido pela faixa seguinte (46–70 s). O manual não traz o intervalo de coleta do TTPA nem dose máxima de bolus.
        </p>
      </Bloco>
    </ToolLayout>
  )
}
