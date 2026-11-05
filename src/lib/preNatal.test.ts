import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  CID_GESTACAO, CIAP_GESTACAO, FORA_DO_APP, ITENS, JANELA, TETO_NO_APP, consultaIndicaGestacao, diaDoPuerperio, diasEntre,
  estadoDoItem, faseDa, frasesDa, marcasDa, pontosDa, posicao, resumoPreNatal, rotuloIG, somarDias, temAtraso, type PreNatalLinha,
} from '../domain/preNatal.ts'
import { itensDeNavegacao } from '../components/casca/navegacao.ts'

// 5A, tarefa 7 (K1 a K6 = A e opção B da tela, RT em 05/11/2026): a régua da
// nota C3 da SAPS/MS. Os pontos repetem o Quadro 01; as janelas, o item 17 da
// nota e o Caderno de Atenção Básica nº 32.
const HOJE = '2026-11-05'
const DUM = (ig: number) => somarDias(HOJE, -ig)
const g = (ig: number | null, r: Partial<PreNatalLinha> = {}): PreNatalLinha => {
  const dum = ig === null ? null : DUM(ig)
  return {
    id: 'g', origem: 'consulta', entrada_em: '2026-10-01T12:00:00Z', paciente_id: 'p', nome: 'Gestante', nome_social: null, data_nascimento: null,
    dum, dpp: dum && somarDias(dum, 280), fim_gestacao: dum && somarDias(dum, 294), puerperio_ate: dum && somarDias(dum, 336),
    desfecho: null, desfecho_em: null, proxima_consulta: null,
    ...(dum ? { primeira_consulta: null, consultas: 0, datas_consultas: [], pa: 0, peso_altura: 0, testes_1tri: {}, testes_3tri: {}, consulta_puerperio: null } : {}),
    ...r,
  }
}

