import { regraCanadenseColuna } from '@/clinico/adulto/trauma'
import { EscoreTela } from '@/components/plantonista/EscoreTela'

/** Regra canadense da coluna cervical como o manual do HCFMUSP imprime (cap. 47, Tabela 1, p. 641–642). */
export function RegraCanadenseColuna() {
  return <EscoreTela escore={regraCanadenseColuna} />
}
