import assert from 'node:assert/strict'
import { test } from 'node:test'

import { DISPOSITIVOS_DA_FITA, dispositivosDaCor, fichaDispositivosDaFita, ROTULOS_DISPOSITIVO } from './dispositivosDaFita.ts'
import { CORES_BROSELOW } from './fitaBroselow.ts'
import { EQUIPAMENTO } from './viaAerea.ts'

// Dispositivos por cor (decisões DP1–DP6 do RT de 18/11/2026).

test('uma linha por cor, na ordem da fita, com todos os itens e a fonte de cada um', () => {
  assert.deepEqual(DISPOSITIVOS_DA_FITA.map((d) => d.cor), CORES_BROSELOW.map((c) => c.id))
  for (const d of DISPOSITIVOS_DA_FITA) {
    for (const [k] of ROTULOS_DISPOSITIVO) assert.ok(d[k].valor && d[k].fonte, `${d.cor} ${k}`)
  }
  assert.equal(fichaDispositivosDaFita.publico, 'pediatrico')
  assert.ok(fichaDispositivosDaFita.fontes.every((f) => f.pediatrica))
})

test('tubo sem cuff pela fonte aberta e com cuff 0,5 mm menor (DP2)', () => {
  const sem = DISPOSITIVOS_DA_FITA.map((d) => d.tuboSemCuff.valor)
  assert.deepEqual(sem, ['3,5 mm', '3,5 mm', '3,5 mm', '4,0 mm', '4,5 mm', '5,0 mm', '5,5 mm', '6,0 mm', '6,5 mm'])
  assert.ok(DISPOSITIVOS_DA_FITA.every((d) => d.tuboComCuff.fonte.startsWith('calculado')))
  // profundidade = 3 × diâmetro sem cuff
  for (const d of DISPOSITIVOS_DA_FITA) {
    const di = Number(d.tuboSemCuff.valor.split(' ')[0].replace(',', '.'))
    assert.ok(d.profundidade.valor.startsWith(`${String(3 * di).replace('.', ',')} cm`), d.cor)
  }
})

test('o e-book não dá número (DP1, DP6): sem Miller 0 acima de 3 kg e sem intraóssea', () => {
  assert.equal(dispositivosDaCor('rosa')?.lamina.valor, 'Miller 1')
  assert.ok(!DISPOSITIVOS_DA_FITA.some((d) => JSON.stringify(d).includes('ntraóss')))
  assert.ok(!DISPOSITIVOS_DA_FITA.some((d) => d.lamina.fonte.includes('e-book') || d.guedel.fonte.includes('e-book')))
})

test('itens do livro do ICr batem com a tabela da ferramenta Via aérea (DP3)', () => {
  const linha = (r: string) => EQUIPAMENTO.find((l) => l.rotulo.startsWith(r))!
  assert.equal(dispositivosDaCor('rosa')?.sondaGastrica.valor, `${linha('0–6 meses').sondaGastrica} Fr`)
  assert.equal(dispositivosDaCor('vermelho')?.drenoTorax.valor, `${linha('6–12 meses').drenoTorax} Fr`)
  assert.equal(dispositivosDaCor('roxo')?.sondaVesical.valor, `${linha('1–3 anos').foley} Fr`)
  assert.equal(dispositivosDaCor('azul')?.acessoVenoso.valor, `${linha('4–7 anos').jelco} G`)
  assert.equal(dispositivosDaCor('verde')?.drenoTorax.valor, `${linha('8–10 anos').drenoTorax} Fr`)
  // branco e laranja mostram as duas linhas
  assert.match(dispositivosDaCor('branco')!.sondaVesical.valor, /1–3 anos.*4–7 anos/)
  assert.match(dispositivosDaCor('laranja')!.drenoTorax.valor, /4–7 anos.*8–10 anos/)
})
