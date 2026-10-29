// ─────────────────────────────────────────────────────────────────────────────
// Cofre do certificado A1 da RNDS (5C-5.4): o formato do cifrado, dos dois lados.
//
// - O navegador (tela da 5.4c) cifra o .pfx e a senha com a chave pública do
//   serviço no VPS e manda só o cifrado ao banco (public.rnds_enviar_certificado).
// - O serviço no VPS (services/rnds-envio) é o único que tem a chave privada e
//   abre o cifrado.
//
// Cifra híbrida, só com a WebCrypto (a mesma API no navegador e no Node 24):
//   - uma chave AES-256-GCM nova a cada envio cifra {"pfx": base64, "senha"};
//   - a chave AES vai cifrada com RSA-OAEP-256 (a chave pública do serviço);
//   - o dado adicional do GCM amarra o cifrado à credencial: o cifrado de uma
//     credencial copiado para outra não abre.
// Formato gravado (tudo em base64): {versao: 1, chave_id, chave, iv, dados}.
// O chave_id é a impressão da chave pública (RFC 7638), igual nos dois lados.
// ─────────────────────────────────────────────────────────────────────────────

export type Cifrado = { versao: 1; chave_id: string; chave: string; iv: string; dados: string }
/** A parte pública de uma chave RSA em JWK (sem a "d"). */
export type Jwk = { kty?: string; n?: string; e?: string; alg?: string; use?: string; ext?: boolean }
export type ChavePublica = { id: string; jwk: Jwk }
export type Conteudo = { pfx: Uint8Array; senha: string }
/** CryptoKey da WebCrypto, sem depender dos tipos do navegador ou do Node. */
export type ChaveCripto = Awaited<ReturnType<typeof globalThis.crypto.subtle.importKey>>

const RSA = { name: 'RSA-OAEP', hash: 'SHA-256' } as const

function subtle() {
  return globalThis.crypto.subtle
}

function adicional(credencialId: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(new TextEncoder().encode(`rnds-cofre:1:${credencialId}`))
}

export function paraBase64(b: Uint8Array): string {
  let s = ''
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000))
  return btoa(s)
}

export function deBase64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s)
  const b = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i)
  return b
}

function base64url(b: Uint8Array): string {
  return paraBase64(b).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Impressão da chave pública RSA (RFC 7638): 43 caracteres base64url. */
export async function idDaChave(jwk: Jwk): Promise<string> {
  if (jwk.kty !== 'RSA' || !jwk.n || !jwk.e) throw new Error('chave pública RSA sem n ou e')
  const canonica = JSON.stringify({ e: jwk.e, kty: 'RSA', n: jwk.n })
  return base64url(new Uint8Array(await subtle().digest('SHA-256', new TextEncoder().encode(canonica))))
}

/** Cifra o certificado para a credencial (lado do navegador). */
export async function cifrarCertificado(chave: ChavePublica, credencialId: string, c: Conteudo): Promise<Cifrado> {
  if ((await idDaChave(chave.jwk)) !== chave.id) throw new Error('a chave pública não confere com o id')
  const rsa = await subtle().importKey('jwk', { kty: 'RSA', n: chave.jwk.n, e: chave.jwk.e, alg: 'RSA-OAEP-256', ext: true },
    RSA, false, ['encrypt'])
  const aes = await subtle().generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt'])
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12))
  const claro = new TextEncoder().encode(JSON.stringify({ pfx: paraBase64(c.pfx), senha: c.senha }))
  const dados = await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: adicional(credencialId) }, aes, claro)
  const chaveAes = await subtle().encrypt(RSA, rsa, await subtle().exportKey('raw', aes))
  return {
    versao: 1,
    chave_id: chave.id,
    chave: paraBase64(new Uint8Array(chaveAes)),
    iv: paraBase64(iv),
    dados: paraBase64(new Uint8Array(dados)),
  }
}

/** Abre o cifrado com a chave privada do serviço (lado do VPS). */
export async function abrirCertificado(privada: ChaveCripto, credencialId: string, c: Cifrado): Promise<Conteudo> {
  if (c.versao !== 1) throw new Error(`versão do cofre desconhecida: ${String(c.versao)}`)
  const bruta = await subtle().decrypt(RSA, privada, deBase64(c.chave))
  const aes = await subtle().importKey('raw', bruta, { name: 'AES-GCM' }, false, ['decrypt'])
  const claro = await subtle().decrypt({ name: 'AES-GCM', iv: deBase64(c.iv), additionalData: adicional(credencialId) },
    aes, deBase64(c.dados))
  const j = JSON.parse(new TextDecoder().decode(claro)) as { pfx?: unknown; senha?: unknown }
  if (typeof j.pfx !== 'string' || typeof j.senha !== 'string') throw new Error('conteúdo do cofre sem pfx ou senha')
  return { pfx: deBase64(j.pfx), senha: j.senha }
}
