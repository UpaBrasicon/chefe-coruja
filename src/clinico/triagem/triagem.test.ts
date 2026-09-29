// node --experimental-strip-types --test src/clinico/triagem/triagem.test.ts   (npm run test:clinico)
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import { ESCALAS_DOR, escalaPelaIdade, escalasDoGrupo, itensMarcados, notaNumerica, registroDor, totalDor } from './dor.ts'
import { dppPelaDum, erroGestacao, GESTACAO_VAZIA, igPelaDum, registroGestacao } from './gestacao.ts'
import { ANEXO_III_ADULTO, ANEXO_IV_PEDIATRIA, fichaAnexosSinaisVitais, referenciaDoSinal } from './anexosSinaisVitais.ts'
import { buscarFluxogramas, termosDaBusca } from './buscaFluxograma.ts'

// ---- dor ----
test('dor: escala pela idade — NIPS até 2 meses, FLACC até antes dos 4 anos, depois autorrelato', () => {
  assert.equal(escalaPelaIdade('2026-09-28', '2026-09-29'), 'nips') // 1 dia
  assert.equal(escalaPelaIdade('2026-07-30', '2026-09-29'), 'nips') // 1 mês e 30 dias
  assert.equal(escalaPelaIdade('2026-07-29', '2026-09-29'), 'flacc') // 2 meses
  assert.equal(escalaPelaIdade('2022-09-30', '2026-09-29'), 'flacc') // 3a 11m 29d
  assert.equal(escalaPelaIdade('2022-09-29', '2026-09-29'), 'numerica') // 4 anos
  assert.equal(escalaPelaIdade(null, '2026-09-29'), 'numerica')
})
test('dor: NIPS e FLACC só aparecem no grupo pediátrico', () => {
  assert.deepEqual(escalasDoGrupo('adulto'), ['numerica'])
  assert.deepEqual(escalasDoGrupo(null), ['numerica'])
  assert.deepEqual(escalasDoGrupo('pediatrico'), ['nips', 'flacc', 'numerica'])
})
test('dor: máximos batem com os itens (NIPS 7, FLACC 10)', () => {
  for (const e of [ESCALAS_DOR.nips, ESCALAS_DOR.flacc]) {
    const max = e.itens.reduce((s, i) => s + Math.max(...i.opcoes.map((o) => o.valor)), 0)
    assert.equal(max, e.max, e.nome)
  }
  assert.equal(ESCALAS_DOR.nips.itens.length, 6)
  assert.equal(ESCALAS_DOR.flacc.itens.length, 5)
})
test('dor: total só com todos os itens marcados e valores das opções', () => {
  const nips = { face: 1, choro: 2, resp: 1, bracos: 0, pernas: 0 }
  assert.equal(totalDor('nips', nips), null)
  assert.equal(itensMarcados('nips', nips), 5)
  assert.equal(totalDor('nips', { ...nips, alerta: 1 }), 5)
  assert.equal(totalDor('nips', { ...nips, alerta: 3 }), null) // fora das opções
  assert.equal(totalDor('numerica', {}), null)
})
test('dor: leituras nos cortes das fontes', () => {
  assert.equal(ESCALAS_DOR.nips.leitura(3), 'Sem dor pela NIPS (menos de 4)')
  assert.equal(ESCALAS_DOR.nips.leitura(4), 'Dor (4 ou mais na NIPS)')
  assert.equal(ESCALAS_DOR.flacc.leitura(0), 'Relaxado e confortável (0)')
  assert.equal(ESCALAS_DOR.flacc.leitura(3), 'Desconforto leve (1 a 3)')
  assert.equal(ESCALAS_DOR.flacc.leitura(6), 'Dor moderada (4 a 6)')
  assert.equal(ESCALAS_DOR.flacc.leitura(7), 'Dor intensa (7 a 10)')
  assert.equal(ESCALAS_DOR.numerica.leitura(0), 'Sem dor (0)')
  assert.equal(ESCALAS_DOR.numerica.leitura(4), 'Dor moderada (4 a 6)')
  assert.equal(ESCALAS_DOR.numerica.leitura(10), 'Dor intensa (7 a 10)')
})
test('dor: nenhuma leitura fala em cor', () => {
  for (const e of Object.values(ESCALAS_DOR)) {
    for (let t = 0; t <= e.max; t++) assert.doesNotMatch(e.leitura(t), /vermelh|laranja|amarel|verde|azul/i)
  }
})
test('dor: autorrelato aceita só inteiro de 0 a 10', () => {
  assert.equal(notaNumerica('0'), 0)
  assert.equal(notaNumerica(' 10 '), 10)
  assert.equal(notaNumerica('11'), null)
  assert.equal(notaNumerica('4,5'), null)
  assert.equal(notaNumerica(''), null)
})
test('dor: registro para o servidor leva itens só nas escalas comportamentais', () => {
  assert.deepEqual(registroDor('numerica', {}, 3), { escala: 'numerica', total: 3 })
  assert.deepEqual(registroDor('flacc', { face: 1 }, 1), { escala: 'flacc', itens: { face: 1 }, total: 1 })
})
test('dor: fichas pediátricas declaram fonte pediátrica', () => {
  for (const e of Object.values(ESCALAS_DOR)) {
    assert.ok(e.ficha.fontes.length > 0 && e.ficha.versao, e.nome)
    assert.equal(temReferenciaPediatrica(e.ficha), true, e.nome)
  }
})

