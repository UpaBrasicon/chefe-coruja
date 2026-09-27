import { abcd2 } from '@/clinico/escores/abcd2'
import { alvarado } from '@/clinico/escores/alvarado'
import { cha2ds2va } from '@/clinico/escores/cha2ds2va'
import { childPugh } from '@/clinico/escores/childPugh'
import { curb65 } from '@/clinico/escores/curb65'
import { glasgow } from '@/clinico/escores/glasgow'
import { hasBled } from '@/clinico/escores/hasBled'
import { heart } from '@/clinico/escores/heart'
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
