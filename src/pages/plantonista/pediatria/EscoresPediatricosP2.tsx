import { glasgowPediatrico, pecarnMaior2, pecarnMenor2 } from '@/clinico/pediatria/tceDecisao'
import { pews, pops } from '@/clinico/pediatria/triagem'
import { EscoreTela } from '@/components/plantonista/EscoreTela'

// Escores pediátricos do lote P2 (livro do ICr): a regra e o teste ficam em
// src/clinico/pediatria; aqui só o nome que o registry vai usar.
export const PecarnMenor2 = () => <EscoreTela escore={pecarnMenor2} />
export const PecarnMaior2 = () => <EscoreTela escore={pecarnMaior2} />
export const GlasgowPediatrico = () => <EscoreTela escore={glasgowPediatrico} />
export const PopsPediatrico = () => <EscoreTela escore={pops} />
export const PewsPediatrico = () => <EscoreTela escore={pews} />
