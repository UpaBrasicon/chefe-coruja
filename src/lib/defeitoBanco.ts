/**
 * Resposta 4xx da API do banco: defeito ou recusa de regra? (Fase 0, item 11)
 *
 * O PostgREST devolve 400 também para erro INTERNO de uma função do banco
 * (divisão por zero, tipo inválido, coluna que não existe) — isso é defeito e
 * precisa chegar ao painel de erros e ao Sentry. Já a recusa de regra
 * (`RAISE EXCEPTION` das RPCs, permissão, JWT, conflito de duplo clique) é
 * esperada e fica de fora. Decide-se pelo CÓDIGO do erro, nunca pela mensagem
 * (que pode trazer dado digitado e não é enviada).
 */

// Classes SQLSTATE que indicam defeito de código/banco, não regra de negócio.
const CLASSES_DEFEITO = ['21', '22', '25', '27', '2B', '2D', '38', '39', '40', '0A', '53', '54', '55', '57', '58', 'XX']
// Códigos avulsos que também são defeito.
const CODIGOS_DEFEITO = new Set([
  'P0002', 'P0003', 'P0004', // no_data_found / too_many_rows / assert_failure dentro de função
  'PGRST202', 'PGRST203', // função ausente ou ambígua (deploy fora de sincronia)
  'PGRST204', // coluna ausente
  '42703', '42883', '42P01', '42804', '42P18', '42601', // coluna/função/tabela inexistente, tipo, sintaxe
])

/** `true` quando a resposta com esse status/código é defeito a relatar. */
export function ehDefeitoDoBanco(status: number, codigo: string | null | undefined): boolean {
  if (status >= 500) return true
  if (status < 400 || !codigo) return false
  const c = codigo.toUpperCase()
  if (CODIGOS_DEFEITO.has(c)) return true
  return /^[0-9A-Z]{5}$/.test(c) && CLASSES_DEFEITO.includes(c.slice(0, 2))
}
