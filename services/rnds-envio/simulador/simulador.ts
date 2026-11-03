// ─────────────────────────────────────────────────────────────────────────────
// Simulador da RNDS (5C-5.3b): o EHR Auth e o EHR Services, para testar o
// serviço de envio sem credencial. Não é a RNDS: confere só o que o manual
// descreve para a porta (token com TLS mútuo, headers, Bundle de documento).
//
//   GET|POST /api/token        exige certificado de cliente assinado pela CA de
//                              teste; devolve {access_token, expires_in: 1800000}
//   POST /api/fhir/r4/Bundle   exige X-Authorization-Server com token válido e
//                              Authorization com um CNS (15 dígitos); confere
//                              tipo, timestamp, identifier e a substituição;
//                              201 com o id no Location
//
// Cenários para teste: `cnsSemCbo` (422 ERR906), `proximas` (respostas
// forçadas, ex.: 500) e `expirarTokens()`.
//
// Linha de comando (5.3c, no VPS):
//   node services/rnds-envio/simulador/simulador.ts --porta 8443 --certs <pasta>
// Gera a CA, o certificado do servidor e um .pfx de unidade de teste na pasta,
// se ainda não existirem.
// ─────────────────────────────────────────────────────────────────────────────
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer, type Server } from 'node:https'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { TLSSocket } from 'node:tls'
import { join } from 'node:path'

export type CertificadosDeTeste = {
  ca: string
  servidorCert: string
  servidorChave: string
  /** .pfx de uma unidade assinado pela CA de teste */
  unidadePfx: Buffer
  unidadeSenha: string
  /** .pfx de outra CA: o EHR Auth o recusa */
  estranhoPfx: Buffer
}

/** Gera (uma vez) a CA de teste e os certificados, com o openssl. Só para teste. */
export function gerarCertificadosDeTeste(pasta: string): CertificadosDeTeste {
  mkdirSync(pasta, { recursive: true })
  const p = (n: string) => join(pasta, n)
  const ossl = (...args: string[]) => execFileSync('openssl', args, { stdio: 'pipe' })
  const senha = 'teste-simulador'
  if (!existsSync(p('unidade.pfx'))) {
    const subj = (cn: string) => `/CN=${cn}`
    for (const ca of ['ca', 'outra-ca']) {
      ossl('req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', p(`${ca}.key`), '-out', p(`${ca}.crt`),
        '-days', '365', '-subj', subj(`RNDS simulador ${ca} (teste)`))
    }
    // "simulador" é o nome do contêiner no compose do VPS (5.3c)
    writeFileSync(p('servidor.ext'), 'subjectAltName=DNS:localhost,DNS:simulador,IP:127.0.0.1\nextendedKeyUsage=serverAuth\n')
    writeFileSync(p('cliente.ext'), 'extendedKeyUsage=clientAuth\n')
    const emitir = (nome: string, ca: string, ext: string, cn: string) => {
      ossl('req', '-newkey', 'rsa:2048', '-nodes', '-keyout', p(`${nome}.key`), '-out', p(`${nome}.csr`), '-subj', subj(cn))
      ossl('x509', '-req', '-in', p(`${nome}.csr`), '-CA', p(`${ca}.crt`), '-CAkey', p(`${ca}.key`), '-CAcreateserial',
        '-out', p(`${nome}.crt`), '-days', '365', '-extfile', p(ext))
    }
    emitir('servidor', 'ca', 'servidor.ext', 'localhost')
    emitir('estranho', 'outra-ca', 'cliente.ext', 'Unidade de outra cadeia (teste)')
    emitir('unidade', 'ca', 'cliente.ext', 'UPA de teste (simulador RNDS)')
    for (const nome of ['estranho', 'unidade']) {
      ossl('pkcs12', '-export', '-inkey', p(`${nome}.key`), '-in', p(`${nome}.crt`), '-out', p(`${nome}.pfx`),
        '-passout', `pass:${senha}`, '-certpbe', 'AES-256-CBC', '-keypbe', 'AES-256-CBC', '-macalg', 'sha256')
    }
  }
  return {
    ca: readFileSync(p('ca.crt'), 'utf8'),
    servidorCert: readFileSync(p('servidor.crt'), 'utf8'),
    servidorChave: readFileSync(p('servidor.key'), 'utf8'),
    unidadePfx: readFileSync(p('unidade.pfx')),
    unidadeSenha: senha,
    estranhoPfx: readFileSync(p('estranho.pfx')),
  }
}

export type Recebido = { id: string; headers: IncomingMessage['headers']; bundle: Record<string, unknown> }

export class SimuladorRnds {
  server: Server
  /** tokens emitidos (o teste confere o reaproveitamento) */
  tokensEmitidos = 0
  recebidos: Recebido[] = []
  /** CNS de profissional sem CBO autorizado: 422 ERR906 */
  cnsSemCbo = new Set<string>()
  /** respostas forçadas para os próximos envios, na ordem */
  proximas: { status: number; corpo?: unknown }[] = []
  private tokens = new Map<string, number>()
  private ids = new Set<string>()

  constructor(c: Pick<CertificadosDeTeste, 'ca' | 'servidorCert' | 'servidorChave'>) {
    this.server = createServer({ ca: c.ca, cert: c.servidorCert, key: c.servidorChave, requestCert: true, rejectUnauthorized: false },
      (req, res) => { void this.atender(req, res) })
  }

