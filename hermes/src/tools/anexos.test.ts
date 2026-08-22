// Testes da verificação de anexos do Cérbero (magic bytes, dupla extensão).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { verificarAnexo, detectarTipoPorConteudo, TAMANHO_MAX_ANEXO } from './anexos.ts'

const bytes = (hex: string): Uint8Array => {
  const a = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) a[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  return a
}

test('detectarTipoPorConteudo — reconhece PDF, PNG, JPG', () => {
  assert.equal(detectarTipoPorConteudo(bytes('25504446')), 'pdf') // %PDF
  assert.equal(detectarTipoPorConteudo(bytes('89504e470d0a1a0a')), 'png')
  assert.equal(detectarTipoPorConteudo(bytes('ffd8ff')), 'jpg')
  assert.equal(detectarTipoPorConteudo(bytes('0000')), null) // não reconhecido
})

test('verificarAnexo — PDF legítimo é seguro', () => {
  const r = verificarAnexo('laudo.pdf', bytes('25504446' + '00000000'))
  assert.equal(r.veredicto, 'seguro', JSON.stringify(r))
})

test('verificarAnexo — laudo.pdf.exe é malicioso (dupla extensão)', () => {
  const r = verificarAnexo('laudo.pdf.exe', bytes('25504446'))
  assert.equal(r.veredicto, 'malicioso')
  assert.ok(r.motivos.includes('dupla_extensao'))
})

test('verificarAnexo — arquivo .exe é malicioso direto', () => {
  const r = verificarAnexo('virus.exe', bytes('4d5a'))
  assert.equal(r.veredicto, 'malicioso')
})

test('verificarAnexo — executável MZ disfarçado de PDF é malicioso', () => {
  // Começa com %PDF mas contém MZ no início do payload real... na verdade o
  // caso real: nome .pdf com conteúdo MZ (executável)
  const r = verificarAnexo('laudo.pdf', bytes('4d5a'))
  assert.equal(r.veredicto, 'malicioso')
  assert.ok(r.motivos.includes('executavel_mz_disfarcado'))
})

test('verificarAnexo — PDF declarado mas conteúdo PNG é suspeito', () => {
  const r = verificarAnexo('laudo.pdf', bytes('89504e470d0a1a0a'))
  assert.equal(r.veredicto, 'suspeito')
  assert.ok(r.motivos.some((m) => m.includes('magic_bytes_incompativel')))
})

test('verificarAnexo — tamanho acima do limite é malicioso', () => {
  const grande = new Uint8Array(TAMANHO_MAX_ANEXO + 1)
  const r = verificarAnexo('laudo.pdf', grande)
  assert.equal(r.veredicto, 'malicioso')
  assert.ok(r.motivos.includes('tamanho_excedido'))
})

test('verificarAnexo — texto puro com extensão .txt é seguro', () => {
  const r = verificarAnexo('notas.txt', new TextEncoder().encode('apenas texto'))
  assert.equal(r.veredicto, 'seguro', JSON.stringify(r))
})
