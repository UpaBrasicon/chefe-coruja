import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  FORA_DO_APP, ITENS, META, PRIMEIRA_ATE_DIAS, TETO_NO_APP, doisAnos, estadoDoItem, faseDa, frasesDa, marcasDa, pontosDa,
  posicao, resumoPuericultura, rotuloIdadeCurta, somarDias, temAtraso, type CriancaLinha,
} from '../domain/puericultura.ts'
import { itensDeNavegacao } from '../components/casca/navegacao.ts'

// 5A, tarefa 7 (K6 = A do RT em 05/11/2026): a régua da nota C2 da SAPS/MS.
// Os pontos repetem o Quadro 01; (D) ACS e (E) vacinas ficam fora do app.
const HOJE = '2026-11-05'
const NASC = (dias: number) => somarDias(HOJE, -dias)
const c = (idade: number, r: Partial<CriancaLinha> = {}): CriancaLinha => ({
  paciente_id: 'c', nome: 'Criança', nome_social: null, data_nascimento: NASC(idade), nome_mae: null,
  primeira_consulta: null, consultas: 0, datas_consultas: [], peso_altura: 0, datas_peso_altura: [], proxima_consulta: null, ...r,
})

test('pontos do Quadro 01 somam 100; o teto no app é 60', () => {
  assert.equal([...ITENS, ...FORA_DO_APP].reduce((s, i) => s + i.pontos, 0), 100)
  assert.equal(TETO_NO_APP, 60)
  assert.equal(META, 9)
  assert.equal(PRIMEIRA_ATE_DIAS, 29, '30º dia de vida, com o nascimento como 1º dia')
})

test('idade, fase e os 2 anos', () => {
  assert.equal(doisAnos('2024-11-05'), '2026-11-05')
  assert.equal(doisAnos('2024-02-29'), '2026-03-01')
  assert.equal(faseDa(NASC(29), HOJE), 'neonatal')
  assert.equal(faseDa(NASC(30), HOJE), 'primeiro_ano')
  assert.equal(faseDa('2025-11-05', HOJE), 'segundo_ano')
  assert.equal(rotuloIdadeCurta(NASC(20), HOJE), '20 dias')
  assert.equal(rotuloIdadeCurta('2026-06-01', HOJE), '5 meses')
  assert.equal(rotuloIdadeCurta('2025-08-01', HOJE), '1 ano e 3 meses')
})

test('(A) 1ª consulta até o 30º dia', () => {
  assert.equal(estadoDoItem(c(40, { primeira_consulta: somarDias(NASC(40), 29) }), 'primeira', HOJE), 'feito')
  assert.equal(estadoDoItem(c(40, { primeira_consulta: somarDias(NASC(40), 30) }), 'primeira', HOJE), 'perdido')
  assert.equal(estadoDoItem(c(29), 'primeira', HOJE), 'no_prazo')
  assert.equal(estadoDoItem(c(30), 'primeira', HOJE), 'perdido')
})

test('(B) e (C): 9 até os 2 anos', () => {
  assert.equal(estadoDoItem(c(400, { consultas: 9 }), 'consultas', HOJE), 'feito')
  assert.equal(estadoDoItem(c(400, { peso_altura: 4 }), 'peso_altura', HOJE), 'no_prazo')
  assert.equal(estadoDoItem(c(800, { peso_altura: 4 }), 'peso_altura', HOJE), 'perdido')
})

test('pontos, atraso, frases, marcas e resumo', () => {
  const boa = c(200, { primeira_consulta: NASC(190), consultas: 9, peso_altura: 9, datas_consultas: [NASC(190), NASC(100)] })
  assert.equal(pontosDa(boa, HOJE), 60)
  assert.equal(temAtraso(boa, HOJE), false)
  const tarde = c(100, { primeira_consulta: NASC(55), consultas: 1, datas_consultas: [NASC(55)] })
  assert.deepEqual(frasesDa(tarde, HOJE).perdido, ['1ª consulta com 45 dias'])
  assert.deepEqual(marcasDa(tarde).map((m) => m.tipo), ['perdido'])
  assert.deepEqual(frasesDa(c(10), HOJE).aFazer, [`1ª consulta até ${somarDias(NASC(10), 29).slice(8, 10)}/${somarDias(NASC(10), 29).slice(5, 7)}`])
  assert.equal(posicao(NASC(0), HOJE), 0)
  const r = resumoPuericultura([boa, tarde, c(10)], HOJE)
  assert.deepEqual(r.captacao, { feitas: 1, de: 2 })
  assert.equal(r.comAtraso, 1)
  assert.deepEqual([r.neonatal, r.primeiroAno, r.segundoAno], [1, 2, 0])
})

test('o painel só aparece na UBS, para médico, enfermagem e gestor', () => {
  for (const papel of ['plantonista', 'enfermeiro', 'tecnico_enfermagem', 'gestor'] as const) {
    assert.ok(itensDeNavegacao(papel, false, false, 'ubs').some((i) => i.to === '/puericultura'), `${papel} sem a puericultura na UBS`)
    assert.ok(!itensDeNavegacao(papel, false, false, 'upa').some((i) => i.to === '/puericultura'), `${papel} vê a puericultura na UPA`)
  }
  assert.ok(!itensDeNavegacao('recepcao', false, false, 'ubs').some((i) => i.to === '/puericultura'), 'a recepção não vê')
})

test('a consulta mostra o bloco e o painel usa as RPCs da puericultura', () => {
  assert.match(readFileSync('src/pages/plantao/porta/AbaConduta.tsx', 'utf8'), /<PuericulturaNaConsulta /)
  assert.match(readFileSync('src/components/puericultura/PuericulturaNaConsulta.tsx', 'utf8'), /rpc\('puericultura_do_paciente'/)
  assert.match(readFileSync('src/pages/puericultura/Puericultura.tsx', 'utf8'), /rpc\('puericultura_painel'/)
  assert.match(readFileSync('src/App.tsx', 'utf8'), /path="\/puericultura"/)
  // o banco só conta a consulta com o problema "Puericultura" (Quadro 02)
  assert.match(readFileSync('supabase/migrations/20270224000001_puericultura.sql', 'utf8'), /'puericultura' = ANY \(coalesce\(e\.problemas_aps/)
})
