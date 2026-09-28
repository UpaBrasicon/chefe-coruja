import { addRs } from '@/clinico/adulto/emergenciaHipertensiva'
import { EscoreTela } from '@/components/plantonista/EscoreTela'

/** ADD-RS com o D-dímero (manual do HCFMUSP, cap. 20, Tabela 2, p. 281–282). */
export function AddRsDisseccaoAorta() {
  return <EscoreTela escore={addRs} />
}
