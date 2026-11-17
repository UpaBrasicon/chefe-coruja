import { useState } from 'react'

import {
  ESQUEMAS_MG, capsulasCloretoMg, classificarMagnesio, faixaReposicaoMgEstavel, fichaReposicaoMagnesio, infusaoMagnesio, magnesioUnidades,
} from '@/clinico/adulto/eletrolitos'
import { textoFontes } from '@/clinico/ficha'
import { passosDaFaixa } from '@/clinico/guia'
import { guiaDa } from '@/clinico/guias'
import { AbasResultado } from '@/components/plantonista/calc/AbasResultado'
import { ID_ABAS_RESULTADO, type IdAba } from '@/components/plantonista/calc/contexto'
import { ResumoFlutuante } from '@/components/plantonista/calc/ResumoFlutuante'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { textoCopia } from '@/domain/copiaCalculo'

import { Bloco, Escolha, Resultado, Trecho } from './LoteAPecas'
import { br, faixaBr } from './loteAFormato'

/** Hipomagnesemia no adulto: faixas, esquemas por contexto e preparo do MgSO4 10%. */
export function ReposicaoMagnesio() {
  const [mg, setMg] = useState(0)
  const [gramas, setGramas] = useState(2)
  const [diluente, setDiluente] = useState(100)
  const [minutos, setMinutos] = useState(60)
  const [drc, setDrc] = useState<'nao' | 'sim'>('nao')
  const [mgVO, setMgVO] = useState(0)
  const [aba, setAba] = useState<IdAba>('proximos')
  const guia = guiaDa(fichaReposicaoMagnesio.id)

  const g = mg > 0 ? classificarMagnesio(mg) : null
  const un = mg > 0 ? magnesioUnidades(mg) : null
  const faixa = mg > 0 ? faixaReposicaoMgEstavel(mg) : null
  const inf = infusaoMagnesio({ gramas, diluenteMl: diluente, minutos, clcrMenor30: drc === 'sim' })
  const caps = capsulasCloretoMg(mgVO)
  const textoFaixa = g === 'sem hipomagnesemia' ? 'Mg ≥ 2 mg/dL: sem hipomagnesemia' : g === 'hipomagnesemia' ? 'Hipomagnesemia (sem gravidade nomeada no livro)' : `Hipomagnesemia ${g}`

  // Texto do "Copiar" (C4 = A): Mg, faixa, esquema do anexo e o preparo EV.
  const copia = () =>
    textoCopia({
      ferramenta: 'Hipomagnesemia — reposição de magnésio (adulto)',
      dados: [
        ['Mg sérico', mg > 0 ? `${br(mg)} mg/dL` : ''],
        ['DRC com ClCr < 30', drc === 'sim' ? 'sim' : 'não'],
      ],
      resultado: [
        ...(g ? [`Faixa (Anexo 5, p. 1501): ${textoFaixa}`] : []),
        ...(un ? [`Equivalente: ${br(un.mmolL, 2)} mmol/L · ${br(un.mEqL, 2)} mEq/L`] : []),
        ...(faixa ? [`${faixa.referencia.texto} (${faixa.referencia.pagina})`] : []),
        ...(inf
          ? [
              `Preparo EV: ${br(inf.gramas, 2)} g = ${br(inf.ml10)} mL de MgSO4 10% em ${diluente} mL por ${minutos} min${drc === 'sim' ? ' (dose reduzida em 50%, p. 1502)' : ''}`,
              `${br(inf.mEq)} mEq · ${br(inf.mmol)} mmol · volume final ${br(inf.volumeTotalMl)} mL · bomba ${br(inf.mlH)} mL/h · ${br(inf.gH, 2)} g/h (p. 1501)`,
            ]
          : []),
        ...(caps ? [`VO: ${br(mgVO)} mg de Mg elementar/dia = ${faixaBr(caps)} cápsulas/dia de cloreto de Mg (p. 1502)`] : []),
      ],
      fonte: textoFontes(fichaReposicaoMagnesio),
      versao: fichaReposicaoMagnesio.versao,
      quando: new Date(),
    })

  return (
    <ToolLayout
      title="Hipomagnesemia — reposição de magnésio"
      description="Faixas do Anexo 5, esquemas de sulfato de magnésio que o manual do HCFMUSP traz por contexto e preparo (mL de MgSO4 10%, mEq, mmol, mL/h). Adulto (14 anos ou mais)."
      ficha={fichaReposicaoMagnesio}
    >
      <Bloco titulo="Magnésio sérico" descricao="Hipomagnesemia < 2 mg/dL; moderada 1–1,5; grave < 1 (Anexo 5, p. 1501).">
        <NumberField id="mg-serico" label="Mg sérico" unit="mg/dL" value={mg} onChange={setMg} step={0.1} />
        {g && un && (
          <div className="grid gap-3 sm:grid-cols-3">
            <Resultado rotulo="Faixa" valor={textoFaixa} />
            <Resultado rotulo="Equivalente" valor={`${br(un.mmolL, 2)} mmol/L · ${br(un.mEqL, 2)} mEq/L`} />
          </div>
        )}
        {faixa && <Trecho {...faixa.referencia} />}
        {mg > 0 && !faixa && g !== 'sem hipomagnesemia' && <p className="text-tinta-sussurro">Valor entre as faixas de reposição EV do paciente estável que o livro traz (&lt; 1; 1–1,5; 1,6–1,9 mg/dL).</p>}
      </Bloco>

      <Bloco titulo="Esquemas que o manual traz" descricao="Conversões: MgSO4 10% 1 g = 10 mL = 8 mEq = 4 mmol; 1 mmol = 2 mEq = 24 mg de Mg elementar = 240 mg de MgSO4 (p. 1501).">
        {/* A errata do livro (12–25 h → 12–24 h) vai para a aba "Armadilhas" (C6 = A); o texto do esquema já traz 12–24 h. */}
        {ESQUEMAS_MG.map((e) => <Trecho key={e.id} texto={e.texto} pagina={e.pagina} />)}
      </Bloco>

      <Bloco titulo="Preparo EV de MgSO4 10%">
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="mg-g" label="Dose de MgSO4" unit="g" value={gramas} onChange={setGramas} step={0.5} />
          <NumberField id="mg-dil" label="Diluente" unit="mL" value={diluente} onChange={setDiluente} step={10} />
          <NumberField id="mg-min" label="Tempo" unit="min" value={minutos} onChange={setMinutos} step={5} />
        </div>
        <Escolha label="DRC com ClCr < 30 mL/min/1,73 m² (dose reduzida em 50%, p. 1502)" value={drc} onChange={setDrc} opcoes={[{ value: 'nao', label: 'Não' }, { value: 'sim', label: 'Sim' }]} />
        {inf ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <Resultado rotulo="Dose" valor={`${br(inf.gramas, 2)} g = ${br(inf.ml10)} mL de MgSO4 10%`} />
            <Resultado rotulo="Equivalente" valor={`${br(inf.mEq)} mEq · ${br(inf.mmol)} mmol`} />
            <Resultado rotulo="Volume final" valor={`${br(inf.volumeTotalMl)} mL`} />
            <Resultado rotulo="Bomba" valor={`${br(inf.mlH)} mL/h`} />
            <Resultado rotulo="Velocidade" valor={`${br(inf.gH, 2)} g/h`} />
          </div>
        ) : <p className="text-tinta-sussurro">Informe dose e tempo.</p>}
      </Bloco>

      <Bloco titulo="Reposição VO" descricao="Assintomático ou sintomas leves: 240–1.000 mg (20–80 mEq [10–40 mmol]) de Mg elementar em 2–3 tomadas; cloreto de Mg de liberação prolongada (64–71,5 mg de Mg elementar/cápsula) 4–8 cápsulas/dia; óxido de magnésio 800–1.600 mg (20–40 mmol [40–80 mEq])/dia (p. 1502).">
        <NumberField id="mg-vo" label="Mg elementar no dia" unit="mg" value={mgVO} onChange={setMgVO} step={10} />
        {caps && <Resultado rotulo="Cloreto de Mg (64–71,5 mg/cápsula)" valor={`${faixaBr(caps)} cápsulas/dia`} />}
      </Bloco>
      <AbasResultado
        aba={aba}
        onAba={setAba}
        passos={passosDaFaixa(guia, undefined)}
        semResultado={!g && !inf}
        armadilhas={[
          ...ESQUEMAS_MG.flatMap((e) => (e.errata ? [`Errata do livro (${e.pagina}): ${e.errata}`] : [])),
          ...(guia?.armadilhas ?? []),
        ]}
        ficha={fichaReposicaoMagnesio}
        guia={guia}
      />
      <ResumoFlutuante
        principal={g ? (g === 'sem hipomagnesemia' ? textoFaixa : `Mg ${br(mg)} mg/dL · ${g === 'hipomagnesemia' ? 'hipomagnesemia' : `hipomagnesemia ${g}`}`) : 'Informe o Mg sérico'}
        detalhe={inf ? `Preparo EV: ${br(inf.gramas, 2)} g = ${br(inf.ml10)} mL de MgSO4 10% · bomba ${br(inf.mlH)} mL/h` : undefined}
        tom={g === 'grave' ? 'critico' : 'neutro'}
        textoCopia={g || inf ? copia() : undefined}
        alvoDetalhes={ID_ABAS_RESULTADO}
        rotuloDetalhes="Próximos passos"
        aoIrDetalhes={() => setAba('proximos')}
      />
    </ToolLayout>
  )
}