test('pontos do Quadro 01 somam 100; o teto no app é 64', () => {
  assert.equal(ITENS.reduce((s, i) => s + i.pontos, 0) + FORA_DO_APP.reduce((s, i) => s + i.pontos, 0), 100)
  assert.equal(TETO_NO_APP, 64)
  assert.deepEqual([...ITENS, ...FORA_DO_APP].map((i) => i.letra).sort(), ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'])
})

test('janelas: 12s6d, 13s6d, 28s0d, 42 semanas e 42 dias', () => {
  assert.deepEqual(JANELA, { primeiraAte: 12 * 7 + 6, t1Ate: 13 * 7 + 6, t3Desde: 28 * 7, fim: 42 * 7, puerperio: 42 })
  assert.equal(rotuloIG(65), '9s2d')
  assert.equal(diasEntre('2026-10-31', '2026-11-05'), 5)
  assert.equal(somarDias('2026-02-27', 2), '2026-03-01')
})

test('fase pela DUM e pelo desfecho', () => {
  assert.equal(faseDa(g(null), HOJE), 'sem_dum')
  assert.equal(faseDa(g(97), HOJE), 't1')
  assert.equal(faseDa(g(98), HOJE), 't2')
  assert.equal(faseDa(g(195), HOJE), 't2')
  assert.equal(faseDa(g(196), HOJE), 't3')
  assert.equal(faseDa(g(295), HOJE), 'puerperio', 'passou de 42 semanas sem desfecho')
  const parto = g(270, { desfecho: 'parto', desfecho_em: somarDias(HOJE, -12) })
  assert.equal(faseDa(parto, HOJE), 'puerperio')
  assert.equal(diaDoPuerperio(parto, HOJE), 12)
})

test('(A) 1ª consulta até 12s6d', () => {
  assert.equal(estadoDoItem(g(100, { primeira_consulta: somarDias(DUM(100), 90) }), 'primeira', HOJE), 'feito', 'consulta com 90 dias')
  assert.equal(estadoDoItem(g(100, { primeira_consulta: somarDias(DUM(100), 91) }), 'primeira', HOJE), 'perdido', 'consulta com 91 dias')
  assert.equal(estadoDoItem(g(80), 'primeira', HOJE), 'no_prazo')
  assert.equal(estadoDoItem(g(91), 'primeira', HOJE), 'perdido')
})

test('(B, C, D) sete na gestação; (G, H) testes por trimestre; (I) puerpério', () => {
  assert.equal(estadoDoItem(g(200, { consultas: 7 }), 'consultas', HOJE), 'feito')
  assert.equal(estadoDoItem(g(200, { pa: 3 }), 'pa', HOJE), 'no_prazo')
  assert.equal(estadoDoItem(g(300, { peso_altura: 6 }), 'peso_altura', HOJE), 'perdido')
  const todos = { sifilis: HOJE, hiv: HOJE, hepatite_b: HOJE, hepatite_c: HOJE }
  assert.equal(estadoDoItem(g(50, { testes_1tri: todos }), 'testes_1tri', HOJE), 'feito')
  assert.equal(estadoDoItem(g(97, { testes_1tri: { sifilis: HOJE } }), 'testes_1tri', HOJE), 'no_prazo')
  assert.equal(estadoDoItem(g(98, { testes_1tri: { sifilis: HOJE } }), 'testes_1tri', HOJE), 'perdido')
  assert.equal(estadoDoItem(g(195), 'testes_3tri', HOJE), 'ainda_nao')
  assert.equal(estadoDoItem(g(196), 'testes_3tri', HOJE), 'no_prazo')
  assert.equal(estadoDoItem(g(200, { testes_3tri: { sifilis: HOJE, hiv: HOJE } }), 'testes_3tri', HOJE), 'feito')
  assert.equal(estadoDoItem(g(200), 'puerperio', HOJE), 'ainda_nao')
  const parto = { desfecho: 'parto' as const, desfecho_em: somarDias(HOJE, -10) }
  assert.equal(estadoDoItem(g(280, parto), 'puerperio', HOJE), 'no_prazo')
  assert.equal(estadoDoItem(g(280, { ...parto, consulta_puerperio: HOJE }), 'puerperio', HOJE), 'feito')
  assert.equal(estadoDoItem(g(340), 'puerperio', HOJE), 'perdido', 'fim com 294 dias, puerpério até 336')
  assert.equal(estadoDoItem(g(null), 'consultas', HOJE), null, 'sem DUM não há janela')
})

test('pontos, atraso, frases e marcas da linha do tempo', () => {
  const tudo = g(250, {
    primeira_consulta: DUM(250 - 60), consultas: 7, pa: 7, peso_altura: 7,
    datas_consultas: [DUM(250 - 60), DUM(250 - 100)],
    testes_1tri: { sifilis: DUM(250 - 61), hiv: DUM(250 - 61), hepatite_b: DUM(250 - 61), hepatite_c: DUM(250 - 61) },
    testes_3tri: { sifilis: DUM(250 - 200), hiv: DUM(250 - 200) },
  })
  assert.equal(pontosDa(tudo, HOJE), 10 + 9 * 5, 'tudo menos o puerpério, que ainda não chegou')
  assert.equal(temAtraso(tudo, HOJE), false)
  const tarde = g(110, { primeira_consulta: somarDias(DUM(110), 98), datas_consultas: [somarDias(DUM(110), 98)], testes_1tri: { sifilis: HOJE } })
  assert.equal(temAtraso(tarde, HOJE), true)
  const f = frasesDa(tarde, HOJE)
  assert.deepEqual(f.perdido, ['1ª consulta com 14 semanas', 'testes do 1º trimestre sem HIV, hepatite B e hepatite C'])
  assert.deepEqual(marcasDa(tarde).map((m) => m.tipo).sort(), ['perdido', 'teste'])
  assert.deepEqual(frasesDa(g(60, { primeira_consulta: DUM(0) }), HOJE).aFazer.length, 1)
  assert.equal(posicao(DUM(0), HOJE), 0)
  assert.equal(posicao(DUM(336), HOJE), 100)
})

test('resumo do painel', () => {
  const linhas = [g(60, { primeira_consulta: DUM(0) }), g(120, { primeira_consulta: DUM(0) }), g(null), g(280, { desfecho: 'parto', desfecho_em: HOJE })]
  const r = resumoPreNatal(linhas, HOJE)
  assert.equal(r.total, 4)
  assert.equal(r.puerperas, 1)
  assert.equal(r.semDum, 1)
  assert.deepEqual([r.t1, r.t2, r.t3], [1, 1, 0])
  assert.deepEqual(r.captacao, { feitas: 1, de: 2 }, 'a de 120 dias teve a 1ª consulta hoje, com 17 semanas')
})

test('códigos de gestação iguais aos da migration (nota C3, item 24-f)', () => {
  const sql = readFileSync('supabase/migrations/20270222000001_pre_natal.sql', 'utf8')
  for (const c of [...CIAP_GESTACAO, ...CID_GESTACAO]) assert.ok(sql.includes(`'${c}'`), `${c} fora da migration`)
  assert.ok(consultaIndicaGestacao(['pre_natal'], [], []))
  assert.ok(consultaIndicaGestacao([], ['Z34.0'], []))
  assert.ok(consultaIndicaGestacao([], [], ['W78']))
  assert.ok(consultaIndicaGestacao([], ['O99.1'], []))
  assert.ok(!consultaIndicaGestacao([], ['O99.8'], []), 'O99.8 não está na lista')
  assert.ok(!consultaIndicaGestacao(['tabagismo'], ['J45'], ['R96']))
})

test('o painel só aparece na UBS, para médico, enfermagem e gestor (K5)', () => {
  for (const papel of ['plantonista', 'enfermeiro', 'tecnico_enfermagem', 'gestor'] as const) {
    assert.ok(itensDeNavegacao(papel, false, false, 'ubs').some((i) => i.to === '/pre-natal'), `${papel} sem o pré-natal na UBS`)
    assert.ok(!itensDeNavegacao(papel, false, false, 'upa').some((i) => i.to === '/pre-natal'), `${papel} vê o pré-natal na UPA`)
  }
  assert.ok(!itensDeNavegacao('recepcao', false, false, 'ubs').some((i) => i.to === '/pre-natal'), 'a recepção não vê')
})

test('a consulta mostra o bloco e o painel usa as RPCs do pré-natal', () => {
  const conduta = readFileSync('src/pages/plantao/porta/AbaConduta.tsx', 'utf8')
  assert.match(conduta, /<PreNatalNaConsulta /)
  const bloco = readFileSync('src/components/preNatal/PreNatalNaConsulta.tsx', 'utf8')
  assert.match(bloco, /rpc\('pre_natal_do_paciente'/)
  assert.match(bloco, /rpc\('pre_natal_incluir', \{ p_paciente: pacienteId, p_dum: dum, p_episodio: episodioId \}/)
  const painel = readFileSync('src/pages/preNatal/PreNatal.tsx', 'utf8')
  assert.match(painel, /rpc\('pre_natal_painel'/)
  const app = readFileSync('src/App.tsx', 'utf8')
  assert.match(app, /path="\/pre-natal"/)
})
