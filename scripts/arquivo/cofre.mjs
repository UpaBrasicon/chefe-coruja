// Peças da guarda na nuvem (fase 8; Lei 13.787/2018, art. 6º; ADR 0004):
// criptografia no computador antes do envio e a assinatura dos pedidos ao S3,
// sem SDK (só node:crypto e fetch).
//
// Formato de cada arquivo cifrado (.ccg):
//   "CCG1" (4) | sal do scrypt (16) | iv (12) | tag GCM (16) | texto cifrado
// A chave AES-256 sai do scrypt da senha com o sal; o sal é um por guarda.
// Sem a senha não há como abrir: ela não vai para a nuvem nem para o disco.
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, scryptSync } from 'node:crypto'
import { readFileSync } from 'node:fs'

const MAGICO = Buffer.from('CCG1')
const SCRYPT = { N: 2 ** 17, r: 8, p: 1, maxmem: 256 * 1024 * 1024 }

export const sha256 = (b) => createHash('sha256').update(b).digest()

/** Deriva a chave de 32 bytes da senha (lento de propósito). */
export function derivarChave(senha, sal) {
  return scryptSync(senha.normalize('NFC'), sal, 32, SCRYPT)
}

export function novoSal() {
  return randomBytes(16)
}

export function cifrar(chave, sal, claro) {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', chave, iv)
  const corpo = Buffer.concat([c.update(claro), c.final()])
  return Buffer.concat([MAGICO, sal, iv, c.getAuthTag(), corpo])
}

/** Lê o sal de um .ccg (para derivar a chave antes de decifrar). */
export function salDe(cifrado) {
  if (!cifrado.subarray(0, 4).equals(MAGICO)) throw new Error('não é um arquivo da guarda (.ccg)')
  return cifrado.subarray(4, 20)
}

export function decifrar(chave, cifrado) {
  salDe(cifrado)
  const iv = cifrado.subarray(20, 32)
  const tag = cifrado.subarray(32, 48)
  const d = createDecipheriv('aes-256-gcm', chave, iv)
  d.setAuthTag(tag)
  try {
    return Buffer.concat([d.update(cifrado.subarray(48)), d.final()])
  } catch {
    throw new Error('senha errada ou arquivo alterado')
  }
}

// ── S3: assinatura AWS SigV4 ────────────────────────────────────────────────

const hmac = (k, s) => createHmac('sha256', k).update(s).digest()

/** Credenciais do ambiente ou do .csv baixado no IAM (nunca impressas). */
export function credenciais(csv) {
  if (csv) {
    const linhas = readFileSync(csv, 'utf8').replace(/^﻿/, '').trim().split(/\r?\n/)
    const cab = linhas[0].split(',').map((x) => x.trim().toLowerCase())
    const val = linhas[1].split(',').map((x) => x.trim())
    const id = val[cab.findIndex((c) => c.includes('access key id'))]
    const segredo = val[cab.findIndex((c) => c.includes('secret access key'))]
    if (!id || !segredo) throw new Error('o .csv não tem as colunas "Access key ID" e "Secret access key"')
    return { id, segredo }
  }
  const id = process.env.AWS_ACCESS_KEY_ID
  const segredo = process.env.AWS_SECRET_ACCESS_KEY
  if (!id || !segredo) throw new Error('faltam as credenciais: use --credenciais <arquivo.csv> ou AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY')
  return { id, segredo }
}

