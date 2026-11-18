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
  const nomes = (p: 'crianca' | 'adulto') => CAUSAS_REVERSIVEIS[p].itens.map((c) => c.causa)
  assert.ok(nomes('crianca').includes('Hipoglicemia'))
  assert.ok(!nomes('adulto').includes('Hipoglicemia'))
  // CR1/CR2: cada causa tem identificar, tratar e fonte; sem fonte, a tela diz
  for (const c of [...CAUSAS_REVERSIVEIS.crianca.itens, ...CAUSAS_REVERSIVEIS.adulto.itens]) {
    assert.ok(c.identificar && c.tratar && c.fonte, c.causa)
  }
  assert.equal(CAUSAS_REVERSIVEIS.crianca.itens.find((c) => c.causa === 'Trombose coronária')?.tratar, 'Sem fonte aberta.')
  // CR3: hipercalemia do adulto sem número de glicose (divergência 25 × 50 g vai para o lote D11)
  assert.ok(!/\d+ ?g\b/.test(CAUSAS_REVERSIVEIS.adulto.itens.find((c) => c.causa === 'Hipo ou hipercalemia')!.tratar))
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
