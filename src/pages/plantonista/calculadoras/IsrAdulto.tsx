import { DIFERENCAS_DAS_2025, DIRETRIZ_DAS_2025, DROGAS_ISR, NOTA_ATS_PRE_OXIGENACAO, calcularIsr, fichaIsrAdulto, type DrogaIsr } from '@/clinico/adulto/isr'
import { textoFontes } from '@/clinico/ficha'
import { CampoPesoAdulto } from '@/components/plantonista/calc/CampoNumero'
import { usePesoAdulto } from '@/components/plantonista/calc/pacienteNaFerramenta'
import { Evidencias, VerMais } from '@/components/plantonista/calc/Evidencias'
import { ResumoFlutuante } from '@/components/plantonista/calc/ResumoFlutuante'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { numeroBr, textoCopia } from '@/domain/copiaCalculo'
import { numero } from '@/lib/formato'

const PAPEL: Record<DrogaIsr['papel'], string> = { inducao: 'Indução', analgesia: 'Analgesia', bloqueio: 'Bloqueio neuromuscular' }
const PAPEIS = Object.keys(PAPEL) as DrogaIsr['papel'][]

/** Intubação em sequência rápida do adulto (Anexo 1 do manual do HCFMUSP). Piloto das calculadoras. */
export function IsrAdulto() {
  // Peso da Central (C5 = A) e trava da unidade de 30 a 250 kg (RT, 16/11/2026).
  const pesoAdulto = usePesoAdulto()
  const { peso, leitura, pesoConta } = pesoAdulto
  const linhas = DROGAS_ISR.map((d) => ({ d, r: calcularIsr(d, pesoConta) }))
  const doseTexto = (r: NonNullable<ReturnType<typeof calcularIsr>>) => `${r.dose} · ${r.volumeMl} mL${r.ampolas > 1 ? ` · ${r.ampolas} ampolas` : ''}`

  const copia = leitura === 'ok'
    ? textoCopia({
        ferramenta: 'Intubação em sequência rápida — adulto',
        dados: [['Peso', `${numeroBr(peso)} kg`]],
        resultado: PAPEIS.flatMap((p) => [`${PAPEL[p]}:`, ...linhas.filter((l) => l.d.papel === p && l.r).map((l) => `- ${l.d.nome}: ${doseTexto(l.r!)}`)]),
        fonte: textoFontes(fichaIsrAdulto),
        versao: fichaIsrAdulto.versao,
        quando: new Date(),
      })
    : undefined

  return (
    <ToolLayout
      title="Intubação em sequência rápida — adulto"
      description="Dose, volume e ampolas por peso, pelo padrão do HC. Adulto (14 anos ou mais)."
      ficha={fichaIsrAdulto}
    >
      <Card>
        <CardContent className="pt-6">
          <CampoPesoAdulto id="isr-peso" estado={pesoAdulto} className="max-w-xs" />
        </CardContent>
      </Card>
      <p role="note" className="rounded-controle border border-atencao/40 bg-alerta-atencao px-3 py-2 text-apoio text-atencao">{NOTA_ATS_PRE_OXIGENACAO}</p>
      {PAPEIS.map((p) => (
        <Card key={p}>
          <CardHeader>
            <CardTitle className="text-corpo">{PAPEL[p]}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {linhas.filter((l) => l.d.papel === p).map(({ d, r }) => (
              <div key={d.id} className="rounded-controle border px-3 py-2 text-apoio">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">{d.nome}</span>
                  <span className="tabular-nums">
                    {r ? <><strong>{r.dose}</strong> · {r.volumeMl} mL{r.ampolas > 1 ? ` · ${r.ampolas} ampolas` : ''}</> : leitura === 'fora' ? 'confira o peso' : 'informe o peso'}
                  </span>
                </div>
                <p className="text-tinta-sussurro">
                  {d.fixa ? `dose fixa ${d.fixa.minUg}–${d.fixa.maxUg} µg` : `${numero(d.mgKg!)} mg/kg`} · {d.apresentacao}
                </p>
                {d.nota && <VerMais rotulo="Divergência no livro"><p>{d.nota}</p></VerMais>}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
      <Evidencias titulo="DAS 2025 — ao lado do manual" resumo="Difficult Airway Society 2025, lida no texto integral: recomendações de consenso, sem classe. As doses do Anexo 1 acima continuam valendo.">
        <div className="overflow-x-auto">
          <Table variante="referencia" className="w-full min-w-[560px] text-left align-top text-apoio">
            <TableHeader className="text-tinta-sussurro"><TableRow><TableHead className="pr-3 pb-2">Tema</TableHead><TableHead className="pr-3 pb-2">DAS 2025</TableHead><TableHead className="pr-3 pb-2">Manual do HC</TableHead></TableRow></TableHeader>
            <TableBody>{DIRETRIZ_DAS_2025.map((d) => <TableRow key={d.tema} className="border-t"><TableCell className="pr-3 py-2 font-medium">{d.tema}</TableCell><TableCell className="pr-3 py-2">{d.das} <span className="text-tinta-sussurro">({d.onde})</span></TableCell><TableCell className="pr-3 py-2 text-tinta-sussurro">{d.livro}</TableCell></TableRow>)}</TableBody>
          </Table>
        </div>
        <ul className="list-disc pl-5 text-tinta-sussurro">{DIFERENCAS_DAS_2025.map((d) => <li key={d}>{d}</li>)}</ul>
      </Evidencias>
      <ResumoFlutuante
        principal={leitura === 'ok' ? `Adulto · ${numeroBr(peso)} kg` : leitura === 'fora' ? 'Peso fora de 30 a 250 kg' : 'Informe o peso'}
        detalhe={leitura === 'ok' ? 'Doses por peso nas listas acima; "Copiar" leva todas.' : undefined}
        tom={leitura === 'fora' ? 'critico' : 'neutro'}
        textoCopia={copia}
      />
    </ToolLayout>
  )
}
