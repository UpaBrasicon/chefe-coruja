// node --experimental-strip-types --test src/lib/duplaChecagem.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { doseUnicaFeita, etapaDupla, origemAltaVigilancia, type ConferenciaAberta, type ItemAltaVigilancia } from './duplaChecagem.ts'

const conf = (horario: string | null, segundo: string | null): ConferenciaAberta => ({
  horario, primeiro_por: 'Ana', primeiro_em: '2026-10-08T10:00:00Z', segundo_por: segundo,
  segundo_em: segundo ? '2026-10-08T10:02:00Z' : null, sou_o_primeiro: false,
})

test('etapa da dupla checagem por horário', () => {
  assert.equal(etapaDupla(undefined, null).etapa, 'nenhuma')
  const estado = { item_id: 'i', regra: 'Insulinas (todas)', abertas: [conf('08:00', 'Bia'), conf('20:00', null)] }
  assert.equal(etapaDupla(estado, '08:00').etapa, 'pronta')
  assert.equal(etapaDupla(estado, '20:00').etapa, 'aguardando_segunda')
  assert.equal(etapaDupla(estado, '14:00').etapa, 'nenhuma')
  assert.equal(etapaDupla({ item_id: 'i', regra: 'x', abertas: [conf(null, null)] }, '').etapa, 'aguardando_segunda')
})

test('dose única "Agora" já feita não volta a pedir conferência', () => {
  assert.equal(doseUnicaFeita('Agora', false, 'feito'), true)
  assert.equal(doseUnicaFeita(' agora ', false, 'feito'), true)
  assert.equal(doseUnicaFeita('Agora', false, null), false)
  assert.equal(doseUnicaFeita('Agora', false, 'nao_feito'), false)
  assert.equal(doseUnicaFeita('8/8h', false, 'feito'), false)
  assert.equal(doseUnicaFeita('Agora', true, 'feito'), false)
})

test('origem da exigência', () => {
  const base: ItemAltaVigilancia = { id: 'm', principio_ativo: 'Morfina', apresentacao: 'amp', concentracao: null, cadastro: true, regra: 'Analgésicos opioides', exige: true, ajuste: null }
  assert.equal(origemAltaVigilancia(base), 'ISMP Brasil 2019 — Analgésicos opioides')
  assert.equal(origemAltaVigilancia({ ...base, ajuste: { exige: false, motivo: 'x', por: null, em: '' } }), 'Desmarcado pela unidade')
  assert.equal(origemAltaVigilancia({ ...base, regra: null }), 'Marcado no cadastro')
})
