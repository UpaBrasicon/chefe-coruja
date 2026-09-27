import { abcd2 } from '@/clinico/escores/abcd2'
import { aims65 } from '@/clinico/escores/aims65'
import { alvarado } from '@/clinico/escores/alvarado'
import { bisap } from '@/clinico/escores/bisap'
import { camIcu } from '@/clinico/escores/camIcu'
import { canadianCtHead } from '@/clinico/escores/canadianCtHead'
import { cha2ds2va } from '@/clinico/escores/cha2ds2va'
import { childPugh } from '@/clinico/escores/childPugh'
import { civdIsth } from '@/clinico/escores/civdIsth'
import { curb65 } from '@/clinico/escores/curb65'
import { four } from '@/clinico/escores/four'
import { genebraRevisado } from '@/clinico/escores/genebraRevisado'
import { glasgow } from '@/clinico/escores/glasgow'
import { glasgowBlatchford } from '@/clinico/escores/glasgowBlatchford'
import { grace } from '@/clinico/escores/grace'
import { hasBled } from '@/clinico/escores/hasBled'
import { heart } from '@/clinico/escores/heart'
import { killip } from '@/clinico/escores/killip'
import { light } from '@/clinico/escores/light'
import { meld3 } from '@/clinico/escores/meld3'
import { psi } from '@/clinico/escores/psi'
import { quatroT } from '@/clinico/escores/quatroT'
import { ranson } from '@/clinico/escores/ranson'
import { rass } from '@/clinico/escores/rass'
import { rockall } from '@/clinico/escores/rockall'
import { sepseAdulto } from '@/clinico/escores/sepseAdulto'
import { wellsTep } from '@/clinico/escores/wellsTep'
import { wellsTvp } from '@/clinico/escores/wellsTvp'
import { EscoreTela } from '@/components/plantonista/EscoreTela'

// Escores do pacote src/clinico (Fase 5.3): a regra e o teste ficam lá; aqui só
// o nome que o registry da Central usa.
export const Glasgow = () => <EscoreTela escore={glasgow} />
export const Curb65 = () => <EscoreTela escore={curb65} />
export const Cha2ds2va = () => <EscoreTela escore={cha2ds2va} />
export const HasBled = () => <EscoreTela escore={hasBled} />
export const ChildPugh = () => <EscoreTela escore={childPugh} />
export const Heart = () => <EscoreTela escore={heart} />
export const WellsTvp = () => <EscoreTela escore={wellsTvp} />
export const Alvarado = () => <EscoreTela escore={alvarado} />
export const Abcd2 = () => <EscoreTela escore={abcd2} />
export const QuatroT = () => <EscoreTela escore={quatroT} />
export const Aims65 = () => <EscoreTela escore={aims65} />
export const Bisap = () => <EscoreTela escore={bisap} />
export const CamIcu = () => <EscoreTela escore={camIcu} />
export const CivdIsth = () => <EscoreTela escore={civdIsth} />
export const CanadianCtHead = () => <EscoreTela escore={canadianCtHead} />
export const Light = () => <EscoreTela escore={light} />
export const Four = () => <EscoreTela escore={four} />
export const Grace = () => <EscoreTela escore={grace} />
export const GenebraRevisado = () => <EscoreTela escore={genebraRevisado} />
export const GlasgowBlatchford = () => <EscoreTela escore={glasgowBlatchford} />
export const Killip = () => <EscoreTela escore={killip} />
export const Meld3 = () => <EscoreTela escore={meld3} />
export const Psi = () => <EscoreTela escore={psi} />
export const Rass = () => <EscoreTela escore={rass} />
export const Ranson = () => <EscoreTela escore={ranson} />
export const Rockall = () => <EscoreTela escore={rockall} />
export const SepseAdulto = () => <EscoreTela escore={sepseAdulto} />
export const WellsTep = () => <EscoreTela escore={wellsTep} />
