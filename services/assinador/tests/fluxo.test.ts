// Fluxo do assinador de ponta a ponta com dublês: provedor DOC-ICP-17 de teste
// (assina com um certificado de TESTE), banco, folha e guarda em memória.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash, privateEncrypt, constants, randomBytes } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PDFDocument } from 'pdf-lib'

import { conferirCms } from '../src/cms.ts'
import type { Provedor } from '../src/docicp17.ts'
import { assinarDocumento, encerrarSessao, ErroAssinador, iniciarSessao, retornoDoProvedor, type Dependencias, type Documento } from '../src/fluxo.ts'
import { bytesCobertos, lerAssinatura } from '../src/pades.ts'
import { Cofre, Pendentes, Sessoes } from '../src/sessoes.ts'

const dir = mkdtempSync(join(tmpdir(), 'fluxo-'))
const ossl = (...a: string[]) => execFileSync('openssl', a, { cwd: dir, stdio: 'pipe' })
let certDer: Buffer
let chave: Buffer
let srv: Server
let porta = 0
const codigos = new Map<string, string>()

before(async () => {
  ossl('req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'ca.key', '-out', 'ca.pem', '-days', '30', '-subj', '/C=BR/CN=AC TESTE')
  writeFileSync(join(dir, 'ext.cnf'), '[ext]\nbasicConstraints=CA:FALSE\nsubjectAltName=otherName:2.16.76.1.3.1;OCTETSTRING:0101198012345678909000000000000000000000000\n')
  ossl('req', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'm.key', '-out', 'm.csr', '-subj', '/C=BR/CN=MEDICA TESTE')
  ossl('x509', '-req', '-in', 'm.csr', '-CA', 'ca.pem', '-CAkey', 'ca.key', '-CAcreateserial', '-out', 'm.pem', '-days', '30', '-extfile', 'ext.cnf', '-extensions', 'ext')
  ossl('x509', '-in', 'm.pem', '-outform', 'DER', '-out', 'm.der')
  certDer = readFileSync(join(dir, 'm.der'))
  chave = readFileSync(join(dir, 'm.key'))
  const PREFIXO = Buffer.from('3031300d060960864801650304020105000420', 'hex')
  srv = createServer(async (req, res) => {
    let corpo = ''
    for await (const c of req) corpo += c
    const u = new URL(req.url!, 'http://x')
    const resp = (s: number, j: unknown) => { res.writeHead(s, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(j)) }
    if (u.pathname === '/token') {
      const f = new URLSearchParams(corpo)
      const ok = codigos.get(f.get('code') ?? '') === createHash('sha256').update(f.get('code_verifier') ?? '').digest('base64url')
      return ok ? resp(200, { access_token: 'tk', expires_in: 3600 }) : resp(400, {})
    }
    if (req.headers.authorization !== 'Bearer tk') return resp(401, {})
    if (u.pathname === '/certs') return resp(200, { certificates: [{ alias: 'a1', certificate: certDer.toString('base64') }] })
    if (u.pathname === '/sign') {
      const h = Buffer.from(JSON.parse(corpo).hashes[0].hash, 'base64')
      return resp(200, { signatures: [{ id: '1', raw_signature: privateEncrypt({ key: chave, padding: constants.RSA_PKCS1_PADDING }, Buffer.concat([PREFIXO, h])).toString('base64') }] })
    }
    resp(404, {})
  })
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', () => r()))
  porta = (srv.address() as { port: number }).port
})
after(() => srv.close())

function montar(over: Partial<Dependencias> & { docs?: Record<string, Documento>; cpf?: string } = {}) {
  // relógio do teste = hora real: o certificado de teste nasce agora (openssl -days 30)
  const agora = new Date()
  const fimPlantao = new Date(agora.getTime() + 5 * 3600_000)
  const guardados = new Map<string, Uint8Array>()
  const registro: Record<string, unknown>[] = []
  const provedor: Provedor = {
    id: 'vidaas', nome: 'Teste', base: `http://127.0.0.1:${porta}`, clientId: 'c', clientSecret: 's', redirectUri: 'https://r', hashEm: 'base64',
    caminhos: { autorizar: '/auth', token: '/token', certificados: '/certs', assinar: '/sign' },
  }
  const docs = over.docs ?? {
    d1: { id: 'd1', tipo: 'atestado', numero: 'A-1', estado: 'ativo', autorId: 'p1', assinadoEm: null, unidadeNome: 'UPA Teste', unidadeId: 'u1', pacienteId: 'pac1' },
    d2: { id: 'd2', tipo: 'evolucao', numero: 'E-1', estado: 'ativo', autorId: 'p1', assinadoEm: null, unidadeNome: 'UPA Teste', unidadeId: 'u1', pacienteId: 'pac1' },
    d3: { id: 'd3', tipo: 'receita', numero: 'R-1', estado: 'ativo', autorId: 'outro', assinadoEm: null, unidadeNome: 'UPA Teste', unidadeId: 'u1', pacienteId: 'pac1' },
  }
  const d: Dependencias = {
    provedores: [provedor],
    sessoes: new Sessoes(new Cofre(randomBytes(32).toString('hex')), undefined, () => agora),
    pendentes: new Pendentes(),
    quemE: async (jwt) => {
      if (jwt !== 'jwt-p1') throw new ErroAssinador(401, 'Sessão inválida')
      return { perfilId: 'p1', nome: 'Médica Teste', cpf: over.cpf ?? '12345678909', crmNumero: '12345', crmUf: 'SP' }
    },
    fimDoPlantao: async () => fimPlantao,
    documento: async (_jwt, id) => docs[id] ?? null,
    folhaPdf: async () => {
      const doc = await PDFDocument.create()
      doc.addPage()
      return doc.save()
    },
    urlConferencia: 'https://assina.exemplo/v',
    banco: {
      abrirSessao: async (v) => { registro.push({ abrir: v }); return 'sessao-1' },
      encerrarSessao: async (id, motivo) => { registro.push({ encerrar: id, motivo }) },
      registrarComPdf: async (v) => { guardados.set(v.documentoId, v.pdf); registro.push({ assinatura: v }); return 'assinatura-1' },
    },
    agora: () => agora,
    ...over,
  }
  return { d, guardados, registro, agora, fimPlantao }
}

async function abrirSessao(d: Dependencias) {
  const { url } = await iniciarSessao(d, 'jwt-p1', 'vidaas')
  const u = new URL(url)
  codigos.set('codigo-ok', u.searchParams.get('code_challenge')!)
  return retornoDoProvedor(d, u.searchParams.get('state')!, 'codigo-ok')
}

test('sessão: abre só no plantão, vai até o fim dele (máx. 12 h) e confere o CPF do certificado', async () => {
  const { d, registro, fimPlantao } = montar()
  const { url } = await iniciarSessao(d, 'jwt-p1', 'vidaas')
  assert.equal(new URL(url).searchParams.get('lifetime'), String(5 * 3600), 'até o fim do plantão (5 h)')
  const r = await abrirSessao(d)
  assert.equal(r.validaAte, fimPlantao.toISOString())
  const aberta = registro.find((x) => 'abrir' in x)!.abrir as { cpfFinal: string; emissor: string }
  assert.equal(aberta.cpfFinal, '8909', 'o banco recebe só o final do CPF')
  assert.equal(aberta.emissor, 'AC TESTE')

  const fora = montar({ fimDoPlantao: async () => null })
  await assert.rejects(iniciarSessao(fora.d, 'jwt-p1', 'vidaas'), /só abre dentro do plantão/)
  const outroCpf = montar({ cpf: '98765432100' })
  await assert.rejects(abrirSessao(outroCpf.d), /CPF do certificado não é o do seu cadastro/)
})

test('assinar: PDF PAdES conferido, guardado e registrado; o banco guarda só o hash do código', async () => {
  const { d, guardados, registro, agora } = montar()
  await assert.rejects(assinarDocumento(d, 'jwt-p1', 'd1'), /Sem sessão de assinatura/)
  await abrirSessao(d)
  const { assinaturaId, codigo } = await assinarDocumento(d, 'jwt-p1', 'd1')
  assert.equal(assinaturaId, 'assinatura-1')
  const pdf = guardados.get('d1')!
  const { faixa, cms } = lerAssinatura(pdf)
  assert.deepEqual(await conferirCms(cms, bytesCobertos(pdf, faixa), agora), { ok: true })
  const reg = registro.find((x) => 'assinatura' in x)!.assinatura as { codigoSha256: string }
  assert.equal(reg.codigoSha256, createHash('sha256').update(codigo).digest('hex'))
  assert.match(codigo, /^[A-HJ-NP-Z2-9]{32}$/, 'código alfanumérico de 32 símbolos, sem 0/O e 1/I')
})

test('assinar: recusa evolução (fica com login e 2FA), documento de outro médico e JWT inválido', async () => {
  const { d } = montar()
  await abrirSessao(d)
  await assert.rejects(assinarDocumento(d, 'jwt-p1', 'd2'), /não é assinado com ICP-Brasil/)
  await assert.rejects(assinarDocumento(d, 'jwt-p1', 'd3'), /Só o autor assina/)
  await assert.rejects(assinarDocumento(d, 'jwt-falso', 'd1'), /Sessão inválida/)
  await assert.rejects(assinarDocumento(d, 'jwt-p1', 'nao-existe'), /Documento não encontrado/)
})

test('encerrar: a sessão sai do assinador e do banco', async () => {
  const { d, registro } = montar()
  await abrirSessao(d)
  await encerrarSessao(d, 'jwt-p1', 'checkout')
  assert.deepEqual(registro.find((x) => 'encerrar' in x), { encerrar: 'sessao-1', motivo: 'checkout' })
  await assert.rejects(assinarDocumento(d, 'jwt-p1', 'd1'), /Sem sessão de assinatura/)
})
