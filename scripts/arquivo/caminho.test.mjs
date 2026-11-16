// node --test scripts/arquivo/caminho.test.mjs
// S10, H1: nenhum caminho que vem do índice da guarda ou do Storage escapa da
// pasta de destino; anexo com nome ruim é pulado sem derrubar a guarda.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { spawnSync } from 'node:child_process'
import { generateKeyPairSync } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { caminhoConfinado, caminhoValido, planejarAnexos, resumoNome } from './caminho.mjs'
import { cifrar2, novaChaveEnvelopada, sha256 } from './cofre.mjs'

const base = resolve(tmpdir(), 'guarda-teste-base')

test('nome bom é aceito e fica dentro da pasta', () => {
  assert.equal(caminhoConfinado(base, 'banco.dump'), join(base, 'banco.dump'))
  assert.equal(caminhoConfinado(base, 'storage/anexos/unidade 1/exame (2).pdf'), join(base, 'storage', 'anexos', 'unidade 1', 'exame (2).pdf'))
  assert.ok(caminhoValido('MANIFESTO.json'))
  assert.ok(caminhoValido('storage/b/ação_ç.pdf'))
})

test('índice com ../ é recusado', () => {
  for (const ruim of ['../fora.txt', 'storage/../../fora.txt', 'storage/..', './x', 'a/./b']) {
    assert.throws(() => caminhoConfinado(base, ruim), /caminho recusado/, ruim)
    assert.equal(caminhoValido(ruim), false, ruim)
  }
})

test('caminho absoluto é recusado', () => {
  for (const ruim of ['/etc/passwd', 'C:/Users/x/AppData/Roaming/Microsoft/Windows/Start Menu/Programs/Startup/a.bat', 'c:x', '\\\\servidor\\c$\\x']) {
    assert.throws(() => caminhoConfinado(base, ruim), /caminho recusado/, ruim)
  }
})

test('barra invertida, dois-pontos, controle e parte vazia são recusados', () => {
  for (const ruim of ['a\\..\\..\\b', 'nota.txt:fluxo', 'a\nb', 'a\u0000b', 'a\u0085b', 'a//b', 'a/', '', null, 42]) {
    assert.throws(() => caminhoConfinado(base, ruim), /caminho recusado/, String(ruim))
  }
})

test('anexos: nome inválido e colisão arquivo×pasta são pulados, o resto segue', () => {
  const { aceitos, pulados } = planejarAnexos([
    { bucket: 'exames', nome: 'u1/laudo.pdf' },
    { bucket: 'exames', nome: '../../etc/cron.d/x' },
    { bucket: 'exames', nome: 'x' },
    { bucket: 'exames', nome: 'x/y.pdf' },
    { bucket: 'fotos', nome: 'x' },           // outro bucket: não colide
    { bucket: '..', nome: 'a.pdf' },
  ])
  assert.deepEqual(aceitos, [
    { bucket: 'exames', nome: 'u1/laudo.pdf' },
    { bucket: 'exames', nome: 'x/y.pdf' },
    { bucket: 'fotos', nome: 'x' },
  ])
  assert.equal(pulados.length, 3)
  assert.deepEqual(pulados.map((p) => p.motivo).sort(), ['bucket com nome inválido', 'colisão arquivo×pasta', 'parte "." ou ".."'].sort())
  // o aviso não leva o nome (pode identificar paciente)
  for (const p of pulados) assert.ok(!JSON.stringify(p).includes('cron'), 'nome vazou no aviso')
  assert.match(resumoNome('Maria da Silva.pdf'), /^18 caractere\(s\), sha256 [0-9a-f]{12}$/)
})

// ── abrir-guarda.mjs de ponta a ponta (guarda CCG2 montada no teste) ────────

const ABRIR = fileURLToPath(new URL('./abrir-guarda.mjs', import.meta.url))
const FRASE = 'frase-de-teste-longa'
const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem', cipher: 'aes-256-cbc', passphrase: FRASE },
})

