// node --test "src/domain/*.test.ts"   (npm run test:dominio)
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { ehPediatrico, idadeEm, rotuloIdade } from './idade.ts'
import { formatarDuracao, nivelDaObservacao, nivelDoTurno, tempoDeTurno } from './plantao.ts'

test('pediatria: recém-nascido nas primeiras 24 horas é pediátrico', () => {
  assert.equal(ehPediatrico('2026-09-26', '2026-09-26'), true)
})

test('pediatria: 13 anos, 11 meses e 29 dias ainda é pediátrico', () => {
  assert.equal(ehPediatrico('2012-09-27', '2026-09-26'), true)
})

test('pediatria: no dia em que completa 14 anos já é adulto', () => {
  assert.equal(ehPediatrico('2012-09-26', '2026-09-26'), false)
})

test('pediatria: nascido em 29/02 completa 14 anos em 01/03 do ano não bissexto', () => {
  assert.equal(ehPediatrico('2012-02-29', '2026-02-28'), true)
  assert.equal(ehPediatrico('2012-02-29', '2026-03-01'), false)
})

test('idade: nascimento no futuro é inválido, não "zero"', () => {
  assert.equal(idadeEm('2026-10-01', '2026-09-26'), null)
  assert.equal(ehPediatrico('2026-10-01', '2026-09-26'), null)
})

test('idade: anos, meses e dias exatos', () => {
  assert.deepEqual(idadeEm('2000-01-31', '2000-03-01'), { anos: 0, meses: 1, dias: 1, totalDias: 30 })
})

test('rótulo: dias até 30, meses até 23, depois anos', () => {
  assert.equal(rotuloIdade('2026-09-16', '2026-09-26'), '10d')
  assert.equal(rotuloIdade('2025-09-26', '2026-09-26'), '12m')
  assert.equal(rotuloIdade('2020-09-26', '2026-09-26'), '6a')
})

// 2026-09-26T14:30:00-03:00 = 17:30 UTC
const as1430 = new Date('2026-09-26T17:30:00Z')

test('turno da tarde (13–19): às 14h30 faltam 4h30 de 6h', () => {
  assert.deepEqual(tempoDeTurno('tarde', as1430), { restante: 270, duracao: 360 })
})

test('turno da noite atravessa a meia-noite: às 02h faltam 5h', () => {
  const as02 = new Date('2026-09-27T05:00:00Z') // 02:00 em Brasília
  assert.deepEqual(tempoDeTurno('noite', as02), { restante: 300, duracao: 720 })
})

test('turno da noite às 20h: faltam 11h', () => {
  const as20 = new Date('2026-09-26T23:00:00Z')
  assert.equal(tempoDeTurno('noite', as20).restante, 660)
})

test('nível do turno: última hora é atenção, últimos 15 min são críticos', () => {
  assert.equal(nivelDoTurno(61), 'ok')
  assert.equal(nivelDoTurno(60), 'atencao')
  assert.equal(nivelDoTurno(15), 'critico')
})

test('observação: janela de 6 h — âmbar na última hora, vermelho depois', () => {
  assert.equal(nivelDaObservacao(299), 'ok')
  assert.equal(nivelDaObservacao(300), 'atencao')
  assert.equal(nivelDaObservacao(360), 'atencao')
  assert.equal(nivelDaObservacao(361), 'critico')
})

test('duração formatada', () => {
  assert.equal(formatarDuracao(45), '45 min')
  assert.equal(formatarDuracao(185), '3h05')
})

test('janela do plantão: noite de 12 h que começou ontem às 19h, às 02h faltam 5h', async () => {
  const { tempoDaJanela } = await import('./plantao.ts')
  const inicio = new Date('2026-09-25T22:00:00Z') // 19:00 em Brasília
  const fim = new Date('2026-09-26T10:00:00Z')    // 07:00
  const agora = new Date('2026-09-26T05:00:00Z')  // 02:00
  assert.deepEqual(tempoDaJanela(inicio, fim, agora), { restante: 300, duracao: 720 })
})

// ── prioridade legal na fila da triagem ──────────────────────────────────────
import { ordemTriagem, rotulosPrioridade } from './prioridade.ts'

