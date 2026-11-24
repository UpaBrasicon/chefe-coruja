// node --experimental-strip-types --test src/lib/doProntuario.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cidPrincipal, linhasDiagnostico, quadroParaRegulacao, sumarioAlta, textoPrescricao, textoVitais, viaDeCasa, type Diag } from './doProntuario.ts'
import { caraterDaPrioridade } from './regulacao.ts'

const diag: Diag[] = [
  { cid: 'I10', descricao: 'Hipertensão essencial', tipo: 'secundario', status: 'confirmado' },
  { cid: 'J18.9', descricao: 'Pneumonia', tipo: 'primario', status: 'hipotese' },
  { cid: 'E11', descricao: 'Diabetes', tipo: 'secundario', status: 'confirmado', encerrado_em: '2026-11-01T00:00:00Z' },
]

test('diagnóstico: principal primeiro, encerrado fora, hipótese marcada', () => {
  assert.equal(linhasDiagnostico(diag), 'J18.9 — Pneumonia (hipótese)\nI10 — Hipertensão essencial')
  assert.equal(cidPrincipal(diag), 'J18.9')
})

test('vitais crus, com a hora e a condição da SpO₂', () => {
  const t = textoVitais({ pa: '128/76', fc: '102', fr: null, temp: '37.85', spo2: '94', condicao: 'o2', aferido_em: '2026-11-24T14:50:00Z' })
  assert.match(t, /^PA 128\/76, FC 102, Tax 37\.85, SpO₂ 94% em O₂ às /)
  assert.equal(textoVitais(null), '')
})

test('prescrição como o médico escreveu, só medicamentos', () => {
  assert.equal(textoPrescricao([
    { tipo: 'medicamento', descricao: 'Ceftriaxona', dose: '1 g', via: 'EV', posologia: '12/12h' },
    { tipo: 'cuidado', descricao: 'Cabeceira elevada', dose: null, via: null, posologia: null },
  ]), 'Ceftriaxona 1 g EV 12/12h')
})

test('quadro da regulação sai do caderno; sem evolução, quadro vazio', () => {
  const q = quadroParaRegulacao({ evolucao: { a: 'PAC grave', p: 'UTI', criado_em: '2026-11-24T10:00:00Z' }, sv: null, exames: [
    { exame: 'Lactato', resultado: '4,1', situacao: 'resultado', pedido_em: '2026-11-24T09:00:00Z' },
    { exame: 'PCR', resultado: null, situacao: 'pedido', pedido_em: '2026-11-24T09:00:00Z' },
  ], prescricao: [], diagnosticos: diag })
  assert.equal(q.cid, 'J18.9')
  assert.match(q.quadro_clinico, /Avaliação: PAC grave\nPlano: UTI/)
  assert.equal(q.exames, 'Lactato: 4,1 (24/11)')
  assert.equal(quadroParaRegulacao({ exames: [], prescricao: [], diagnosticos: [] }).quadro_clinico, '')
})

test('sumário de alta tem as seções e deixa a condição na alta para o médico', () => {
  const s = sumarioAlta({ admissao: '2026-10-07T18:19:00Z', diagnosticos: diag, exames: [], evolucao: null })
  for (const t of ['Internação', 'Diagnósticos (CID-10)', 'Resumo da evolução na internação', 'Exames relevantes', 'Procedimentos', 'Condição na alta', 'Prescrição para casa', 'Seguimento e encaminhamento']) assert.ok(s.includes(t), t)
})

test('vias de casa: injetável fica de fora', () => {
  assert.equal(viaDeCasa('VO'), true)
  assert.equal(viaDeCasa('EV'), false)
  assert.equal(viaDeCasa('IM'), false)
})

test('caráter vem da prioridade', () => {
  assert.equal(caraterDaPrioridade('emergencia'), 'urgencia')
  assert.equal(caraterDaPrioridade('urgencia'), 'urgencia')
  assert.equal(caraterDaPrioridade('prioritaria'), 'eletivo')
  assert.equal(caraterDaPrioridade('eletiva'), 'eletivo')
  assert.equal(caraterDaPrioridade('nao_classificada'), null)
})