/** Monta uma guarda CCG2 com os arquivos dados e um índice (que o teste pode forjar). */
function montarGuarda(arquivos, extraManifesto = {}) {
  const raiz = mkdtempSync(join(tmpdir(), 'guarda-abrir-'))
  const origem = join(raiz, 'ccg')
  mkdirSync(origem)
  const { chave, envelope } = novaChaveEnvelopada(publicKey)
  const objetos = arquivos.map(([arquivo, texto], i) => {
    const nome = `${String(i + 1).padStart(5, '0')}.ccg`
    const claro = Buffer.from(texto)
    writeFileSync(join(origem, nome), cifrar2(chave, envelope, claro))
    return { objeto: `auto-teste/${nome}`, arquivo, sha256_claro: sha256(claro).toString('hex') }
  })
  const indice = { versao: 2, prefixo: 'auto-teste', manifesto: { gerado_em: 'teste', ...extraManifesto }, objetos }
  writeFileSync(join(origem, 'indice.ccg'), cifrar2(chave, envelope, Buffer.from(JSON.stringify(indice))))
  writeFileSync(join(raiz, 'privada.pem'), privateKey)
  const destino = join(raiz, 'destino')
  const r = spawnSync(process.execPath, [ABRIR, origem, '--destino', destino, '--chave-privada', join(raiz, 'privada.pem')], {
    env: { ...process.env, GUARDA_SENHA: FRASE }, encoding: 'utf8',
  })
  return { raiz, destino, status: r.status, saida: r.stdout + r.stderr }
}

test('abrir-guarda: índice forjado com ../ não grava fora do destino', () => {
  const g = montarGuarda([['banco.dump', 'ok'], ['../fora.txt', 'pwned'], ['storage/../../fora2.txt', 'pwned']])
  try {
    assert.equal(g.status, 1, g.saida)
    assert.match(g.saida, /recusado/)
    assert.ok(!existsSync(join(g.raiz, 'fora.txt')) && !existsSync(join(g.raiz, 'fora2.txt')), 'gravou fora do destino')
    assert.equal(readFileSync(join(g.destino, 'banco.dump'), 'utf8'), 'ok')
  } finally { rmSync(g.raiz, { recursive: true, force: true }) }
})

test('abrir-guarda: guarda antiga (sem lista de anexos) abre como antes', () => {
  const g = montarGuarda([['banco.dump', 'dump'], ['storage/exames/u1/laudo.pdf', 'pdf'], ['MANIFESTO.json', '{}']])
  try {
    assert.equal(g.status, 0, g.saida)
    assert.equal(readFileSync(join(g.destino, 'storage', 'exames', 'u1', 'laudo.pdf'), 'utf8'), 'pdf')
  } finally { rmSync(g.raiz, { recursive: true, force: true }) }
})

test('abrir-guarda: guarda nova devolve o anexo ao nome real; nome real ruim fica com o nome seguro', () => {
  const g = montarGuarda([['banco.dump', 'dump'], ['storage/anexo-00001', 'pdf'], ['storage/anexo-00002', 'ruim']], {
    anexos: [
      { arquivo: 'storage/anexo-00001', bucket: 'exames', nome: 'u1/laudo.pdf' },
      { arquivo: 'storage/anexo-00002', bucket: 'exames', nome: '../../../fora.txt' },
    ],
  })
  try {
    assert.equal(g.status, 0, g.saida)
    assert.equal(readFileSync(join(g.destino, 'storage', 'exames', 'u1', 'laudo.pdf'), 'utf8'), 'pdf')
    assert.equal(readFileSync(join(g.destino, 'storage', 'anexo-00002'), 'utf8'), 'ruim')
    assert.ok(!existsSync(join(g.raiz, 'fora.txt')))
  } finally { rmSync(g.raiz, { recursive: true, force: true }) }
})
