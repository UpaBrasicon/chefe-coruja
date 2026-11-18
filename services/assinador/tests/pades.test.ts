// PAdES AD-RB de ponta a ponta com um certificado de TESTE gerado aqui
// (CA de teste + certificado com o otherName da ICP-Brasil). Nada aqui é uma
// assinatura válida na ICP-Brasil: a cadeia de teste não leva à raiz do ITI.
import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash, privateEncrypt, constants } from 'node:crypto'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PDFDocument, PDFDict, PDFName, StandardFonts } from 'pdf-lib'
import * as pkijs from 'pkijs'
import * as asn1js from 'asn1js'

import { atributosAssinados, conferirCms, derDosAtributos, hashParaAssinar, montarCms } from '../src/cms.ts'
import { dadosDoCertificado } from '../src/certificado.ts'
import { bytesCobertos, fecharByteRange, gravarCms, lerAssinatura, prepararPdf } from '../src/pades.ts'
import { OID, OID_SAUDE, POLITICA_PADES_AD_RB } from '../src/politica.ts'

const dir = mkdtempSync(join(tmpdir(), 'assinador-'))
const ossl = (...a: string[]) => execFileSync('openssl', a, { cwd: dir, stdio: 'pipe' })
let certDer: Buffer
let caDer: Buffer
let chave: Buffer

before(() => {
  ossl('req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'ca.key', '-out', 'ca.pem', '-days', '30',
    '-subj', '/C=BR/O=ICP-Brasil TESTE/CN=AC TESTE CHEFE CORUJA')
  // otherName 2.16.76.1.3.1: nascimento 01011980 + CPF 12345678909 + resto
  writeFileSync(join(dir, 'ext.cnf'), [
    '[ext]',
    'basicConstraints=CA:FALSE',
    'keyUsage=critical,digitalSignature,nonRepudiation',
    'subjectAltName=otherName:2.16.76.1.3.1;OCTETSTRING:0101198012345678909000000000000000000000000',
  ].join('\n'))
  ossl('req', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'medico.key', '-out', 'medico.csr',
    '-subj', '/C=BR/O=ICP-Brasil TESTE/CN=MEDICA DE TESTE:12345678909')
  ossl('x509', '-req', '-in', 'medico.csr', '-CA', 'ca.pem', '-CAkey', 'ca.key', '-CAcreateserial', '-out', 'medico.pem',
    '-days', '30', '-extfile', 'ext.cnf', '-extensions', 'ext')
  ossl('x509', '-in', 'medico.pem', '-outform', 'DER', '-out', 'medico.der')
  ossl('x509', '-in', 'ca.pem', '-outform', 'DER', '-out', 'ca.der')
  certDer = readFileSync(join(dir, 'medico.der'))
  caDer = readFileSync(join(dir, 'ca.der'))
  chave = readFileSync(join(dir, 'medico.key'))
})

// O que o provedor faz no formato RAW: PKCS#1 v1.5 sobre o DigestInfo(SHA-256, hash).
const PREFIXO_SHA256 = Buffer.from('3031300d060960864801650304020105000420', 'hex')
const provedorRaw = (hash: Uint8Array) =>
  privateEncrypt({ key: chave, padding: constants.RSA_PKCS1_PADDING }, Buffer.concat([PREFIXO_SHA256, hash]))

async function pdfDeTeste() {
  const doc = await PDFDocument.create()
  const p = doc.addPage([595, 842])
  p.drawText('Atestado de teste', { x: 50, y: 780, size: 14, font: await doc.embedFont(StandardFonts.Helvetica) })
  return doc.save()
}

async function assinar(pdf: Uint8Array) {
  const preparado = await prepararPdf(pdf, {
    tipo: 'atestado', crmNumero: '12345', crmUf: 'SP', nomeMedico: 'Médica de Teste',
    motivo: 'Atestado médico', local: 'UPA de Teste', quando: new Date('2026-11-18T12:00:00Z'),
  })
  const { pdf: fechado, faixa } = fecharByteRange(preparado)
  const digest = createHash('sha256').update(bytesCobertos(fechado, faixa)).digest()
  const atributos = atributosAssinados(digest, certDer)
  const cms = montarCms({ atributos, assinaturaRaw: provedorRaw(hashParaAssinar(atributos)), certificadoDer: certDer, cadeiaDer: [caDer] })
  return gravarCms(fechado, faixa, cms)
}