test('fila da triagem: 80+ antes das demais prioridades, que vêm antes da chegada', () => {
  const fila = [
    { id: 'sem', prioridades_legais: [], chegada_em: '2026-09-27T10:00:00Z' },
    { id: 'gestante', prioridades_legais: ['gestante'], chegada_em: '2026-09-27T10:20:00Z' },
    { id: '80', prioridades_legais: ['idoso_60', 'idoso_80'], chegada_em: '2026-09-27T10:30:00Z' },
    { id: '60', prioridades_legais: ['idoso_60'], chegada_em: '2026-09-27T10:10:00Z' },
  ].sort(ordemTriagem)
  assert.deepEqual(fila.map((f) => f.id), ['80', '60', 'gestante', 'sem'])
})

test('rótulo: 80+ aparece uma vez, sem repetir 60+', () => {
  assert.deepEqual(rotulosPrioridade(['idoso_60', 'idoso_80', 'pcd']), ['80 anos ou mais', 'Pessoa com deficiência'])
})

// ── fila médica ──────────────────────────────────────────────────────────────
import { ordemMedica } from './risco.ts'

test('fila médica: cor primeiro; prioridade legal só desempata dentro da cor', () => {
  const fila = [
    { id: 'verde-80', cor_atual: 'verde' as const, prioridades_legais: ['idoso_60', 'idoso_80'], classificado_em: '2026-09-27T10:00:00Z' },
    { id: 'amarelo-tarde', cor_atual: 'amarelo' as const, prioridades_legais: [], classificado_em: '2026-09-27T10:40:00Z' },
    { id: 'amarelo-gestante', cor_atual: 'amarelo' as const, prioridades_legais: ['gestante'], classificado_em: '2026-09-27T10:50:00Z' },
    { id: 'amarelo-cedo', cor_atual: 'amarelo' as const, prioridades_legais: [], classificado_em: '2026-09-27T10:05:00Z' },
    { id: 'laranja', cor_atual: 'laranja' as const, prioridades_legais: [], classificado_em: '2026-09-27T10:55:00Z' },
  ].sort(ordemMedica)
  assert.deepEqual(fila.map((f) => f.id), ['laranja', 'amarelo-gestante', 'amarelo-cedo', 'amarelo-tarde', 'verde-80'])
})

// ── espera na porta por cor (cartão de turno) ────────────────────────────────
import { esperaPorCor } from './esperaPorta.ts'

test('espera por cor: conta, maior espera e alvo estourado pela cor', () => {
  const agora = new Date('2026-09-30T12:00:00Z')
  const r = esperaPorCor([
    { cor_atual: 'amarelo', classificado_em: '2026-09-30T11:30:00Z' },
    { cor_atual: 'amarelo', classificado_em: '2026-09-30T10:50:00Z' },
    { cor_atual: 'laranja', classificado_em: '2026-09-30T11:55:00Z' },
    { cor_atual: 'vermelho', classificado_em: '2026-09-30T11:59:00Z' },
    { cor_atual: null, classificado_em: null },
  ], agora)
  const por = Object.fromEntries(r.map((x) => [x.cor, x]))
  assert.deepEqual(por.amarelo, { cor: 'amarelo', aguardando: 2, maiorMin: 70, acimaDoAlvo: true })
  assert.deepEqual(por.laranja, { cor: 'laranja', aguardando: 1, maiorMin: 5, acimaDoAlvo: false })
  assert.equal(por.vermelho.acimaDoAlvo, true) // vermelho é imediato: 1 min já passou do alvo
  assert.deepEqual(por.azul, { cor: 'azul', aguardando: 0, maiorMin: null, acimaDoAlvo: false })
})

// ── paciente da Central (modo adulto/pediátrico) ─────────────────────────────
import { lerPaciente, lerPositivo, modoPelaIdade, PACIENTE_VAZIO } from './pacienteCentral.ts'

test('Central: o corte de 14 anos é o da unidade, em qualquer unidade de idade', () => {
  assert.equal(modoPelaIdade(13, 'anos'), 'pediatrico')
  assert.equal(modoPelaIdade(14, 'anos'), 'adulto')
  assert.equal(modoPelaIdade(167, 'meses'), 'pediatrico')
  assert.equal(modoPelaIdade(168, 'meses'), 'adulto')
  assert.equal(modoPelaIdade(20, 'dias'), 'pediatrico')
})

test('Central: peso só da balança, positivo; nada é estimado', () => {
  assert.equal(lerPositivo('70,5'), 70.5)
  assert.equal(lerPositivo('0'), null)
  assert.equal(lerPositivo(''), null)
  assert.equal(lerPositivo('-3'), null)
  assert.equal(lerPositivo('7O'), null)
})

