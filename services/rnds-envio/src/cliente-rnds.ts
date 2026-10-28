// ─────────────────────────────────────────────────────────────────────────────
// Cliente da RNDS (5C-5.3b): token com TLS mútuo e envio do Bundle.
//
// - O token sai do EHR Auth com o certificado da unidade (o único serviço que
//   usa o certificado) e vale 30 min. Fica guardado por unidade e ambiente e é
//   reaproveitado até 1 min antes de vencer.
// - Os manuais divergem no método do token (GET no SA e no Postman, POST no
//   RAC): tenta GET e, se a RNDS responder 405, POST.
// - Envio: POST {ehr}/api/fhir/r4/Bundle com X-Authorization-Server (o token)
//   e Authorization (o CNS de quem assina). O id RNDS vem no Location.
// - Um 401 no envio pede token novo uma vez; se repetir, é a credencial.
//
// A resposta vira um dos resultados de public.rnds_registrar_resultado.
// ─────────────────────────────────────────────────────────────────────────────
import { request } from 'node:https'
import { rootCertificates } from 'node:tls'
import type { IncomingHttpHeaders } from 'node:http'

export type Ambiente = 'homologacao' | 'producao'
export type Certificado = { pfx: Buffer; senha: string }
export type Enderecos = { auth: string; ehr: string }

export type Resultado =
  | { resultado: 'enviado'; idRnds: string; resposta: RespostaGravada }
  | { resultado: 'reenviar' | 'erro' | 'credencial'; erro: string; resposta?: RespostaGravada }

/** O que fica gravado no item da fila (sem o token nem o corpo inteiro de erro HTML). */
export type RespostaGravada = { status: number; location?: string; corpo?: unknown }

type Resposta = { status: number; headers: IncomingHttpHeaders; corpo: string }

const HOMOLOGACAO: Enderecos = { auth: 'https://ehr-auth-hmg.saude.gov.br', ehr: 'https://ehr-services-hmg.saude.gov.br' }

/**
 * Endereços oficiais (docs/rnds/CHECKLIST.md, I4). Na produção, o EHR é o da UF
 * do CNES. `sobrepor` aponta para o simulador.
 */
export function enderecos(ambiente: Ambiente, uf: string | null, sobrepor?: Partial<Enderecos>): Enderecos {
  const base = ambiente === 'homologacao'
    ? HOMOLOGACAO
    : { auth: 'https://ehr-auth.saude.gov.br', ehr: uf ? `https://${uf.toLowerCase()}-ehr-services.saude.gov.br` : '' }
  return { auth: sobrepor?.auth ?? base.auth, ehr: sobrepor?.ehr ?? base.ehr }
}

/** Códigos da RNDS que dizem que a credencial (e não o documento) foi recusada. */
const ERRO_DE_CREDENCIAL = /ERR(88[1-4]|93[0-2]|989)/

export class ErroDeRede extends Error {}

export type OpcoesCliente = {
  /** CA a mais em que confiar (o simulador); a RNDS usa as CAs públicas */
  caExtra?: string
  timeoutMs?: number
  agora?: () => number
}

export class ClienteRnds {
  private tokens = new Map<string, { token: string; vale: number }>()
  private ca: string[] | undefined
  private timeoutMs: number
  private agora: () => number

  constructor(opcoes: OpcoesCliente = {}) {
    this.ca = opcoes.caExtra ? [...rootCertificates, opcoes.caExtra] : undefined
    this.timeoutMs = opcoes.timeoutMs ?? 30_000
    this.agora = opcoes.agora ?? Date.now
  }

  /** Envia um Bundle em nome da unidade (o certificado) e do profissional (o CNS). */
  async enviar(p: {
    chaveToken: string
    enderecos: Enderecos
    certificado: Certificado
    cns: string
    bundle: unknown
  }): Promise<Resultado> {
    for (let tentativa = 0; tentativa < 2; tentativa++) {
      let token: string
      try {
        token = await this.token(p.chaveToken, p.enderecos.auth, p.certificado, tentativa > 0)
      } catch (e) {
        return this.falhaNoToken(e)
      }
      let r: Resposta
      try {
        r = await this.chamar(`${p.enderecos.ehr}/api/fhir/r4/Bundle`, 'POST', {
          headers: {
            'Content-Type': 'application/json',
            'X-Authorization-Server': `Bearer ${token}`,
            Authorization: p.cns,
          },
          corpo: JSON.stringify(p.bundle),
        })
      } catch (e) {
        return { resultado: 'reenviar', erro: `sem resposta da RNDS: ${(e as Error).message}` }
      }
      if (r.status === 401 && tentativa === 0) {
        this.tokens.delete(p.chaveToken) // token vencido ou revogado do lado de lá: pede outro uma vez
        continue
      }
      return classificar(r)
    }
    return { resultado: 'credencial', erro: 'a RNDS recusou o token novo' }
  }

