// node --experimental-strip-types --test src/lib/anexo.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cabeNoAccept, ehNomeDeColagem, extensao, itensDoAccept, nomeDeColado, problemaDoArquivo, tamanhoLegivel, triarArquivos } from './anexo.ts'

const MB = 1024 * 1024
const arq = (name: string, type: string, size = 1000) => ({ name, type, size })

test('extensão e itens do accept', () => {
  assert.equal(extensao('Laudo Final.PDF'), 'pdf')
  assert.equal(extensao('sem-extensao'), '')
  assert.deepEqual(itensDoAccept(' application/pdf, .PDF ,image/* '), ['application/pdf', '.pdf', 'image/*'])
  assert.deepEqual(itensDoAccept(undefined), [])
})

test('accept por tipo exato, por família e por extensão', () => {
  assert.equal(cabeNoAccept(arq('a.pdf', 'application/pdf'), 'application/pdf'), true)
  assert.equal(cabeNoAccept(arq('a.png', 'image/png'), 'application/pdf'), false)
  assert.equal(cabeNoAccept(arq('a.heic', 'image/heic'), 'application/pdf,image/*'), true)
  assert.equal(cabeNoAccept(arq('lista.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'), '.xlsx,.xls,.csv,.doc,.docx,.pdf'), true)
  assert.equal(cabeNoAccept(arq('lista.ods', 'application/vnd.oasis.opendocument.spreadsheet'), '.xlsx,.xls,.csv,.doc,.docx,.pdf'), false)
  assert.equal(cabeNoAccept(arq('a.jpg', 'image/jpeg'), '.pdf,image/png,image/jpeg,image/jpg'), true)
})

test('sem tipo (arrastado de alguns sistemas), o tipo sai da extensão', () => {
  assert.equal(cabeNoAccept(arq('laudo.pdf', ''), 'application/pdf'), true)
  assert.equal(cabeNoAccept(arq('foto.jpeg', ''), 'image/*'), true)
  assert.equal(cabeNoAccept(arq('virus.exe', ''), 'application/pdf,image/*'), false)
})

test('accept vazio aceita tudo', () => {
  assert.equal(cabeNoAccept(arq('qualquer.bin', 'application/octet-stream'), ''), true)
})

test('tamanho legível', () => {
  assert.equal(tamanhoLegivel(10), '1 KB')
  assert.equal(tamanhoLegivel(820 * 1024), '820 KB')
  assert.equal(tamanhoLegivel(1.5 * MB), '1,5 MB')
  assert.equal(tamanhoLegivel(10 * MB), '10 MB')
})

test('problema do arquivo: regra da tela primeiro, depois tipo, vazio e tamanho', () => {
  const opcoes = { accept: 'application/pdf', maxBytes: 10 * MB }
  assert.equal(problemaDoArquivo(arq('a.pdf', 'application/pdf'), opcoes), null)
  assert.equal(problemaDoArquivo(arq('a.png', 'image/png'), opcoes), 'Esse tipo de arquivo não é aceito aqui.')
  assert.equal(problemaDoArquivo(arq('a.pdf', 'application/pdf', 0), opcoes), 'O arquivo está vazio.')
  assert.equal(problemaDoArquivo(arq('a.pdf', 'application/pdf', 11 * MB), opcoes), 'O arquivo passa de 10 MB.')
  const validar = (f: { type: string }) => (f.type === 'application/pdf' ? null : 'O laudo precisa ser PDF.')
  assert.equal(problemaDoArquivo(arq('a.png', 'image/png'), { ...opcoes, validar }), 'O laudo precisa ser PDF.')
})

test('triagem: um arquivo só vale o primeiro; vários levam o nome no erro', () => {
  const lista = [arq('a.pdf', 'application/pdf'), arq('b.png', 'image/png'), arq('c.pdf', 'application/pdf')]
  const um = triarArquivos(lista, { accept: 'application/pdf' })
  assert.deepEqual(um.aceitos.map((a) => a.name), ['a.pdf'])
  assert.deepEqual(um.erros, [])
  const varios = triarArquivos(lista, { accept: 'application/pdf', multiple: true })
  assert.deepEqual(varios.aceitos.map((a) => a.name), ['a.pdf', 'c.pdf'])
  assert.deepEqual(varios.erros, ['b.png: Esse tipo de arquivo não é aceito aqui.'])
  const primeiroRuim = triarArquivos([arq('b.png', 'image/png')], { accept: 'application/pdf' })
  assert.deepEqual(primeiroRuim, { aceitos: [], erros: ['Esse tipo de arquivo não é aceito aqui.'] })
})

test('nome genérico da colagem', () => {
  assert.equal(ehNomeDeColagem('image.png'), true)
  assert.equal(ehNomeDeColagem('Pasted Graphic 2.png'), true)
  assert.equal(ehNomeDeColagem(''), true)
  assert.equal(ehNomeDeColagem('blob'), true)
  assert.equal(ehNomeDeColagem('laudo-hemograma.pdf'), false)
  assert.equal(ehNomeDeColagem('image-2026.png'), false)
})

test('nome do colado leva data e hora de Brasília e a extensão do tipo', () => {
  const agora = new Date('2026-11-10T17:32:05Z') // 14:32:05 em Brasília
  assert.equal(nomeDeColado('image/png', agora), 'colado-2026-11-10-14-32-05.png')
  assert.equal(nomeDeColado('image/jpeg', agora, 1), 'colado-2026-11-10-14-32-05-2.jpg')
  assert.equal(nomeDeColado('', agora, 0, 'image.webp'), 'colado-2026-11-10-14-32-05.webp')
  assert.equal(nomeDeColado('', agora), 'colado-2026-11-10-14-32-05')
})
