// Sessão quando a rede cai (recarga sem conexão, parte 1; A em N1 a N5 pelo RT
// em 05/11/2026; docs/porta/RECARGA-SEM-CONEXAO-DIAGNOSTICO.md).

type Area = { readonly length: number; key(i: number): string | null; removeItem(k: string): void }

/**
 * D1: o supabase-js não apaga o token quando o pedido de saída falha por falta
 * de rede. Sair tem de deixar o navegador sem sessão mesmo assim: computador
 * compartilhado de UPA, a próxima pessoa não pode achar a sessão de quem saiu.
 */
export function apagarTokensDeSessao(areas: (Area | null | undefined)[]) {
  for (const a of areas) {
    if (!a) continue
    try {
      const chaves: string[] = []
      for (let i = 0; i < a.length; i++) {
        const k = a.key(i)
        if (k && k.startsWith('sb-')) chaves.push(k)
      }
      for (const k of chaves) a.removeItem(k)
    } catch {
      // armazenamento bloqueado: nada a apagar
    }
  }
}

/**
 * D3: renovar o token sem rede devolve "sem sessão" com um erro de rede. Isso
 * não é sessão encerrada: os rascunhos cifrados e a chave da aba ficam.
 */
export function ehFalhaDeRede(erro: unknown): boolean {
  if (!erro || typeof erro !== 'object') return false
  const e = erro as { name?: string; message?: string }
  if (e.name === 'AuthRetryableFetchError') return true
  return e.name === 'TypeError' && /fetch|network|rede/i.test(e.message ?? '')
}
