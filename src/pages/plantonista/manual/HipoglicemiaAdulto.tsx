import { useState } from 'react'

import { DIFERENCAS_HIPOGLICEMIA, DIRETRIZ_HIPOGLICEMIA, HIPOGLICEMIA_DOSES, LIMIAR_HIPOGLICEMIA, abaixoDoLimiar, fichaHipoglicemia, gramasGlicose50 } from '@/clinico/adulto/glicemia'
import { textoFontes } from '@/clinico/ficha'
import { passosDaFaixa } from '@/clinico/guia'
import { guiaDa } from '@/clinico/guias'
import { AbasResultado } from '@/components/plantonista/calc/AbasResultado'
import { ID_ABAS_RESULTADO, type IdAba } from '@/components/plantonista/calc/contexto'
import { BlocoComparacao } from '@/components/plantonista/calc/Evidencias'
import { ResumoFlutuante } from '@/components/plantonista/calc/ResumoFlutuante'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { textoCopia } from '@/domain/copiaCalculo'

const ERRATA_LIMIAR = 'Limiar sem DM: 45 mg/dL no texto (p. 877) e 50 mg/dL na Figura 1 (p. 881). A ferramenta usa o texto e mostra o corte da figura.'

/** Hipoglicemia no adulto: limiar e doses — cap. 65 do manual do HCFMUSP. */
export function HipoglicemiaAdulto() {
  const [glic, setGlic] = useState(0)
  const [dm, setDm] = useState(false)
  const abaixo = glic > 0 ? abaixoDoLimiar(glic, dm) : null
  const [g0, g1] = HIPOGLICEMIA_DOSES.glicose50Ml
  const [aba, setAba] = useState<IdAba>('proximos')
  const guia = guiaDa(fichaHipoglicemia.id)
  const entreCortes = !dm && glic >= LIMIAR_HIPOGLICEMIA.semDmTexto && glic < LIMIAR_HIPOGLICEMIA.semDmFigura
  const textoLimiar = abaixo === null ? null : `Glicemia ${glic} mg/dL ${abaixo ? 'abaixo' : 'não está abaixo'} do limiar do manual para paciente ${dm ? 'com' : 'sem'} DM${entreCortes ? ' (mas abaixo do corte de 50 da Figura 1)' : ''}.`

  // Texto do "Copiar" (C3 e C4 = A): a leitura do limiar e a lista de doses do manual.
  const copia = abaixo === null
    ? undefined
    : textoCopia({
        ferramenta: 'Hipoglicemia — limiar e doses (adulto)',
        dados: [['Glicemia', `${glic} mg/dL`], ['Diabetes melito', dm ? 'com DM' : 'sem DM']],
        resultado: [
          `${textoLimiar} (p. 877, 881)`,
          'Doses do manual (p. 880–881):',
          `- Glicose 50%: ${g0}–${g1} mL EV (${gramasGlicose50(g0)}–${gramasGlicose50(g1)} g de glicose)`,
          `- Sem acesso venoso: glucagon ${HIPOGLICEMIA_DOSES.glucagonMg[0]}–${HIPOGLICEMIA_DOSES.glucagonMg[1]} mg IM — efeito fugaz, esgota o glicogênio hepático; o manual diz que não é possível repetir`,
          `- Desnutridos, hepatopatas ou etilistas: tiamina ${HIPOGLICEMIA_DOSES.tiaminaMg} mg IV ou IM junto com a glicose (Wernicke-Korsakoff)`,
          `- DM com alto risco de recorrência (p. ex. insuficiência renal crônica): observação por ${HIPOGLICEMIA_DOSES.observacaoHoras[0]}–${HIPOGLICEMIA_DOSES.observacaoHoras[1]} h com glicemia capilar 1/1 h`,
        ],
        fonte: textoFontes(fichaHipoglicemia),
        versao: fichaHipoglicemia.versao,
        quando: new Date(),
      })

  return (
    <ToolLayout
      title="Hipoglicemia — limiar e doses"
      description="Limiar de glicemia com e sem diabetes e as doses de glicose 50%, glucagon e tiamina que o manual do HCFMUSP traz. Adulto (14 anos ou mais)."
      ficha={fichaHipoglicemia}
    >
      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
          <NumberField id="hipog-glic" label="Glicemia" unit="mg/dL" value={glic} onChange={setGlic} />
          <div className="flex flex-col gap-1.5">
            <Label className="flex-1 items-end leading-snug">Diabetes melito</Label>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant={dm ? 'default' : 'outline'} onClick={() => setDm(true)}>Com DM</Button>
              <Button type="button" size="sm" variant={!dm ? 'default' : 'outline'} onClick={() => setDm(false)}>Sem DM</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-corpo">Limiar (p. 877, 881)</CardTitle>
          <CardDescription>
            Sem DM: &lt; {LIMIAR_HIPOGLICEMIA.semDmTexto} mg/dL no texto (tríade de Whipple, p. 877) — a Figura 1 (p. 881) usa &lt; {LIMIAR_HIPOGLICEMIA.semDmFigura}. Com DM: &lt; {LIMIAR_HIPOGLICEMIA.comDm} mg/dL já pode dar sintomas.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-apoio">
          {abaixo === null ? <p className="text-tinta-sussurro">Informe a glicemia.</p> : (
            <p>
              Glicemia {glic} mg/dL {abaixo ? <strong>abaixo</strong> : 'não está abaixo'} do limiar do manual para paciente {dm ? 'com' : 'sem'} DM
              {entreCortes && ' (mas abaixo do corte de 50 da Figura 1)'}.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-corpo">O que o manual traz (p. 880–881)</CardTitle>
          <CardDescription>Doses fixas do adulto; não há dose por peso no capítulo.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-apoio">
          <p>Glicose 50%: <strong>{g0}–{g1} mL</strong> EV ({gramasGlicose50(g0)}–{gramasGlicose50(g1)} g de glicose).</p>
          <p>Sem acesso venoso: glucagon <strong>{HIPOGLICEMIA_DOSES.glucagonMg[0]}–{HIPOGLICEMIA_DOSES.glucagonMg[1]} mg IM</strong> — efeito fugaz, esgota o glicogênio hepático; o manual diz que não é possível repetir.</p>
          <p>Desnutridos, hepatopatas ou etilistas: tiamina <strong>{HIPOGLICEMIA_DOSES.tiaminaMg} mg IV ou IM</strong> junto com a glicose (Wernicke-Korsakoff).</p>
          <p>DM com alto risco de recorrência (p. ex. insuficiência renal crônica): observação por {HIPOGLICEMIA_DOSES.observacaoHoras[0]}–{HIPOGLICEMIA_DOSES.observacaoHoras[1]} h com glicemia capilar 1/1 h.</p>
          {/* A errata do limiar vai para a aba "Armadilhas" (C6 = A); o cabeçalho do limiar já mostra os dois cortes. */}
        </CardContent>
      </Card>
      <AbasResultado
        aba={aba}
        onAba={setAba}
        passos={passosDaFaixa(guia, undefined)}
        semResultado={abaixo === null}
        armadilhas={[`Errata do livro: ${ERRATA_LIMIAR}`, ...(guia?.armadilhas ?? [])]}
        ficha={fichaHipoglicemia}
        guia={guia}
        comparacao={
          // Tabela de comparação com a ADA 2026 e a Endocrine 2023 vai para "Evidências" (C6 = A); as doses do manual não mudam.
          <BlocoComparacao titulo="ADA 2026 e Endocrine 2023 — ao lado do manual" resumo="Seção 6 do Standards of Care da ADA 2026 (graus A, B, C e E), lida no texto integral, e Endocrine Society 2023, lida no resumo. As doses do manual acima continuam valendo.">
            <div className="overflow-x-auto">
              <Table variante="referencia" className="w-full min-w-[640px] text-left align-top text-apoio">
                <TableHeader className="text-tinta-sussurro"><TableRow><TableHead className="pr-3 pb-2">Tema</TableHead><TableHead className="pr-3 pb-2">Diretriz</TableHead><TableHead className="pr-3 pb-2">Manual do HC</TableHead></TableRow></TableHeader>
                <TableBody>{DIRETRIZ_HIPOGLICEMIA.map((d) => <TableRow key={d.tema} className="border-t"><TableCell className="pr-3 py-2 font-medium">{d.tema}</TableCell><TableCell className="pr-3 py-2">{d.diretriz} <span className="text-tinta-sussurro">({d.fonte}; {d.grau})</span></TableCell><TableCell className="pr-3 py-2 text-tinta-sussurro">{d.livro}</TableCell></TableRow>)}</TableBody>
              </Table>
            </div>
            <ul className="list-disc pl-5 text-tinta-sussurro">{DIFERENCAS_HIPOGLICEMIA.map((d) => <li key={d}>{d}</li>)}</ul>
          </BlocoComparacao>
        }
      />
      <ResumoFlutuante
        principal={abaixo === null ? 'Informe a glicemia' : `Glicemia ${glic} mg/dL · ${abaixo ? 'abaixo do limiar' : 'não está abaixo do limiar'} (${dm ? 'com' : 'sem'} DM)`}
        detalhe={`Glicose 50%: ${g0}–${g1} mL EV · sem acesso, glucagon ${HIPOGLICEMIA_DOSES.glucagonMg[0]}–${HIPOGLICEMIA_DOSES.glucagonMg[1]} mg IM`}
        textoCopia={copia}
        alvoDetalhes={ID_ABAS_RESULTADO}
        rotuloDetalhes="Próximos passos"
        aoIrDetalhes={() => setAba('proximos')}
      />
    </ToolLayout>
  )
}
