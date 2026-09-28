import { useState } from 'react'

import { AUTO_PEEP, OBSTRUIDO, conferirObstruido, fichaVmObstruidoAdulto, peepPorAutoPeep, relacaoIE, vcPorPeso } from '@/clinico/adulto/ventilacaoMecanica'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { Alertas, Bloco, Resultado } from './LoteAPecas'
import { br, faixaBr, informado } from './loteAFormato'

/** VM no paciente obstruído grave — Tabela 4 do cap. 37 do manual do HCFMUSP. */
export function VmObstruidoGraveAdulto() {
  const [peso, setPeso] = useState(0)
  const [autoPeep, setAutoPeep] = useState(0)
  const [fr, setFr] = useState(10)
  const [tins, setTins] = useState(1)
  const [fluxo, setFluxo] = useState(0)
  const [pplato, setPplato] = useState(0)
  const [ppico, setPpico] = useState(0)
  const [ph, setPh] = useState(0)

  const vt = vcPorPeso(peso, [OBSTRUIDO.vtMlKg, OBSTRUIDO.vtMlKg])
  const peep85 = peepPorAutoPeep(autoPeep)
  const ie = relacaoIE(fr, tins)
  const avisos = conferirObstruido({ fr: informado(fr), tins: informado(tins), fluxo: informado(fluxo), pplato: informado(pplato), ppico: informado(ppico), ph: informado(ph) })

  return (
    <ToolLayout
      title="Ventilação mecânica no obstruído grave (adulto)"
      description="Tabela 4 do cap. 37 do manual do HCFMUSP: Vt, PEEP a 85% da auto-PEEP, FR, relação I:E e limites de pressão, com conferência dos valores do ventilador. Adulto (14 anos ou mais)."
      ficha={fichaVmObstruidoAdulto}
    >
      <Bloco titulo="Tabela 4 — ajuste no obstruído grave (p. 505)" descricao="A VM específica da asma (p. 416) e da DPOC (p. 425) está nas telas de exacerbação de asma e de DPOC.">
        <div className="grid gap-3 sm:grid-cols-3">
          <Resultado rotulo="Vt" valor={`${OBSTRUIDO.vtMlKg} mL/kg inicialmente`} />
          <Resultado rotulo="PEEP" valor="3–5 cmH2O → 85% da auto-PEEP se necessário" />
          <Resultado rotulo="FiO2" valor="100% inicial → SatO2 > 92%" />
          <Resultado rotulo="FR" valor={`${faixaBr(OBSTRUIDO.fr, 0)} rpm, I:E ≥ 1:3`} />
          <Resultado rotulo="PCV · VCV" valor="Tins ≤ 1 s · fluxo ≥ 60 L/min" />
          <Resultado rotulo="Alarmes" valor="evitar Pplatô > 30 e Ppico > 45 cmH2O" />
        </div>
        <p className="text-muted-foreground">p. 505: tolera-se hipercapnia se pH &gt; 7,2; evita-se I:E &gt; 1:5 (retenção de CO2); deterioração rápida → pensar em pneumotórax hipertensivo por barotrauma.</p>
      </Bloco>

      <Bloco titulo="Contas" descricao="O livro não diz qual peso usar no mL/kg nem traz fórmula de peso predito: informe o peso que você quer usar.">
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="ob-peso" label="Peso usado na conta" unit="kg" value={peso} onChange={setPeso} step={0.1} />
          <Resultado rotulo="Vt 6 mL/kg" valor={vt ? `${br(vt[0], 0)} mL` : 'informe o peso'} />
          <span />
          <NumberField id="ob-autopeep" label="Auto-PEEP medida (pausa expiratória)" unit="cmH2O" value={autoPeep} onChange={setAutoPeep} step={0.5} />
          <Resultado rotulo="85% da auto-PEEP" valor={peep85 !== null ? `${br(peep85, 1)} cmH2O` : '—'} />
        </div>
      </Bloco>

      <Bloco titulo="Conferir o ventilador contra a Tabela 4">
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="ob-fr" label="FR" unit="rpm" value={fr} onChange={setFr} step={1} />
          <NumberField id="ob-tins" label="Tins" unit="s" value={tins} onChange={setTins} step={0.1} />
          <Resultado rotulo="Ciclo · Te · I:E" valor={ie ? `${br(ie.cicloS, 2)} s · ${br(ie.teS, 2)} s · 1:${br(ie.n, 1)}` : '—'} />
          <NumberField id="ob-fluxo" label="Fluxo (VCV)" unit="L/min" value={fluxo} onChange={setFluxo} step={5} />
          <NumberField id="ob-plato" label="Pplatô" unit="cmH2O" value={pplato} onChange={setPplato} step={1} />
          <NumberField id="ob-pico" label="Ppico" unit="cmH2O" value={ppico} onChange={setPpico} step={1} />
          <NumberField id="ob-ph" label="pH" value={ph} onChange={setPh} step={0.01} />
        </div>
        {avisos.length ? <Alertas itens={avisos} /> : <p>Nenhum valor informado fora da Tabela 4.</p>}
      </Bloco>

      <Bloco titulo="Auto-PEEP (p. 504)">
        <p className="font-medium">Como identificar</p>
        <ul className="list-disc pl-5">{AUTO_PEEP.identificar.map((i) => <li key={i}>{i}</li>)}</ul>
        <p className="font-medium">Como evitar e otimizar</p>
        <ul className="list-disc pl-5">{AUTO_PEEP.otimizar.map((i) => <li key={i}>{i}</li>)}</ul>
      </Bloco>
    </ToolLayout>
  )
}
