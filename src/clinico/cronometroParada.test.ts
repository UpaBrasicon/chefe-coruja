import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  acaoAgora, antiarritmicoLiberado, dosesDaParada, epinefrinaDevida, fichaCronometroParada, mlNaAmpola, restaDoCiclo,
  situacaoDaParada, textoDoRegistro, type EstadoParada, type EventoParada, type RitmoParada,
} from './cronometroParada.ts'

// Cronômetro da parada (G3, construído com o RT em 18/11/2026).
const T0 = Date.UTC(2026, 10, 18, 14, 0, 0)
const min = (m: number) => T0 + m * 60_000
const ev = (tipo: EventoParada['tipo'], em: number, ritmo?: RitmoParada): EventoParada => ({ tipo, em, texto: tipo, ritmo })
const estado = (eventos: EventoParada[], publico: 'crianca' | 'adulto' = 'crianca'): EstadoParada => ({ publico, pesoKg: 13, eventos })

test('ritmo chocável: choque agora; depois do choque, compressões; epinefrina só depois do 2º choque', () => {
  let e = estado([ev('inicio', T0), ev('ritmo', min(0.2), 'fv')])
  assert.equal(acaoAgora(situacaoDaParada(e), min(0.3)), 'choque')
  e = estado([...e.eventos, ev('choque', min(0.5))])
  let s = situacaoDaParada(e)
  assert.equal(acaoAgora(s, min(0.6)), 'compressoes')
  assert.equal(epinefrinaDevida(s, min(0.6)), false)
  // o choque reinicia o ciclo de 2 min
  assert.equal(restaDoCiclo(s, min(0.5)), 120_000)
  // checagem: continua FV → novo ciclo, choque 2 → epinefrina libera
  e = estado([...e.eventos, ev('ritmo', min(2.5), 'fv'), ev('choque', min(2.6))])
  s = situacaoDaParada(e)
  assert.equal(s.ciclo, 2)
  assert.equal(acaoAgora(s, min(2.7)), 'epinefrina')
  assert.equal(antiarritmicoLiberado(s), false)
  e = estado([...e.eventos, ev('epinefrina', min(2.8)), ev('ritmo', min(4.6), 'fv'), ev('choque', min(4.7))])
  s = situacaoDaParada(e)
  assert.equal(antiarritmicoLiberado(s), true)
  // epinefrina de novo só com 3 min da última
  assert.equal(epinefrinaDevida(s, min(5.7)), false)
  assert.equal(epinefrinaDevida(s, min(5.8)), true)
})

test('ritmo não chocável: epinefrina logo, nunca choque', () => {
  const e = estado([ev('inicio', T0), ev('ritmo', min(0.2), 'assistolia')])
  const s = situacaoDaParada(e)
  assert.equal(acaoAgora(s, min(0.3)), 'epinefrina')
  const depois = situacaoDaParada(estado([...e.eventos, ev('epinefrina', min(0.5))]))
  assert.equal(acaoAgora(depois, min(1)), 'compressoes')
  assert.equal(acaoAgora(depois, min(3.5)), 'epinefrina')
})

test('sem ritmo escolhido, pede o ritmo; RCE e nova parada', () => {
  assert.equal(acaoAgora(situacaoDaParada(estado([ev('inicio', T0)])), T0), 'escolher-ritmo')
  const rce = estado([ev('inicio', T0), ev('ritmo', min(0.2), 'aesp'), ev('rce', min(3))])
  assert.equal(acaoAgora(situacaoDaParada(rce), min(4)), 'rce')
  const volta = situacaoDaParada(estado([...rce.eventos, ev('nova-parada', min(6))]))
  assert.equal(acaoAgora(volta, min(6.1)), 'escolher-ritmo')
})

test('doses: criança pelo peso (módulo aprovado); criança sem peso, nada; adulto pelo manual e AHA', () => {
  const c = dosesDaParada('crianca', 13)!
  assert.equal(c.choque(0).valor, '26 J')
  assert.equal(c.choque(1).valor, '52 J')
  assert.equal(c.epinefrina.valor, '0,13 mg')
  assert.match(c.epinefrina.detalhe, /^1,3 mL de 0,1 mg\/mL/)
  assert.equal(c.amiodarona(0).valor, '65 mg')
  assert.equal(dosesDaParada('crianca', null), null)
  const a = dosesDaParada('adulto', null)!
  assert.equal(a.epinefrina.valor, '1 mg')
  assert.equal(a.amiodarona(0).valor, '300 mg')
  assert.equal(a.amiodarona(1).valor, '150 mg')
  assert.equal(a.choque(0).valor, '200 J bifásico')
})

test('mL na ampola (RT, 20/11/2026): só com uma concentração; amiodarona a aspirar e diluir', () => {
  const c = dosesDaParada('crianca', 13)!
  assert.match(c.amiodarona(0).detalhe, /^1,3 mL da ampola de 50 mg\/mL, aspirar e diluir · /)
  assert.match(c.lidocaina.detalhe, /^0,65 mL da ampola de 20 mg\/mL · /)
  const a = dosesDaParada('adulto', 70)!
  assert.match(a.epinefrina.detalhe, /^1 mL da ampola de 1 mg\/mL · /)
  assert.match(a.amiodarona(0).detalhe, /^6 mL da ampola de 50 mg\/mL, aspirar e diluir/)
  assert.match(a.amiodarona(1).detalhe, /^3 mL da ampola/)
  assert.match(a.lidocaina.detalhe, /^3,5 a 5,25 mL da ampola de 20 mg\/mL/)
  // com duas concentrações, o cronômetro não escolhe
  assert.equal(mlNaAmpola([10, 10], [{ id: 'a', rotulo: 'a', porMl: 1, fonte: 'x' }, { id: 'b', rotulo: 'b', porMl: 5, fonte: 'x' }]), null)
  assert.equal(mlNaAmpola([10, 10], undefined), null)
  assert.equal(fichaCronometroParada.versao, '2026-11-20.1')
})

test('registro com hora, sem os eventos de som, e a ficha vale para criança e adulto', () => {
  const e = estado([ev('inicio', T0), { tipo: 'som', em: min(0.1), texto: 'som' }, ev('ritmo', min(0.2), 'fv'), ev('choque', min(0.5))])
  const t = textoDoRegistro(e, min(1))
  assert.ok(!t.includes('som'))
  assert.match(t, /choques: 1/)
  assert.equal(fichaCronometroParada.publico, 'ambos')
  assert.ok(fichaCronometroParada.fontes.some((f) => f.pediatrica))
})
