import { burchWartofsky, escoreMixedema } from '@/clinico/adulto/endocrino'
import { DIRETRIZ_HDB_2023, oakland } from '@/clinico/adulto/hemorragiaDigestiva'
import { maddrey } from '@/clinico/adulto/hepatopata'
import { mcmahon } from '@/clinico/adulto/renal'
import { EscoreTela } from '@/components/plantonista/EscoreTela'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

import { Bloco } from './LoteAPecas'

// Escores do lote E6 (manual do HCFMUSP, adulto): a regra e o teste ficam em
// src/clinico/adulto; aqui só o nome que o registry da Central vai usar.
export const OaklandHdb = () => (
  <EscoreTela escore={oakland}>
    <Bloco titulo="ACG 2023 — ao lado do manual" descricao="Hemorragia digestiva baixa pela diretriz da ACG de 2023 (GRADE), lida no texto integral, ao lado do cap. 51 do manual do HC.">
      <div className="overflow-x-auto">
        <Table variante="referencia" className="w-full min-w-[640px] text-left align-top text-apoio">
          <TableHeader className="text-tinta-sussurro"><TableRow><TableHead className="pr-3 pb-2">Tema</TableHead><TableHead className="pr-3 pb-2">Diretriz</TableHead><TableHead className="pr-3 pb-2">Manual do HC</TableHead></TableRow></TableHeader>
          <TableBody>{DIRETRIZ_HDB_2023.map((d) => <TableRow key={d.tema} className="border-t"><TableCell className="pr-3 py-2 font-medium">{d.tema}</TableCell><TableCell className="pr-3 py-2">{d.diretriz} <span className="text-tinta-sussurro">({d.fonte}; {d.grau})</span></TableCell><TableCell className="pr-3 py-2 text-tinta-sussurro">{d.livro}</TableCell></TableRow>)}</TableBody>
        </Table>
      </div>
    </Bloco>
  </EscoreTela>
)
export const MaddreyHepatiteAlcoolica = () => <EscoreTela escore={maddrey} />
export const McMahonRabdomiolise = () => <EscoreTela escore={mcmahon} />
export const BurchWartofsky = () => <EscoreTela escore={burchWartofsky} />
export const EscoreMixedema = () => <EscoreTela escore={escoreMixedema} />
