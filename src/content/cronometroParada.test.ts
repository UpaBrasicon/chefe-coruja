import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { ROTA_DA_FICHA } from '../clinico/indice.ts'
import { CAUSAS_REVERSIVEIS, FERRAMENTAS_DO_CRONOMETRO } from './cronometroParada.ts'
import { GUIA_ADULTO, rotasDoCartao } from './guiaRapido.ts'

// Cronômetro da parada (G3, RT em 18/11/2026).

test('causas reversíveis da AHA 2025: 11 na criança (com hipoglicemia), 10 no adulto', () => {
  assert.equal(CAUSAS_REVERSIVEIS.crianca.itens.length, 11)
  assert.equal(CAUSAS_REVERSIVEIS.adulto.itens.length, 10)
  assert.ok(CAUSAS_REVERSIVEIS.crianca.itens.includes('Hipoglicemia'))
  assert.ok(!CAUSAS_REVERSIVEIS.adulto.itens.includes('Hipoglicemia'))
  assert.match(CAUSAS_REVERSIVEIS.crianca.fonte, /Part 8, Figura 2/)
  assert.match(CAUSAS_REVERSIVEIS.adulto.fonte, /Part 9, Figura 2/)
})

test('as ferramentas abertas pelo cronômetro existem; o cartão do adulto abre o cronômetro', () => {
  const rotas = new Set(Object.values(ROTA_DA_FICHA))
  for (const f of [...FERRAMENTAS_DO_CRONOMETRO.crianca, ...FERRAMENTAS_DO_CRONOMETRO.adulto]) {
    assert.ok(f.rota.startsWith('/plantonista?guia=') || rotas.has(f.rota), f.rota)
  }
  assert.equal(GUIA_ADULTO[0].nome, 'Parada e reanimação')
  assert.ok('id' in GUIA_ADULTO[0] && GUIA_ADULTO[0].id === 'parada-adulto')
  assert.deepEqual(rotasDoCartao(GUIA_ADULTO[0]), ['/plantonista/emergencias/pcr-adulto'])
  const tela = readFileSync('src/components/plantonista/central/GuiaRapido.tsx', 'utf8')
  assert.match(tela, /guia === 'cronometro' \|\| guia === 'parada-adulto'\) return <CronometroParada \/>/)
})
