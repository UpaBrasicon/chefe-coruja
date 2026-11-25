// Regulação fora do plantão (decisão do RT de 25/11/2026, achado B-07 do teste
// de fluxo B). O servidor recusa as ações do médico e do NIR da origem fora do
// plantão (private.regulacao_exigir_plantao, migration 20270426000020) com uma
// frase que começa por "Fora do plantão". A tela mostra essa frase como aviso,
// do jeito que veio, e não como erro genérico.

const INICIO = 'Fora do plantão'

/** A frase do servidor quando a recusa é de plantão; nulo em qualquer outro erro. */
export function recusaDePlantao(erro: unknown): string | null {
  const texto = typeof erro === 'string' ? erro
    : erro && typeof erro === 'object' && 'message' in erro && typeof erro.message === 'string' ? erro.message
      : ''
  const limpo = texto.trim()
  return limpo.startsWith(INICIO) ? limpo : null
}

/** A primeira recusa de plantão entre vários erros (ações da mesma peça). */
export function primeiraRecusaDePlantao(...erros: unknown[]): string | null {
  for (const e of erros) {
    const r = recusaDePlantao(e)
    if (r) return r
  }
  return null
}
