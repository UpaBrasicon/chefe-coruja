import { abcTransfusaoAdulto } from '@/clinico/adulto/transfusao'
import { EscoreTela } from '@/components/plantonista/EscoreTela'

/** ABC score (manual do HCFMUSP, cap. 82 p. 1077 e cap. 47 p. 647), com os dois cortes do livro. */
export function AbcTransfusaoMacica() {
  return <EscoreTela escore={abcTransfusaoAdulto} />
}