  private async token(chave: string, auth: string, cert: Certificado, renovar: boolean): Promise<string> {
    const guardado = this.tokens.get(chave)
    if (guardado && !renovar && guardado.vale > this.agora()) return guardado.token
    let r = await this.chamar(`${auth}/api/token`, 'GET', { certificado: cert })
    if (r.status === 405) r = await this.chamar(`${auth}/api/token`, 'POST', { certificado: cert })
    if (r.status !== 200) throw new ErroDoToken(r)
    const corpo = JSON.parse(r.corpo) as { access_token?: string; expires_in?: number }
    if (!corpo.access_token) throw new ErroDoToken(r)
    // o manual mostra expires_in em milissegundos (1800000); na dúvida, segundos
    const validadeMs = Math.min(corpo.expires_in && corpo.expires_in > 100_000 ? corpo.expires_in : (corpo.expires_in ?? 1800) * 1000, 1_800_000)
    this.tokens.set(chave, { token: corpo.access_token, vale: this.agora() + validadeMs - 60_000 })
    return corpo.access_token
  }

  private falhaNoToken(e: unknown): Resultado {
    if (e instanceof ErroDoToken) {
      const r = e.resposta
      const resposta = gravavel(r)
      if (r.status === 429 || r.status >= 500) return { resultado: 'reenviar', erro: `EHR Auth respondeu ${r.status}`, resposta }
      return { resultado: 'credencial', erro: `EHR Auth recusou o certificado (${r.status}) ${resumoDoErro(r.corpo)}`.trim(), resposta }
    }
    const msg = (e as Error).message
    // handshake recusado (certificado inválido, vencido, de outra cadeia) é a credencial
    if (/certificate|ssl|tls|alert|handshake/i.test(msg) && !/ECONNREFUSED|ETIMEDOUT|ENOTFOUND/.test(msg)) {
      return { resultado: 'credencial', erro: `TLS mútuo recusado no EHR Auth: ${msg}` }
    }
    return { resultado: 'reenviar', erro: `sem resposta do EHR Auth: ${msg}` }
  }

  private chamar(url: string, metodo: 'GET' | 'POST', o: {
    headers?: Record<string, string>
    corpo?: string
    certificado?: Certificado
  }): Promise<Resposta> {
    return new Promise((resolve, reject) => {
      const req = request(url, {
        method: metodo,
        headers: { Accept: 'application/json', ...o.headers, ...(o.corpo ? { 'Content-Length': Buffer.byteLength(o.corpo) } : {}) },
        ...(o.certificado ? { pfx: o.certificado.pfx, passphrase: o.certificado.senha } : {}),
        ...(this.ca ? { ca: this.ca } : {}),
        timeout: this.timeoutMs,
      }, (res) => {
        const partes: Buffer[] = []
        res.on('data', (c: Buffer) => partes.push(c))
        res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, corpo: Buffer.concat(partes).toString('utf8') }))
        res.on('error', reject)
      })
      req.on('timeout', () => req.destroy(new ErroDeRede(`tempo esgotado (${this.timeoutMs} ms)`)))
      req.on('error', reject)
      if (o.corpo) req.write(o.corpo)
      req.end()
    })
  }
}

class ErroDoToken extends Error {
  resposta: Resposta
  constructor(r: Resposta) {
    super(`EHR Auth ${r.status}`)
    this.resposta = r
  }
}

/** A resposta do envio vira um resultado da fila. */
export function classificar(r: Resposta): Resultado {
  const resposta = gravavel(r)
  if (r.status === 201) {
    const local = String(r.headers.location ?? r.headers['content-location'] ?? '')
    const id = local.split('/').filter(Boolean).pop()
    // sem o id não dá para substituir nem excluir depois: não reenvia (duplicaria)
    if (!id) return { resultado: 'erro', erro: '201 sem o id da RNDS no Location', resposta }
    return { resultado: 'enviado', idRnds: id, resposta }
  }
  if (ERRO_DE_CREDENCIAL.test(r.corpo) || r.status === 401 || r.status === 403) {
    return { resultado: 'credencial', erro: `RNDS recusou a credencial (${r.status}) ${resumoDoErro(r.corpo)}`.trim(), resposta }
  }
  if (r.status === 429 || r.status >= 500) return { resultado: 'reenviar', erro: `RNDS respondeu ${r.status}`, resposta }
  return { resultado: 'erro', erro: `RNDS recusou o documento (${r.status}) ${resumoDoErro(r.corpo)}`.trim(), resposta }
}

function gravavel(r: Resposta): RespostaGravada {
  let corpo: unknown
  try {
    corpo = r.corpo ? JSON.parse(r.corpo) : undefined
  } catch {
    corpo = r.corpo.slice(0, 500)
  }
  const location = r.headers.location ?? r.headers['content-location']
  return { status: r.status, ...(location ? { location: String(location) } : {}), ...(corpo !== undefined ? { corpo } : {}) }
}

/** As mensagens do OperationOutcome, ex.: "(EHR-ERR906) Profissional … não autorizado". */
export function resumoDoErro(corpo: string): string {
  try {
    const oo = JSON.parse(corpo) as { issue?: { diagnostics?: string; details?: { text?: string } }[] }
    const textos = (oo.issue ?? []).map((i) => i.diagnostics ?? i.details?.text).filter(Boolean)
    if (textos.length) return textos.join('; ').slice(0, 500)
  } catch {
    // corpo que não é JSON
  }
  return corpo.slice(0, 200)
}
