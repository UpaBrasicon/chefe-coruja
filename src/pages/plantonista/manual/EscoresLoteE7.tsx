import { bars } from '@/clinico/adulto/agitacao'
import { szpilman } from '@/clinico/adulto/ambientais'
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
export const Szpilman = () => <EscoreTela escore={szpilman} />
export const RegiScar = () => <EscoreTela escore={regiscar} />
export const ScortenUti = () => <EscoreTela escore={scortenUti} />
