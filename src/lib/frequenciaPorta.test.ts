import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  FREQUENCIAS_PORTA, OUTRA, aguardaAprazamento, aprazamentoImpresso, frequenciaPortaReconhecida, intervaloDaPosologia,
  resumoDoses, textoResumoDoses, tomDoses, type DosePS,
} from './frequenciaPorta.ts'

// Frequência com horário na prescrição do PS (decisão do RT: A em F1 a F6,
// docs/porta/FREQUENCIA-PRESCRICAO-PS-DIAGNOSTICO.md).

test('F1: os chips da porta, na ordem, e o "Outra" com campo livre', () => {
  assert.deepEqual([...FREQUENCIAS_PORTA], ['Agora', 'Se necessário', '4/4h', '6/6h', '8/8h', '12/12h', '24/24h'])
  assert.equal(OUTRA, 'Outra')
})

test('o intervalo lido da posologia é o mesmo do servidor (private.intervalo_posologia)', () => {
  assert.equal(intervaloDaPosologia('8/8h'), 8)
  assert.equal(intervaloDaPosologia('12 / 12 horas'), 12)
  assert.equal(intervaloDaPosologia('de 6 em 6 h'), 6)
  assert.equal(intervaloDaPosologia('a cada 4 horas'), 4)
  assert.equal(intervaloDaPosologia('3x ao dia'), 8)
  assert.equal(intervaloDaPosologia('2 vezes por dia'), 12)
  assert.equal(intervaloDaPosologia('uma vez ao dia'), 24)
  assert.equal(intervaloDaPosologia('Três vezes ao dia'), 8)
  assert.equal(intervaloDaPosologia('8/12h'), null)
  assert.equal(intervaloDaPosologia('a cada 5 horas'), null)
  assert.equal(intervaloDaPosologia('8/8hrs'), null)
  assert.equal(intervaloDaPosologia('de manhã'), null)
  assert.equal(intervaloDaPosologia(''), null)
  assert.equal(intervaloDaPosologia(null), null)
})

test('F1: frequência que a porta aceita', () => {
  for (const f of FREQUENCIAS_PORTA.filter((x) => x !== 'Se necessário')) assert.equal(frequenciaPortaReconhecida(f, false), true, f)
  assert.equal(frequenciaPortaReconhecida(' agora ', false), true)
  assert.equal(frequenciaPortaReconhecida('Contínuo', false), true)
  assert.equal(frequenciaPortaReconhecida('Se necessário', true), true)
  assert.equal(frequenciaPortaReconhecida('Se necessário', false), false)
  assert.equal(frequenciaPortaReconhecida('a cada 6 horas', false), true)
  assert.equal(frequenciaPortaReconhecida('de manhã', false), false)
  assert.equal(frequenciaPortaReconhecida('', false), false)
})

const dose = (situacao: DosePS['situacao'], horario = '08:00'): DosePS =>
  ({ horario, previsto_em: '2026-11-06T11:00:00Z', situacao, em: null, por: null, motivo: null })

test('F2: o resumo das doses por horário', () => {
  const doses = [dose('feito'), dose('atrasada', '16:00'), dose('pendente', '00:00'), dose('pendente', '08:00')]
  assert.deepEqual(resumoDoses(doses), { feitas: 1, naoFeitas: 0, recusadas: 0, atrasadas: 1, pendentes: 2 })
  assert.equal(textoResumoDoses(doses), '1 feita · 1 atrasada · 2 pendentes')
  assert.equal(textoResumoDoses([dose('nao_feito'), dose('recusado')]), '1 não feita · 1 recusada')
})

test('F2: o tom das doses (vencida sem resolver é vermelho)', () => {
  assert.equal(tomDoses([dose('feito'), dose('atrasada')]), 'vermelho')
  assert.equal(tomDoses([dose('recusado'), dose('pendente')]), 'vermelho')
  assert.equal(tomDoses([dose('feito'), dose('pendente')]), 'ambar')
  assert.equal(tomDoses([dose('feito'), dose('nao_feito')]), 'verde')
})

test('aguarda aprazamento: frequência com intervalo e sem horários', () => {
  assert.equal(aguardaAprazamento({ posologia: '8/8h', se_necessario: false, horarios: [] }), true)
  assert.equal(aguardaAprazamento({ posologia: '8/8h', se_necessario: false, horarios: ['08:00'] }), false)
  assert.equal(aguardaAprazamento({ posologia: 'Agora', se_necessario: false, horarios: null }), false)
  assert.equal(aguardaAprazamento({ posologia: '8/8h', se_necessario: true, horarios: [] }), false)
})

test('F6: a coluna de aprazamento da folha leva os horários', () => {
  assert.equal(aprazamentoImpresso(['08:00', '16:00', '00:00']), '08:00 16:00 00:00')
  assert.equal(aprazamentoImpresso([]), '')
  assert.equal(aprazamentoImpresso(null), '')
})

// ── telas ───────────────────────────────────────────────────────────────────
const estruturada = readFileSync('src/components/prescricao/PrescricaoEstruturada.tsx', 'utf8')
const aba = readFileSync('src/pages/plantao/porta/AbaPrescricao.tsx', 'utf8')
const aba_leito = readFileSync('src/components/internacao/documentos/PrescricaoTab.tsx', 'utf8')

test('F1: a porta mostra os chips de frequência e o campo do "Outra"', () => {
  assert.match(estruturada, /FREQUENCIAS_PORTA\.map\(/)
  assert.match(estruturada, /\{OUTRA\}/)
  assert.match(estruturada, /\{outra && \([\s\S]{0,400}id="item-freq-outra"/)
})

test('F2: a aba Prescrição da porta mostra as doses por horário', () => {
  assert.match(aba, /i\.doses/)
  assert.match(aba, /textoResumoDoses\(/)
  assert.match(aba, /Agora, se necessário ou com horário\. Vai para a checagem da enfermagem\./)
  assert.doesNotMatch(aba, /Dose única ou para fazer aqui/)
})

test('F4: a prescrição do leito mostra "Vindos da porta" com suspender e alterar', () => {
  assert.match(aba_leito, /<PrescricaoEstruturada/)
  assert.match(estruturada, /rpc\('prescricao_porta_ativa', \{ p_paciente: pacienteId \}\)/)
  assert.match(estruturada, /Vindos da porta/)
  const bloco = estruturada.slice(estruturada.indexOf('Vindos da porta'))
  assert.match(bloco, /<LinhaItem /)
})

test('F6: a folha impressa do leito leva os horários aprazados', () => {
  assert.match(estruturada, /rpc\('horarios_dos_itens'/)
  assert.match(estruturada, /apr: aprazamentoImpresso\(/)
  assert.doesNotMatch(estruturada, /apr: ''/)
})
