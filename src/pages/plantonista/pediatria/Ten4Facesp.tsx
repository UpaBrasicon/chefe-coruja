import { ten4Facesp } from '@/clinico/pediatria/ten4Facesp'
import { EscoreTela } from '@/components/plantonista/EscoreTela'

// TEN-4-FACESp (escores P2/P3, item P8): a regra e o teste ficam em
// src/clinico/pediatria/ten4Facesp.ts; aqui só o nome que o registry usa.
export const Ten4Facesp = () => <EscoreTela escore={ten4Facesp} />
