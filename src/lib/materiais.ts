// Materiais da unidade (pendências da 5B, L4): a busca da tela de cadastro.
import type { MaterialUnidade } from './contas.ts'

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Filtra o cadastro pela situação e pela busca: nome sem acento ou dígitos do código SIGTAP. */
export function filtrarMateriais(lista: MaterialUnidade[], busca: string, ativos: boolean) {
  const b = semAcento(busca.trim())
  const digitos = b.replace(/\D/g, '')
  return lista.filter((m) => m.ativo === ativos
    && (!b || semAcento(m.nome).includes(b) || (digitos.length >= 2 && (m.procedimento ?? '').includes(digitos))))
}
