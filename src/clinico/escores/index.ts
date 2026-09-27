import type { Escore } from '../escore.ts'
import { abcd2 } from './abcd2.ts'
import { aims65 } from './aims65.ts'
import { alvarado } from './alvarado.ts'
import { bisap } from './bisap.ts'
import { camIcu } from './camIcu.ts'
import { canadianCtHead } from './canadianCtHead.ts'
import { cha2ds2va } from './cha2ds2va.ts'
import { childPugh } from './childPugh.ts'
import { civdIsth } from './civdIsth.ts'
import { curb65 } from './curb65.ts'
import { four } from './four.ts'
import { genebraRevisado } from './genebraRevisado.ts'
import { glasgow } from './glasgow.ts'
import { glasgowBlatchford } from './glasgowBlatchford.ts'
import { grace } from './grace.ts'
import { hasBled } from './hasBled.ts'
import { heart } from './heart.ts'
import { killip } from './killip.ts'
import { light } from './light.ts'
import { meld3 } from './meld3.ts'
import { psi } from './psi.ts'
import { quatroT } from './quatroT.ts'
import { ranson } from './ranson.ts'
import { rass } from './rass.ts'
import { rockall } from './rockall.ts'
import { sepseAdulto } from './sepseAdulto.ts'
import { wellsTep } from './wellsTep.ts'
import { wellsTvp } from './wellsTvp.ts'

/** Todos os escores do pacote, para a Central e para os testes de conjunto. */
export const ESCORES: Escore[] = [
  glasgow,
  curb65,
  cha2ds2va,
  hasBled,
  childPugh,
  heart,
  wellsTvp,
  alvarado,
  abcd2,
  quatroT,
  aims65,
  bisap,
  camIcu,
  civdIsth,
  canadianCtHead,
  light,
  four,
  grace,
  genebraRevisado,
  glasgowBlatchford,
  killip,
  meld3,
  psi,
  rass,
  ranson,
  rockall,
  sepseAdulto,
  wellsTep,
]
