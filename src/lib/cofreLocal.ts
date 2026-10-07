import { gcm } from '@noble/ciphers/aes.js'

/**
 * Cofre local dos rascunhos clínicos (Fase 0, item 13 do BACKLOG.md).
 *
 * O rascunho continua no localStorage (sobrevive a recarga e queda de luz),
 * mas cifrado: AES-256-GCM com a chave DA SESSÃO de login, que vem do servidor
 * (`chave_rascunho`, migration 20261026000001) e é apagada lá quando a sessão
 * acaba. Sem a chave — outra pessoa no computador depois do logout, sessão
 * vencida — o rascunho é ilegível.
 *
 * Síncrono de propósito (`@noble/ciphers`): as telas leem o rascunho no
 * primeiro render. A chave fica na memória e, para recarregar a aba sem
 * conexão, numa cópia no sessionStorage (morre com a aba). Sem chave, nada é
 * gravado: o rascunho fica só na memória da tela — nunca em texto claro.
 */

const PREFIXO = 'ccr1:'
const CACHE_ABA = 'cc-chave-rascunho'

let chave: Uint8Array | null = null

function deBase64(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
function paraBase64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s)
}

/** Recebe a chave da sessão (base64 de 32 bytes) ou `null` para esquecer. */
export function definirChave(b64: string | null): void {
  if (!b64) {
    chave = null
    try { sessionStorage.removeItem(CACHE_ABA) } catch { /* sem sessionStorage */ }
    return
  }
  const bytes = deBase64(b64)
  if (bytes.length !== 32) throw new Error('chave de rascunho inválida')
  chave = bytes
  try { sessionStorage.setItem(CACHE_ABA, b64) } catch { /* sem sessionStorage */ }
}

/** Recarga sem conexão: usa a cópia da chave que ficou nesta aba. */
export function chaveDaAba(): boolean {
  if (chave) return true
  try {
    const b64 = sessionStorage.getItem(CACHE_ABA)
    if (b64) { definirChave(b64); return true }
  } catch { /* sem sessionStorage */ }
  return false
}

export const temChave = () => chave !== null

/** Texto → "ccr1:<base64(nonce|cifra|tag)>". `null` sem chave (o chamador não grava). */
export function cifrar(texto: string): string | null {
  if (!chave) return null
  const nonce = crypto.getRandomValues(new Uint8Array(12))
  const corpo = gcm(chave, nonce).encrypt(new TextEncoder().encode(texto))
  const tudo = new Uint8Array(12 + corpo.length)
  tudo.set(nonce)
  tudo.set(corpo, 12)
  return PREFIXO + paraBase64(tudo)
}

export const estaCifrado = (valor: string) => valor.startsWith(PREFIXO)

/** Decifra; `null` sem chave, com chave de outra sessão ou conteúdo alterado. */
export function decifrar(valor: string): string | null {
  if (!chave || !estaCifrado(valor)) return null
  try {
    const tudo = deBase64(valor.slice(PREFIXO.length))
    const claro = gcm(chave, tudo.subarray(0, 12)).decrypt(tudo.subarray(12))
    return new TextDecoder().decode(claro)
  } catch {
    return null
  }
}
