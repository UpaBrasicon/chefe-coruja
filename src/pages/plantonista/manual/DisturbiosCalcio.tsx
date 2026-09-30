import { useState } from 'react'

import {
  BOLUS_CALCIO, CALCIO, INFUSAO_CALCIO, TABELA7_HIPERCALCEMIA, calcioCorrigido, calcioElementar, comprimidosCarbonato, fichaHipercalcemia,
  fichaReposicaoCalcio, fracaoExcrecaoCalcio, infusaoCalcioDose, infusaoCalcioMlH, lerCalcioTotal, tratamentoHipercalcemia, velocidadeBolus,
  type SalCalcio,
} from '@/clinico/adulto/eletrolitos'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { Alertas, Bloco, Escolha, Resultado, Trecho } from './LoteAPecas'
import { br, faixaBr } from './loteAFormato'

function CalcioSerico({ prefixo }: { prefixo: string }) {
  const [ca, setCa] = useState(0)
  const [alb, setAlb] = useState(0)
  const corr = ca > 0 && alb > 0 ? calcioCorrigido(ca, alb) : null
  const base = corr ?? (ca > 0 ? ca : null)
  const leitura = base !== null ? lerCalcioTotal(base) : null
  return (
    <Bloco titulo="Cálcio total e correção pela albumina" descricao="Ca corrigido = Ca medido + [(4,0 − albumina) × 0,8], Ca em mg/dL e albumina em g/dL (p. 919). Alcalose reduz e acidose aumenta o cálcio iônico.">
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField id={`${prefixo}-ca`} label="Cálcio total medido" unit="mg/dL" value={ca} onChange={setCa} step={0.1} />
        <NumberField id={`${prefixo}-alb`} label="Albumina" unit="g/dL" value={alb} onChange={setAlb} step={0.1} />
      </div>
      {corr !== null && <Resultado rotulo="Cálcio corrigido" valor={`${br(corr)} mg/dL`} />}
      {leitura && leitura.referencias.map((r) => <Trecho key={r.texto} {...r} />)}
    </Bloco>
  )
}

/** Hipocalcemia no adulto: cálcio corrigido, bolus, infusão contínua e VO (cap. 68 e Anexo 5). */
export function ReposicaoCalcio() {
  const [sal, setSal] = useState<SalCalcio>('gluconato')
  const [ml, setMl] = useState(10)
  const [dil, setDil] = useState(100)
  const [min, setMin] = useState(10)
  const [peso, setPeso] = useState(0)
  const [dose, setDose] = useState(0)
  const [mlh, setMlh] = useState(INFUSAO_CALCIO.inicioMlH)
  const [caVO, setCaVO] = useState(0)

  const el = calcioElementar(sal, ml)
  const vel = velocidadeBolus(ml, dil, min)
  const infMlH = dose > 0 ? infusaoCalcioMlH(dose, peso) : null
  const infDose = infusaoCalcioDose(mlh, peso)
  const foraFaixa = infDose !== null && (infDose < INFUSAO_CALCIO.faixaMgKgH[0] || infDose > INFUSAO_CALCIO.faixaMgKgH[1])
  const comp = comprimidosCarbonato(caVO)

  return (
    <ToolLayout
      title="Hipocalcemia — cálcio corrigido e reposição"
      description="Cálcio corrigido pela albumina, cálcio elementar do bolus, velocidade na bomba, infusão contínua em mg/kg/h e comprimidos de carbonato, como o manual do HCFMUSP traz. Adulto (14 anos ou mais)."
      ficha={fichaReposicaoCalcio}
    >
      <CalcioSerico prefixo="hipoca" />

      <Bloco titulo="Bolus de cálcio EV" descricao="Meta do livro: reversão dos sintomas e CaT > 7–7,5 mg/dL; efeito transitório (2–3 h); infusão mais rápida que 10–20 min → depressão miocárdica (Tab. 4, p. 922; p. 1500).">
        {BOLUS_CALCIO.map((b) => <Trecho key={b.sal} texto={b.texto} pagina={b.pagina} errata={b.errata} />)}
        <Escolha label="Sal" value={sal} onChange={setSal} opcoes={[{ value: 'gluconato', label: 'Gluconato 10% (9 mg/mL)' }, { value: 'cloreto', label: 'Cloreto 10% (27 mg/mL)' }]} />
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="ca-ml" label={`${CALCIO[sal].nome}`} unit="mL" value={ml} onChange={setMl} />
          <NumberField id="ca-dil" label="Diluente (SG 5%)" unit="mL" value={dil} onChange={setDil} step={10} />
          <NumberField id="ca-min" label="Tempo" unit="min" value={min} onChange={setMin} />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Resultado rotulo="Cálcio elementar" valor={el ? `${br(el.mgCa, 0)} mg · ${br(el.mEq)} mEq` : '—'} />
          <Resultado rotulo="Bomba" valor={vel === null ? '—' : `${br(vel, 0)} mL/h`} />
        </div>
        <Alertas itens={min > 0 && min < 10 ? ['Mais rápido que 10 min: o livro associa a depressão miocárdica (Tab. 4, p. 922).'] : []} />
        <p className="text-tinta-sussurro">mEq por 10 mL: cloreto 13,6 × gluconato 4,6 (nota da Tab. 6, p. 916).</p>
      </Bloco>

      <Bloco titulo="Infusão contínua (hipocalcemia persistente)" descricao="Gluconato de cálcio 10% 110 mL + SG 5% ou SF 890 mL (≈ 1 mg/mL de Ca elementar; pela conta, 0,99 mg/mL); iniciar a 50 mL/h; 0,5–1,5 mg/kg/h de Ca elementar por 6–12 h (p. 922 e 1500).">
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="ca-peso" label="Peso" unit="kg" value={peso} onChange={setPeso} step={0.1} />
          <NumberField id="ca-dose" label="Dose → bomba" unit="mg/kg/h" value={dose} onChange={setDose} step={0.1} />
          <NumberField id="ca-mlh" label="Bomba → dose" unit="mL/h" value={mlh} onChange={setMlh} />
        </div>
        {peso > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Resultado rotulo="Velocidade para a dose" valor={infMlH === null ? '—' : `${br(infMlH)} mL/h`} />
            <Resultado rotulo={`Dose a ${br(mlh)} mL/h`} valor={infDose === null ? '—' : `${br(infDose, 2)} mg/kg/h de Ca elementar`} />
          </div>
        ) : <p className="text-tinta-sussurro">Informe o peso.</p>}
        <Alertas itens={foraFaixa ? ['Fora da faixa de 0,5–1,5 mg/kg/h que o manual traz.'] : []} />
      </Bloco>

      <Bloco titulo="Reposição VO" descricao="Hipocalcemia leve, sintomática leve ou crônica: 1.500–2.000 mg/dia de Ca elementar em 2–3 doses (Anexo 5, p. 1500; três tomadas no cap. 68, p. 923). Carbonato de cálcio 1.250 mg = 500 mg de Ca elementar.">
        <NumberField id="ca-vo" label="Ca elementar no dia" unit="mg" value={caVO} onChange={setCaVO} step={100} />
        {comp !== null && <Resultado rotulo="Carbonato de cálcio 1.250 mg" valor={`${br(comp)} comprimidos/dia`} />}
        <Trecho texto="Na DRC com hipocalcemia assintomática não se justifica cálcio EV como reposição inicial; atentar para vitamina D na hipovitaminose ou no hipoparatireoidismo. Calcitriol 0,25–0,5 µg 2 vezes ao dia." pagina="p. 922 e 1503" />
      </Bloco>
    </ToolLayout>
  )
}