test('Central: adulto completo com o peso; pediátrico precisa de idade abaixo de 14 anos e peso', () => {
  assert.equal(lerPaciente({ ...PACIENTE_VAZIO, modo: 'adulto' }).completo, false)
  assert.equal(lerPaciente({ ...PACIENTE_VAZIO, modo: 'adulto', peso: '72' }).completo, true)
  assert.equal(lerPaciente({ ...PACIENTE_VAZIO, modo: 'pediatrico', peso: '16' }).completo, false)
  assert.equal(lerPaciente({ ...PACIENTE_VAZIO, modo: 'pediatrico', peso: '16', idade: '4' }).completo, true)
  const fora = lerPaciente({ ...PACIENTE_VAZIO, modo: 'pediatrico', peso: '50', idade: '15' })
  assert.equal(fora.idadeForaDaPediatria, true)
  assert.equal(fora.completo, false)
  assert.equal(lerPaciente(PACIENTE_VAZIO).completo, false)
})

// ── R6 (auditoria 03/10/2026): pediatria pela idade; idade desconhecida não é adulto
import { aplicaCuidadoPediatrico, faixaEtaria, ofereceConteudoAdulto, publicosDeProtocolo, rotuloFaixa } from './idade.ts'
import { faltandoVitais, publicoDosVitais } from './vitais.ts'

test('faixa etária: pela idade, não pela porta; sem nascimento é desconhecida', () => {
  assert.equal(faixaEtaria('2016-01-10', '2026-10-03'), 'pediatrico')
  assert.equal(faixaEtaria('2011-01-10', '2026-10-03'), 'adulto', 'adolescente de 15 é adulto mesmo na porta pediátrica')
  assert.equal(faixaEtaria('2012-10-04', '2026-10-03'), 'pediatrico', '13a 11m 29d')
  assert.equal(faixaEtaria('2012-10-03', '2026-10-03'), 'adulto', '14 anos completos')
  assert.equal(faixaEtaria(null, '2026-10-03'), 'desconhecida')
  assert.equal(faixaEtaria(undefined, '2026-10-03'), 'desconhecida')
  assert.equal(faixaEtaria('', '2026-10-03'), 'desconhecida')
  assert.equal(faixaEtaria('2027-01-01', '2026-10-03'), 'desconhecida', 'nascimento no futuro')
})

test('idade desconhecida: nada de adulto (receita padrão, favoritos, NEWS2/qSOFA)', () => {
  assert.equal(ofereceConteudoAdulto('adulto'), true)
  assert.equal(ofereceConteudoAdulto('pediatrico'), false)
  assert.equal(ofereceConteudoAdulto('desconhecida'), false)
})

test('idade desconhecida: prescrição pelo peso aferido, como na criança', () => {
  assert.equal(aplicaCuidadoPediatrico('pediatrico'), true)
  assert.equal(aplicaCuidadoPediatrico('desconhecida'), true)
  assert.equal(aplicaCuidadoPediatrico('adulto'), false)
})

test('vitais da reclassificação: PA exigida só no adulto pela idade', () => {
  const semPa = { 'frequencia-cardiaca': '100', 'frequencia-respiratoria': '24', temperatura: '37', 'saturacao-o2': '97', 'escala-dor': '2' }
  assert.deepEqual(faltandoVitais(semPa, publicoDosVitais('pediatrico')), [])
  assert.deepEqual(faltandoVitais(semPa, publicoDosVitais('desconhecida')), [], 'sem idade a PA não trava')
  assert.deepEqual(faltandoVitais(semPa, publicoDosVitais('adulto')).map((v) => v.k), ['pressao-arterial-sistolica', 'pressao-arterial-diastolica'])
  assert.equal(faltandoVitais({}, publicoDosVitais('desconhecida')).length, 5, 'os demais continuam obrigatórios')
})

test('protocolos da observação: sem idade, só os de público "todos"', () => {
  assert.deepEqual(publicosDeProtocolo('desconhecida'), ['todos'])
  assert.deepEqual(publicosDeProtocolo('pediatrico'), ['todos', 'pediatrico'])
  assert.deepEqual(publicosDeProtocolo('adulto'), ['todos', 'adulto'])
})

test('rótulo da fila: pediatria pela idade; sem nascimento avisa; adulto sem rótulo', () => {
  assert.equal(rotuloFaixa('pediatrico'), 'pediatria')
  assert.equal(rotuloFaixa('desconhecida'), 'sem data de nascimento')
  assert.equal(rotuloFaixa('adulto'), '')
})
