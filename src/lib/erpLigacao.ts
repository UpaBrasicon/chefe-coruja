// Aviso da ligação com o ERP (revisão do perfil Faturamento, CT3, RT em
// 24/11/2026): sem chave ativa, o aviso diz quem resolve; o caminho para
// Integrações só aparece no perfil que abre essa tela (gestor e administrador,
// como a rota /integracoes).
import type { Papel } from '../types/database.ts'

export const QUEM_ATIVA_CHAVE_ERP = 'O administrador ativa a chave do ERP em Integrações.'

export function podeAbrirIntegracoes(papelAtivo: Papel | null | undefined): boolean {
  return papelAtivo === 'gestor' || papelAtivo === 'admin'
}

/** Por que não há ligação: as chaves existem mas não valem, ou nenhuma tem o recurso Financeiro. */
export function semChaveErp(chavesDoErp: number): string {
  return chavesDoErp > 0
    ? 'As chaves do ERP desta unidade foram revogadas ou venceram: o ERP não busca as contas nem responde o lançamento.'
    : 'Nenhuma chave da API tem o recurso Financeiro (ERP) nesta unidade: o ERP não busca as contas nem responde o lançamento.'
}