/** Hipercalcemia no adulto: cálcio corrigido, FECa e as doses da Tab. 7 que dependem do peso. */
export function HipercalcemiaAdulto() {
  const [peso, setPeso] = useState(0)
  const [caU, setCaU] = useState(0)
  const [fluxo, setFluxo] = useState(0)
  const [caP, setCaP] = useState(0)
  const [tfg, setTfg] = useState(0)
  const t = tratamentoHipercalcemia(peso)
  const feca = caU > 0 && fluxo > 0 ? fracaoExcrecaoCalcio({ caU, fluxoMlMin: fluxo, caP, tfgMlMin: tfg }) : null

  return (
    <ToolLayout
      title="Hipercalcemia — cálcio corrigido, FECa e tratamento agudo"
      description="Cortes de gravidade, fração de excreção de cálcio e as doses da Tabela 7 do manual do HCFMUSP (prednisona e calcitonina por peso, velocidades de SF e pamidronato). Adulto (14 anos ou mais)."
      ficha={fichaHipercalcemia}
    >
      <CalcioSerico prefixo="hiperca" />

      <Bloco titulo="Tratamento agudo — Tabela 7" descricao="Indicações do livro: hipercalcemia grave (CaT > 14 mg/dL) ou moderada (CaT > 12 mg/dL) com sintomas (p. 927).">
        <NumberField id="hiperca-peso" label="Peso" unit="kg" value={peso} onChange={setPeso} step={0.1} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Resultado rotulo="SF (como o livro traz)" valor={`${faixaBr(t.soroMlH, 0)} mL/h`} />
          <Resultado rotulo="Pamidronato 90 mg + SF 250 mL em 2–4 h" valor={`${faixaBr(t.pamidronatoMlH)} mL/h`} />
          <Resultado rotulo="Prednisona 1 mg/kg" valor={t.prednisonaMg === null ? 'informe o peso' : `${br(t.prednisonaMg)} mg`} />
          <Resultado rotulo="Calcitonina 4–8 UI/kg IM ou SC 12/12 h por 48 h" valor={t.calcitoninaUI === null ? 'informe o peso' : `${faixaBr(t.calcitoninaUI, 0)} UI por dose`} />
        </div>
        {TABELA7_HIPERCALCEMIA.map((r) => <Trecho key={r.texto} {...r} />)}
      </Bloco>

      <Bloco titulo="Fração de excreção de cálcio (FECa)" descricao="FECa = (Ca urinário × fluxo urinário) / (Ca plasmático × TFG) (p. 925). FECa < 0,01 diferencia a hipercalcemia hipocalciúrica familiar do hiperparatireoidismo primário (p. 924). Use a mesma unidade nos dois cálcios e nos dois fluxos.">
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField id="feca-cau" label="Ca urinário" unit="mg/dL" value={caU} onChange={setCaU} step={0.1} />
          <NumberField id="feca-fluxo" label="Fluxo urinário" unit="mL/min" value={fluxo} onChange={setFluxo} step={0.1} />
          <NumberField id="feca-cap" label="Ca plasmático" unit="mg/dL" value={caP} onChange={setCaP} step={0.1} />
          <NumberField id="feca-tfg" label="TFG" unit="mL/min" value={tfg} onChange={setTfg} />
        </div>
        {feca !== null && <Resultado rotulo="FECa" valor={`${br(feca, 4)} — ${feca < 0.01 ? 'abaixo de 0,01' : 'igual ou acima de 0,01'}`} />}
      </Bloco>
    </ToolLayout>
  )
}
