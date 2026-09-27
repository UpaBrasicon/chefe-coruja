import type { Escore } from '../escore.ts'
import { abcd2 } from './abcd2.ts'
import { alvarado } from './alvarado.ts'
import { cha2ds2va } from './cha2ds2va.ts'
import { childPugh } from './childPugh.ts'
import { curb65 } from './curb65.ts'
import { glasgow } from './glasgow.ts'
import { hasBled } from './hasBled.ts'
import { heart } from './heart.ts'
import { wellsTvp } from './wellsTvp.ts'

/** Todos os escores do pacote, para a Central e para os testes de conjunto. */
export const ESCORES: Escore[] = [glasgow, curb65, cha2ds2va, hasBled, childPugh, heart, wellsTvp, alvarado, abcd2]