test('certificado: serial, emissor, validade e CPF do otherName ICP-Brasil', () => {
  const d = dadosDoCertificado(certDer)
  assert.equal(d.cpf, '12345678909')
  assert.equal(d.emissor, 'AC TESTE CHEFE CORUJA')
  assert.match(d.titular, /MEDICA DE TESTE/)
  assert.match(d.serialHex, /^[0-9a-f]+$/)
  assert.ok(d.validoAte > new Date())
})

test('o hash enviado ao provedor cobre os quatro atributos da política AD-RB', () => {
  const atributos = atributosAssinados(new Uint8Array(32), certDer)
  assert.deepEqual(atributos.map((a) => a.type), [OID.contentType, OID.messageDigest, OID.signingCertificateV2, OID.sigPolicyId])
  const der = derDosAtributos(atributos)
  assert.equal(der[0], 0x31, 'assinado como SET')
  assert.equal(Buffer.from(hashParaAssinar(atributos)).toString('hex'), createHash('sha256').update(der).digest('hex'))
  const politica = atributos[3].values[0] as asn1js.Sequence
  assert.equal((politica.valueBlock.value[0] as asn1js.ObjectIdentifier).valueBlock.toString(), POLITICA_PADES_AD_RB.oid)
})

test('PAdES de ponta a ponta: o CMS confere com os bytes cobertos e o PDF continua legível', async () => {
  const assinado = await assinar(await pdfDeTeste())
  const { faixa, cms } = lerAssinatura(assinado)
  assert.equal(faixa[0], 0)
  assert.equal(faixa[2] + faixa[3], assinado.length, 'o /ByteRange cobre o arquivo até o fim')
  assert.deepEqual(await conferirCms(cms, bytesCobertos(assinado, faixa)), { ok: true })

  const doc = await PDFDocument.load(assinado)
  const info = doc.context.lookup(doc.context.trailerInfo.Info) as PDFDict
  assert.ok(info.get(PDFName.of(OID_SAUDE.tipo.atestado)), 'OID do tipo de documento nos metadados')
  assert.ok(info.get(PDFName.of(OID_SAUDE.crmNumero)), 'OID do CRM nos metadados')
  const texto = Buffer.from(assinado).toString('latin1')
  assert.match(texto, /\/SubFilter \/ETSI\.CAdES\.detached/)
  assert.match(texto, /\/TransformMethod \/DocMDP/)
  assert.doesNotMatch(texto, /\/Perms/)

  // o CMS leva o certificado e a cadeia
  const sd = new pkijs.SignedData({ schema: pkijs.ContentInfo.fromBER(cms.buffer.slice(cms.byteOffset, cms.byteOffset + cms.byteLength) as ArrayBuffer).content })
  assert.equal(sd.certificates?.length, 2)
})

test('um byte alterado no documento invalida a assinatura', async () => {
  const assinado = Buffer.from(await assinar(await pdfDeTeste()))
  const { faixa, cms } = lerAssinatura(assinado)
  const i = assinado.indexOf('Atestado de teste') >= 0 ? assinado.indexOf('Tj') - 3 : 100
  assinado[i] = assinado[i] ^ 0x01
  const r = await conferirCms(cms, bytesCobertos(assinado, faixa))
  assert.equal(r.ok, false)
})

test('certificado vencido não passa na conferência', async () => {
  const assinado = await assinar(await pdfDeTeste())
  const { faixa, cms } = lerAssinatura(assinado)
  const r = await conferirCms(cms, bytesCobertos(assinado, faixa), new Date('2099-01-01'))
  assert.deepEqual(r, { ok: false, motivo: 'certificado fora da validade' })
})

test('conferência independente: o openssl valida o CMS contra a CA de teste', async () => {
  const assinado = await assinar(await pdfDeTeste())
  const { faixa, cms } = lerAssinatura(assinado)
  writeFileSync(join(dir, 'assinatura.p7s'), cms)
  writeFileSync(join(dir, 'coberto.bin'), bytesCobertos(assinado, faixa))
  const saida = execFileSync('openssl', ['cms', '-verify', '-inform', 'DER', '-in', 'assinatura.p7s', '-binary',
    '-content', 'coberto.bin', '-CAfile', 'ca.pem', '-purpose', 'any', '-out', process.platform === 'win32' ? 'NUL' : '/dev/null'],
  { cwd: dir, stdio: 'pipe' })
  assert.ok(saida !== undefined)
})
