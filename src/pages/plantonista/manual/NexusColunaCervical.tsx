import { nexus } from '@/clinico/adulto/trauma'
import { EscoreTela } from '@/components/plantonista/EscoreTela'

/** NEXUS (manual do HCFMUSP, cap. 47, Tabela 1, p. 641; restrições na p. 643). */
export function NexusColunaCervical() {
  return <EscoreTela escore={nexus} />
}
