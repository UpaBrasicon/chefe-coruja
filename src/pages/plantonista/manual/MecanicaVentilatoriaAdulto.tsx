import { useState } from 'react'

import { CAUSAS_MECANICA, CONDICOES_MECANICA, EXEMPLO_FIGURA2, NORMAL_MECANICA, fichaMecanicaAdulto, mecanica } from '@/clinico/adulto/ventilacaoMecanica'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Button } from '@/components/ui/button'

import { Bloco, Resultado, Trecho } from './LoteAPecas'
import { br, faixaBr } from './loteAFormato'

/** Mecânica ventilatória — resistência, complacência estática, constante de tempo e driving pressure (cap. 37). */
export function MecanicaVentilatoriaAdulto() {
  const [vc, setVc] = useState(0)
  const [fluxo, setFluxo] = useState(60)
  const [ppico, setPpico] = useState(0)
  const [pplato, setPplato] = useState(0)
  const [peep, setPeep] = useState(0)

  const m = mecanica({ vcMl: vc, fluxoLMin: fluxo, ppico, pplato, peep })
  const exemplo = () => {
    const e = EXEMPLO_FIGURA2
    setVc(e.vcMl); setFluxo(e.fluxoLMin); setPpico(e.ppico); setPplato(e.pplato); setPeep(e.peep)
  }

  return (
    <ToolLayout
      title="Mecânica ventilatória (adulto)"
      description="Resistência, complacência estática, constante de tempo e driving pressure com as fórmulas e faixas do cap. 37 do manual do HCFMUSP. Adulto (14 anos ou mais)."
      ficha={fichaMecanicaAdulto}
    >
      <Bloco titulo="Condições para a medida (p. 499–500)">
        <ol className="list-decimal pl-5">{CONDICOES_MECANICA.map((c) => <li key={c}>{c}</li>)}</ol>
      </Bloco>

      <Bloco titulo="Valores do ventilador" descricao="VCV com fluxo quadrado e pausa inspiratória. O fluxo em L/min é convertido para L/s (60 L/min = 1 L/s).">
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="mc-vc" label="Volume corrente" unit="mL" value={vc} onChange={setVc} step={10} />
          <NumberField id="mc-fluxo" label="Fluxo" unit="L/min" value={fluxo} onChange={setFluxo} step={5} />
          <NumberField id="mc-pico" label="Ppico" unit="cmH2O" value={ppico} onChange={setPpico} step={1} />
          <NumberField id="mc-plato" label="Pplatô" unit="cmH2O" value={pplato} onChange={setPplato} step={1} />
          <NumberField id="mc-peep" label="PEEP" unit="cmH2O" value={peep} onChange={setPeep} step={1} />
        </div>
        <div><Button type="button" size="sm" variant="outline" onClick={exemplo}>Carregar o exemplo da Figura 2 (p. 499)</Button></div>
      </Bloco>

      <Bloco titulo="Resultado">
        <div className="grid gap-3 sm:grid-cols-2">
          <Resultado rotulo={`Resistência (Ppico − Pplatô)/fluxo · normal ${faixaBr(NORMAL_MECANICA.resistencia, 0)}`} valor={m.resistencia !== null ? `${br(m.resistencia, 1)} cmH2O/L/s` : '—'} />
          <Resultado rotulo={`Complacência estática VC/(Pplatô − PEEP) · normal ${faixaBr(NORMAL_MECANICA.complacencia, 0)}`} valor={m.complacencia !== null ? `${br(m.complacencia, 1)} mL/cmH2O` : '—'} />
          <Resultado rotulo="Driving pressure (Pplatô − PEEP) · evitar > 15 (p. 506)" valor={m.driving !== null ? `${br(m.driving, 1)} cmH2O` : '—'} />
          <Resultado rotulo="Constante de tempo (R × Cst) · 3–5 constantes para esvaziar" valor={m.tau ? `${br(m.tau.tauS, 2)} s · esvaziamento ${faixaBr(m.tau.esvaziamentoS, 2)} s` : '—'} />
        </div>
        {m.notas.length > 0 && <ul className="list-disc pl-5">{m.notas.map((n) => <li key={n}>{n}</li>)}</ul>}
        <Trecho texto="Resistência (Ppico – Pplatô/fluxo); complacência (volume corrente/Pplatô – PEEP)" pagina="p. 499" errata="Impresso sem parênteses; a Figura 2 confirma (Ppico − Pplatô)/fluxo e VC/(Pplatô − PEEP)." />
        <p className="text-muted-foreground">Complacência dinâmica: o capítulo não traz fórmula — não calculada.</p>
      </Bloco>

      <Bloco titulo="Tabela 1 — causas (p. 500)">
        <div className="grid gap-3 sm:grid-cols-2">
          <div><p className="font-medium">↓ Complacência</p><ul className="list-disc pl-5">{CAUSAS_MECANICA.complacencia.map((c) => <li key={c}>{c}</li>)}</ul></div>
          <div><p className="font-medium">↑ Resistência</p><ul className="list-disc pl-5">{CAUSAS_MECANICA.resistencia.map((c) => <li key={c}>{c}</li>)}</ul></div>
        </div>
      </Bloco>
    </ToolLayout>
  )
}
