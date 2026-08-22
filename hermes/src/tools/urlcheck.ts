// ─────────────────────────────────────────────────────────────────────────────
// HERMES v1.1 — tools/urlcheck.ts
// Verificador de URL do Cérbero (Patrulha B) — camada 1: heurísticas locais
// (sem custo). Camada 2 (Google Safe Browsing) fica para quando houver chave.
//
// Veredictos:
//   - malicioso: extensão executável ou credenciais na URL (bloqueio direto)
//   - suspeito : 1+ heurísticas (entrega com aviso + incidente informativo)
//   - seguro   : nenhuma heurística
// ─────────────────────────────────────────────────────────────────────────────
import { createHash } from 'node:crypto'

const ENCURTADORES = ['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'is.gd', 'cutt.ly', 'rb.gy']
const EXT_PERIGOSAS = /\.(exe|scr|bat|cmd|msi|apk|jar|vbs|ps1|dll)([?#]|$)/i
const TLD_RISCO = /\.(zip|mov|tk|ml|ga|cf|gq)([/?#]|$)/i

export function heuristicas(url: string): string[] {
  const achados: string[] = []
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return ['url_malformada']
  }

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(u.hostname)) achados.push('ip_literal')
  if (u.hostname.startsWith('xn--') || u.hostname.includes('.xn--')) achados.push('punycode')
  if (ENCURTADORES.some((e) => u.hostname === e || u.hostname.endsWith(`.${e}`))) achados.push('encurtador')
  if (EXT_PERIGOSAS.test(u.pathname)) achados.push('extensao_executavel')
  if (TLD_RISCO.test(u.hostname)) achados.push('tld_alto_risco')
  if (u.hostname.split('.').length > 4) achados.push('subdominios_excessivos')
  if (u.username || u.password) achados.push('credencial_na_url')
  if (u.protocol !== 'https:') achados.push('sem_https')
  return achados
}

export function hashUrl(url: string): string {
  return createHash('sha256').update(url.trim().toLowerCase()).digest('hex')
}

export async function verificarUrl(url: string): Promise<{
  veredicto: 'seguro' | 'suspeito' | 'malicioso'
  motivos: string[]
  fonte: 'heuristica' | 'safe_browsing'
}> {
  const motivos = heuristicas(url)

  // Bloqueio direto: extensão executável ou credenciais na URL
  if (motivos.includes('extensao_executavel') || motivos.includes('credencial_na_url')) {
    return { veredicto: 'malicioso', motivos, fonte: 'heuristica' }
  }

  // Safe Browsing v4 (futuro — quando GOOGLE_SAFEBROWSING_KEY existir)
  if (process.env.GOOGLE_SAFEBROWSING_KEY && motivos.length === 0) {
    try {
      const res = await fetch(
        `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${process.env.GOOGLE_SAFEBROWSING_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client: { clientId: 'chefe-coruja-cerbero', clientVersion: '1.1' },
            threatInfo: {
              threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE'],
              platformTypes: ['ANY_PLATFORM'],
              threatEntryTypes: ['URL'],
              threatEntries: [{ url }],
            },
          }),
          signal: AbortSignal.timeout(5000),
        },
      ).catch(() => null)
      const data = (await res?.json().catch(() => null)) as { matches?: unknown[] } | null
      if (data?.matches?.length) {
        return { veredicto: 'malicioso', motivos: [...motivos, 'safe_browsing_match'], fonte: 'safe_browsing' }
      }
    } catch {
      // falha do Safe Browsing não bloqueia — segue com heurísticas
    }
  }

  return { veredicto: motivos.length ? 'suspeito' : 'seguro', motivos, fonte: 'heuristica' }
}

/**
 * Extrai URLs de um texto (regex simples, sem pegar pontuação final).
 */
export function extrairUrls(texto: string): string[] {
  const regex = /https?:\/\/[^\s<>"']+/g
  return (texto.match(regex) ?? []).map((u) => u.replace(/[.,;:!?]+$/, ''))
}
