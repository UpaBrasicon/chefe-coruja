import { useState } from 'react'

import { COMPLICACOES_DIAMETRO, CORTES_AORTA, METAS_EH, fichaSindromeAorticaAdulto, linhaDiametro } from '@/clinico/adulto/emergenciaHipertensiva'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { Trecho } from './LoteAPecas'
import { Bloco, LinhaManual } from './PecasLoteC'
import { numero } from '@/lib/formato'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

/** Síndrome aórtica aguda do adulto (cap. 20 do manual do HCFMUSP): alvos, cortes de diâmetro e Tabela 3. O ADD-RS tem tela própria. */
export function SindromeAorticaAdulto() {
  const [cm, setCm] = useState(0)
  const linha = linhaDiametro(cm)
  const disseccao = METAS_EH.find((m) => m.id === 'disseccao')!

  return (
    <ToolLayout
      title="Síndrome aórtica aguda — adulto"
      description="Alvo de PAS e FC na dissecção, cortes de diâmetro e complicações anuais por tamanho da aorta, como o manual do HCFMUSP traz. Adulto (14 anos ou mais)."
      ficha={fichaSindromeAorticaAdulto}
    >
      <Bloco titulo="Alvo na dissecção de aorta (cap. 19, Tabela 4, p. 274)">
        <LinhaManual nome="Dissecção de aorta" texto={<>alvo: {disseccao.alvo}. Tempo: {disseccao.tempo}</>} pagina="Tabela 4, p. 274" errata={disseccao.errata} />
        <p className="text-apoio text-tinta-sussurro">Esmolol e nitroprussiato com mL/h: tela de emergência hipertensiva. Risco pelo ADD-RS: tela própria.</p>
      </Bloco>

      <Bloco titulo="Cortes e prognóstico">
        {CORTES_AORTA.map((c) => <Trecho key={c.texto} texto={c.texto} pagina={c.pagina} />)}
      </Bloco>

      <Bloco titulo="Complicações anuais por diâmetro (Tabela 3, p. 284)">
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="aorta-cm" label="Diâmetro da aorta" unit="cm" value={cm} onChange={setCm} step={0.1} />
        </div>
        {cm > 0 && (linha
          ? <p className="tabular-nums">Faixa &gt; {numero(linha.acimaDeCm)} cm: ruptura {linha.ruptura}, dissecção {linha.disseccao}, morte {linha.morte}, total {linha.total} ao ano.</p>
          : <p className="text-tinta-sussurro">Até 3,5 cm a Tabela 3 não tem linha.</p>)}
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
    </ToolLayout>
  )
}
