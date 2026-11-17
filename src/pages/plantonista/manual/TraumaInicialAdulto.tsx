import { useState } from 'react'

import {
  ALIQUOTA_TRAUMA_ML, DIFERENCAS_TRAUMA, DIRETRIZ_TRAUMA, ERRATA_TRAUMA, NOTA_ENSAIOS_NEGATIVOS_TRAUMA, NOTA_PATCH_TRAUMA, RMC_ADULTO, TORACOLOMBAR, TORNIQUETE_MAX_MIN, TRAUMA_REFERENCIAS, TXA_TRAUMA,
  cristaloideAcumulado, fichaTraumaAdulto, hemotorax, torniqueteRestante, txaTrauma,
} from '@/clinico/adulto/trauma'
import { textoFontes } from '@/clinico/ficha'
import { passosDaFaixa } from '@/clinico/guia'
import { guiaDa } from '@/clinico/guias'
import { NumberField } from '@/components/plantonista/NumberField'
import { AbasResultado } from '@/components/plantonista/calc/AbasResultado'
import { ID_ABAS_RESULTADO, type IdAba } from '@/components/plantonista/calc/contexto'
import { BlocoComparacao } from '@/components/plantonista/calc/Evidencias'
import { ResumoFlutuante } from '@/components/plantonista/calc/ResumoFlutuante'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { textoCopia } from '@/domain/copiaCalculo'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

import { Resultado, Trecho } from './LoteAPecas'
import { br, faixaBr, informado } from './loteAFormato'
import { Bloco, LinhaManual } from './PecasLoteC'

const CRISTALOIDE = { abaixo: 'abaixo de 1 L', dentro: 'dentro de 1–3 L', acima: 'acima de 3 L' }

