import { timiSemSupra } from '@/clinico/adulto/timi'
import { EscoreTela } from '@/components/plantonista/EscoreTela'

// O manual do HC traz só o TIMI-NSTEMI (cap. 12, Tabela 4, p. 192); não há TIMI de IAM com supra.
export function Timi() { return <EscoreTela escore={timiSemSupra} /> }
