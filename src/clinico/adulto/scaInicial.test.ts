// node --experimental-strip-types --test src/clinico/adulto/scaInicial.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { clopidogrelLitico, condutaSca, limiarSupraV2V3, prasugrelElegivel, reperfusao } from './scaInicial.ts'

const drogas = (c: ReturnType<typeof condutaSca>) => c.antiagregantes.map((d) => d.droga)

test('sca: supra em V2–V3 por sexo e idade (p. 212)', () => {
  assert.equal(limiarSupraV2V3(true, 30), 1.5)
  assert.equal(limiarSupraV2V3(false, 39), 2.5)
  assert.equal(limiarSupraV2V3(false, 40), 2)
})
test('sca: reperfusão — até 12 h, corte de 120 min até a ICP (p. 218)', () => {
  assert.equal(reperfusao({ tipo: 'supra', horasSintomas: 3, atrasoIcpMin: 90 })!.via, 'angioplastia')
  assert.equal(reperfusao({ tipo: 'supra', horasSintomas: 3, atrasoIcpMin: 120 })!.via, 'angioplastia')
  assert.equal(reperfusao({ tipo: 'supra', horasSintomas: 3, atrasoIcpMin: 121, contraindicacaoLitico: false })!.via, 'fibrinolitico')
  assert.equal(reperfusao({ tipo: 'supra', horasSintomas: 3, atrasoIcpMin: 121 }), null, 'lítico só com a contraindicação respondida')
  assert.equal(reperfusao({ tipo: 'supra', horasSintomas: 3 }), null, 'sem o tempo até a ICP não decide')
})
test('sca: contraindicação ao lítico e equivalente vão para angioplastia (p. 213, 218)', () => {
  assert.equal(reperfusao({ tipo: 'supra', horasSintomas: 2, atrasoIcpMin: 300, contraindicacaoLitico: true })!.via, 'angioplastia')
  assert.equal(reperfusao({ tipo: 'equivalente' })!.via, 'angioplastia')
})
test('sca: mais de 12 h — com isquemia angioplastia; sem, sem definição (p. 218)', () => {
  assert.equal(reperfusao({ tipo: 'supra', horasSintomas: 14, isquemiaPersistente: true })!.via, 'angioplastia')
  assert.equal(reperfusao({ tipo: 'supra', horasSintomas: 14, isquemiaPersistente: false })!.via, 'sem_definicao')
})
test('sca: clopidogrel com trombólise 300 mg até 75 anos, 75 mg acima (p. 219)', () => {
  assert.match(clopidogrelLitico(75)!.ataque, /^300 mg/)
  assert.match(clopidogrelLitico(76)!.ataque, /^75 mg/)
  assert.equal(clopidogrelLitico(undefined), null)
})
test('sca: trombólise traz clopidogrel e enoxaparina do cap. 14 (bolus 30 mg até 75 anos)', () => {
  const c = condutaSca({ tipo: 'supra', horasSintomas: 2, atrasoIcpMin: 180, contraindicacaoLitico: false, idadeAnos: 60, pesoKg: 80 })
  assert.deepEqual(drogas(c), ['Ácido acetilsalicílico (AAS)', 'Clopidogrel'])
  assert.equal(c.enoxaparina!.dose!.bolusEvMg, 30)
  assert.equal(c.enoxaparina!.dose!.doseMg, 80)
})
test('sca: angioplastia primária — três opções e sem anticoagulante antes (p. 219)', () => {
  const c = condutaSca({ tipo: 'supra', horasSintomas: 2, atrasoIcpMin: 60 })
  assert.deepEqual(drogas(c), ['Ácido acetilsalicílico (AAS)', 'Ticagrelor', 'Prasugrel', 'Clopidogrel'])
  assert.equal(c.enoxaparina, null)
  assert.match(c.anticoagulacaoTexto, /sala de cateterismo/)
})
test('sca sem supra: estratificação precoce disponível = sem segundo antiagregante (p. 207)', () => {
  const c = condutaSca({ tipo: 'sem_supra', invasivaPrecoce: true })
  assert.deepEqual(drogas(c), ['Ácido acetilsalicílico (AAS)'])
  assert.equal(c.enoxaparina, null)
})
test('sca sem supra conservador: prasugrel, ticagrelor, clopidogrel e enoxaparina 1 mg/kg 12/12 h (p. 207)', () => {
  const c = condutaSca({ tipo: 'sem_supra', invasivaPrecoce: false, idadeAnos: 80, pesoKg: 70, avcAitPrevio: false })
  assert.equal(c.antiagregantes.length, 4)
  assert.match(c.antiagregantes[1].nota!, /Fora da indicação/, '80 anos: prasugrel fora')
  assert.match(c.antiagregantes[3].ataque, /^75 mg/, 'clopidogrel acima de 75 anos')
  assert.equal(c.enoxaparina!.dose!.doseMg, 70)
  assert.equal(c.enoxaparina!.dose!.intervalo, '12/12 h SC')
})
test('sca sem supra: clopidogrel 600 mg se ICP em até 6 h (p. 207)', () => {
  const c = condutaSca({ tipo: 'sem_supra', invasivaPrecoce: false, icpEm6h: true })
  assert.equal(c.antiagregantes[3].ataque, '600 mg')
})
test('sca: prasugrel pelo manual — < 75 anos, > 60 kg, sem AVC/AIT; null se faltar dado', () => {
  assert.equal(prasugrelElegivel({ tipo: 'sem_supra', idadeAnos: 60, pesoKg: 70, avcAitPrevio: false }), true)
  assert.equal(prasugrelElegivel({ tipo: 'sem_supra', idadeAnos: 60, pesoKg: 60, avcAitPrevio: false }), false)
  assert.equal(prasugrelElegivel({ tipo: 'sem_supra', idadeAnos: 75, pesoKg: 70, avcAitPrevio: false }), false)
  assert.equal(prasugrelElegivel({ tipo: 'sem_supra', idadeAnos: 60, pesoKg: 70 }), null)
})