/** Monta um pedido assinado ao S3 (estilo virtual-hosted). */
export function assinar({ metodo, bucket, regiao, chaveObjeto, cabecalhos = {}, corpoHash, cred, agora = new Date(), host = `${bucket}.s3.${regiao}.amazonaws.com` }) {
  const caminho = '/' + chaveObjeto.split('/').map(encodeURIComponent).join('/')
  const amzData = agora.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const dia = amzData.slice(0, 8)
  const h = { ...cabecalhos, host, 'x-amz-content-sha256': corpoHash, 'x-amz-date': amzData }
  const nomes = Object.keys(h).map((x) => x.toLowerCase()).sort()
  const valor = (n) => String(h[Object.keys(h).find((k) => k.toLowerCase() === n)]).trim()
  const canonCab = nomes.map((n) => `${n}:${valor(n)}\n`).join('')
  const assinados = nomes.join(';')
  const canon = [metodo, caminho, '', canonCab, assinados, corpoHash].join('\n')
  const escopo = `${dia}/${regiao}/s3/aws4_request`
  const paraAssinar = ['AWS4-HMAC-SHA256', amzData, escopo, sha256(canon).toString('hex')].join('\n')
  const k = hmac(hmac(hmac(hmac('AWS4' + cred.segredo, dia), regiao), 's3'), 'aws4_request')
  const assinatura = createHmac('sha256', k).update(paraAssinar).digest('hex')
  const saida = { ...h }
  delete saida.host
  saida.authorization = `AWS4-HMAC-SHA256 Credential=${cred.id}/${escopo}, SignedHeaders=${assinados}, Signature=${assinatura}`
  return { url: `https://${host}${caminho}`, cabecalhos: saida }
}

/** Envia um objeto com sha256 conferido pelo S3 (exigido pelo Object Lock). */
export async function enviar({ bucket, regiao, chaveObjeto, corpo, cred }) {
  const hash = sha256(corpo)
  const { url, cabecalhos } = assinar({
    metodo: 'PUT', bucket, regiao, chaveObjeto, cred, corpoHash: hash.toString('hex'),
    cabecalhos: { 'x-amz-checksum-sha256': hash.toString('base64') },
  })
  const r = await fetch(url, { method: 'PUT', headers: cabecalhos, body: corpo })
  if (!r.ok) throw new Error(`envio de ${chaveObjeto} falhou: HTTP ${r.status} ${(await r.text()).slice(0, 300)}`)
  return hash.toString('base64')
}

/** Lê os metadados do objeto enviado: checksum, trava e data de liberação. */
export async function consultar({ bucket, regiao, chaveObjeto, cred }) {
  const vazio = sha256('').toString('hex')
  const { url, cabecalhos } = assinar({
    metodo: 'HEAD', bucket, regiao, chaveObjeto, cred, corpoHash: vazio,
    cabecalhos: { 'x-amz-checksum-mode': 'ENABLED' },
  })
  const r = await fetch(url, { method: 'HEAD', headers: cabecalhos })
  if (!r.ok) throw new Error(`consulta de ${chaveObjeto} falhou: HTTP ${r.status}`)
  return {
    checksum: r.headers.get('x-amz-checksum-sha256'),
    modo: r.headers.get('x-amz-object-lock-mode'),
    ate: r.headers.get('x-amz-object-lock-retain-until-date'),
    bytes: Number(r.headers.get('content-length')),
  }
}

// ── senha digitada sem aparecer na tela ─────────────────────────────────────

export function perguntarSenha(rotulo) {
  if (process.env.GUARDA_SENHA) return Promise.resolve(process.env.GUARDA_SENHA)
  return new Promise((resolve, reject) => {
    const e = process.stdin
    if (!e.isTTY) return reject(new Error('rode num terminal (a senha é digitada sem aparecer)'))
    process.stdout.write(rotulo)
    e.setRawMode(true)
    e.resume()
    e.setEncoding('utf8')
    let s = ''
    const fim = (erro) => {
      e.setRawMode(false)
      e.pause()
      e.removeListener('data', tecla)
      process.stdout.write('\n')
      erro ? reject(erro) : resolve(s)
    }
    const tecla = (t) => {
      for (const ch of t) {
        if (ch === '\r' || ch === '\n') return fim()
        if (ch === '\u0003') return fim(new Error('cancelado'))
        if (ch === '\u0008' || ch === '\u007f') s = s.slice(0, -1)
        else s += ch
      }
    }
    e.on('data', tecla)
  })
}
