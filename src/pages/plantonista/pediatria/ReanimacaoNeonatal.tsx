import { useState } from 'react'

import { textoFontes } from '@/clinico/ficha'
import { passosDaFaixa } from '@/clinico/guia'
import { guiaDa } from '@/clinico/guias'
import { ADRENALINA, EXPANSOR_ML_KG, SEQUENCIA, SPO2_ALVO, dosesReanimacao, fichaReanimacaoNeonatal, marcaCanula } from '@/clinico/pediatria/reanimacaoNeonatal'
import { NumberField } from '@/components/plantonista/NumberField'
import { AbasResultado } from '@/components/plantonista/calc/AbasResultado'
import { ResumoFlutuante } from '@/components/plantonista/calc/ResumoFlutuante'
import { ID_ABAS_RESULTADO, type IdAba } from '@/components/plantonista/calc/contexto'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { numeroBr, textoCopia } from '@/domain/copiaCalculo'
import { numero } from '@/lib/formato'

import { Bloco, LinhaManual } from '../manual/PecasLoteC'

const n = (x: number, casas = 2) => numero(Math.round(x * 10 ** casas) / 10 ** casas)

const AVISO_ADRENALINA_MAXIMA = 'Adrenalina acima de 0,1 mg/kg não deve ser usada por nenhuma via no período neonatal (p. 32).'

