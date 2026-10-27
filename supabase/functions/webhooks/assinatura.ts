// Regras puras do motor de webhooks (Fase 5C, tarefa 4, etapa 4.2): assinatura
// no padrão Standard Webhooks, conferência do endereço e o texto do erro que
// vai para a entrega. Sem Deno nem rede, para testar no Node (assinatura.test.ts).
//
// Standard Webhooks (https://www.standardwebhooks.com):
//   webhook-id         id da entrega (o mesmo em todas as tentativas)
//   webhook-timestamp  segundos desde 1970 (o receptor recusa se estiver longe do relógio dele)
//   webhook-signature  "v1," + base64(HMAC-SHA256(segredo, "<id>.<timestamp>.<corpo>"))
// O segredo "whsec_<base64>" vale pelos bytes do base64, sem o prefixo.

const texto = new TextEncoder()

function bytesDoSegredo(segredo: string): Uint8Array {
  const b64 = segredo.startsWith('whsec_') ? segredo.slice(6) : segredo
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}

function base64(bytes: ArrayBuffer): string {
  let s = ''
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b)
  return btoa(s)
}

/** Valor do cabeçalho webhook-signature. */
export async function assinar(segredo: string, id: string, timestamp: number, corpo: string): Promise<string> {
  const chave = await crypto.subtle.importKey('raw', bytesDoSegredo(segredo), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const assinatura = await crypto.subtle.sign('HMAC', chave, texto.encode(`${id}.${timestamp}.${corpo}`))
  return `v1,${base64(assinatura)}`
}

/** Cabeçalhos da entrega. */
export async function cabecalhos(segredo: string, id: string, timestamp: number, corpo: string): Promise<Record<string, string>> {
  return {
    'Content-Type': 'application/json',
    'User-Agent': 'ChefeCoruja-Webhooks/1',
    'webhook-id': id,
    'webhook-timestamp': String(timestamp),
    'webhook-signature': await assinar(segredo, id, timestamp, corpo),
  }
}

// Mesma regra do banco (private.webhook_url_valida): https com nome público.
const HOST_PROIBIDO = /(^localhost$|\.localhost$|\.local$|\.internal$|\.lan$|\.home$|\.test$|\.invalid$|^[0-9.]+$)/

/** O motor confere de novo antes de chamar: https, nome público, sem usuário/senha no endereço. */
export function enderecoSeguro(endereco: string): boolean {
  let u: URL
  try { u = new URL(endereco) } catch { return false }
  if (u.protocol !== 'https:' || u.username || u.password) return false
  const host = u.hostname.toLowerCase()
  if (host.startsWith('[') || !host.includes('.')) return false
  return !HOST_PROIBIDO.test(host)
}

/** Texto curto do erro para a entrega: status e começo da resposta, ou o erro de rede. */
export function resumoErro(status: number, resposta: string | null, erro?: unknown): string {
  if (erro) {
    const nome = erro instanceof Error ? (erro.name === 'AbortError' || erro.name === 'TimeoutError' ? 'Tempo esgotado (10 s)' : erro.message) : String(erro)
    return nome.slice(0, 300)
  }
  const corpo = (resposta ?? '').replace(/\s+/g, ' ').trim().slice(0, 200)
  return corpo ? `HTTP ${status}: ${corpo}` : `HTTP ${status}`
}
