import { useState } from 'react'

import {
  BOLUS_CALCIO, CALCIO, DIFERENCAS_CALCIO, DIRETRIZ_CALCIO, INFUSAO_CALCIO, TABELA7_HIPERCALCEMIA, calcioCorrigido, calcioElementar, comprimidosCarbonato, fichaHipercalcemia,
  fichaReposicaoCalcio, fracaoExcrecaoCalcio, infusaoCalcioDose, infusaoCalcioMlH, lerCalcioTotal, tratamentoHipercalcemia, velocidadeBolus,
  type SalCalcio,
} from '@/clinico/adulto/eletrolitos'
import { textoFontes } from '@/clinico/ficha'
import { passosDaFaixa } from '@/clinico/guia'
import { guiaDa } from '@/clinico/guias'
import { AbasResultado } from '@/components/plantonista/calc/AbasResultado'
import { ID_ABAS_RESULTADO, type IdAba } from '@/components/plantonista/calc/contexto'
import { BlocoComparacao } from '@/components/plantonista/calc/Evidencias'
import { ResumoFlutuante } from '@/components/plantonista/calc/ResumoFlutuante'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { textoCopia } from '@/domain/copiaCalculo'

import { Alertas, Bloco, Escolha, Resultado, Trecho } from './LoteAPecas'
import { br, faixaBr } from './loteAFormato'

// Tabela de comparação com as diretrizes vai para a aba "Evidências" (C6 = A); as doses do manual não mudam.
function DiretrizCalcio({ parte, titulo }: { parte: 'hipo' | 'hiper'; titulo: string }) {
  const linhas = DIRETRIZ_CALCIO.filter((d) => d.parte === parte)
  return (
    <BlocoComparacao titulo={titulo} resumo="Endocrine Society 2023 (hipercalcemia da malignidade; GRADE) e Society for Endocrinology 2016 (orientações de emergência), lidas no texto integral. Os cortes em mmol/L são das diretrizes; os em mg/dL, a conversão aproximada. As doses e contas do manual acima continuam valendo.">
      <div className="overflow-x-auto">
        <Table variante="referencia" className="w-full min-w-[640px] text-left align-top text-apoio">
          <TableHeader className="text-tinta-sussurro"><TableRow><TableHead className="pr-3 pb-2">Tema</TableHead><TableHead className="pr-3 pb-2">Diretriz</TableHead><TableHead className="pr-3 pb-2">Manual do HC</TableHead></TableRow></TableHeader>
          <TableBody>{linhas.map((d) => <TableRow key={d.tema} className="border-t"><TableCell className="pr-3 py-2 font-medium">{d.tema}</TableCell><TableCell className="pr-3 py-2">{d.diretriz} <span className="text-tinta-sussurro">({d.fonte}; {d.grau})</span></TableCell><TableCell className="pr-3 py-2 text-tinta-sussurro">{d.livro}</TableCell></TableRow>)}</TableBody>
        </Table>
      </div>
      {parte === 'hiper' && <ul className="list-disc pl-5 text-apoio text-tinta-sussurro">{DIFERENCAS_CALCIO.map((d) => <li key={d}>{d}</li>)}</ul>}
    </BlocoComparacao>
  )
}

/** Cálcio corrigido (se houver albumina) e a leitura do livro; a mesma conta para a tela, o resumo e o "Copiar". */
function lerCalcio(ca: number, alb: number) {
  const corr = ca > 0 && alb > 0 ? calcioCorrigido(ca, alb) : null
  const base = corr ?? (ca > 0 ? ca : null)
  const leitura = base !== null ? lerCalcioTotal(base) : null
  return { corr, base, leitura }
}

const ROTULO_FAIXA = { hipocalcemia: 'hipocalcemia', hipercalcemia: 'hipercalcemia', normal: 'entre 8,5 e 10,5 mg/dL' } as const

function textoCalcio(ca: number, alb: number) {
  const { corr, base, leitura } = lerCalcio(ca, alb)
  if (base === null || !leitura) return null
  return `Ca ${corr !== null ? 'corrigido ' : ''}${br(base)} mg/dL · ${ROTULO_FAIXA[leitura.faixa]}`
}

