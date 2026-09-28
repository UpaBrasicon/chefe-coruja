import { useState } from 'react'

import {
  ATB_CIRROTICO_HDA, DIVERGENCIAS_ESCORES_HDA, ERITROMICINA_EDA, FORA_HDA, FORREST, INDICACAO_ATB_CIRROTICO, METAS_HDA, METAS_HDB, NOTA_CALIBRE_5MM, NOTA_FORRESTER,
  NOTA_HDB_MACICA, OMEPRAZOL_HDA, PROFILAXIA_VARIZES, VASOATIVOS_VARIZES, eritromicinaMg, fichaHemorragiaDigestiva, hdbMacica, indiceDeChoque,
  omeprazolAltaDose, referenciaForrest, testeOrtostatico, vasoativosTotais24h, type ClasseForrest,
} from '@/clinico/adulto/hemorragiaDigestiva'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { Bloco, Escolha, Resultado, Trecho } from './LoteAPecas'
import { br, faixaBr, informado } from './loteAFormato'
import { CampoPeso, LinhaManual } from './PecasLoteC'
import { Fora, ListaRef } from './PecasLoteE6'

/** Hemorragia digestiva alta e baixa (caps. 50–51 do manual do HCFMUSP). */
export function HemorragiaDigestivaAdulto() {
  const [peso, setPeso] = useState(0)
  const [pasD, setPasD] = useState(0)
  const [pasP, setPasP] = useState(0)
  const [fcD, setFcD] = useState(0)
  const [fcP, setFcP] = useState(0)
  const [fc, setFc] = useState(0)
  const [pas, setPas] = useState(0)
  const [quedaHt, setQuedaHt] = useState(0)
  const [ch, setCh] = useState(0)
  const [forrest, setForrest] = useState<ClasseForrest>('Ia')

  const orto = testeOrtostatico(pasD, pasP, fcD, fcP)
  const ic = indiceDeChoque(fc, pas)
  const mac = hdbMacica(informado(quedaHt), informado(ch))
  const ome = omeprazolAltaDose()
  const vaso = vasoativosTotais24h()
  const eri = eritromicinaMg(peso)
  const refF = referenciaForrest(forrest)
  const V = VASOATIVOS_VARIZES

  return (
    <ToolLayout
      title="Hemorragia digestiva alta e baixa — adulto"
      description="Metas, omeprazol, vasoativos no sangramento varicoso, antibiótico no cirrótico, Forrest e índice de choque, como o manual do HCFMUSP traz. Adulto (14 anos ou mais)."
      ficha={fichaHemorragiaDigestiva}
    >
      <CampoPeso id="hd-peso" peso={peso} onChange={setPeso} />

      <Bloco titulo="HDA — metas e gatilhos">
        <div className="grid gap-4 sm:grid-cols-4">
          <NumberField id="hd-pasd" label="PAS deitado" unit="mmHg" value={pasD} onChange={setPasD} />
          <NumberField id="hd-pasp" label="PAS em pé" unit="mmHg" value={pasP} onChange={setPasP} />
          <NumberField id="hd-fcd" label="FC deitado" unit="bpm" value={fcD} onChange={setFcD} />
          <NumberField id="hd-fcp" label="FC em pé" unit="bpm" value={fcP} onChange={setFcP} />
        </div>
        {orto && (
          <p>
            Queda da PAS {br(orto.quedaPas, 0)} mmHg; aumento da FC {br(orto.aumentoFc, 0)} bpm —{' '}
            {orto.positivo ? <strong>acima de 10: o livro associa a perda de pelo menos 1.000 mL (p. 696)</strong> : 'nenhuma variação acima de 10.'}
          </p>
        )}
        <ListaRef itens={METAS_HDA} />
      </Bloco>

      <Bloco titulo="Classificação de Forrest e IBP" descricao={NOTA_FORRESTER}>
        <Escolha label="Achado endoscópico" value={forrest} onChange={setForrest} opcoes={FORREST.map((f) => ({ value: f.classe, label: `${f.classe} — ${f.achado}` }))} />
        <Trecho texto={refF.texto} pagina={refF.pagina} />
        <LinhaManual nome="Omeprazol — dose alta" texto={OMEPRAZOL_HDA.texto} pagina={OMEPRAZOL_HDA.pagina}
          conta={<strong>{ome.bolusMg} mg bolus + {OMEPRAZOL_HDA.infusaoMgH} mg/h ({ome.mgDiaInfusao} mg/dia) = {ome.totalMg} mg em 72 h</strong>}
          nota={OMEPRAZOL_HDA.semPreparo} />
        <LinhaManual nome="Eritromicina antes da EDA" texto={ERITROMICINA_EDA.texto} pagina={ERITROMICINA_EDA.pagina}
          conta={eri ? <strong>{br(eri, 0)} mg, {faixaBr(ERITROMICINA_EDA.janelaMin, 0)} min antes</strong> : 'informe o peso'} />
      </Bloco>

      <Bloco titulo="Sangramento varicoso — vasoativos" descricao={V.semPreparo}>
        <LinhaManual nome="Terlipressina" texto={V.terlipressina.texto} pagina={V.terlipressina.pagina}
          conta={<strong>{faixaBr(V.terlipressina.ataqueMg, 0)} mg; depois {faixaBr(vaso.terlipressinaMgDia, 0)} mg/dia</strong>} nota={V.semDuracao} />
        <LinhaManual nome="Somatostatina" texto={V.somatostatina.texto} pagina={V.somatostatina.pagina}
          conta={<strong>{V.somatostatina.bolusUg} µg; {faixaBr(vaso.somatostatinaUgDia, 0)} µg/dia</strong>} />
        <LinhaManual nome="Octreotídeo" texto={V.octreotideo.texto} pagina={V.octreotideo.pagina}
          conta={<strong>{V.octreotideo.bolusUg} µg; {br(vaso.octreotideoUgDia, 0)} µg/dia</strong>} />
      </Bloco>

      <Bloco titulo="Cirrótico com ascite e HDA — antibiótico" descricao={`${INDICACAO_ATB_CIRROTICO.texto} (${INDICACAO_ATB_CIRROTICO.pagina}).`}>
        {ATB_CIRROTICO_HDA.map((a) => <LinhaManual key={a.droga} nome={a.droga} texto={a.texto} pagina={a.pagina} errata={a.errata} />)}
      </Bloco>

      <Bloco titulo="Profilaxia de sangramento varicoso" descricao={NOTA_CALIBRE_5MM}>
        <ListaRef itens={PROFILAXIA_VARIZES} />
      </Bloco>

      <Bloco titulo="HDB — índice de choque e HDB maciça" descricao={NOTA_HDB_MACICA}>
        <div className="grid gap-4 sm:grid-cols-4">
          <NumberField id="hd-fc" label="FC" unit="bpm" value={fc} onChange={setFc} />
          <NumberField id="hd-pas" label="PAS" unit="mmHg" value={pas} onChange={setPas} />
          <NumberField id="hd-ht" label="Queda do Ht" unit="pontos" value={quedaHt} onChange={setQuedaHt} step={0.5} />
          <NumberField id="hd-ch" label="CH transfundidos" value={ch} onChange={setCh} />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Resultado rotulo="Índice de choque (FC/PAS)" valor={ic ? `${br(ic.indice, 2)}${ic.acimaDe1 ? ' — > 1 (instável, p. 714)' : ''}` : 'informe FC e PAS'} />
          <Resultado rotulo="Queda do Ht > 8 pontos" valor={quedaHt > 0 ? (mac.quedaHt ? 'sim' : 'não') : '—'} />
          <Resultado rotulo="Mais de 2 CH" valor={ch > 0 ? (mac.transfusao ? 'sim' : 'não') : '—'} />
        </div>
        <ListaRef itens={METAS_HDB} />
        <p className="text-muted-foreground">Escore de Oakland em ferramenta própria.</p>
      </Bloco>

      <Bloco titulo="Escores de HDA: diferenças do livro" descricao="Glasgow-Blatchford, Rockall e AIMS65 já existem no produto e não foram alterados.">
        <ListaRef itens={DIVERGENCIAS_ESCORES_HDA} />
      </Bloco>

      <Bloco titulo="O que o manual não traz">
        <Fora itens={FORA_HDA} />
      </Bloco>
    </ToolLayout>
  )
}
