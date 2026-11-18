// Cliente de certificado em nuvem no padrão DOC-ICP-17.01 v2.3 do ITI (LG7, A2).
//
// O mesmo código serve a qualquer provedor credenciado (VIDaaS, BirdID, NeoID…):
//   1. urlAutorizacao(): OAuth 2.0 com PKCE S256 e escopo signature_session;
//      o médico autoriza no aplicativo do provedor; o sistema nunca vê senha;
//   2. trocarCodigo(): código → token de acesso (fica só no assinador, cifrado);
//   3. certificados(): o certificado e a cadeia do médico;
//   4. assinarHash(): manda só o hash e recebe a assinatura RAW (PKCS#1 v1.5).
// Endereços e detalhes de cada provedor ficam na configuração; o que não está
// confirmado na documentação pública vem marcado "conferir na homologação".
import { createHash, randomBytes } from 'node:crypto'

export type Provedor = {
  id: 'vidaas' | 'birdid' | 'neoid' | 'safeid' | 'remoteid' | 'outro'
  nome: string
  base: string
  caminhos: { autorizar: string; token: string; certificados: string; assinar: string }
  clientId: string
  clientSecret: string
  redirectUri: string
  /** como o hash vai no corpo da assinatura; o DOC-ICP-17 usa base64 (conferir por provedor) */
  hashEm: 'base64' | 'hex'
}

export type Fetch = (url: string, init?: RequestInit) => Promise<Response>

const b64url = (b: Buffer) => b.toString('base64url')

export function pkce(): { verifier: string; challenge: string } {
  const verifier = b64url(randomBytes(48))
  return { verifier, challenge: b64url(createHash('sha256').update(verifier).digest()) }
}

export function urlAutorizacao(p: Provedor, a: { estado: string; challenge: string; segundos: number; loginHint?: string }): string {
  const u = new URL(p.caminhos.autorizar, p.base)
  u.searchParams.set('response_type', 'code')
  u.searchParams.set('client_id', p.clientId)
  u.searchParams.set('redirect_uri', p.redirectUri)
  u.searchParams.set('scope', 'signature_session')
  u.searchParams.set('code_challenge', a.challenge)
  u.searchParams.set('code_challenge_method', 'S256')
  u.searchParams.set('state', a.estado)
  u.searchParams.set('lifetime', String(Math.max(60, Math.floor(a.segundos))))
  if (a.loginHint) u.searchParams.set('login_hint', a.loginHint)
  return u.toString()
}

async function json(r: Response, etapa: string) {
  const texto = await r.text()
  if (!r.ok) throw new Error(`${etapa}: HTTP ${r.status}`) // o corpo não vai ao log: pode ter dado sensível
  try {
    return JSON.parse(texto)
  } catch {
    throw new Error(`${etapa}: resposta não é JSON`)
  }
}

export async function trocarCodigo(p: Provedor, codigo: string, verifier: string, f: Fetch = fetch): Promise<{ token: string; expiraEmSeg: number }> {
  const corpo = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: p.clientId,
    client_secret: p.clientSecret,
    code: codigo,
    redirect_uri: p.redirectUri,
    code_verifier: verifier,
  })
  const r = await f(new URL(p.caminhos.token, p.base).toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: corpo,
  })
  const j = await json(r, 'token')
  if (typeof j.access_token !== 'string') throw new Error('token: sem access_token')
  return { token: j.access_token, expiraEmSeg: Number(j.expires_in ?? 0) }
}

export type CertificadoNuvem = { alias: string; certificadoDer: Uint8Array; cadeiaDer: Uint8Array[] }

/** Lista os certificados do titular. Aceita o certificado em base64 (DER) ou PEM. */
export async function certificados(p: Provedor, token: string, f: Fetch = fetch): Promise<CertificadoNuvem[]> {
  const r = await f(new URL(p.caminhos.certificados, p.base).toString(), {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  })
  const j = await json(r, 'certificados')
  const lista = (Array.isArray(j) ? j : j.certificates ?? []) as Array<Record<string, unknown>>
  const der = (v: unknown) => Buffer.from(String(v ?? '').replace(/-----[^-]+-----|\s/g, ''), 'base64')
  return lista.map((c) => ({
    alias: String(c.alias ?? ''),
    certificadoDer: der(c.certificate),
    cadeiaDer: Array.isArray(c.certificate_chain) ? (c.certificate_chain as unknown[]).map(der) : [],
  }))
}

/** Assina um hash SHA-256 (RAW). Devolve a assinatura PKCS#1 v1.5. */
export async function assinarHash(p: Provedor, token: string, alias: string, hash: Uint8Array, rotulo: string, f: Fetch = fetch): Promise<Uint8Array> {
  const h = Buffer.from(hash)
  const r = await f(new URL(p.caminhos.assinar, p.base).toString(), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      certificate_alias: alias,
      hashes: [{ id: '1', alias: rotulo, hash: p.hashEm === 'hex' ? h.toString('hex') : h.toString('base64'), hash_algorithm: '2.16.840.1.101.3.4.2.1', signature_format: 'RAW' }],
    }),
  })
  const j = await json(r, 'assinatura')
  const s = (j.signatures ?? [])[0]
  const valor = s?.raw_signature ?? s?.signature
  if (typeof valor !== 'string') throw new Error('assinatura: resposta sem assinatura')
  return Buffer.from(valor, 'base64')
}

/** Provedores com documentação pública. Endereços de produção só depois da homologação. */
export function provedoresDoAmbiente(env: Record<string, string | undefined>): Provedor[] {
  const lista: Provedor[] = []
  const um = (id: Provedor['id'], nome: string, prefixo: string, padrao: Partial<Provedor['caminhos']>, hashEm: Provedor['hashEm']) => {
    const base = env[`${prefixo}_BASE`]
    const clientId = env[`${prefixo}_CLIENT_ID`]
    const clientSecret = env[`${prefixo}_CLIENT_SECRET`]
    const redirectUri = env.ASSINADOR_RETORNO
    if (!base || !clientId || !clientSecret || !redirectUri) return
    lista.push({
      id, nome, base, clientId, clientSecret, redirectUri, hashEm,
      caminhos: {
        autorizar: env[`${prefixo}_AUTORIZAR`] ?? padrao.autorizar ?? '/v0/oauth/authorize',
        token: env[`${prefixo}_TOKEN`] ?? padrao.token ?? '/v0/oauth/token',
        certificados: env[`${prefixo}_CERTIFICADOS`] ?? padrao.certificados ?? '/v0/oauth/certificate-discovery',
        assinar: env[`${prefixo}_ASSINAR`] ?? padrao.assinar ?? '/v0/oauth/signature',
      },
    })
  }
  // caminhos-padrão do DOC-ICP-17; cada provedor pode trocar pelo .env (conferir na homologação)
  um('vidaas', 'VIDaaS (Valid)', 'VIDAAS', {}, 'base64')
  um('birdid', 'BirdID (Soluti)', 'BIRDID', {}, 'hex')
  um('neoid', 'NeoID (Serpro)', 'NEOID', {}, 'base64')
  return lista
}