function CalcioSerico({ prefixo, ca, alb, onCa, onAlb }: { prefixo: string; ca: number; alb: number; onCa: (v: number) => void; onAlb: (v: number) => void }) {
  const { corr, leitura } = lerCalcio(ca, alb)
  return (
    <Bloco titulo="Cálcio total e correção pela albumina" descricao="Ca corrigido = Ca medido + [(4,0 − albumina) × 0,8], Ca em mg/dL e albumina em g/dL (p. 919). Alcalose reduz e acidose aumenta o cálcio iônico.">
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField id={`${prefixo}-ca`} label="Cálcio total medido" unit="mg/dL" value={ca} onChange={onCa} step={0.1} />
        <NumberField id={`${prefixo}-alb`} label="Albumina" unit="g/dL" value={alb} onChange={onAlb} step={0.1} />
      </div>
      {corr !== null && <Resultado rotulo="Cálcio corrigido" valor={`${br(corr)} mg/dL`} />}
      {leitura && leitura.referencias.map((r) => <Trecho key={r.texto} {...r} />)}
    </Bloco>
  )
}

/** Hipocalcemia no adulto: cálcio corrigido, bolus, infusão contínua e VO (cap. 68 e Anexo 5). */
export function ReposicaoCalcio() {
  const [ca, setCa] = useState(0)
  const [alb, setAlb] = useState(0)
  const [sal, setSal] = useState<SalCalcio>('gluconato')
  const [ml, setMl] = useState(10)
  const [dil, setDil] = useState(100)
  const [min, setMin] = useState(10)
  const [peso, setPeso] = useState(0)
  const [dose, setDose] = useState(0)
  const [mlh, setMlh] = useState(INFUSAO_CALCIO.inicioMlH)
  const [caVO, setCaVO] = useState(0)
  const [aba, setAba] = useState<IdAba>('proximos')
  const guia = guiaDa(fichaReposicaoCalcio.id)

  const el = calcioElementar(sal, ml)
  const vel = velocidadeBolus(ml, dil, min)
  const infMlH = dose > 0 ? infusaoCalcioMlH(dose, peso) : null
  const infDose = infusaoCalcioDose(mlh, peso)
  const foraFaixa = infDose !== null && (infDose < INFUSAO_CALCIO.faixaMgKgH[0] || infDose > INFUSAO_CALCIO.faixaMgKgH[1])
  const comp = comprimidosCarbonato(caVO)
  const rapido = min > 0 && min < 10
  const leituraCa = lerCalcio(ca, alb)
  const resumoCa = textoCalcio(ca, alb)

  // Texto do "Copiar" (C4 = A): cálcio lido, bolus, infusão contínua e VO, com a página.
  const copia = () =>
    textoCopia({
      ferramenta: 'Hipocalcemia — cálcio corrigido e reposição (adulto)',
      dados: [
        ['Cálcio total medido', ca > 0 ? `${br(ca)} mg/dL` : ''],
        ['Albumina', alb > 0 ? `${br(alb)} g/dL` : ''],
        ['Peso', peso > 0 ? `${br(peso)} kg` : ''],
      ],
      resultado: [
        ...(leituraCa.corr !== null ? [`Cálcio corrigido: ${br(leituraCa.corr)} mg/dL (p. 919)`] : []),
        ...(leituraCa.leitura ? leituraCa.leitura.referencias.map((r) => `${r.texto} (${r.pagina})`) : []),
        ...(el ? [`Bolus EV: ${br(ml)} mL de ${CALCIO[sal].nome} = ${br(el.mgCa, 0)} mg de Ca elementar · ${br(el.mEq)} mEq em ${br(dil)} mL por ${br(min)} min${vel !== null ? ` · bomba ${br(vel, 0)} mL/h` : ''} (Tab. 4, p. 922; p. 1500)`] : []),
        ...(rapido ? ['Mais rápido que 10 min: o livro associa a depressão miocárdica (Tab. 4, p. 922).'] : []),
        ...(peso > 0 && infMlH !== null ? [`Infusão contínua: ${br(dose)} mg/kg/h = ${br(infMlH)} mL/h (gluconato 10% 110 mL + 890 mL; p. 922 e 1500)`] : []),
        ...(peso > 0 && infDose !== null ? [`Infusão a ${br(mlh)} mL/h = ${br(infDose, 2)} mg/kg/h de Ca elementar`] : []),
        ...(foraFaixa ? ['Fora da faixa de 0,5–1,5 mg/kg/h que o manual traz.'] : []),
        ...(comp !== null ? [`VO: ${br(caVO)} mg de Ca elementar/dia = ${br(comp)} comprimidos/dia de carbonato de cálcio 1.250 mg (p. 1500)`] : []),
      ],
      fonte: textoFontes(fichaReposicaoCalcio),
      versao: fichaReposicaoCalcio.versao,
      quando: new Date(),
    })

  return (
    <ToolLayout
      title="Hipocalcemia — cálcio corrigido e reposição"
      description="Cálcio corrigido pela albumina, cálcio elementar do bolus, velocidade na bomba, infusão contínua em mg/kg/h e comprimidos de carbonato, como o manual do HCFMUSP traz. Adulto (14 anos ou mais)."
      ficha={fichaReposicaoCalcio}
    >
      <CalcioSerico prefixo="hipoca" ca={ca} alb={alb} onCa={setCa} onAlb={setAlb} />

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
        <Alertas itens={rapido ? ['Mais rápido que 10 min: o livro associa a depressão miocárdica (Tab. 4, p. 922).'] : []} />
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
      <AbasResultado
        aba={aba}
        onAba={setAba}
        passos={passosDaFaixa(guia, undefined)}
        semResultado={leituraCa.base === null && !el}
        armadilhas={[
          ...BOLUS_CALCIO.flatMap((b) => (b.errata ? [`Errata do livro (${CALCIO[b.sal].nome}): ${b.errata}`] : [])),
          ...(guia?.armadilhas ?? []),
        ]}
        ficha={fichaReposicaoCalcio}
        guia={guia}
        comparacao={<DiretrizCalcio parte="hipo" titulo="SfE 2016 (hipocalcemia) — ao lado do manual" />}
      />
      <ResumoFlutuante
        principal={resumoCa ?? 'Informe o cálcio total'}
        detalhe={el ? `Bolus: ${br(el.mgCa, 0)} mg de Ca elementar${vel !== null ? ` · bomba ${br(vel, 0)} mL/h` : ''}${rapido ? ' · mais rápido que 10 min' : ''}` : undefined}
        textoCopia={leituraCa.base !== null || el ? copia() : undefined}
        alvoDetalhes={ID_ABAS_RESULTADO}
        rotuloDetalhes="Próximos passos"
        aoIrDetalhes={() => setAba('proximos')}
      />
    </ToolLayout>
  )
}

