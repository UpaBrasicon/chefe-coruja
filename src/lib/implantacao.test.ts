// node --experimental-strip-types --test src/lib/implantacao.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { diasEntre, faltamParaAceite, resumoFase, rotuloDia, situacaoPrazo, type Item } from './implantacao.ts'

const item = (x: Partial<Item>): Item => ({
  id: 'i', codigo: 'P01', fase: 'preparacao', titulo: 't', descricao: null, obrigatorio: true, responsavel: 'gestor',
  prazo: '2026-10-01', automatico: false, ok: false, detalhe: null, feito_em: null, feito_por: null, observacao: null, ...x,
})

test('implantação: dias relativos ao D0', () => {
  assert.equal(diasEntre('2026-10-31', '2026-10-01'), -30)
  assert.equal(rotuloDia('2026-10-31', '2026-10-01'), 'D-30')
  assert.equal(rotuloDia('2026-10-31', '2026-10-31'), 'D0')
  assert.equal(rotuloDia('2026-10-31', '2026-11-14'), 'D+14')
  // atravessa o fim do horário de verão sem errar um dia
  assert.equal(diasEntre('2026-02-20', '2026-02-24'), 4)
})

test('implantação: situação do prazo', () => {
  assert.equal(situacaoPrazo({ ok: true, prazo: '2026-01-01' }, '2026-10-10'), 'feito')
  assert.equal(situacaoPrazo({ ok: false, prazo: '2026-10-09' }, '2026-10-10'), 'atrasado')
  assert.equal(situacaoPrazo({ ok: false, prazo: '2026-10-13' }, '2026-10-10'), 'perto')
  assert.equal(situacaoPrazo({ ok: false, prazo: '2026-10-20' }, '2026-10-10'), 'no_prazo')
})

test('implantação: resumo por fase e o que falta para o aceite', () => {
  const itens = [
    item({ codigo: 'P01', ok: true }), item({ codigo: 'P02' }), item({ codigo: 'P10', obrigatorio: false }),
    item({ codigo: 'V01', fase: 'virada' }), item({ codigo: 'E01', fase: 'encerramento' }),
  ]
  assert.deepEqual(resumoFase(itens, 'preparacao'), { feitos: 1, obrigatorios: 2, total: 3 })
  assert.deepEqual(faltamParaAceite(itens, 'virada').map((i) => i.codigo), ['P02', 'V01'])
  assert.deepEqual(faltamParaAceite(itens, 'encerramento').map((i) => i.codigo), ['P02', 'V01', 'E01'])
})
