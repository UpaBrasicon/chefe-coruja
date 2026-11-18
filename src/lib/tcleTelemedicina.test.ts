import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { faltasDoConsentimento, TEXTO_TCLE_TELEMEDICINA } from './tcleTelemedicina.ts'

const migration = readFileSync(new URL('../../supabase/migrations/20270418000092_lg8_telemedicina.sql', import.meta.url), 'utf8')

test('LG8: o texto que a tela mostra é o mesmo que vai para o prontuário', () => {
  const sql = migration.replace(/'\s*\|\|\s*'/g, '').replace(/'\s*\|\|\s*E'\\n'\s*\|\|\s*'/g, ' ')
  for (const frase of TEXTO_TCLE_TELEMEDICINA) {
    for (const parte of frase.split('. ')) assert.ok(sql.includes(parte.replace(/\.$/, '')), `falta no banco: ${parte}`)
  }
  assert.ok(TEXTO_TCLE_TELEMEDICINA.some((f) => f.includes('pode recusar')), 'o termo diz que o paciente pode recusar')
})

test('LG8: regras do consentimento iguais às do banco', () => {
  const base = { consentimento: 'obtido', forma: '' as const, testemunha: '', representante: '', justificativa: '' }
  assert.deepEqual(faltasDoConsentimento({ ...base, consentimento: '' }), ['o consentimento'])
  assert.deepEqual(faltasDoConsentimento(base), ['como o consentimento foi dado'])
  assert.deepEqual(faltasDoConsentimento({ ...base, forma: 'verbal_testemunha' }), ['o nome da testemunha da equipe'])
  assert.deepEqual(faltasDoConsentimento({ ...base, forma: 'verbal_testemunha', testemunha: 'Enf. Maria' }), [])
  assert.deepEqual(faltasDoConsentimento({ ...base, forma: 'assinatura_papel' }), [])
  assert.deepEqual(faltasDoConsentimento({ ...base, consentimento: 'representante_legal', forma: 'assinatura_papel' }), ['o nome e o vínculo do representante legal'])
  assert.deepEqual(faltasDoConsentimento({ ...base, consentimento: 'emergencia_sem_condicao', justificativa: 'curta' }), ['por que não houve consentimento (15 caracteres ou mais)'])
  assert.deepEqual(faltasDoConsentimento({ ...base, consentimento: 'emergencia_sem_condicao', justificativa: 'Paciente inconsciente na chegada' }), [])
})
