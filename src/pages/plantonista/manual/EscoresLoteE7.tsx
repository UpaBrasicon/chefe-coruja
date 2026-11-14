import { bars } from '@/clinico/adulto/agitacao'
import { DIFERENCAS_AFOGAMENTO, DIRETRIZ_AFOGAMENTO, szpilman } from '@/clinico/adulto/ambientais'
import { Bloco } from './LoteAPecas'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { regiscar, scortenUti } from '@/clinico/adulto/dermatoses'
import { criteriosSta } from '@/clinico/adulto/falciforme'
import { criteriosVmSgb, egos, incapacidadeGbs } from '@/clinico/adulto/guillainBarre'
import { fisherHsa, huntHess, ottawaHsa, wfns } from '@/clinico/adulto/hsa'
import { cairoBishop } from '@/clinico/adulto/liseTumoral'
import { mascc } from '@/clinico/adulto/neutropeniaFebril'
import { atsIdsaPac, hestia, perc, smartCop } from '@/clinico/adulto/tepPac'
import { hintsPlus } from '@/clinico/adulto/vertigem'
import { EscoreTela } from '@/components/plantonista/EscoreTela'

// Escores do lote E7 (manual do HCFMUSP, adulto): a regra e o teste ficam em
// src/clinico/adulto; aqui só o nome que o registry da Central vai usar.
export const BarsAgitacao = () => <EscoreTela escore={bars} />
export const OttawaHsa = () => <EscoreTela escore={ottawaHsa} />
export const HuntHess = () => <EscoreTela escore={huntHess} />
export const WfnsHsa = () => <EscoreTela escore={wfns} />
export const FisherHsa = () => <EscoreTela escore={fisherHsa} />
export const HintsPlus = () => <EscoreTela escore={hintsPlus} />
export const CriteriosVmSgb = () => <EscoreTela escore={criteriosVmSgb} />
export const IncapacidadeGbs = () => <EscoreTela escore={incapacidadeGbs} />
export const Egos = () => <EscoreTela escore={egos} />
export const Perc = () => <EscoreTela escore={perc} />
export const Hestia = () => <EscoreTela escore={hestia} />
export const SmartCop = () => <EscoreTela escore={smartCop} />
export const AtsIdsaPac = () => <EscoreTela escore={atsIdsaPac} />
export const Mascc = () => <EscoreTela escore={mascc} />
export const CairoBishop = () => <EscoreTela escore={cairoBishop} />
export const SindromeToracicaAguda = () => <EscoreTela escore={criteriosSta} />
export const Szpilman = () => (
  <EscoreTela escore={szpilman}>
    <Bloco titulo="WMS 2024 — ao lado do manual" descricao="Afogamento pela diretriz da Wilderness Medical Society de 2024 (sistema do ACCP), lida no texto integral. Os graus de Szpilman e os cortes do manual acima continuam valendo.">
      <div className="overflow-x-auto">
        <Table variante="referencia" className="w-full min-w-[640px] text-left align-top text-apoio">
          <TableHeader className="text-tinta-sussurro"><TableRow><TableHead className="pr-3 pb-2">Tema</TableHead><TableHead className="pr-3 pb-2">Diretriz</TableHead><TableHead className="pr-3 pb-2">Manual do HC</TableHead></TableRow></TableHeader>
          <TableBody>{DIRETRIZ_AFOGAMENTO.map((d) => <TableRow key={d.tema} className="border-t"><TableCell className="pr-3 py-2 font-medium">{d.tema}</TableCell><TableCell className="pr-3 py-2">{d.diretriz} <span className="text-tinta-sussurro">({d.fonte}; {d.grau})</span></TableCell><TableCell className="pr-3 py-2 text-tinta-sussurro">{d.livro}</TableCell></TableRow>)}</TableBody>
        </Table>
      </div>
      <ul className="list-disc pl-5 text-apoio text-tinta-sussurro">{DIFERENCAS_AFOGAMENTO.map((d) => <li key={d}>{d}</li>)}</ul>
    </Bloco>
  </EscoreTela>
)
export const RegiScar = () => <EscoreTela escore={regiscar} />
export const ScortenUti = () => <EscoreTela escore={scortenUti} />
