import { burchWartofsky, escoreMixedema } from '@/clinico/adulto/endocrino'
import { oakland } from '@/clinico/adulto/hemorragiaDigestiva'
import { maddrey } from '@/clinico/adulto/hepatopata'
import { mcmahon } from '@/clinico/adulto/renal'
import { EscoreTela } from '@/components/plantonista/EscoreTela'

// Escores do lote E6 (manual do HCFMUSP, adulto): a regra e o teste ficam em
// src/clinico/adulto; aqui só o nome que o registry da Central vai usar.
export const OaklandHdb = () => <EscoreTela escore={oakland} />
export const MaddreyHepatiteAlcoolica = () => <EscoreTela escore={maddrey} />
export const McMahonRabdomiolise = () => <EscoreTela escore={mcmahon} />
export const BurchWartofsky = () => <EscoreTela escore={burchWartofsky} />
export const EscoreMixedema = () => <EscoreTela escore={escoreMixedema} />
