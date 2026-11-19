// Percurso da UBS, U15, vacina, PR 3: lotes de vacina da UBS.
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const HOJE = '2026-11-19'
const FORM = { imunobiologico: '42', lote: ' ab12-3 ', fabricante: '152', validade: '2027-03-01' }

test('U15 PR 3: o lote segue o formato do LEDI e a validade não passou', async () => {
  const { conferirLote, normalizarLote } = await import('../domain/vacinaLotes.ts')
  assert.equal(conferirLote(FORM, HOJE), null)
  assert.equal(normalizarLote(' ab12-3 '), 'AB12-3')
  assert.match(conferirLote({ ...FORM, imunobiologico: '' }, HOJE) ?? '', /imunobiológico/)
  assert.match(conferirLote({ ...FORM, lote: 'A B' }, HOJE) ?? '', /até 30/)
  assert.match(conferirLote({ ...FORM, lote: 'A'.repeat(31) }, HOJE) ?? '', /até 30/)
  assert.equal(conferirLote({ ...FORM, lote: 'DT/2026.1' }, HOJE), null)
  assert.match(conferirLote({ ...FORM, fabricante: '' }, HOJE) ?? '', /fabricante/)
  assert.match(conferirLote({ ...FORM, validade: '2026-11-18' }, HOJE) ?? '', /passou/)
  assert.equal(conferirLote({ ...FORM, validade: HOJE }, HOJE), null)
})

test('U15 PR 3: situação do lote e o que a sala de vacina oferece', async () => {
  const { situacaoLote, lotesParaAplicar } = await import('../domain/vacinaLotes.ts')
  assert.equal(situacaoLote({ ativo: false, validade: '2027-01-01' }, HOJE), 'desativado')
  assert.equal(situacaoLote({ ativo: true, validade: '2026-11-18' }, HOJE), 'vencido')
  assert.equal(situacaoLote({ ativo: true, validade: HOJE }, HOJE), 'vence_logo')
  assert.equal(situacaoLote({ ativo: true, validade: '2026-12-19' }, HOJE), 'vence_logo')
  assert.equal(situacaoLote({ ativo: true, validade: '2026-12-20' }, HOJE), 'valido')
  const base = { imunobiologico: 42, imunobiologico_nome: 'penta', sigla: 'PENTA', lote: 'L', fabricante: '152', fabricante_nome: 'BUTANTAN', vencido: false }
  const lotes = [
    { ...base, id: 'a', ativo: true, validade: '2027-01-01' },
    { ...base, id: 'b', ativo: true, validade: '2026-11-01' },
    { ...base, id: 'c', ativo: false, validade: '2027-01-01' },
  ]
  assert.deepEqual(lotesParaAplicar(lotes, HOJE).map((l) => l.id), ['a'])
})

test('U15 PR 3: Lotes de vacina só na UBS, para o gestor e o enfermeiro', async () => {
  const { itensDeNavegacao } = await import('../components/casca/navegacao.ts')
  for (const papel of ['gestor', 'enfermeiro'] as const) {
    assert.ok(itensDeNavegacao(papel, false, false, 'ubs').some((i) => i.to === '/vacina/lotes'), `${papel} sem Lotes de vacina na UBS`)
    assert.ok(!itensDeNavegacao(papel, false, false, 'upa').some((i) => i.to === '/vacina/lotes'), `${papel} vê Lotes de vacina na UPA`)
  }
  for (const papel of ['tecnico_enfermagem', 'recepcao', 'plantonista'] as const) {
    assert.ok(!itensDeNavegacao(papel, false, false, 'ubs').some((i) => i.to === '/vacina/lotes'), `${papel} vê Lotes de vacina`)
  }
  const app = readFileSync('src/App.tsx', 'utf8')
  assert.match(app, /<Route element={<RequireRole papeis={\['gestor', 'enfermeiro'\]} \/>}>\s*<Route path="\/vacina\/lotes" element={<LotesVacina \/>} \/>/)
})