/** Hipercalcemia no adulto: cálcio corrigido, FECa e as doses da Tab. 7 que dependem do peso. */
export function HipercalcemiaAdulto() {
  const [ca, setCa] = useState(0)
  const [alb, setAlb] = useState(0)
  const [peso, setPeso] = useState(0)
  const [caU, setCaU] = useState(0)
  const [fluxo, setFluxo] = useState(0)
  const [caP, setCaP] = useState(0)
  const [tfg, setTfg] = useState(0)
  const [aba, setAba] = useState<IdAba>('proximos')
  const guia = guiaDa(fichaHipercalcemia.id)
  const t = tratamentoHipercalcemia(peso)
  const feca = caU > 0 && fluxo > 0 ? fracaoExcrecaoCalcio({ caU, fluxoMlMin: fluxo, caP, tfgMlMin: tfg }) : null
  const leituraCa = lerCalcio(ca, alb)
  const resumoCa = textoCalcio(ca, alb)
  const temAlgo = leituraCa.base !== null || peso > 0 || feca !== null

  // Texto do "Copiar" (C4 = A): cálcio lido, doses da Tabela 7 e FECa, com a página.
  const copia = () =>
    textoCopia({
      ferramenta: 'Hipercalcemia — cálcio corrigido, FECa e tratamento agudo (adulto)',
      dados: [
        ['Cálcio total medido', ca > 0 ? `${br(ca)} mg/dL` : ''],
        ['Albumina', alb > 0 ? `${br(alb)} g/dL` : ''],
        ['Peso', peso > 0 ? `${br(peso)} kg` : ''],
        ['Ca urinário', feca !== null ? `${br(caU)} mg/dL` : ''],
        ['Fluxo urinário', feca !== null ? `${br(fluxo)} mL/min` : ''],
        ['Ca plasmático', feca !== null ? `${br(caP)} mg/dL` : ''],
        ['TFG', feca !== null ? `${br(tfg)} mL/min` : ''],
      ],
      resultado: [
        ...(leituraCa.corr !== null ? [`Cálcio corrigido: ${br(leituraCa.corr)} mg/dL (p. 919)`] : []),
        ...(leituraCa.leitura ? leituraCa.leitura.referencias.map((r) => `${r.texto} (${r.pagina})`) : []),
        'Tratamento agudo (Tabela 7, p. 927):',
        `- SF (como o livro traz): ${faixaBr(t.soroMlH, 0)} mL/h`,
        `- Pamidronato 90 mg + SF 250 mL em 2–4 h: ${faixaBr(t.pamidronatoMlH)} mL/h`,
        ...(t.prednisonaMg !== null ? [`- Prednisona 1 mg/kg: ${br(t.prednisonaMg)} mg`] : []),
        ...(t.calcitoninaUI !== null ? [`- Calcitonina 4–8 UI/kg IM ou SC 12/12 h por 48 h: ${faixaBr(t.calcitoninaUI, 0)} UI por dose`] : []),
        ...TABELA7_HIPERCALCEMIA.map((r) => `- ${r.texto} (${r.pagina})`),
        ...(feca !== null ? [`FECa: ${br(feca, 4)} — ${feca < 0.01 ? 'abaixo de 0,01' : 'igual ou acima de 0,01'} (p. 924–925)`] : []),
      ],
      fonte: textoFontes(fichaHipercalcemia),
      versao: fichaHipercalcemia.versao,
      quando: new Date(),
    })

  return (
    <ToolLayout
      title="Hipercalcemia — cálcio corrigido, FECa e tratamento agudo"
      description="Cortes de gravidade, fração de excreção de cálcio e as doses da Tabela 7 do manual do HCFMUSP (prednisona e calcitonina por peso, velocidades de SF e pamidronato). Adulto (14 anos ou mais)."
      ficha={fichaHipercalcemia}
    >
      <CalcioSerico prefixo="hiperca" ca={ca} alb={alb} onCa={setCa} onAlb={setAlb} />

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
      <AbasResultado
        aba={aba}
        onAba={setAba}
        passos={passosDaFaixa(guia, undefined)}
        semResultado={!temAlgo}
        armadilhas={[
          ...TABELA7_HIPERCALCEMIA.flatMap((r) => (r.errata ? [`Errata do livro (${r.pagina}): ${r.errata}`] : [])),
          ...(guia?.armadilhas ?? []),
        ]}
        ficha={fichaHipercalcemia}
        guia={guia}
        comparacao={<DiretrizCalcio parte="hiper" titulo="Endocrine Society 2023 e SfE 2016 (hipercalcemia) — ao lado do manual" />}
      />
      <ResumoFlutuante
        principal={resumoCa ?? 'Informe o cálcio total'}
        detalhe={peso > 0 ? `Adulto · ${br(peso)} kg · prednisona ${br(t.prednisonaMg ?? 0)} mg · calcitonina ${faixaBr(t.calcitoninaUI, 0)} UI por dose` : 'Tabela 7: informe o peso para as doses por kg'}
        tom={leituraCa.base !== null && leituraCa.base > 14 ? 'critico' : 'neutro'}
        textoCopia={temAlgo ? copia() : undefined}
        alvoDetalhes={ID_ABAS_RESULTADO}
        rotuloDetalhes="Próximos passos"
        aoIrDetalhes={() => setAba('proximos')}
      />
    </ToolLayout>
  )
}
