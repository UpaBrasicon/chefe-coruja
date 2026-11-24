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

/**
 * Quem cadastra e altera material na tela: a farmácia e o gestor (ajustes da
 * revisão, item 4, RT em 24/11/2026). O faturamento só lê e lança na conta.
 * O banco confere de novo (material_salvar, migration 20270421000073).
 */
export function podeCadastrarMaterial(papel: string | null | undefined): boolean {
  return papel === 'farmaceutico' || papel === 'gestor'
}
