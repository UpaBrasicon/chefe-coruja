// Percurso da UBS, U15, vacina, PR 4: sala de vacina e caderneta.
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

// recorte das tabelas do LEDI APS 8.7.0 (migration 20270415000025)
const R = {
  imunobiologicos: [
    { codigo: 42, nome: 'vacina penta', sigla: 'PENTA', tem_regra: true },
    { codigo: 15, nome: 'Vacina BCG', sigla: 'BCG', tem_regra: true },
    { codigo: 85, nome: 'COVID-19', sigla: 'COVID', tem_regra: false },
  ],
  estrategias: [{ codigo: 1, nome: 'Rotina' }, { codigo: 2, nome: 'Especial' }, { codigo: 11, nome: 'Pesquisa' }],
  doses: [{ codigo: 1, nome: '1ª Dose', sigla: 'D1' }, { codigo: 2, nome: '2ª Dose', sigla: 'D2' }, { codigo: 3, nome: '3ª Dose', sigla: 'D3' },
    { codigo: 4, nome: '4ª Dose', sigla: 'D4' }, { codigo: 8, nome: 'Dose', sigla: 'D' }, { codigo: 9, nome: 'Única', sigla: 'DU' }],
  regras: [[42, 1, 1], [42, 1, 2], [42, 1, 3], [42, 2, 8], [15, 1, 9]] as [number, number, number][],
  grupos: [{ codigo: 121, nome: 'FAIXA ETÁRIA' }],
  vias: [{ codigo: 2, nome: 'INTRADÉRMICA' }, { codigo: 3, nome: 'INTRAMUSCULAR' }],
  locais: [{ codigo: 2, nome: 'DELTÓIDE DIREITO' }, { codigo: 14, nome: 'FACE EXTERNA SUPERIOR DO BRAÇO DIREITO' }],
  via_local: [[3, 2], [2, 14]] as [number, number][],
  covid: [85],
}
const HOJE = '2026-11-19'

test('U15 PR 4: estratégia, dose e local seguem a regra do LEDI', async () => {
  const { estrategiasDe, dosesDe, dosesAnterior, locaisDe } = await import('../domain/salaVacina.ts')
  assert.deepEqual(estrategiasDe(R, 42).map((e) => e.codigo), [1, 2])
  assert.deepEqual(dosesDe(R, 42, 1).map((d) => d.codigo), [1, 2, 3])
  assert.deepEqual(dosesDe(R, 42, 2).map((d) => d.codigo), [8])
  assert.deepEqual(dosesAnterior(R, 42).map((d) => d.codigo), [1, 2, 3, 8])
  assert.equal(dosesAnterior(R, 85).length, R.doses.length) // sem regra: todas as doses
  assert.deepEqual(locaisDe(R, 3).map((l) => l.codigo), [2])
  assert.deepEqual(locaisDe(R, 2).map((l) => l.codigo), [14])
})

test('U15 PR 4: a aplicação pede o que o LEDI exige', async () => {
  const { APLICACAO_VAZIA, conferirAplicacao, dadosAplicacao } = await import('../domain/salaVacina.ts')
  const f = { ...APLICACAO_VAZIA, imunobiologico: '42', estrategia: '1', dose: '1', lote_id: 'l', via: '3', local: '2' }
  assert.equal(APLICACAO_VAZIA.grupo_atendimento, '121')
  assert.equal(conferirAplicacao(R, f, 'M'), null)
  assert.match(conferirAplicacao(R, f, 'F') ?? '', /condição maternal/)
  assert.equal(conferirAplicacao(R, { ...f, condicao_maternal: '2' }, 'F'), null)
  assert.match(conferirAplicacao(R, { ...f, dose: '4' }, 'M') ?? '', /dose/)
  assert.match(conferirAplicacao(R, { ...f, lote_id: '' }, 'M') ?? '', /lote/)
  assert.match(conferirAplicacao(R, { ...f, local: '14' }, 'M') ?? '', /local/)
  const bcg = { ...f, imunobiologico: '15', estrategia: '1', dose: '9', via: '2', local: '14' }
  assert.match(conferirAplicacao(R, bcg, 'M') ?? '', /hanseníase/)
  assert.equal(conferirAplicacao(R, { ...bcg, comunicante_hanseniase: 'nao' }, 'M'), null)
  const esp = { ...f, estrategia: '2', dose: '8' }
  assert.match(conferirAplicacao(R, esp, 'M') ?? '', /CBO/)
  assert.match(conferirAplicacao(R, { ...esp, prescritor_cbo: '225125' }, 'M') ?? '', /CID-10/)
  assert.equal(conferirAplicacao(R, { ...esp, prescritor_cbo: '225125', cid10_motivo: 'D80.0' }, 'M'), null)
  const d = dadosAplicacao({ ...bcg, comunicante_hanseniase: 'nao' }, 'M')
  assert.deepEqual(d, { imunobiologico: 15, estrategia: 1, dose: 9, lote_id: 'l', grupo_atendimento: 121, via: 2, local: 14, viajante: false, comunicante_hanseniase: false })
  assert.equal(dadosAplicacao({ ...f, condicao_maternal: '2' }, 'F').condicao_maternal, 2)
})

