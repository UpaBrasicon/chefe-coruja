import { useState } from 'react'

import {
  DESMAME, DESMAME_OUTROS, DESMAME_SUBJETIVOS, FALHA_TRE_CLINICA, NOTA_AARC_TRE, NOTA_ATS_POS_EXTUBACAO, criteriosObjetivosDesmame, falhaTre, fichaDesmameAdulto,
} from '@/clinico/adulto/ventilacaoMecanica'
import { textoFontes } from '@/clinico/ficha'
import { passosDaFaixa } from '@/clinico/guia'
import { guiaDa } from '@/clinico/guias'
import { NumberField } from '@/components/plantonista/NumberField'
import { AbasResultado } from '@/components/plantonista/calc/AbasResultado'
import { ID_ABAS_RESULTADO, type IdAba } from '@/components/plantonista/calc/contexto'
import { ResumoFlutuante } from '@/components/plantonista/calc/ResumoFlutuante'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { textoCopia } from '@/domain/copiaCalculo'

import { Alertas, Bloco } from './LoteAPecas'
import { br, faixaBr, informado } from './loteAFormato'

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
  const [aba, setAba] = useState<IdAba>('proximos')
  const guia = guiaDa(fichaDesmameAdulto.id)
  const lidos = objetivos.filter((o) => o.atende !== null)
  const atendidos = lidos.filter((o) => o.atende).length
  const temResultado = lidos.length > 0 || algumTre
  const textoTre = falha.length
    ? `Critérios de falência da Figura 5 presentes: ${falha.join('; ')}`
    : 'Nenhum critério numérico de falência da Figura 5 nos valores informados'

  // Texto do "Copiar" (C4 = A): parâmetros antes do TRE, o que atende e os critérios de falência no teste.
  const copia = temResultado
    ? textoCopia({
        ferramenta: 'Desmame da ventilação mecânica (adulto)',
        dados: [
          ['PO2', po2 > 0 ? `${br(po2, 0)} mmHg` : ''],
          ['FiO2', fio2 > 0 ? `${br(fio2, 0)}%` : ''],
          ['PEEP', peep > 0 ? `${br(peep, 0)} cmH2O` : ''],
          ['FC', fc > 0 ? `${br(fc, 0)} bpm` : ''],
          ['FC no TRE', treFc > 0 ? `${br(treFc, 0)} bpm` : ''],
          ['FR no TRE', treFr > 0 ? `${br(treFr, 0)} rpm` : ''],
          ['SatO2 no TRE', treSat > 0 ? `${br(treSat, 0)}%` : ''],
          ['PAS no TRE', trePas > 0 ? `${br(trePas, 0)} mmHg` : ''],
        ],
        resultado: [
          ...(lidos.length ? ['Antes do TRE (Figura 5, p. 510):', ...lidos.map((o) => `- ${o.texto}: ${marca(o.atende)}`)] : []),
          ...(algumTre ? [`TRE (Figura 5, p. 510): ${textoTre}`] : []),
        ],
        fonte: textoFontes(fichaDesmameAdulto),
        versao: fichaDesmameAdulto.versao,
        quando: new Date(),
      })
    : undefined

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
        <p className="text-tinta-sussurro">"PEEP ≤ 5 a 8 cmH2O" é impresso assim; a tela mostra a posição em relação aos dois números.</p>
      </Bloco>

      <Bloco titulo="Teste de respiração espontânea" descricao={`PSV ${faixaBr(DESMAME.tre.psv, 0)} cmH2O por ${faixaBr(DESMAME.tre.minutos, 0)} min (Figura 5).`}>
        <p role="note" className="rounded-controle border border-atencao/40 bg-alerta-atencao px-3 py-2 text-apoio text-atencao">{NOTA_AARC_TRE}</p>
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
        <p className="text-tinta-sussurro">No fluxograma do livro, qualquer critério presente leva ao ramo de não extubar (reiniciar sedação se necessário e reajustar a VM); nenhum, ao ramo de extubação. A decisão é da equipe.</p>
        <p role="note" className="rounded-controle border border-atencao/40 bg-alerta-atencao px-3 py-2 text-apoio text-atencao">{NOTA_ATS_POS_EXTUBACAO}</p>
      </Bloco>

      <AbasResultado
        aba={aba}
        onAba={setAba}
        passos={passosDaFaixa(guia, undefined)}
        semResultado={!temResultado}
        armadilhas={guia?.armadilhas ?? []}
        ficha={fichaDesmameAdulto}
        guia={guia}
      />
      <ResumoFlutuante
        principal={algumTre ? (falha.length ? `TRE: ${falha.length} critério${falha.length > 1 ? 's' : ''} de falência` : 'TRE: nenhum critério numérico de falência') : lidos.length ? `Antes do TRE: ${atendidos} de ${lidos.length} atendido${lidos.length > 1 ? 's' : ''}` : 'Informe os parâmetros antes do TRE'}
        detalhe={algumTre && falha.length ? falha.join(' · ') : algumTre && lidos.length ? `Antes do TRE: ${atendidos} de ${lidos.length} atendido${lidos.length > 1 ? 's' : ''}` : undefined}
        tom={falha.length ? 'atencao' : 'neutro'}
        textoCopia={copia}
        alvoDetalhes={ID_ABAS_RESULTADO}
        rotuloDetalhes="Próximos passos"
        aoIrDetalhes={() => setAba('proximos')}
      />
    </ToolLayout>
  )
}
