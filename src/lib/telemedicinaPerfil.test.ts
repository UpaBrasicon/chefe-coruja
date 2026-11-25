import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  agruparPorDia, contagemRemotos, duracaoLegivel, juntarParecer, parecerPronto, siglaSetor, trilhaDaTelemedicina,
  type ConsultaTrilha, type EventoTrilha,
} from './telemedicinaPerfil.ts'

// Revisão do perfil Telemedicina (RT, 24/11/2026).

test('SA2: o parecer em três campos vira um texto só, com os rótulos e só o que foi escrito', () => {
  assert.equal(juntarParecer({ hipoteses: ' Pneumonia comunitária ', sugestao: 'Amoxicilina conforme protocolo', reavaliar: '' }),
    'Hipóteses: Pneumonia comunitária\nSugestão: Amoxicilina conforme protocolo')
  assert.equal(juntarParecer({ hipoteses: '', sugestao: '', reavaliar: 'SpO2 abaixo de 92' }), 'Reavaliar se: SpO2 abaixo de 92')
})

test('SA2: o mínimo de 20 caracteres conta o que foi escrito, não os rótulos', () => {
  assert.equal(parecerPronto({ hipoteses: 'IVAS', sugestao: 'sintomáticos', reavaliar: '' }), false) // 16
  assert.equal(parecerPronto({ hipoteses: 'IVAS viral', sugestao: 'sintomáticos', reavaliar: '' }), true) // 22
  assert.equal(parecerPronto({ hipoteses: '   ', sugestao: '                    ', reavaliar: '' }), false)
})

test('SA2: o parecer segue pela mesma RPC, sem migration', () => {
  const sala = readFileSync('src/pages/telemedicina/Chamados.tsx', 'utf8')
  assert.match(sala, /rpc\('responder_teleinterconsulta', \{ p_id: [^,]+, p_resposta: juntarParecer\(/)
})

const consultas: ConsultaTrilha[] = [
  { paciente: 'Ana', unidade: 'UPA Centro', aceita_em: '2026-11-24T14:00:00Z', respondida_em: '2026-11-24T15:00:00Z' },
]
const ev = (em: string, acao: string, paciente = 'Ana', unidade = 'UPA Centro'): EventoTrilha => ({ em, acao, paciente, unidade, por: 'Dra. X' })

test('CH3: a trilha fica só com a telemedicina; a abertura feita como Médico sai', () => {
  const trilha = [
    ev('2026-11-24T14:00:00Z', 'aceitar_teleinterconsulta'),
    ev('2026-11-24T14:05:00Z', 'leitura_prontuario'), // na janela da teleinterconsulta
    ev('2026-11-25T14:30:00Z', 'impressao'), // até 24 h depois do parecer
    ev('2026-11-25T16:00:00Z', 'leitura_prontuario'), // depois da janela
    ev('2026-11-24T14:10:00Z', 'leitura_prontuario', 'Bruno'), // outro paciente (aberto como Médico)
    ev('2026-11-24T13:00:00Z', 'leitura_prontuario'), // antes do aceite
    ev('2026-11-24T14:20:00Z', 'acao_desconhecida'),
  ]
  assert.deepEqual(trilhaDaTelemedicina(trilha, consultas).map((e) => `${e.acao}@${e.em.slice(8, 16)}`),
    ['aceitar_teleinterconsulta@24T14:00', 'leitura_prontuario@24T14:05', 'impressao@25T14:30'])
})

test('CH3: sem parecer ainda, a janela vai até agora', () => {
  const abertas: ConsultaTrilha[] = [{ ...consultas[0], respondida_em: null }]
  const agora = new Date('2026-11-24T18:00:00Z').getTime()
  assert.equal(trilhaDaTelemedicina([ev('2026-11-24T17:00:00Z', 'leitura_prontuario')], abertas, agora).length, 1)
})

test('HI1: agrupar por dia mantém a ordem', () => {
  const g = agruparPorDia(['2026-11-24a', '2026-11-24b', '2026-11-23a'], (x) => x.slice(0, 10))
  assert.deepEqual(g.map((x) => [x.dia, x.itens.length]), [['2026-11-24', 2], ['2026-11-23', 1]])
})

test('HI1: tempo até o parecer legível', () => {
  assert.equal(duracaoLegivel(8 * 60_000), '8 min')
  assert.equal(duracaoLegivel(65 * 60_000), '1 h 05')
  assert.equal(duracaoLegivel(120 * 60_000), '2 h')
  assert.equal(duracaoLegivel(51 * 3_600_000), '2 d 3 h')
})

test('ES2: sigla do setor que cabe na ficha', () => {
  assert.equal(siglaSetor('Pronto Socorro'), 'PS')
  assert.equal(siglaSetor('Clínica Médica'), 'CM')
  assert.equal(siglaSetor('Observação'), 'Obs.')
  assert.equal(siglaSetor('UTI'), 'UTI')
  assert.equal(siglaSetor('Sala de Emergência'), 'SE')
  assert.equal(siglaSetor('Leito 12'), 'L12')
})

test('ES1: contador dos remotos', () => {
  assert.equal(contagemRemotos(1, 15), '1 remoto de 15')
  assert.equal(contagemRemotos(3, 15), '3 remotos de 15')
})

test('TM2: o menu do perfil Telemedicina tem Chamados, Escala, Histórico e Prontuários', () => {
  const nav = readFileSync('src/components/casca/navegacao.ts', 'utf8')
  const bloco = nav.slice(nav.indexOf('  telemedicina: ['), nav.indexOf('],', nav.indexOf('  telemedicina: [')))
  const rotulos = [...bloco.matchAll(/rotulo: '([^']+)'/g)].map((m) => m[1])
  assert.deepEqual(rotulos, ['Chamados', 'Histórico'])
  assert.match(bloco, /ITEM_ESCALA/)
  assert.match(bloco, /ITEM_PRONTUARIOS/)
})

test('CH2: sem a faixa antiga de parâmetros no perfil Telemedicina (contradizia o selo)', () => {
  const faixa = readFileSync('src/components/casca/FaixaDoPapel.tsx', 'utf8')
  assert.doesNotMatch(faixa, /FaixaTelemedicina|Chamados esperando/)
})

test('CH2: o selo só conta o plantão da categoria telemedicina e o check-in dele', () => {
  const comum = readFileSync('src/pages/telemedicina/comum.tsx', 'utf8')
  assert.match(comum, /p\.perfil_id === perfil!\.id && p\.papel === 'telemedicina'/)
  assert.match(comum, /const checkin = turno \?/)
  assert.match(comum, /\{r\.turno && r\.checkin && \(\s*<Button size="sm" variant="outline"/)
})

test('CH1: a tela da teleinterconsulta escolhe pelo perfil em uso, não pelos papéis', () => {
  const tela = readFileSync('src/pages/telemedicina/Teleinterconsulta.tsx', 'utf8')
  assert.doesNotMatch(tela, /papeisDaUnidade\.includes\('telemedicina'\)/)
  assert.match(tela, /papelAtivo === 'telemedicina'/)
})
