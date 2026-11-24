import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  avisoDeRegistro, cobertura, contagem, diferenca, papeisComGente, papeisOferecidos, podeMexer, porcento, totalDaSecretaria,
  type IndicadorUnidade,
} from './secretariaCompleta.ts'

// Perfil Gestor da secretaria, o que ficou de fora (pedido do RT, 24/11/2026).

function un(p: Partial<IndicadorUnidade> & Pick<IndicadorUnidade, 'id'>): IndicadorUnidade {
  return {
    nome: p.id, tipo: 'upa', secretaria: null,
    leitos: { total: 10, ocupados: 6, livres: 4, higienizacao: 0, reservados: 0, bloqueados: 0, taxa: 60 },
    pessoas: {}, pessoas_total: 0,
    escala: { plantoes: 0, faixas: 0, cobertas: 0, com_vaga: 0, vagas: 0 },
    atendimentos: 10, internacoes: 5,
    ...p,
  }
}

test('contagem suprimida aparece como "< 5"', () => {
  assert.equal(contagem(null), '< 5')
  assert.equal(contagem(0), '0')
  assert.equal(contagem(12), '12')
})

test('porcento com vírgula e traço sem taxa', () => {
  assert.equal(porcento(72.5), '72,5%')
  assert.equal(porcento(null), '—')
})

test('cobertura: faixas cobertas sobre as que têm plantão ou vaga', () => {
  assert.equal(cobertura({ plantoes: 30, faixas: 90, cobertas: 27, com_vaga: 3, vagas: 4 }), 90)
  assert.equal(cobertura({ plantoes: 0, faixas: 90, cobertas: 0, com_vaga: 0, vagas: 0 }), null)
})

test('total da secretaria soma e some a ocupação quando alguma unidade veio suprimida', () => {
  const t = totalDaSecretaria([un({ id: 'a' }), un({ id: 'b', leitos: { total: 10, ocupados: 4, livres: 6, higienizacao: 0, reservados: 0, bloqueados: 0, taxa: 40 } })])
  assert.equal(t.leitos, 20)
  assert.equal(t.ocupados, 10)
  assert.equal(t.taxa, 50)
  const s = totalDaSecretaria([un({ id: 'a' }), un({ id: 'b', leitos: { total: 3, ocupados: null, livres: 1, higienizacao: 0, reservados: 0, bloqueados: 0, taxa: null }, atendimentos: null })])
  assert.equal(s.ocupados, null)
  assert.equal(s.taxa, null)
  assert.equal(s.atendimentos, null)
  assert.equal(s.internacoes, 10)
})

test('unidade sem leito não some com a ocupação do total', () => {
  const t = totalDaSecretaria([un({ id: 'a' }), un({ id: 'ubs', leitos: { total: 0, ocupados: 0, livres: 0, higienizacao: 0, reservados: 0, bloqueados: 0, taxa: null } })])
  assert.equal(t.taxa, 60)
})

test('papéis com gente, do maior para o menor', () => {
  assert.deepEqual(papeisComGente({ recepcao: 2, plantonista: 5, enfermeiro: 0 }), [['plantonista', 5], ['recepcao', 2]])
})

test('o gestor da unidade não oferece gestor; secretaria e administrador oferecem', () => {
  assert.ok(!papeisOferecidos('gestor').includes('gestor'))
  assert.ok(papeisOferecidos('secretaria').includes('gestor'))
  assert.ok(!papeisOferecidos('admin').includes('admin'))
  assert.ok(!papeisOferecidos('admin').includes('gestor_secretaria'))
})

test('registro profissional pedido pelo papel', () => {
  assert.equal(avisoDeRegistro('recepcao', null), null)
  assert.match(avisoDeRegistro('plantonista', null) ?? '', /entra pelo convite/)
  assert.match(avisoDeRegistro('enfermeiro', 'CRM') ?? '', /pede COREN/)
  assert.equal(avisoDeRegistro('telemedicina', 'CRM'), null)
})

test('quem mexe em quem', () => {
  assert.equal(podeMexer('gestor', ['plantonista']), true)
  assert.equal(podeMexer('gestor', ['gestor']), false)
  assert.equal(podeMexer('secretaria', ['gestor']), true)
  assert.equal(podeMexer('secretaria', ['admin']), false)
  assert.equal(podeMexer('admin', ['admin', 'gestor']), true)
})

test('diferença entre a lista atual e a nova', () => {
  assert.deepEqual(diferenca(['recepcao'], ['gestor']), { entram: ['gestor'], saem: ['recepcao'] })
  assert.deepEqual(diferenca(['plantonista'], ['plantonista', 'telemedicina']), { entram: ['telemedicina'], saem: [] })
})
