import { useState } from 'react'

import {
  ERRATA_CORTES_FIGURAS, ESQUEMAS_BICARBONATO, NAHCO3_84_MEQ_POR_ML, REFERENCIAS_BICARBONATO, TABELA_ATR, analisarGasometria, anionGap,
  anionGapCorrigido, anionGapUrinario, calcularEsquemaBic, criterioLaboratorialBicarbonato, deficitBicarbonato, deltaDelta, fichaBicarbonato,
  fichaGasometria, gapOsmolar, lerCloroUrinario, phArterialEstimado, type Tempo,
} from '@/clinico/adulto/acidobase'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { Bloco, Escolha, Resultado, Trecho } from './LoteAPecas'
import { br, faixaBr } from './loteAFormato'

/** Distúrbios acidobásicos: passo a passo do cap. 69 (primário, compensação, AG, delta-delta, AG urinário, Cl urinário, gap osmolar). */
export function GasometriaAcidoBase() {
  const [ph, setPh] = useState(0)
  const [pco2, setPco2] = useState(0)
  const [hco3, setHco3] = useState(0)
  const [tempo, setTempo] = useState<'nao' | Tempo>('nao')
  const [na, setNa] = useState(0)
  const [cl, setCl] = useState(0)
  const [alb, setAlb] = useState(0)
  const [naU, setNaU] = useState(0)
  const [kU, setKU] = useState(0)
  const [clU, setClU] = useState(0)
  const [clUAlc, setClUAlc] = useState(0)
  const [osmM, setOsmM] = useState(0)
  const [osmC, setOsmC] = useState(0)
  const [phV, setPhV] = useState(0)

  const a = ph > 0 && pco2 > 0 && hco3 > 0 ? analisarGasometria({ ph, pco2, hco3, tempoRespiratorio: tempo === 'nao' ? undefined : tempo }) : null
  const ag = na > 0 && cl > 0 && hco3 > 0 ? anionGap(na, hco3, cl) : null
  const agc = ag !== null && alb > 0 ? anionGapCorrigido(ag, alb) : null
  const dd = (agc ?? ag) !== null && hco3 > 0 ? deltaDelta((agc ?? ag)!, hco3) : null
  const agu = naU > 0 && clU > 0 ? anionGapUrinario(naU, kU, clU) : null
  const clLeitura = clUAlc > 0 ? lerCloroUrinario(clUAlc) : null
  const go = osmM > 0 && osmC > 0 ? gapOsmolar(osmM, osmC) : null
  const phA = phV > 0 ? phArterialEstimado(phV) : null

  return (
    <ToolLayout
      title="Distúrbios acidobásicos — análise da gasometria"
      description="Acidemia ou alcalemia, distúrbio primário, compensação esperada (Winter e demais), ânion-gap corrigido, delta-delta, AG urinário, cloro urinário e gap osmolar, com as fórmulas do manual do HCFMUSP. Adulto (14 anos ou mais)."
      ficha={fichaGasometria}
    >
      <Bloco titulo="Gasometria" descricao="Referência: pH 7,35–7,45; HCO3 21–27 mEq/L; pCO2 35–45 mmHg (Tab. 1, p. 931).">
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="gas-ph" label="pH" value={ph} onChange={setPh} step={0.01} />
          <NumberField id="gas-pco2" label="pCO2" unit="mmHg" value={pco2} onChange={setPco2} />
          <NumberField id="gas-hco3" label="HCO3" unit="mEq/L" value={hco3} onChange={setHco3} step={0.1} />
        </div>
        <Escolha label="Distúrbio respiratório (se houver)" value={tempo} onChange={setTempo} opcoes={[{ value: 'nao', label: 'Mostrar agudo e crônico' }, { value: 'aguda', label: 'Agudo' }, { value: 'cronica', label: 'Crônico' }]} />
        {a && (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Resultado rotulo="Estado" valor={a.estado} />
              <Resultado rotulo="Distúrbio primário (Tab. 1)" valor={a.primarios.length ? a.primarios.join(' + ') : '—'} />
              <Resultado rotulo="pH por Henderson-Hasselbalch" valor={a.phCalculado === null ? '—' : br(a.phCalculado, 2)} />
            </div>
            {a.compensacoes.map((c) => (
              <Trecho key={c.primario + c.esperado} texto={`${c.primario[0].toUpperCase()}${c.primario.slice(1)} — ${c.esperado}. ${c.leitura}`} pagina={c.pagina} />
            ))}
            {a.observacoes.map((o) => <p key={o} className="text-atencao">{o}</p>)}
          </>
        )}
        <Trecho texto="Fórmulas: pH = 6,10 + log(HCO3 ÷ (0,03 × pCO2)); acidose metabólica: pCO2 = 1,5 × HCO3 + 8 ± 2 (Winter) ou HCO3 + 15; alcalose metabólica: pCO2 = 0,7 × (HCO3 − 24) + 40 ± 2; acidose respiratória: HCO3 +1 (aguda) ou +4–5 (crônica) por 10 mmHg de pCO2 acima de 40; alcalose respiratória: −2 (aguda) ou −4–5 (crônica) por 10 mmHg abaixo de 40." pagina="p. 931, 934, 938 e 942" errata={ERRATA_CORTES_FIGURAS} />
      </Bloco>

      <Bloco titulo="Ânion-gap e delta-delta" descricao="AG = Na − (HCO3 + Cl); referência 7–13 mEq/L (mais recentemente 3–10, média 6; cada laboratório define a sua) (p. 935). AG corrigido = AG + 2,5 × (4,0 − albumina) (p. 936). ΔAG = AG − 10; ΔHCO3 = 24 − HCO3 (p. 936).">
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="ag-na" label="Na" unit="mEq/L" value={na} onChange={setNa} />
          <NumberField id="ag-cl" label="Cl" unit="mEq/L" value={cl} onChange={setCl} />
          <NumberField id="ag-alb" label="Albumina" unit="g/dL" value={alb} onChange={setAlb} step={0.1} />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Resultado rotulo="Ânion-gap" valor={ag === null ? '—' : `${br(ag)} mEq/L`} />
          <Resultado rotulo="AG corrigido pela albumina" valor={agc === null ? '—' : `${br(agc)} mEq/L`} />
          <Resultado rotulo={`ΔAG/ΔHCO3${agc !== null ? ' (com AG corrigido)' : ''}`} valor={dd ? `${br(dd.razao, 2)} (ΔAG ${br(dd.deltaAG)}; ΔHCO3 ${br(dd.deltaHCO3)})` : '—'} />
        </div>
        {dd && <Trecho texto={`${dd.texto} O livro calcula a razão quando há acidose metabólica com AG aumentado.`} pagina="p. 936; Fig. 1, p. 944" />}
      </Bloco>

      <Bloco titulo="AG urinário (acidose com AG normal)" descricao="AG urinário = Na urinário + K urinário − Cl urinário (p. 936–937).">
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="agu-na" label="Na urinário" unit="mEq/L" value={naU} onChange={setNaU} />
          <NumberField id="agu-k" label="K urinário" unit="mEq/L" value={kU} onChange={setKU} />
          <NumberField id="agu-cl" label="Cl urinário" unit="mEq/L" value={clU} onChange={setClU} />
        </div>
        {agu && <Trecho texto={`AG urinário ${br(agu.valor)} mEq/L. ${agu.texto}`} pagina="p. 937" />}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead><tr className="text-tinta-sussurro"><th className="pr-2">ATR (Tab. 4, p. 937)</th><th className="pr-2">Grau</th><th className="pr-2">K sérico</th><th className="pr-2">pH urinário</th><th>AG urinário</th></tr></thead>
            <tbody>
              {TABELA_ATR.map((t) => <tr key={t.tipo}><td className="pr-2">{t.tipo}</td><td className="pr-2">{t.grau}</td><td className="pr-2">{t.potassio}</td><td className="pr-2">{t.phUrinario}</td><td>{t.agUrinario}</td></tr>)}
            </tbody>
          </table>
        </div>
      </Bloco>

      <Bloco titulo="Cloro urinário (alcalose metabólica)">
        <NumberField id="alc-clu" label="Cl urinário" unit="mEq/L" value={clUAlc} onChange={setClUAlc} />
        {clLeitura && <Trecho {...clLeitura} />}
      </Bloco>

      <Bloco titulo="Gap osmolar e gasometria venosa">
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="go-med" label="Osmolaridade medida" unit="mOsm/kg" value={osmM} onChange={setOsmM} />
          <NumberField id="go-calc" label="Osmolaridade calculada" unit="mOsm/kg" value={osmC} onChange={setOsmC} />
          <NumberField id="gv-ph" label="pH venoso periférico" value={phV} onChange={setPhV} step={0.01} />
        </div>
        {go && <Resultado rotulo="Gap osmolar (medida − calculada)" valor={`${br(go.valor)} mOsm/kg${go.acimaDe15 ? ' — acima de 15' : ''}`} />}
        <Trecho texto="Gap osmolar > 15 mOsm/kg aparece na fase precoce da intoxicação por álcoois tóxicos e tende a cair com a evolução. O livro não traz, neste trecho, a fórmula da osmolaridade calculada: informe-a." pagina="p. 1326 e 1512" />
        {phA && <Resultado rotulo="pH arterial estimado" valor={faixaBr(phA, 2)} />}
        <Trecho texto="pH venoso periférico ~0,02–0,04 menor que o arterial; HCO3 com diferença média de −1,41 mEq/L; pCO2 com diferença provável de 5,7 mmHg (pode não valer no choque); pO2 venosa não serve para avaliar hipoxemia." pagina="p. 932" />
      </Bloco>
    </ToolLayout>
  )
}

