// node --experimental-strip-types --test src/lib/anexoJustificativa.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { caminhoDoAnexo, caminhoNovoAnexo } from './anexoJustificativa.ts'

const uni = 'e1100000-0000-4000-8000-000000000001'

test('caminho gravado volta como está', () => {
  assert.equal(caminhoDoAnexo(`${uni}/justificativas/abc-atestado.pdf`), `${uni}/justificativas/abc-atestado.pdf`)
})

test('URL pública antiga vira o caminho do arquivo', () => {
  const url = `https://kswurfyxxvfydpjfrivy.supabase.co/storage/v1/object/public/atendimento/${uni}/justificativas/abc-atestado%20m%C3%A9dico.pdf`
  assert.equal(caminhoDoAnexo(url), `${uni}/justificativas/abc-atestado médico.pdf`)
})

test('URL de outro bucket ou vazio não dá caminho', () => {
  assert.equal(caminhoDoAnexo('https://exemplo.com/arquivo.pdf'), null)
  assert.equal(caminhoDoAnexo(''), null)
  assert.equal(caminhoDoAnexo(null), null)
})

test('caminho novo fica na pasta das justificativas da unidade, sem caracteres estranhos', () => {
  assert.equal(caminhoNovoAnexo(uni, 'atestado médico (1).pdf', 'id1'), `${uni}/justificativas/id1-atestado_m_dico__1_.pdf`)
})
