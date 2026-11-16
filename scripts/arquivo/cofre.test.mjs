// node --test scripts/arquivo/cofre.test.mjs
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { generateKeyPairSync } from 'node:crypto'
import { abrirEnvelope, assinar, cifrar, cifrar2, decifrar, decifrar2, derivarChave, digitalDaChave, enviar, envelopeDe, formatoDe, lerVersoes, listarVersoes, novaChaveEnvelopada, novoSal, salDe, versaoMaisAntiga } from './cofre.mjs'

test('cifra e decifra de volta; senha errada e arquivo alterado falham', () => {
  const sal = novoSal()
  const chave = derivarChave('senha-de-teste-longa', sal)
  const claro = Buffer.from('prontuário de teste ✓')
  const c = cifrar(chave, sal, claro)
  assert.ok(salDe(c).equals(sal))
  assert.ok(decifrar(chave, c).equals(claro))
  assert.throws(() => decifrar(derivarChave('outra-senha-longa', sal), c), /senha errada/)
  const mexido = Buffer.from(c); mexido[mexido.length - 1] ^= 1
  assert.throws(() => decifrar(chave, mexido), /senha errada ou arquivo alterado/)
  assert.throws(() => salDe(Buffer.from('xxxx')), /não é um arquivo/)
})

// Exemplo "GET Object" da documentação da AWS (Signature Version 4, cabeçalho
// Authorization): mesma chave, data e cabeçalhos → mesma assinatura.
test('assinatura SigV4 confere com o exemplo da AWS', () => {
  const { cabecalhos } = assinar({
    metodo: 'GET', bucket: 'examplebucket', regiao: 'us-east-1', chaveObjeto: 'test.txt', host: 'examplebucket.s3.amazonaws.com',
    cabecalhos: { range: 'bytes=0-9' },
    corpoHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    cred: { id: 'AKIAIOSFODNN7EXAMPLE', segredo: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY' },
    agora: new Date('2013-05-24T00:00:00Z'),
  })
  assert.match(cabecalhos.authorization, /Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41$/)
})

// Guarda automática (CCG2): o servidor cifra só com a chave pública; abrir
// exige a chave privada e a frase dela.
test('CCG2: cifra com a pública, abre só com a privada e a frase', () => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem', cipher: 'aes-256-cbc', passphrase: 'frase-de-teste-longa' },
  })
  const { chave, envelope } = novaChaveEnvelopada(publicKey)
  const claro = Buffer.from('prontuário de teste ✓')
  const c = cifrar2(chave, envelope, claro)
  assert.equal(formatoDe(c), 'CCG2')
  const aberta = abrirEnvelope(privateKey, 'frase-de-teste-longa', envelopeDe(c))
  assert.ok(decifrar2(aberta, c).equals(claro))
  assert.throws(() => abrirEnvelope(privateKey, 'frase-errada-longa', envelopeDe(c)), /frase erradas/)
  const outra = generateKeyPairSync('rsa', { modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } })
  assert.throws(() => abrirEnvelope(outra.privateKey, undefined, envelopeDe(c)), /outra chave/)
  const mexido = Buffer.from(c); mexido[mexido.length - 1] ^= 1
  assert.throws(() => decifrar2(aberta, mexido), /arquivo alterado/)
  assert.match(digitalDaChave(publicKey), /^([0-9a-f]{4}:){15}[0-9a-f]{4}$/)
  assert.ok(!c.includes(chave), 'a chave da guarda não pode ir em claro no arquivo')
})

// S10, H1: arquivo truncado (tag menor que 16 bytes) é recusado nos dois formatos.
test('tag curta / arquivo truncado é recusado (CCG1 e CCG2)', () => {
  const sal = novoSal()
  const chave = derivarChave('senha-de-teste-longa', sal)
  const c1 = cifrar(chave, sal, Buffer.from('x'))
  assert.equal(decifrar(chave, cifrar(chave, sal, Buffer.alloc(0))).length, 0, 'arquivo vazio cifrado continua abrindo')
  assert.throws(() => decifrar(chave, c1.subarray(0, 44)), /truncado/)   // tag de 12 bytes
  assert.throws(() => decifrar(chave, c1.subarray(0, 36)), /truncado/)   // tag de 4 bytes
  const { publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } })
  const { chave: k2, envelope } = novaChaveEnvelopada(publicKey)
  assert.equal(decifrar2(k2, cifrar2(k2, envelope, Buffer.alloc(0))).length, 0)
  const c2 = cifrar2(k2, envelope, Buffer.from('x'))
  const fim = 6 + envelope.length
  assert.throws(() => decifrar2(k2, c2.subarray(0, fim + 24)), /truncado/)   // tag de 12 bytes
  assert.throws(() => decifrar2(k2, c2.subarray(0, 5)), /truncado/)
})

