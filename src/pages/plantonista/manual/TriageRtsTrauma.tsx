import { triageRts } from '@/clinico/adulto/trauma'
import { EscoreTela } from '@/components/plantonista/EscoreTela'

/** Triage-RTS (manual do HCFMUSP, cap. 48, Tabela 4, p. 672). */
export function TriageRtsTrauma() {
  return <EscoreTela escore={triageRts} />
}
