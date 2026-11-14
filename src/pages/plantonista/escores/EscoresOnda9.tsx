import { DIFERENCAS_EI, DIRETRIZ_EI, duke } from '@/clinico/adulto/duke'
import { sincopeSanFrancisco } from '@/clinico/adulto/sincopeSanFrancisco'
import { ckdEpi } from '@/clinico/escores/ckdEpi'
import { iss } from '@/clinico/escores/iss'
import { pram } from '@/clinico/escores/pram'
import { sincopeCanadense } from '@/clinico/escores/sincopeCanadense'
import { timiIamcsst } from '@/clinico/escores/timiIamcsst'
import { schwartzPed } from '@/clinico/pediatria/schwartzPed'
import { EscoreTela } from '@/components/plantonista/EscoreTela'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Bloco } from '../manual/LoteAPecas'

// Calculadoras sem equivalente que entraram na onda 9 do porte, cada uma com a
// sua fonte na ficha (manual do HC, livro do ICr ou referência primária).

export const TimiIamcsst = () => <EscoreTela escore={timiIamcsst} />
export const SincopeSanFrancisco = () => <EscoreTela escore={sincopeSanFrancisco} />
export const SincopeCanadense = () => <EscoreTela escore={sincopeCanadense} />
export const Duke = () => (
  <EscoreTela escore={duke}>
    <Bloco titulo="ESC 2023 — ao lado do manual" descricao="Endocardite pela diretriz da ESC de 2023 (classe e nível de evidência), lida no texto integral. Os critérios de Duke-ISCVID 2023 acima continuam valendo.">
      <div className="overflow-x-auto">
        <Table variante="referencia" className="w-full min-w-[640px] text-left align-top text-apoio">
          <TableHeader className="text-tinta-sussurro"><TableRow><TableHead className="pr-3 pb-2">Tema</TableHead><TableHead className="pr-3 pb-2">Diretriz</TableHead><TableHead className="pr-3 pb-2">Manual do HC</TableHead></TableRow></TableHeader>
          <TableBody>{DIRETRIZ_EI.map((d) => <TableRow key={d.tema} className="border-t"><TableCell className="pr-3 py-2 font-medium">{d.tema}</TableCell><TableCell className="pr-3 py-2">{d.diretriz} <span className="text-tinta-sussurro">({d.fonte}; {d.grau})</span></TableCell><TableCell className="pr-3 py-2 text-tinta-sussurro">{d.livro}</TableCell></TableRow>)}</TableBody>
        </Table>
      </div>
      <ul className="list-disc pl-5 text-apoio text-tinta-sussurro">{DIFERENCAS_EI.map((d) => <li key={d}>{d}</li>)}</ul>
    </Bloco>
  </EscoreTela>
)
export const Iss = () => <EscoreTela escore={iss} />
export const CkdEpi = () => <EscoreTela escore={ckdEpi} />
export const Pram = () => <EscoreTela escore={pram} />
export const SchwartzPed = () => <EscoreTela escore={schwartzPed} />