test('U15 PR 4: a transcrição da caderneta pede data entre o nascimento e hoje e, na COVID, o exterior', async () => {
  const { ANTERIOR_VAZIO, conferirAnterior, dadosAnterior } = await import('../domain/salaVacina.ts')
  const f = { ...ANTERIOR_VAZIO, imunobiologico: '42', dose: '1', data_aplicacao: '2026-07-01', via: '3', local: '2' }
  assert.equal(conferirAnterior(R, f, 'M', '2026-05-01', HOJE), null)
  assert.match(conferirAnterior(R, f, 'M', null, HOJE) ?? '', /nascimento/)
  assert.match(conferirAnterior(R, { ...f, data_aplicacao: '2026-04-30' }, 'M', '2026-05-01', HOJE) ?? '', /do nascimento até hoje/)
  assert.match(conferirAnterior(R, { ...f, data_aplicacao: '2026-11-20' }, 'M', '2026-05-01', HOJE) ?? '', /do nascimento até hoje/)
  const covid = { ...f, imunobiologico: '85', data_aplicacao: '2021-08-01' }
  assert.match(conferirAnterior(R, covid, 'M', '1990-01-01', HOJE) ?? '', /exterior/)
  assert.deepEqual(dadosAnterior(R, { ...covid, aplicado_exterior: 'sim' }, 'M'),
    { imunobiologico: 85, dose: 1, data_aplicacao: '2021-08-01', via: 3, local: 2, viajante: false, aplicado_exterior: true })
})

test('U15 PR 4: Sala de vacina só na UBS, para o técnico e o enfermeiro', async () => {
  const { itensDeNavegacao } = await import('../components/casca/navegacao.ts')
  for (const papel of ['enfermeiro', 'tecnico_enfermagem'] as const) {
    assert.ok(itensDeNavegacao(papel, false, false, 'ubs').some((i) => i.to === '/vacina'), `${papel} sem Sala de vacina na UBS`)
    assert.ok(!itensDeNavegacao(papel, false, false, 'upa').some((i) => i.to === '/vacina'), `${papel} vê Sala de vacina na UPA`)
  }
  for (const papel of ['recepcao', 'plantonista', 'gestor'] as const) {
    assert.ok(!itensDeNavegacao(papel, false, false, 'ubs').some((i) => i.to === '/vacina'), `${papel} vê Sala de vacina`)
  }
  const app = readFileSync('src/App.tsx', 'utf8')
  assert.match(app, /<Route path="\/vacina" element={<SalaVacina \/>} \/>/)
})

// Refinamento da UBS, RF6 = A (RT, 23/11/2026): a caderneta mostra primeiro o
// que está em atraso ou a completar, só pelo que o app calcula nas notas da SAPS.
test('RF6: bloco "Em atraso ou a completar" antes do registro, com a fonte de cada linha', async () => {
  const { rotuloPendencia } = await import('../domain/salaVacina.ts')
  assert.equal(rotuloPendencia('pentavalente'), 'Pentavalente')
  assert.equal(rotuloPendencia('tríplice viral'), 'Tríplice viral')
  assert.equal(rotuloPendencia('VIP'), 'VIP')
  assert.equal(rotuloPendencia('dTpa'), 'dTpa')
  assert.equal(rotuloPendencia('HPV'), 'HPV')
  const tela = readFileSync('src/pages/vacina/SalaVacina.tsx', 'utf8')
  assert.ok(tela.indexOf('<EmAtraso c={c} />') < tela.indexOf('{c.pode_registrar ? ('), 'o bloco vem antes do registro')
  assert.match(tela, /\{p\.indicador\} · \{p\.fonte\}/)
  const sql = readFileSync('supabase/migrations/20270415000034_ubs_rf6_caderneta_em_atraso.sql', 'utf8')
  assert.match(sql, /'pendencias', private\.vacina_pendencias\(pa\)/)
  assert.match(sql, /CONTINUE WHEN f = 'tríplice viral' AND v_meses < 12/)
  assert.match(sql, /v_hoje BETWEEN pg\.dum \+ 140 AND pg\.dum \+ 294/)
})