// Exemplos "GET Bucket Lifecycle" e "Get Bucket (List Objects)" da documentação
// da AWS (SigV4 com query string).
test('assinatura SigV4 com query string confere com os exemplos da AWS', () => {
  const base = {
    metodo: 'GET', bucket: 'examplebucket', regiao: 'us-east-1', chaveObjeto: '', host: 'examplebucket.s3.amazonaws.com',
    corpoHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    cred: { id: 'AKIAIOSFODNN7EXAMPLE', segredo: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY' }, agora: new Date('2013-05-24T00:00:00Z'),
  }
  assert.match(assinar({ ...base, consulta: { lifecycle: '' } }).cabecalhos.authorization, /Signature=fea454ca298b7da1c68078a5d1bdbfbbe0d65c699e0f91ac7a200a0136783543$/)
  const l = assinar({ ...base, consulta: { prefix: 'J', 'max-keys': 2 } })
  assert.match(l.cabecalhos.authorization, /Signature=34b48302e7b5fa45bde8084f4b7868a86f0a534bc59db6670ed5711ef69dc6f7$/)
  assert.equal(l.url, 'https://examplebucket.s3.amazonaws.com/?max-keys=2&prefix=J')
})

// S10, H2: PUT ao cofre com If-None-Match: * (assinado); 412 vira erro claro.
test('envio manda If-None-Match: * assinado e trata 412 como "já existe no cofre"', async (t) => {
  const pedidos = []
  t.mock.method(globalThis, 'fetch', async (url, init) => { pedidos.push({ url, init }); return new Response('', { status: 412 }) })
  await assert.rejects(enviar({
    bucket: 'b', regiao: 'sa-east-1', chaveObjeto: 'auto-x/00001.ccg', corpo: Buffer.from('c'), cred: { id: 'AKIAX', segredo: 's' },
  }), /objeto já existe no cofre/)
  const h = pedidos[0].init.headers
  assert.equal(h['if-none-match'], '*')
  assert.match(h.authorization, /SignedHeaders=[^,]*if-none-match/)
})

// S10, H2: na restauração vale a versão MAIS ANTIGA de cada objeto.
const XML_VERSOES = `<?xml version="1.0" encoding="UTF-8"?>
<ListVersionsResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Name>chefe-coruja-guarda</Name><Prefix>auto-x/00001.ccg</Prefix><KeyMarker></KeyMarker><VersionIdMarker></VersionIdMarker>
  <MaxKeys>1000</MaxKeys><IsTruncated>false</IsTruncated>
  <Version><Key>auto-x/00001.ccg</Key><VersionId>v3-forjada</VersionId><IsLatest>true</IsLatest><LastModified>2026-11-20T03:31:00.000Z</LastModified><Size>10</Size></Version>
  <DeleteMarker><Key>auto-x/00001.ccg</Key><VersionId>dm</VersionId><IsLatest>false</IsLatest><LastModified>2026-01-01T00:00:00.000Z</LastModified></DeleteMarker>
  <Version><Key>auto-x/00001.ccg</Key><VersionId>v1-original</VersionId><IsLatest>false</IsLatest><LastModified>2026-11-16T03:31:00.000Z</LastModified><Size>10</Size></Version>
  <Version><Key>auto-x/00001.ccg.extra</Key><VersionId>outra-chave</VersionId><IsLatest>true</IsLatest><LastModified>2020-01-01T00:00:00.000Z</LastModified><Size>1</Size></Version>
</ListVersionsResult>`

test('versões: escolhe a mais antiga da chave exata, sem marcador de exclusão', () => {
  const { versoes, truncado } = lerVersoes(XML_VERSOES, 'auto-x/00001.ccg')
  assert.equal(truncado, false)
  assert.deepEqual(versoes.map((v) => v.versao), ['v3-forjada', 'v1-original'])
  assert.equal(versaoMaisAntiga(versoes).versao, 'v1-original')
  assert.equal(versaoMaisAntiga([]), null)
  const amp = '<ListVersionsResult><Version><Key>a&amp;b</Key><VersionId>1</VersionId><LastModified>2026-01-01T00:00:00Z</LastModified></Version></ListVersionsResult>'
  assert.equal(lerVersoes(amp, 'a&b').versoes.length, 1)
})

test('versões: a listagem pagina com key-marker e version-id-marker', async (t) => {
  const pag1 = `<ListVersionsResult><IsTruncated>true</IsTruncated><NextKeyMarker>auto-x/00001.ccg</NextKeyMarker><NextVersionIdMarker>v2</NextVersionIdMarker>
    <Version><Key>auto-x/00001.ccg</Key><VersionId>v2</VersionId><LastModified>2026-11-18T00:00:00Z</LastModified></Version></ListVersionsResult>`
  const pag2 = `<ListVersionsResult><IsTruncated>false</IsTruncated>
    <Version><Key>auto-x/00001.ccg</Key><VersionId>v1</VersionId><LastModified>2026-11-16T00:00:00Z</LastModified></Version></ListVersionsResult>`
  const urls = []
  t.mock.method(globalThis, 'fetch', async (url) => { urls.push(url); return new Response(urls.length === 1 ? pag1 : pag2) })
  const v = await listarVersoes({ bucket: 'b', regiao: 'sa-east-1', chaveObjeto: 'auto-x/00001.ccg', cred: { id: 'AKIAX', segredo: 's' } })
  assert.deepEqual(v.map((x) => x.versao), ['v2', 'v1'])
  assert.equal(versaoMaisAntiga(v).versao, 'v1')
  assert.match(urls[0], /^https:\/\/b\.s3\.sa-east-1\.amazonaws\.com\/\?prefix=auto-x%2F00001\.ccg&versions=$/)
  assert.match(urls[1], /key-marker=auto-x%2F00001\.ccg&prefix=.*&version-id-marker=v2&versions=$/)
})
