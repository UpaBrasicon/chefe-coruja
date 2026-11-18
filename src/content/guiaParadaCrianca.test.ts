import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { ROTA_DA_FICHA } from '../clinico/indice.ts'
import { DOSES_DA_FITA } from '../clinico/pediatria/dosesDaFita.ts'
import { CORES_BROSELOW } from '../clinico/pediatria/fitaBroselow.ts'
import { PESOS_DA_CINZA, origemDaCor, pesoDaDoseDoPaciente } from '../lib/fitaDoPeso.ts'
import { FERRAMENTAS_DA_PARADA, SITUACOES_PARADA } from './guiaParadaCrianca.ts'

// Guia de parada e reanimação da criança (G1–G5 = A, RT em 18/11/2026).

test('abas na ordem do RT e toda dose citada existe no módulo aprovado', () => {
  assert.deepEqual(SITUACOES_PARADA.map((s) => s.nome), ['Parada', 'Bradicardia', 'Taquicardia', 'Intubação', 'RCP'])
  const ids = new Set(DOSES_DA_FITA.map((d) => d.id))
  for (const s of SITUACOES_PARADA) {
    for (const g of s.grupos) if ('doses' in g) for (const id of g.doses) assert.ok(ids.has(id), `${s.id}: ${id}`)
  }
  // fentanil da intubação fica fora (D8)
  assert.ok(!SITUACOES_PARADA.flatMap((s) => s.grupos).some((g) => 'doses' in g && g.doses.some((id) => id.includes('fentanil'))))
})

test('neonatal continua ferramenta separada, aberta pela tela (G4)', () => {
  const rotas = new Set(Object.values(ROTA_DA_FICHA))
  for (const f of FERRAMENTAS_DA_PARADA) assert.ok(rotas.has(f.rota), f.rota)
  assert.ok(FERRAMENTAS_DA_PARADA.some((f) => f.rota.endsWith('reanimacao-neonatal')))
})

test('peso da dose: digitado vale; cor da lista usa o meio da faixa', () => {
  assert.deepEqual(pesoDaDoseDoPaciente({ peso: '12', origem: '' }), { origem: 'peso', kg: 12 })
  const daCor = pesoDaDoseDoPaciente({ peso: '13', origem: 'fita de Broselow, cor amarelo (12–14 kg → 13 kg)' })
  assert.equal(daCor.origem, 'cor')
  assert.equal(pesoDaDoseDoPaciente({ peso: '', origem: '' }).origem, 'nenhum')
})

test('G6: na cinza escolhida pela lista, sem peso, nada de meio da faixa; pede 3, 4 ou 5 kg', () => {
  const cinza = CORES_BROSELOW.find((c) => c.id === 'cinza')!
  assert.equal(origemDaCor(cinza), 'fita de Broselow, cor cinza (3–5 kg)')
  assert.equal(pesoDaDoseDoPaciente({ peso: '', origem: origemDaCor(cinza) }).origem, 'nenhum')
  assert.deepEqual([...PESOS_DA_CINZA], [3, 4, 5])
  // depois de escolher 3 kg, o peso é digitado e vale
  assert.deepEqual(pesoDaDoseDoPaciente({ peso: '3', origem: '' }), { origem: 'peso', kg: 3 })
  // nas outras cores, segue o meio da faixa
  const rosa = CORES_BROSELOW.find((c) => c.id === 'rosa')!
  const r = pesoDaDoseDoPaciente({ peso: '6,5', origem: origemDaCor(rosa) })
  assert.equal(r.origem === 'cor' && r.kg, 6.5)
})

test('o cartão da criança abre o guia de parada (G5)', () => {
  const tela = readFileSync('src/components/plantonista/central/GuiaRapido.tsx', 'utf8')
  assert.match(tela, /guia === 'parada-crianca'\) return <GuiaParadaCrianca \/>/)
})