/** Reanimação do RN ≥ 34 semanas em sala de parto (SBP 2026). */
export function ReanimacaoNeonatal() {
  const [peso, setPeso] = useState(0)
  const [ig, setIg] = useState(0)
  const d = dosesReanimacao(peso)
  const canula = ig > 0 ? marcaCanula(ig, peso > 0 ? peso * 1000 : undefined) : []
  const [aba, setAba] = useState<IdAba>('proximos')
  const guia = guiaDa(fichaReanimacaoNeonatal.id)
  const foraRn = peso > 6

  // Texto do "Copiar" (C3 e C4 = A): peso, IG, doses de adrenalina e expansor e a marca da cânula, com a página da SBP.
  const copia = d
    ? textoCopia({
        ferramenta: 'Reanimação do RN ≥ 34 semanas em sala de parto (SBP 2026)',
        dados: [
          ['Peso', `${numeroBr(peso)} kg`],
          ['Idade gestacional', ig > 0 ? `${numeroBr(ig)} semanas` : ''],
        ],
        resultado: [
          'Adrenalina sempre diluída: 1 mL da ampola de 1 mg/mL em 9 mL de SF (0,1 mg/mL), qualquer que seja a via (Quadro 8, p. 32).',
          `- Adrenalina intravascular (veia umbilical ou intraóssea): ${n(d.adrenalinaIvMl)} mL (${n(d.adrenalinaIvMg, 3)} mg) — ${n(ADRENALINA.intravascularMlKg, 1)} mL/kg da diluída (0,02 mg/kg), seringa de 1 mL, rápido, seguida de flush de ${ADRENALINA.flushMl} mL de SF; repetir a cada ${ADRENALINA.intervaloMin} min (Quadro 8, p. 32)`,
          `- Adrenalina traqueal (enquanto se faz o cateterismo): ${n(d.adrenalinaTraquealMl)} mL (${n(d.adrenalinaTraquealMg, 3)} mg) — ${n(ADRENALINA.traquealMlKg, 1)} mL/kg da diluída (0,1 mg/kg), seringa de 5 mL, no interior da cânula e ventilar — uso único; eficácia questionável (Quadro 8, p. 32)`,
          `- Expansor de volume — SF 0,9%: ${n(d.expansorMl, 0)} mL — ${EXPANSOR_ML_KG} mL/kg lentamente, em 5–10 minutos, se houver suspeita de hipovolemia (p. 33)`,
          AVISO_ADRENALINA_MAXIMA,
          ...(canula.length ? [`Cânula traqueal — marca no lábio superior (Quadro 4, p. 23): ${canula.map((c) => `${n(c.cm, 1)} cm (peso estimado ${c.peso[0]} a ${c.peso[1]} g)`).join(' ou ')}`] : []),
        ],
        fonte: textoFontes(fichaReanimacaoNeonatal),
        versao: fichaReanimacaoNeonatal.versao,
        quando: new Date(),
      })
    : undefined

  return (
    <ToolLayout
      title="Reanimação do RN ≥ 34 semanas em sala de parto"
      description="Sequência, saturação-alvo, cânula e doses de adrenalina e de expansor pela diretriz 2026 do Programa de Reanimação Neonatal da SBP."
      ficha={fichaReanimacaoNeonatal}
    >
      <Bloco titulo="Recém-nascido">
        <div className="grid gap-4 md:grid-cols-2">
          <NumberField id="rn-peso" label="Peso (estimado ou ao nascer)" unit="kg" value={peso} onChange={setPeso} min={0} step={0.1} />
          <NumberField id="rn-ig" label="Idade gestacional" unit="semanas" value={ig} onChange={setIg} min={0} />
        </div>
        {peso > 6 && <p className="text-apoio text-atencao">Peso fora da faixa de recém-nascido.</p>}
      </Bloco>

      <Bloco titulo="Medicações (Quadro 8, p. 32; p. 33)" descricao="Adrenalina sempre diluída: 1 mL da ampola de 1 mg/mL em 9 mL de SF (0,1 mg/mL), qualquer que seja a via.">
        <LinhaManual
          origem="A SBP traz"
          nome="Adrenalina intravascular (veia umbilical ou intraóssea)"
          texto={`${n(ADRENALINA.intravascularMlKg, 1)} mL/kg da diluída (0,02 mg/kg), seringa de 1 mL, rápido, seguida de flush de ${ADRENALINA.flushMl} mL de SF; repetir a cada ${ADRENALINA.intervaloMin} min`}
          conta={d ? <><strong>{n(d.adrenalinaIvMl)} mL</strong> ({n(d.adrenalinaIvMg, 3)} mg)</> : 'informe o peso'}
          pagina="Quadro 8, p. 32"
        />
        <LinhaManual
          origem="A SBP traz"
          nome="Adrenalina traqueal (enquanto se faz o cateterismo)"
          texto={`${n(ADRENALINA.traquealMlKg, 1)} mL/kg da diluída (0,1 mg/kg), seringa de 5 mL, no interior da cânula e ventilar — uso único; eficácia questionável`}
          conta={d ? <><strong>{n(d.adrenalinaTraquealMl)} mL</strong> ({n(d.adrenalinaTraquealMg, 3)} mg)</> : 'informe o peso'}
          pagina="Quadro 8, p. 32"
        />
        <LinhaManual
          origem="A SBP traz"
          nome="Expansor de volume — SF 0,9%"
          texto={`${EXPANSOR_ML_KG} mL/kg lentamente, em 5–10 minutos, se houver suspeita de hipovolemia`}
          conta={d ? <strong>{n(d.expansorMl, 0)} mL</strong> : 'informe o peso'}
          pagina="p. 33"
        />
        <p className="text-apoio text-atencao">{AVISO_ADRENALINA_MAXIMA}</p>
      </Bloco>

      <Bloco titulo="Sequência">
        {SEQUENCIA.map((s) => <LinhaManual key={s.passo} origem="A SBP traz" nome={s.passo} texto={s.texto} pagina={s.pagina} />)}
      </Bloco>

      <Bloco titulo="SpO2 alvo pré-ductal (Quadro 2, p. 15)">
        <Table variante="referencia" className="w-full max-w-sm text-left text-apoio">
          <TableHeader className="text-tinta-sussurro"><TableRow><TableHead className="pb-2">Minutos de vida</TableHead><TableHead className="pb-2">SpO2 alvo</TableHead></TableRow></TableHeader>
          <TableBody>{SPO2_ALVO.map((s) => <TableRow key={s.minuto} className="border-t"><TableCell className="py-1.5">{s.minuto}</TableCell><TableCell className="py-1.5">{s.faixa}</TableCell></TableRow>)}</TableBody>
        </Table>
      </Bloco>

      <Bloco titulo="Cânula traqueal — marca no lábio superior (Quadro 4, p. 23)">
        {ig > 0 ? (
          canula.length ? (
            canula.map((c) => <p key={c.cm} className="text-apoio text-tinta">{n(c.cm, 1)} cm <span className="text-tinta-sussurro">(peso estimado {c.peso[0]} a {c.peso[1]} g)</span></p>)
          ) : <p className="text-apoio text-tinta-sussurro">O Quadro 4 vai de 33 a 43 semanas.</p>
        ) : <p className="text-apoio text-tinta-sussurro">Informe a idade gestacional.</p>}
        {canula.length > 1 && <p className="text-apoio text-tinta-sussurro">Com 40 semanas o quadro tem duas linhas; o peso estimado decide.</p>}
      </Bloco>
      <AbasResultado
        aba={aba}
        onAba={setAba}
        passos={passosDaFaixa(guia, undefined)}
        semResultado={!d}
        armadilhas={[AVISO_ADRENALINA_MAXIMA, ...(guia?.armadilhas ?? [])]}
        ficha={fichaReanimacaoNeonatal}
        guia={guia}
      />
      <ResumoFlutuante
        principal={foraRn ? 'Peso fora da faixa de recém-nascido' : d ? `RN · ${numeroBr(peso)} kg${ig > 0 ? ` · ${numeroBr(ig)} sem` : ''}` : 'Informe o peso'}
        tom={foraRn ? 'atencao' : 'neutro'}
        detalhe={d ? `Adrenalina IV ${n(d.adrenalinaIvMl)} mL da diluída (${n(d.adrenalinaIvMg, 3)} mg) · SF ${n(d.expansorMl, 0)} mL` : undefined}
        textoCopia={copia}
        alvoDetalhes={ID_ABAS_RESULTADO}
        rotuloDetalhes="Próximos passos"
        aoIrDetalhes={() => setAba('proximos')}
      />
    </ToolLayout>
  )
}