/** Bicarbonato de sódio no adulto: déficit, critério do livro e esquemas (CAD, hipercalemia). */
export function BicarbonatoAdulto() {
  const [peso, setPeso] = useState(0)
  const [hco3, setHco3] = useState(0)
  const [ph, setPh] = useState(0)
  const def = peso > 0 && hco3 > 0 ? deficitBicarbonato(peso, hco3) : null
  const crit = ph > 0 && hco3 > 0 ? criterioLaboratorialBicarbonato(ph, hco3) : null

  return (
    <ToolLayout
      title="Bicarbonato de sódio — déficit e esquemas"
      description="Déficit estimado de bicarbonato, critério laboratorial que o manual descreve e os preparos de NaHCO3 8,4% da cetoacidose e da hipercalemia, com mL/h. Adulto (14 anos ou mais)."
      ficha={fichaBicarbonato}
    >
      <Bloco titulo="Déficit de bicarbonato" descricao="Déficit = 0,6 × peso (kg) × (24 − HCO3). O livro diz que nunca deve ser totalmente reposto — não é uma meta (p. 938). NaHCO3 8,4% = 1 mEq/mL.">
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="bic-peso" label="Peso" unit="kg" value={peso} onChange={setPeso} step={0.1} />
          <NumberField id="bic-hco3" label="HCO3" unit="mEq/L" value={hco3} onChange={setHco3} step={0.1} />
          <NumberField id="bic-ph" label="pH" value={ph} onChange={setPh} step={0.01} />
        </div>
        {def !== null && <Resultado rotulo="Déficit total estimado" valor={`${br(def, 0)} mEq = ${br(def / NAHCO3_84_MEQ_POR_ML, 0)} mL de NaHCO3 8,4%`} />}
        {crit !== null && (
          <p className={crit ? 'text-atencao' : 'text-tinta-sussurro'}>
            {crit
              ? 'pH < 7,1 e HCO3 < 8 mEq/L: dentro do critério laboratorial que o livro descreve; o livro exige ainda quadro agudo e sintomático (p. 937).'
              : 'Fora do critério laboratorial que o livro descreve (pH < 7,1 com HCO3 < 8 mEq/L, em quadro agudo e sintomático) (p. 937).'}
          </p>
        )}
        {REFERENCIAS_BICARBONATO.map((r) => <Trecho key={r.texto} {...r} />)}
      </Bloco>

      {ESQUEMAS_BICARBONATO.map((e) => {
        const c = calcularEsquemaBic(e.id)!
        return (
          <Bloco key={e.id} titulo={e.id === 'cad' ? 'Cetoacidose diabética' : 'Hipercalemia'}>
            <Trecho texto={e.texto} pagina={e.pagina} />
            <div className="grid gap-3 sm:grid-cols-3">
              <Resultado rotulo="Bicarbonato" valor={`${br(c.mEq, 0)} mEq`} />
              <Resultado rotulo="Volume final" valor={`${br(c.volumeTotalMl, 0)} mL (${br(c.concentracaoMEqL, 0)} mEq/L)`} />
              <Resultado rotulo="Bomba" valor={`${faixaBr(c.mlH)} mL/h`} />
            </div>
          </Bloco>
        )
      })}
    </ToolLayout>
  )
}
