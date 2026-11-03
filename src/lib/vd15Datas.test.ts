import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

// VD15 do lote "Virada de data" (BACKLOG.md): o dia de hoje e o dia de uma
// aferição são os de Brasília, não os do relógio do aparelho. O aparelho
// daqui fica em Tóquio (UTC+9): 22h de Brasília já é amanhã lá.
process.env.TZ = 'Asia/Tokyo'

const { nomeArquivo } = await import('./exportacao.ts')
const { hojeLocal } = await import('./rascunho.ts')
const { mesesDeIdade, paresImc } = await import('../clinico/crescimento/curvas.ts')

test('o aparelho do teste está fora do fuso de Brasília', () => {
  assert.equal(new Date('2026-11-01T22:00:00-03:00').getDate(), 2)
})

test('exportação sem período: o nome do arquivo leva o dia de Brasília', () => {
  const nome = nomeArquivo('csv', { unidade: 'UPA Centro', conjunto: 'leitos', desde: null, ate: null, mascarado: true,
    geradoEm: '2026-11-02T01:30:00.000Z' })
  assert.match(nome, /_2026_11_01\.csv$/)
})

test('rascunho: hoje é o dia de Brasília', () => {
  const agora = Date.now
  Date.now = () => Date.parse('2026-11-01T23:30:00-03:00')
  try {
    assert.equal(hojeLocal(), '2026-11-01')
  } finally {
    Date.now = agora
  }
})

test('curvas: peso das 8h e estatura das 22h do mesmo dia formam um IMC', () => {
  const pares = paresImc([{ aferidoEm: '2026-11-01T08:00:00-03:00', valor: 20 }],
    [{ aferidoEm: '2026-11-01T22:00:00-03:00', valor: 110 }])
  assert.equal(pares.length, 1)
})

test('curvas: a idade na aferição das 22h é a do dia de Brasília', () => {
  assert.equal(mesesDeIdade('2026-01-01', '2026-11-01T22:00:00-03:00'), mesesDeIdade('2026-01-01', '2026-11-01'))
})

// telas: o mês, a competência e o dia de hoje saem de dataIso(), não de new Date()
test('telas: hoje e o mês corrente vêm do dia de Brasília', () => {
  const ler = (p: string) => readFileSync(p, 'utf8')
  const extrato = ler('src/pages/Extrato.tsx')
  assert.doesNotMatch(extrato, /hoje\.getFullYear\(\)/)
  assert.match(extrato, /const hoje = dataIso\(\)/)
  assert.match(ler('src/pages/Escala.tsx'), /function hojeISO\(\) \{\s+return dataIso\(\)/)
  assert.match(ler('src/pages/MinhaAgenda.tsx'), /React\.useState\(\(\) => dataIso\(\)\.slice\(0, 7\)\)/)
  assert.doesNotMatch(ler('src/pages/faturamento/EnvioErp.tsx'), /compDe\(new Date\(\)\)/)
  assert.match(ler('src/components/encaminhamento/EncaminhamentosRecebidos.tsx'), /idadeEm\(nasc, dataIso\(\)\)/)
  const alta = ler('src/components/internacao/caderno/Alta.tsx')
  assert.match(alta, /setQuando\(dataHoraInput\(\)\)/)
  assert.doesNotMatch(alta, /new Date\(quando\)|Date\.parse\(quando\)/)
})
