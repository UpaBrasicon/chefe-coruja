import { useState } from 'react'

import { DESMAME, DESMAME_OUTROS, DESMAME_SUBJETIVOS, FALHA_TRE_CLINICA, criteriosObjetivosDesmame, falhaTre, fichaDesmameAdulto } from '@/clinico/adulto/ventilacaoMecanica'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { Alertas, Bloco } from './LoteAPecas'
import { faixaBr, informado } from './loteAFormato'

const marca = (a: boolean | null) => (a === null ? '—' : a ? 'atende' : 'não atende')

/** Desmame e teste de respiração espontânea — Figura 5 do cap. 37 do manual do HCFMUSP. */
export function DesmameVmAdulto() {
  const [po2, setPo2] = useState(0)
  const [fio2, setFio2] = useState(0)
  const [peep, setPeep] = useState(0)
  const [fc, setFc] = useState(0)
  const [treFc, setTreFc] = useState(0)
  const [treFr, setTreFr] = useState(0)
  const [treSat, setTreSat] = useState(0)
  const [trePas, setTrePas] = useState(0)

  const objetivos = criteriosObjetivosDesmame({ po2: informado(po2), fio2Pct: informado(fio2), peep: informado(peep), fc: informado(fc) })
  const falha = falhaTre({ fc: informado(treFc), fr: informado(treFr), sat: informado(treSat), pas: informado(trePas) })
  const algumTre = treFc > 0 || treFr > 0 || treSat > 0 || trePas > 0

  return (
    <ToolLayout
      title="Desmame da ventilação mecânica (adulto)"
      description="Parâmetros para o teste de respiração espontânea e critérios de falência durante o teste, como a Figura 5 do cap. 37 do manual do HCFMUSP traz. Adulto (14 anos ou mais)."
      ficha={fichaDesmameAdulto}
    >
      <Bloco titulo="Antes do TRE — parâmetros (Figura 5, p. 510)" descricao="Fluxograma começa com a suspensão da sedação.">
        <p className="font-medium">Subjetivos</p>
        <ul className="list-disc pl-5">{DESMAME_SUBJETIVOS.map((i) => <li key={i}>{i}</li>)}</ul>
        <p className="font-medium">Objetivos numéricos</p>
        <div className="grid gap-4 sm:grid-cols-4">
          <NumberField id="dm-po2" label="PO2" unit="mmHg" value={po2} onChange={setPo2} step={1} />
          <NumberField id="dm-fio2" label="FiO2" unit="%" value={fio2} onChange={setFio2} step={5} />
          <NumberField id="dm-peep" label="PEEP" unit="cmH2O" value={peep} onChange={setPeep} step={1} />
          <NumberField id="dm-fc" label="FC" unit="bpm" value={fc} onChange={setFc} step={1} />
        </div>
        <ul className="flex flex-col gap-1">{objetivos.map((o) => <li key={o.texto}>{o.texto}: <strong>{marca(o.atende)}</strong></li>)}</ul>
        <p className="font-medium">Outros objetivos (Figura 5)</p>
        <ul className="list-disc pl-5">{DESMAME_OUTROS.map((i) => <li key={i}>{i}</li>)}</ul>
        <p className="text-muted-foreground">"PEEP ≤ 5 a 8 cmH2O" é impresso assim; a tela mostra a posição em relação aos dois números.</p>
      </Bloco>

      <Bloco titulo="Teste de respiração espontânea" descricao={`PSV ${faixaBr(DESMAME.tre.psv, 0)} cmH2O por ${faixaBr(DESMAME.tre.minutos, 0)} min (Figura 5).`}>
        <div className="grid gap-4 sm:grid-cols-4">
          <NumberField id="dm-tfc" label="FC no TRE" unit="bpm" value={treFc} onChange={setTreFc} step={1} />
          <NumberField id="dm-tfr" label="FR no TRE" unit="rpm" value={treFr} onChange={setTreFr} step={1} />
          <NumberField id="dm-tsat" label="SatO2 no TRE" unit="%" value={treSat} onChange={setTreSat} step={1} />
          <NumberField id="dm-tpas" label="PAS no TRE" unit="mmHg" value={trePas} onChange={setTrePas} step={1} />
        </div>
        {algumTre && (falha.length
          ? <><p>Critérios de falência da Figura 5 presentes:</p><Alertas itens={falha} /></>
          : <p>Nenhum critério numérico de falência da Figura 5 nos valores informados (FC &gt; 140, FR &gt; 35, SatO2 &lt; 90%, PAS &gt; 180 ou &lt; 90).</p>)}
        <p className="font-medium">Critérios clínicos de falência (Figura 5)</p>
        <ul className="list-disc pl-5">{FALHA_TRE_CLINICA.map((i) => <li key={i}>{i}</li>)}</ul>
        <p className="text-muted-foreground">No fluxograma do livro, qualquer critério presente leva ao ramo de não extubar (reiniciar sedação se necessário e reajustar a VM); nenhum, ao ramo de extubação. A decisão é da equipe.</p>
      </Bloco>
    </ToolLayout>
  )
}