// ---- gestação ----
test('gestação: Naegele — DPP = DUM + 280 dias (atravessa ano bissexto)', () => {
  assert.equal(dppPelaDum('2026-01-01'), '2026-10-08')
  assert.equal(dppPelaDum('2027-06-01'), '2028-03-07') // passa por 29/02/2028
  assert.equal(dppPelaDum('2026-02-31'), null)
})
test('gestação: IG pela DUM em semanas e dias; DUM no futuro não conta', () => {
  assert.deepEqual(igPelaDum('2026-09-29', '2026-09-29'), { semanas: 0, dias: 0 })
  assert.deepEqual(igPelaDum('2026-06-01', '2026-09-29'), { semanas: 17, dias: 1 })
  assert.equal(igPelaDum('2026-09-30', '2026-09-29'), null)
})
test('gestação: DUM e "DUM não informada" juntas é erro; intercorrência pede texto', () => {
  const g = { ...GESTACAO_VAZIA, tipo: 'gestacao_unica' as const }
  assert.equal(erroGestacao(g, '2026-09-29'), '')
  assert.match(erroGestacao({ ...g, dum: '2026-06-01', dumNaoInformada: true }, '2026-09-29'), /não os dois/)
  assert.match(erroGestacao({ ...g, dum: '2026-10-01' }, '2026-09-29'), /depois de hoje/)
  assert.match(erroGestacao({ ...g, igDias: '7' }, '2026-09-29'), /0 a 6/)
  assert.match(erroGestacao({ ...g, intercorrencias: true }, '2026-09-29'), /intercorrências/)
  assert.equal(erroGestacao({ ...GESTACAO_VAZIA, tipo: 'nao_gestante', dum: 'x' }, '2026-09-29'), '')
})
test('gestação: registro manda a DUM e deixa IG/DPP para o servidor calcular', () => {
  const r = registroGestacao({ ...GESTACAO_VAZIA, tipo: 'gestacao_unica', dum: '2026-06-01', igSemanas: '3', g: '2' })!
  assert.equal(r.dum, '2026-06-01')
  assert.equal(r.ig_semanas, undefined)
  assert.equal(r.g, 2)
  assert.deepEqual(registroGestacao({ ...GESTACAO_VAZIA, tipo: 'nao_gestante' }), { tipo: 'nao_gestante', observacao: undefined })
  assert.equal(registroGestacao(GESTACAO_VAZIA), null)
})

// ---- anexos III e IV ----
test('anexos: toda linha tem o número de colunas do cabeçalho', () => {
  for (const a of [ANEXO_III_ADULTO, ANEXO_IV_PEDIATRIA]) {
    for (const g of a.grupos) for (const l of g.linhas) assert.equal(l.length, g.colunas.length, `${a.titulo} · ${g.titulo}`)
  }
})
test('anexos: pediatria só tem FR, FC e PA — temperatura, SpO₂ e glicemia sem faixa pediátrica', () => {
  assert.ok(referenciaDoSinal('pediatrico', 'frequencia-cardiaca'))
  assert.ok(referenciaDoSinal('pediatrico', 'pressao-arterial-diastolica'))
  assert.equal(referenciaDoSinal('pediatrico', 'temperatura'), null)
  assert.equal(referenciaDoSinal('pediatrico', 'saturacao-o2'), null)
  assert.equal(referenciaDoSinal('pediatrico', 'glicemia-capilar'), null)
  assert.equal(referenciaDoSinal('adulto', 'escala-dor'), null)
  assert.equal(referenciaDoSinal(null, 'frequencia-cardiaca'), null)
  assert.equal(referenciaDoSinal('adulto', 'saturacao-o2')?.anexo, 'Anexo III')
})
test('anexos: divergências do documento ficam transcritas e marcadas para conferir', () => {
  const fc = ANEXO_III_ADULTO.grupos.find((g) => g.titulo === 'Frequência cardíaca')!
  assert.ok(fc.linhas.some((l) => l[1] === '>39 bpm'))
  assert.match(fc.conferir ?? '', /a conferir/)
  assert.equal(temReferenciaPediatrica(fichaAnexosSinaisVitais), true)
})

// ---- busca ----
const FLUXOS = [
  { nome: 'Dor abdominal', inclui: null, discriminadores: { amarelo: [['Vômitos persistentes', '']] as [string, string][] } },
  { nome: 'Dor torácica', inclui: null, discriminadores: {} },
  { nome: 'Queixas respiratórias', inclui: null, discriminadores: {} },
  { nome: 'Politraumas', inclui: 'pacientes com um ou mais traumas', discriminadores: {} },
  { nome: 'Diarreia e vômitos', inclui: null, discriminadores: {} },
]
test('busca: palavra leiga vira termo técnico', () => {
  assert.deepEqual(termosDaBusca('Dor no PEITO'), ['dor no peito', 'toracica'])
  assert.equal(buscarFluxogramas(FLUXOS, 'dor no peito')[0].nome, 'Dor torácica')
  assert.equal(buscarFluxogramas(FLUXOS, 'barriga')[0].nome, 'Dor abdominal')
  assert.equal(buscarFluxogramas(FLUXOS, 'chiado')[0].nome, 'Queixas respiratórias')
  assert.equal(buscarFluxogramas(FLUXOS, 'queda')[0].nome, 'Politraumas')
})
test('busca: nome vale mais que discriminador', () => {
  const r = buscarFluxogramas(FLUXOS, 'vomito').map((f) => f.nome)
  assert.deepEqual(r, ['Diarreia e vômitos', 'Dor abdominal'])
})
test('busca: sem termo devolve todos na ordem; termo sem casamento devolve vazio', () => {
  assert.equal(buscarFluxogramas(FLUXOS, '  ').length, FLUXOS.length)
  assert.equal(buscarFluxogramas(FLUXOS, 'xyzabc').length, 0)
})
