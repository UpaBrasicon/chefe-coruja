import { nihss, rankin } from '@/clinico/adulto/avcTrombolise'
import { bps, escalaNumericaDor, painad } from '@/clinico/adulto/dorAnalgesia'
import { escoreIch } from '@/clinico/adulto/reversaoAnticoagulacao'
import { EscoreTela } from '@/components/plantonista/EscoreTela'

// Escores do lote E2 (manual do HCFMUSP, adulto): a regra e o teste ficam em
// src/clinico/adulto; aqui só o nome que o registry da Central vai usar.
export const EscalaNumericaDor = () => <EscoreTela escore={escalaNumericaDor} />
export const Painad = () => <EscoreTela escore={painad} />
export const Bps = () => <EscoreTela escore={bps} />
export const NihssHc = () => <EscoreTela escore={nihss} />
export const RankinModificada = () => <EscoreTela escore={rankin} />
export const EscoreIch = () => <EscoreTela escore={escoreIch} />
