import { mgap } from '@/clinico/adulto/trauma'
import { EscoreTela } from '@/components/plantonista/EscoreTela'

/** MGAP (manual do HCFMUSP, cap. 48, p. 671), com a errata dos rótulos de gravidade. */
export function MgapTrauma() {
  return <EscoreTela escore={mgap} />
}