  ouvir(porta = 0, host = '127.0.0.1'): Promise<string> {
    return new Promise((resolve) => this.server.listen(porta, host, () => {
      const a = this.server.address()
      resolve(`https://${host === '0.0.0.0' ? '127.0.0.1' : host}:${typeof a === 'object' && a ? a.port : porta}`)
    }))
  }

  fechar(): Promise<void> {
    return new Promise((resolve) => this.server.close(() => resolve()))
  }

  expirarTokens() {
    this.tokens.clear()
  }

  private async atender(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url ?? '/', 'https://simulador')
    const corpo = await lerCorpo(req)
    if (url.pathname === '/api/token' && (req.method === 'GET' || req.method === 'POST')) {
      if (!(req.socket as TLSSocket).authorized) {
        return responder(res, 401, erro('EHR-ERR882', 'Token de certificado inválido (certificado de cliente ausente ou não reconhecido)'))
      }
      const token = `sim-${randomUUID()}`
      this.tokens.set(token, Date.now() + 1_800_000)
      this.tokensEmitidos++
      return responder(res, 200, { access_token: token, scope: 'read write', token_type: 'jwt', expires_in: 1_800_000 })
    }
    if (url.pathname === '/api/fhir/r4/Bundle' && req.method === 'POST') return this.receberBundle(req, res, corpo)
    return responder(res, 404, erro('SIM-404', `${req.method} ${url.pathname} não existe no simulador`))
  }

  private receberBundle(req: IncomingMessage, res: ServerResponse, corpo: string) {
    const token = String(req.headers['x-authorization-server'] ?? '').replace(/^Bearer /, '')
    const vale = this.tokens.get(token)
    if (!vale || vale < Date.now()) return responder(res, 401, erro('EHR-ERR932', 'Precisa estar autenticado (token ausente ou vencido)'))
    const cns = String(req.headers.authorization ?? '')
    if (!/^\d{15}$/.test(cns)) return responder(res, 422, erro('EHR-ERR930', 'Header Authorization sem o CNS do profissional'))
    const forcada = this.proximas.shift()
    if (forcada) return responder(res, forcada.status, forcada.corpo ?? erro('SIM', `resposta forçada ${forcada.status}`))
    if (this.cnsSemCbo.has(cns)) {
      return responder(res, 422, erro('EHR-ERR906', `Profissional ${cns} não autorizado: sem vínculo CBO autorizado nos estabelecimentos da credencial`))
    }
    let bundle: Record<string, unknown>
    try {
      bundle = JSON.parse(corpo)
    } catch {
      return responder(res, 422, erro('EHR-ERR000', 'JSON inválido'))
    }
    if (bundle.resourceType !== 'Bundle' || bundle.type !== 'document') return responder(res, 422, erro('EHR-ERR922', 'Não é um Bundle do tipo document'))
    const ts = Date.parse(String(bundle.timestamp ?? ''))
    if (!Number.isFinite(ts) || Math.abs(ts - Date.now()) > 10 * 60_000) {
      return responder(res, 422, erro('EHR-ERR807', 'Bundle.timestamp tem de ser a data e hora do envio'))
    }
    if (!(bundle.identifier as { system?: string } | undefined)?.system?.includes('/NamingSystem/BRRNDS-')) {
      return responder(res, 422, erro('EHR-ERR917', 'Falta o identificador do documento no sistema de origem'))
    }
    const composicao = ((bundle.entry as { resource?: Record<string, unknown> }[] | undefined)?.[0]?.resource ?? {}) as {
      resourceType?: string; relatesTo?: { targetReference?: { reference?: string } }[]
    }
    if (composicao.resourceType !== 'Composition') return responder(res, 422, erro('EHR-ERR922', 'A Composition tem de ser o primeiro recurso'))
    const alvo = composicao.relatesTo?.[0]?.targetReference?.reference?.replace(/^Composition\//, '')
    if (alvo && !this.ids.has(alvo)) return responder(res, 422, erro('EHR-ERR827', `Documento ${alvo} a substituir não encontrado`))

    const id = randomUUID()
    this.ids.add(id)
    this.recebidos.push({ id, headers: req.headers, bundle })
    const local = `/api/fhir/r4/Bundle/${id}`
    res.writeHead(201, { location: local, 'content-location': local, 'content-type': 'application/json' })
    res.end()
  }
}

function erro(codigo: string, texto: string) {
  return { resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'processing', diagnostics: `(${codigo}) ${texto}` }] }
}

function responder(res: ServerResponse, status: number, corpo: unknown) {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(corpo))
}

function lerCorpo(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const partes: Buffer[] = []
    req.on('data', (c: Buffer) => partes.push(c))
    req.on('end', () => resolve(Buffer.concat(partes).toString('utf8')))
    req.on('error', reject)
  })
}

// ── linha de comando ─────────────────────────────────────────────────────────
if (process.argv[1]?.endsWith('simulador.ts')) {
  const arg = (nome: string) => { const i = process.argv.indexOf(nome); return i > 0 ? process.argv[i + 1] : undefined }
  const pasta = arg('--certs')
  if (!pasta) {
    console.error('Uso: node services/rnds-envio/simulador/simulador.ts --porta 8443 --certs <pasta> [--host 0.0.0.0]')
    process.exit(1)
  }
  const certs = gerarCertificadosDeTeste(pasta)
  const sim = new SimuladorRnds(certs)
  const base = await sim.ouvir(Number(arg('--porta') ?? 8443), arg('--host') ?? '127.0.0.1')
  console.log(JSON.stringify({ evento: 'simulador', base, ca: join(pasta, 'ca.crt'), pfx: join(pasta, 'unidade.pfx') }))
}
