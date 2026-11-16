// Trilha de segurança, S3 (T3): a função usa a chave secreta, que não passa
// pelo portão do PostgREST (portao_requisicao). Antes de usá-la, confere o
// segundo fator do próprio usuário pela RPC segundo_fator_status, que o portão
// libera mesmo antes do 2FA.
//
// Falha fechada: resposta ausente, malformada ou com erro conta como "falta".

export function segundoFatorFalta(status: unknown): boolean {
  const linha = Array.isArray(status) ? status[0] : status
  if (!linha || typeof linha !== 'object') return true
  const { exigido, valido } = linha as { exigido?: unknown; valido?: unknown }
  if (exigido === false) return false
  return valido !== true
}
