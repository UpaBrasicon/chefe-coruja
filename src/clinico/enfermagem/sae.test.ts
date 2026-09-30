// node --experimental-strip-types --test src/clinico/enfermagem/sae.test.ts   (npm run test:clinico)
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { ETAPAS_SAE, fichaSae, itemSaeValido } from './sae.ts'

test('SAE: as cinco etapas do protótipo, na ordem, e as três listas', () => {
  assert.deepEqual(ETAPAS_SAE.map((e) => e.id), ['avaliacao', 'diagnosticos', 'planejamento', 'implementacao', 'evolucao'])
  assert.deepEqual(ETAPAS_SAE.filter((e) => e.lista).map((e) => e.id), ['diagnosticos', 'planejamento', 'implementacao'])
  assert.ok(fichaSae.fontes.some((f) => /736\/2024/.test(f.citacao)))
})

test('SAE: item precisa do título da licença; código e detalhe opcionais, aparados', () => {
  assert.equal(itemSaeValido({ codigo: '00132', titulo: '  ' }), null)
  assert.equal(itemSaeValido({ titulo: 'ab' }), null)
  assert.deepEqual(itemSaeValido({ codigo: ' 00132 ', titulo: ' Dor aguda ', detalhe: ' r/a agente lesivo ' }),
    { codigo: '00132', titulo: 'Dor aguda', detalhe: 'r/a agente lesivo' })
  assert.deepEqual(itemSaeValido({ titulo: 'Nível de dor' }), { codigo: '', titulo: 'Nível de dor', detalhe: '' })
})
