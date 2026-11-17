import { useState } from 'react'

import { COMPLICACOES_DIAMETRO, CORTES_AORTA, DIFERENCAS_AORTA_2024, DIRETRIZ_AORTA_2024, METAS_EH, fichaSindromeAorticaAdulto, linhaDiametro } from '@/clinico/adulto/emergenciaHipertensiva'
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

import { Trecho } from './LoteAPecas'
import { Bloco, LinhaManual } from './PecasLoteC'
import { numero } from '@/lib/formato'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

/** Síndrome aórtica aguda do adulto (cap. 20 do manual do HCFMUSP): alvos, cortes de diâmetro e Tabela 3. O ADD-RS tem tela própria. */
export function SindromeAorticaAdulto() {
  const [cm, setCm] = useState(0)
  const [aba, setAba] = useState<IdAba>('proximos')
  const guia = guiaDa(fichaSindromeAorticaAdulto.id)
  const linha = linhaDiametro(cm)
  const disseccao = METAS_EH.find((m) => m.id === 'disseccao')!
  const textoLinha = linha
    ? `Faixa > ${numero(linha.acimaDeCm)} cm: ruptura ${linha.ruptura}, dissecção ${linha.disseccao}, morte ${linha.morte}, total ${linha.total} ao ano.`
    : 'Até 3,5 cm a Tabela 3 não tem linha.'

  // Texto do "Copiar" (C4 = A): diâmetro, linha da Tabela 3 e o alvo da dissecção do manual.
  const copia = cm > 0
    ? textoCopia({
        ferramenta: 'Síndrome aórtica aguda — adulto',
        dados: [['Diâmetro da aorta', `${numero(cm)} cm`]],
        resultado: [
          `Complicações anuais por diâmetro (Tabela 3, p. 284): ${textoLinha}`,
          `Alvo na dissecção de aorta (cap. 19, Tabela 4, p. 274): ${disseccao.alvo}. Tempo: ${disseccao.tempo}`,
        ],
        fonte: textoFontes(fichaSindromeAorticaAdulto),
        versao: fichaSindromeAorticaAdulto.versao,
        quando: new Date(),
      })
    : undefined

  return (
    <ToolLayout
      title="Síndrome aórtica aguda — adulto"
      description="Alvo de PAS e FC na dissecção, cortes de diâmetro e complicações anuais por tamanho da aorta, pelo manual do HCFMUSP, com a ESC 2024 ao lado. Adulto (14 anos ou mais)."
      ficha={fichaSindromeAorticaAdulto}
    >
      <Bloco titulo="Alvo na dissecção de aorta (cap. 19, Tabela 4, p. 274)">
        {/* A errata da coluna do alvo fica no item: muda a leitura do alvo (C6 = A). */}
        <LinhaManual nome="Dissecção de aorta" texto={<>alvo: {disseccao.alvo}. Tempo: {disseccao.tempo}</>} pagina="Tabela 4, p. 274" errata={disseccao.errata} />
        <p className="text-apoio text-tinta-sussurro">Esmolol e nitroprussiato com mL/h: tela de emergência hipertensiva. Risco pelo ADD-RS: tela própria.</p>
      </Bloco>

      <Bloco titulo="Cortes e prognóstico (manual)">
        {CORTES_AORTA.map((c) => <Trecho key={c.texto} texto={c.texto} pagina={c.pagina} />)}
      </Bloco>

      <Bloco titulo="Complicações anuais por diâmetro (Tabela 3, p. 284)">
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="aorta-cm" label="Diâmetro da aorta" unit="cm" value={cm} onChange={setCm} step={0.1} />
        </div>
        {cm > 0 && (linha
          ? <p className="tabular-nums">{textoLinha}</p>
          : <p className="text-tinta-sussurro">{textoLinha}</p>)}
        <Table variante="referencia" className="w-full text-apoio tabular-nums">
          <TableHeader><TableRow className="text-left text-tinta-sussurro"><TableHead>Tamanho</TableHead><TableHead>Ruptura</TableHead><TableHead>Dissecção</TableHead><TableHead>Morte</TableHead><TableHead>Total</TableHead></TableRow></TableHeader>
          <TableBody>
            {COMPLICACOES_DIAMETRO.map((l) => (
              <TableRow key={l.acimaDeCm} className={linha?.acimaDeCm === l.acimaDeCm ? 'font-semibold' : ''}>
                <TableCell>&gt; {numero(l.acimaDeCm)} cm</TableCell><TableCell>{l.ruptura}</TableCell><TableCell>{l.disseccao}</TableCell><TableCell>{l.morte}</TableCell><TableCell>{l.total}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Bloco>

      <AbasResultado
        aba={aba}
        onAba={setAba}
        passos={passosDaFaixa(guia, undefined)}
        semResultado={cm <= 0}
        armadilhas={guia?.armadilhas ?? []}
        ficha={fichaSindromeAorticaAdulto}
        guia={guia}
        comparacao={
          // Tabela da ESC 2024 vai para "Evidências" (C6 = A); nenhum alvo do manual muda.
          <BlocoComparacao titulo="ESC 2024 — ao lado do manual" resumo="Recomendações de síndrome aórtica aguda e de aneurisma pelo slideset oficial da ESC, com classe e nível; o texto integral está fechado e os slides não trazem dose.">
            <div className="overflow-x-auto">
              <Table variante="referencia" className="w-full min-w-[640px] text-left align-top text-apoio">
                <TableHeader className="text-tinta-sussurro"><TableRow><TableHead className="pr-3 pb-2">Tema</TableHead><TableHead className="pr-3 pb-2">ESC 2024</TableHead><TableHead className="pr-3 pb-2">Manual do HC</TableHead></TableRow></TableHeader>
                <TableBody>{DIRETRIZ_AORTA_2024.map((d) => <TableRow key={d.tema} className="border-t"><TableCell className="pr-3 py-2 font-medium">{d.tema}</TableCell><TableCell className="pr-3 py-2">{d.esc2024} <span className="text-tinta-sussurro">({d.classe}; {d.slide})</span></TableCell><TableCell className="pr-3 py-2 text-tinta-sussurro">{d.livro}</TableCell></TableRow>)}</TableBody>
              </Table>
            </div>
            <ul className="list-disc pl-5 text-apoio text-tinta-sussurro">{DIFERENCAS_AORTA_2024.map((d) => <li key={d}>{d}</li>)}</ul>
          </BlocoComparacao>
        }
      />
      <ResumoFlutuante
        principal={cm > 0 ? (linha ? `Aorta ${numero(cm)} cm · total ${linha.total} ao ano` : `Aorta ${numero(cm)} cm · sem linha na Tabela 3`) : 'Informe o diâmetro da aorta'}
        detalhe={`Alvo na dissecção: ${disseccao.alvo}`}
        textoCopia={copia}
        alvoDetalhes={ID_ABAS_RESULTADO}
        rotuloDetalhes="Próximos passos"
        aoIrDetalhes={() => setAba('proximos')}
      />
    </ToolLayout>
  )
}
