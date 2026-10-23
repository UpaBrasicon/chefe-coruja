import { pecarnAbdome, pecarnCervical } from '@/clinico/pediatria/pecarnTrauma'
import { EscoreTela } from '@/components/plantonista/EscoreTela'

// PECARN de trauma contuso (lacunas da Central, lote 1): a regra e o teste ficam
// em src/clinico/pediatria/pecarnTrauma.ts; aqui só o nome que o registry usa.
export const PecarnCervical = () => <EscoreTela escore={pecarnCervical} />
export const PecarnAbdome = () => <EscoreTela escore={pecarnAbdome} />
