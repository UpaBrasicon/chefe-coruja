// Recarga sem conexão, parte 3 (A em N1 a N5 pelo RT em 05/11/2026;
// docs/porta/RECARGA-SEM-CONEXAO-DIAGNOSTICO.md).
//
// O que as telas da enfermagem já leram do servidor (leitos, filas, cuidados,
// checagem) fica cifrado com a chave da sessão no armazenamento da ABA (N2) e
// volta numa recarga sem rede, com a hora em que foi lido. Sair apaga; fechar a
// aba apaga. Só as consultas da lista abaixo: o resto do app não é guardado.
import { chaveDaAba, cifrar, decifrar } from '../cofreLocal.ts'

export const CHAVE_CONSULTAS = 'cc-consultas-sem-conexao'
/** O armazenamento da aba tem uns 5 MB; acima disto não grava (fica o anterior). */
export const TETO_BYTES = 2_000_000

const PERMITIDAS = new Set([
  // casca e escala da enfermagem
  'setores-na-escala', 'setores-tipos', 'setores-nomes', 'enfermagem-pendencias',
  // internação, PS e observação
  'enfermagem-leitos', 'enfermagem-ps-triados', 'enfermagem-pacientes-do-setor', 'painel-observacao', 'situacao-leitos',
  'fugulin', 'fugulin-hoje', 'passagens-enfermagem',
  // painel de cuidados do paciente
  'cuidados-enfermagem', 'avaliacoes', 'conceitos-vitais-enfermagem',
  // triagem
  'triagem-fila', 'triagem-espera',
  // checagem
  'fila-checagem', 'liberacao-farmacia', 'alteracoes-itens', 'sugestoes-aprazamento',
])

export function consultaPermitida(queryKey: readonly unknown[]): boolean {
  return typeof queryKey[0] === 'string' && PERMITIDAS.has(queryKey[0])
}

type Estado = { queries: unknown[]; mutations: unknown[] }

function aba(): Storage | null {
  try { return typeof sessionStorage === 'undefined' ? null : sessionStorage } catch { return null }
}

export function guardarConsultas(estado: Estado) {
  const a = aba()
  if (!a) return
  const texto = JSON.stringify({ estado, guardadoEm: Date.now() })
  if (texto.length > TETO_BYTES) return
  const cifrado = cifrar(texto)
  if (!cifrado) return
  try { a.setItem(CHAVE_CONSULTAS, cifrado) } catch { /* armazenamento cheio: fica o anterior */ }
}

export function lerConsultas(): { estado: Estado; guardadoEm: number } | null {
  const bruto = aba()?.getItem(CHAVE_CONSULTAS)
  if (!bruto || !chaveDaAba()) return null
  const texto = decifrar(bruto)
  if (!texto) return null
  try {
    const r = JSON.parse(texto) as { estado: Estado; guardadoEm: number }
    return r?.estado && typeof r.guardadoEm === 'number' ? r : null
  } catch {
    return null
  }
}

export function apagarConsultas() {
  try { aba()?.removeItem(CHAVE_CONSULTAS) } catch { /* sem armazenamento */ }
}