/** Atendimento inicial do politraumatizado (caps. 47–48 do manual do HCFMUSP): tempos e volumes. */
export function TraumaInicialAdulto() {
  const [minTrauma, setMinTrauma] = useState(0)
  const [drenIni, setDrenIni] = useState(0)
  const [drenSub, setDrenSub] = useState(0)
  const [drenH, setDrenH] = useState(0)
  const [minTorniquete, setMinTorniquete] = useState(0)
  const [cristal, setCristal] = useState(0)

  const txa = minTrauma > 0 ? txaTrauma(minTrauma) : null
  const hemo = drenIni > 0 ? hemotorax(drenIni, informado(drenSub), informado(drenH)) : null
  const torn = minTorniquete > 0 ? torniqueteRestante(minTorniquete) : null
  const cris = cristal > 0 ? cristaloideAcumulado(cristal) : null
  const [aba, setAba] = useState<IdAba>('proximos')
  const guia = guiaDa(fichaTraumaAdulto.id)
  const temResultado = txa !== null || hemo !== null || torn !== null || cris !== null
  const alertaHemo = !!hemo && (hemo.inicialAtinge || (hemo.debitoMlH !== null && hemo.debitoAtinge))
  const textoTxa = txa ? (txa.dentroDaJanela ? `dentro — faltam ${br(txa.minutosRestantes, 0)} min` : 'fora (3 h ou mais)') : null
  const textoTorn = torn === null ? null : torn >= 0 ? `faltam ${br(torn, 0)} min` : `passou ${br(-torn, 0)} min`
  const linhasHemo = hemo
    ? [
        `Inicial ${br(drenIni, 0)} mL: ${hemo.inicialAtinge ? 'igual ou superior a 1.500 mL — o livro fala em alta probabilidade de toracotomia de urgência' : 'abaixo de 1.500 mL'}.`,
        ...(hemo.debitoMlH !== null
          ? [`Subsequente ${br(hemo.debitoMlH, 0)} mL/h: ${hemo.debitoAtinge ? 'acima de 200 mL/h' : 'não passa de 200 mL/h'}${hemo.horasNaJanela === false ? ' (o livro fala nas próximas 2 a 4 horas; o período informado está fora disso)' : ''}.`]
          : []),
      ]
    : []
  const resumos = [
    ...(textoTxa ? [`TXA: janela de 3 h ${textoTxa}`] : []),
    ...(hemo ? [`dreno ${hemo.inicialAtinge ? '≥ 1.500 mL' : `${br(drenIni, 0)} mL`}${hemo.debitoMlH !== null ? ` · ${br(hemo.debitoMlH, 0)} mL/h` : ''}`] : []),
    ...(textoTorn ? [`torniquete: ${textoTorn}`] : []),
    ...(cris ? [`cristaloide ${CRISTALOIDE[cris]}`] : []),
  ]

  // Texto do "Copiar" (C4 = A): tempos e volumes informados, a leitura do livro de cada um e o esquema do ácido tranexâmico.
  const copia = temResultado
    ? textoCopia({
        ferramenta: 'Politraumatizado — tempos e volumes (adulto)',
        dados: [
          ['Tempo desde o trauma', minTrauma > 0 ? `${br(minTrauma, 0)} min` : ''],
          ['Drenagem inicial', drenIni > 0 ? `${br(drenIni, 0)} mL` : ''],
          ['Drenagem subsequente', drenSub > 0 ? `${br(drenSub, 0)} mL${drenH > 0 ? ` em ${br(drenH, 1)} h` : ''}` : ''],
          ['Torniquete aplicado há', minTorniquete > 0 ? `${br(minTorniquete, 0)} min` : ''],
          ['Cristaloide já infundido', cristal > 0 ? `${br(cristal, 0)} mL` : ''],
        ],
        resultado: [
          ...(textoTxa
            ? [
                `Ácido tranexâmico, janela de menos de 3 h: ${textoTxa} (${TXA_TRAUMA.pagina})`,
                `Esquema do livro: ${TXA_TRAUMA.bolusG} g IV em bolus em ${TXA_TRAUMA.bolusMin} min, seguido de ${TXA_TRAUMA.manutG} g IV ao longo de ${TXA_TRAUMA.manutH} h (bolus 100 mg/min · manutenção 125 mg/h · total 2 g)`,
              ]
            : []),
          ...(linhasHemo.length ? ['Hemotórax (p. 644–645):', ...linhasHemo.map((l) => `- ${l}`)] : []),
          ...(textoTorn ? [`Torniquete, até ${TORNIQUETE_MAX_MIN / 60} h (p. 646): ${textoTorn}`] : []),
          ...(cris ? [`Cristaloide em relação aos 1–3 L (p. 647): ${CRISTALOIDE[cris]}`] : []),
        ],
        fonte: textoFontes(fichaTraumaAdulto),
        versao: fichaTraumaAdulto.versao,
        quando: new Date(),
      })
    : undefined

  return (
    <ToolLayout
      title="Politraumatizado — tempos e volumes (adulto)"
      description="Janela e velocidade do ácido tranexâmico, débito do dreno no hemotórax, tempo de torniquete e cristaloide antes da transfusão, como o manual do HCFMUSP traz. Adulto (14 anos ou mais)."
      ficha={fichaTraumaAdulto}
    >
      <Bloco titulo="Ácido tranexâmico — CRASH-2 (p. 649)">
        <LinhaManual
          nome="Ácido tranexâmico"
          texto={`${TXA_TRAUMA.bolusG} g IV em bolus em ${TXA_TRAUMA.bolusMin} min, seguido de ${TXA_TRAUMA.manutG} g IV ao longo de ${TXA_TRAUMA.manutH} h, desde que com menos de ${TXA_TRAUMA.janelaH} h do trauma, na hemorragia conhecida ou suspeita`}
          conta={<>bolus 100 mg/min · manutenção 125 mg/h · total 2 g</>}
          pagina={TXA_TRAUMA.pagina}
          nota="O capítulo não traz apresentação nem diluição: a conta fica em mg/min e mg/h."
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="tr-min" label="Tempo desde o trauma" unit="min" value={minTrauma} onChange={setMinTrauma} step={5} />
          <Resultado rotulo="Janela de menos de 3 h" valor={textoTxa ?? '—'} />
        </div>
        <p role="note" className="rounded-controle border border-atencao/40 bg-alerta-atencao px-3 py-2 text-apoio text-atencao">{NOTA_PATCH_TRAUMA}</p>
      </Bloco>

      <Bloco titulo="Hemotórax (p. 644–645)">
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="tr-dren" label="Drenagem inicial" unit="mL" value={drenIni} onChange={setDrenIni} step={50} />
          <NumberField id="tr-drens" label="Drenagem subsequente" unit="mL" value={drenSub} onChange={setDrenSub} step={10} />
          <NumberField id="tr-drenh" label="Em" unit="h" value={drenH} onChange={setDrenH} step={0.5} />
        </div>
        {hemo && (
          <>
            <p className={hemo.inicialAtinge ? 'text-atencao' : ''}>
              Inicial {br(drenIni, 0)} mL: {hemo.inicialAtinge ? 'igual ou superior a 1.500 mL — o livro fala em alta probabilidade de toracotomia de urgência' : 'abaixo de 1.500 mL'}.
            </p>
            {hemo.debitoMlH !== null && (
              <p className={hemo.debitoAtinge ? 'text-atencao' : ''}>
                Subsequente {br(hemo.debitoMlH, 0)} mL/h: {hemo.debitoAtinge ? 'acima de 200 mL/h' : 'não passa de 200 mL/h'}
                {hemo.horasNaJanela === false && ' (o livro fala nas próximas 2 a 4 horas; o período informado está fora disso)'}.
              </p>
            )}
          </>
        )}
      </Bloco>

      <Bloco titulo="Circulação (p. 646–647)">
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="tr-torn" label="Torniquete aplicado há" unit="min" value={minTorniquete} onChange={setMinTorniquete} step={5} />
          <Resultado rotulo={`Até ${TORNIQUETE_MAX_MIN / 60} h (p. 646)`} valor={textoTorn ?? '—'} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="tr-cris" label="Cristaloide já infundido" unit="mL" value={cristal} onChange={setCristal} step={250} />
          <Resultado rotulo="Em relação aos 1–3 L (p. 647)" valor={cris ? CRISTALOIDE[cris] : '—'} />
          <Resultado rotulo="Alíquotas restritas (p. 646)" valor={`${faixaBr(ALIQUOTA_TRAUMA_ML, 0)} mL`} />
        </div>
        <p className="text-apoio text-tinta-sussurro">
          O livro: transfusão bem indicada em quem mantém instabilidade após 1–3 L de cristaloide ou com hemorragia moderada/grave persistente (p. 647). ABC score e
          metas de hipotensão permissiva têm telas próprias (transfusão maciça e ressuscitação volêmica).
        </p>
        <p role="note" className="rounded-controle border border-atencao/40 bg-alerta-atencao px-3 py-2 text-apoio text-atencao">{NOTA_ENSAIOS_NEGATIVOS_TRAUMA}</p>
      </Bloco>

      <Bloco titulo="Referências numéricas do capítulo">
        {TRAUMA_REFERENCIAS.map((t) => <Trecho key={t.texto} texto={t.texto} pagina={t.pagina} />)}
      </Bloco>

      <Bloco titulo="Coluna">
        <p className="text-apoio font-medium">Restrição de movimento da coluna — trauma contuso no adulto (cap. 48, Tabela 3, p. 664)</p>
        <ul className="list-disc pl-5 text-apoio">{RMC_ADULTO.map((x) => <li key={x}>{x}</li>)}</ul>
        <p className="text-apoio text-tinta-sussurro">Em trauma penetrante o livro diz que a restrição da coluna não é indicada (p. 670).</p>
        <p className="text-apoio font-medium">Coluna toracolombar ({TORACOLOMBAR.pagina})</p>
        <p className="text-apoio">Mecanismo de força importante: {TORACOLOMBAR.mecanismo.join('; ')}.</p>
        <p className="text-apoio">Exame da coluna: {TORACOLOMBAR.exame.join('; ')}.</p>
        <p className="text-apoio text-tinta-sussurro">{TORACOLOMBAR.texto}</p>
        <p className="text-apoio text-tinta-sussurro">NEXUS, regra canadense, MGAP e Triage-RTS têm telas próprias.</p>
      </Bloco>

      {/* Errata vai para "Armadilhas" e a diretriz europeia e a EAST para "Evidências" (C6 = A). */}
      <AbasResultado
        aba={aba}
        onAba={setAba}
        passos={passosDaFaixa(guia, undefined)}
        semResultado={!temResultado}
        armadilhas={[...ERRATA_TRAUMA.map((e) => `Errata — ${e}`), ...(guia?.armadilhas ?? [])]}
        ficha={fichaTraumaAdulto}
        guia={guia}
        comparacao={
          <BlocoComparacao titulo="Europeia 2023 e EAST 2025 — ao lado do manual" resumo="Sangramento e coagulopatia no trauma pela diretriz europeia de 2023 (1 = recomenda, 2 = sugere; A–C = qualidade), lida no texto integral, e ácido tranexâmico pela EAST 2025, lida no resumo. As doses e contas do manual na página continuam valendo.">
            <div className="overflow-x-auto">
              <Table variante="referencia" className="w-full min-w-[640px] text-left align-top text-apoio">
                <TableHeader className="text-tinta-sussurro"><TableRow><TableHead className="pr-3 pb-2">Tema</TableHead><TableHead className="pr-3 pb-2">Diretriz</TableHead><TableHead className="pr-3 pb-2">Manual do HC</TableHead></TableRow></TableHeader>
                <TableBody>{DIRETRIZ_TRAUMA.map((d) => <TableRow key={d.tema} className="border-t"><TableCell className="pr-3 py-2 font-medium">{d.tema}</TableCell><TableCell className="pr-3 py-2">{d.diretriz} <span className="text-tinta-sussurro">({d.fonte}; {d.grau})</span></TableCell><TableCell className="pr-3 py-2 text-tinta-sussurro">{d.livro}</TableCell></TableRow>)}</TableBody>
              </Table>
            </div>
            <ul className="list-disc pl-5 text-apoio text-tinta-sussurro">{DIFERENCAS_TRAUMA.map((d) => <li key={d}>{d}</li>)}</ul>
          </BlocoComparacao>
        }
      />
      <ResumoFlutuante
        principal={resumos.length ? resumos[0] : 'Informe tempos ou volumes'}
        detalhe={resumos.length > 1 ? resumos.slice(1).join(' · ') : undefined}
        tom={alertaHemo ? 'atencao' : 'neutro'}
        textoCopia={copia}
        alvoDetalhes={ID_ABAS_RESULTADO}
        rotuloDetalhes="Próximos passos"
        aoIrDetalhes={() => setAba('proximos')}
      />
    </ToolLayout>
  )
}
