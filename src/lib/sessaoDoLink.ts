// Trilha de segurança, S2 (E3): a sessão que chega no fragmento de um link
// (#access_token=...) só vale nas telas que esperam um link do e-mail:
// recuperação de senha e retorno da confirmação de e-mail (/login). Em outra
// tela, um link preparado podia logar a pessoa na conta de outra sem ela
// perceber. Com sessão aberta de outra pessoa na aba, a troca é recusada.
// Módulo puro (sem o cliente do Supabase), para o teste rodar no Node.

export const ROTAS_COM_SESSAO_NO_LINK: readonly string[] = ['/recuperar-senha', '/login']

export type TokensDoLink = { access_token: string; refresh_token: string }

export type DecisaoDoLink = 'nenhum' | 'ignorar' | 'recusar' | 'aceitar'

export function tokensDoLink(hash: string): TokensDoLink | null {
  const p = new URLSearchParams(hash.replace(/^#/, ''))
  const access_token = p.get('access_token')
  const refresh_token = p.get('refresh_token')
  return access_token && refresh_token ? { access_token, refresh_token } : null
}

/** O `sub` do JWT (dono da sessão), sem conferir assinatura: só para comparar contas. */
export function donoDoToken(accessToken: string): string | null {
  try {
    const parte = accessToken.split('.')[1]
    if (!parte) return null
    const b64 = parte.replace(/-/g, '+').replace(/_/g, '/')
    const json = JSON.parse(atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, '='))) as { sub?: unknown }
    return typeof json.sub === 'string' ? json.sub : null
  } catch {
    return null
  }
}

export function decidirSessaoDoLink(caminho: string, tokens: TokensDoLink | null, usuarioAtual: string | null): DecisaoDoLink {
  if (!tokens) return 'nenhum'
  if (!ROTAS_COM_SESSAO_NO_LINK.includes(caminho)) return 'ignorar'
  const dono = donoDoToken(tokens.access_token)
  if (!dono) return 'ignorar'
  if (usuarioAtual && usuarioAtual !== dono) return 'recusar'
  return 'aceitar'
}
