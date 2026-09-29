import { useState } from 'react'

import {
  APRESENTACOES_K, ERRATA_HIPOCALEMIA_P905, calcularKEV, classificarHipocalemia, deficitPotassio, esquemaHipocalemia, fichaReposicaoPotassio,
  interpretarKUrinario, quantidadeKVO,
} from '@/clinico/adulto/eletrolitos'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { Alertas, Bloco, Escolha, Resultado, Trecho } from './LoteAPecas'
import { br, faixaBr, informado } from './loteAFormato'

/** Hipocalemia no adulto: classificação, esquema do Anexo 5 e preparo do KCl EV/VO. */
export function ReposicaoPotassio() {
  const [k, setK] = useState(0)
  const [sint, setSint] = useState<'nao' | 'sim'>('nao')
  const [perda, setPerda] = useState<'nao' | 'sim'>('nao')

  const [mEq, setMEq] = useState(20)
  const [apres, setApres] = useState<'kcl-191' | 'kcl-10'>('kcl-191')
  const [diluente, setDiluente] = useState(500)
  const [horas, setHoras] = useState(2)

  const [mEqVO, setMEqVO] = useState(0)
  const [kAlvo, setKAlvo] = useState(0)
  const [k24, setK24] = useState(0)
  const [kCr, setKCr] = useState(0)
  const [naU, setNaU] = useState(0)
  const [osmU, setOsmU] = useState(0)
  const [osmP, setOsmP] = useState(0)

  const g = k > 0 ? classificarHipocalemia(k) : null
  const esq = k > 0 ? esquemaHipocalemia(k, { sintomatica: sint === 'sim', perdaUrinaria: perda === 'sim' }) : null
  const ev = calcularKEV({ mEq, apresentacao: apres, diluenteMl: diluente, horas })
  const def = k > 0 && kAlvo > k ? deficitPotassio(kAlvo - k) : null
  const urina = interpretarKUrinario({ k24h: informado(k24), kCrSpot: informado(kCr), naU: informado(naU), osmU: informado(osmU), osmP: informado(osmP) })

  return (
    <ToolLayout
      title="Hipocalemia — reposição de potássio"
      description="Classificação, esquema de reposição do Anexo 5 e preparo do KCl (volume, ampolas, concentração, mEq/h e mL/h) com os limites que o manual do HCFMUSP traz. Adulto (14 anos ou mais)."
      ficha={fichaReposicaoPotassio}
    >
      <Bloco titulo="Potássio sérico e esquema do manual" descricao="Anexo 5, p. 1498; classificação da p. 900.">
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="k-serico" label="K sérico" unit="mEq/L" value={k} onChange={setK} step={0.1} />
          <Escolha label="Sintomática (arritmia, fraqueza, rabdomiólise)" value={sint} onChange={setSint} opcoes={[{ value: 'nao', label: 'Não' }, { value: 'sim', label: 'Sim' }]} />
          <Escolha label="Perda urinária de K" value={perda} onChange={setPerda} opcoes={[{ value: 'nao', label: 'Não' }, { value: 'sim', label: 'Sim' }]} />
        </div>
        {g && <Resultado rotulo="Classificação (p. 900)" valor={g === 'sem hipocalemia' ? 'K ≥ 3,5 mEq/L: sem hipocalemia' : `Hipocalemia ${g}`} />}
        {esq && (
          <>
            <Trecho {...esq.referencia} />
            {esq.voMEqDia && <Resultado rotulo="VO no dia" valor={`${esq.voTexto} = ${faixaBr(esq.voMEqDia, 0)} mEq/dia`} />}
            {esq.ev && <Resultado rotulo="EV" valor={`${esq.ev.mEq} mEq em ${faixaBr(esq.ev.horas, 0)} h = ${faixaBr([esq.ev.mEq / esq.ev.horas[1], esq.ev.mEq / esq.ev.horas[0]])} mEq/h`} />}
          </>
        )}
        <Trecho texto="Classificação usada: leve 3–3,4; moderada 2,5–2,9; grave < 2,5 mEq/L." pagina="p. 900" errata={ERRATA_HIPOCALEMIA_P905} />
      </Bloco>

      <Bloco titulo="Preparo EV de KCl" descricao="Velocidade usual 10–20 mEq/h (até 40 só se ameaçadora à vida); concentração 20–60 mEq/L em SF para veia periférica; bomba de infusão (p. 905 e 1498).">
        <Escolha label="Apresentação" value={apres} onChange={setApres} opcoes={[{ value: 'kcl-191', label: 'KCl 19,1% (25 mEq/10 mL)' }, { value: 'kcl-10', label: 'KCl 10% (13,4 mEq/10 mL)' }]} />
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="k-meq" label="Dose de K" unit="mEq" value={mEq} onChange={setMEq} />
          <NumberField id="k-dil" label="Diluente (SF)" unit="mL" value={diluente} onChange={setDiluente} step={10} />
          <NumberField id="k-horas" label="Tempo" unit="h" value={horas} onChange={setHoras} step={0.5} />
        </div>
        {ev ? (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Resultado rotulo="Volume de KCl" valor={`${br(ev.volumeKClMl)} mL (${ev.ampolas} ampola${ev.ampolas > 1 ? 's' : ''} de 10 mL)`} />
              <Resultado rotulo="Volume final" valor={`${br(ev.volumeTotalMl)} mL`} />
              <Resultado rotulo="Concentração final" valor={`${br(ev.concentracaoMEqL)} mEq/L`} />
              <Resultado rotulo="Velocidade de K" valor={`${br(ev.mEqH)} mEq/h`} />
              <Resultado rotulo="Bomba" valor={`${br(ev.mlH)} mL/h`} />
            </div>
            <Alertas itens={ev.alertas} />
          </>
        ) : <p className="text-tinta-sussurro">Informe dose e tempo.</p>}
      </Bloco>

      <Bloco titulo="Reposição VO" descricao="Xarope 6%: 15 mL = 12 mEq; cápsula 600 mg = 8 mEq (Tab. 4, p. 907; p. 1498).">
        <NumberField id="k-vo" label="Dose VO" unit="mEq" value={mEqVO} onChange={setMEqVO} />
        {mEqVO > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Resultado rotulo={APRESENTACOES_K[2].nome} valor={`${br(quantidadeKVO(mEqVO, 'xarope-6'))} mL`} />
            <Resultado rotulo={APRESENTACOES_K[3].nome} valor={`${br(quantidadeKVO(mEqVO, 'capsula-600'))} cápsulas`} />
          </div>
        )}
      </Bloco>

      <Bloco titulo="Déficit corporal estimado" descricao="Cada 1 mEq/L de queda no K corresponde a ~200–400 mEq de perda corporal, se o déficit é verdadeiro (p. 905). Na hipocalemia por influxo celular há risco de hipercalemia rebote.">
        <NumberField id="k-alvo" label="K de referência para a conta" unit="mEq/L" value={kAlvo} onChange={setKAlvo} step={0.1} />
        {def ? <Resultado rotulo={`Queda de ${br(kAlvo - k)} mEq/L`} valor={`${faixaBr(def, 0)} mEq`} /> : <p className="text-tinta-sussurro">Informe o K sérico (acima) e um K de referência maior que ele.</p>}
      </Bloco>

      <Bloco titulo="Excreção urinária de K" descricao="Tab. 2 (p. 903) e Fig. 1 (p. 906). O K urinário em amostra isolada é pouco acurado e não é interpretado aqui.">
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="k-24" label="K urinário 24 h" unit="mEq/dia" value={k24} onChange={setK24} />
          <NumberField id="k-cr" label="K/Cr urinário (spot)" unit="mEq/g" value={kCr} onChange={setKCr} step={0.1} />
          <NumberField id="k-nau" label="Na urinário" unit="mEq/L" value={naU} onChange={setNaU} />
          <NumberField id="k-osmu" label="Osm urinária" unit="mOsm/kg" value={osmU} onChange={setOsmU} />
          <NumberField id="k-osmp" label="Osm plasmática" unit="mOsm/kg" value={osmP} onChange={setOsmP} />
        </div>
        {urina.map((u) => <Trecho key={u.texto} {...u} />)}
      </Bloco>
    </ToolLayout>
  )
}
