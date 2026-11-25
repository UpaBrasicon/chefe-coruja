import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { inicioDoPapel, itensDeNavegacao } from '../components/casca/navegacao.ts'

// Regulação dentro do paciente e perfil NIR (pedidos do RT de 24/11/2026).
const rotas = (...a: Parameters<typeof itensDeNavegacao>) => itensDeNavegacao(...a).map((i) => i.to)

test('NIR: exatamente Internação e Escala', () => {
  for (const tipo of ['upa', 'hospital', null] as const) {
    assert.deepEqual(rotas('nir', false, false, tipo), ['/nir/internacao', '/minha-escala'])
  }
  assert.equal(itensDeNavegacao('nir')[0].rotulo, 'Internação')
  assert.equal(inicioDoPapel('nir'), '/nir/internacao')
})

test('médico: a Regulação sai do menu e mora no Atendimento (fora da UBS)', () => {
  for (const tipo of ['upa', 'hospital', null] as const) {
    const r = rotas('plantonista', false, false, tipo)
    assert.ok(!r.includes('/regulacao'), `${tipo}: médico ainda tem o item Regulação`)
    assert.ok(r.includes('/atendimento'))
  }
  // na UBS o Atendimento é o consultório: o item continua
  assert.ok(rotas('plantonista', false, false, 'ubs').includes('/regulacao'))
})

test('regulador e gestor continuam com a Regulação', () => {
  assert.ok(rotas('regulador').includes('/regulacao'))
  assert.ok(rotas('gestor').includes('/regulacao'))
  assert.ok(rotas('gestor').includes('/nir'), 'o gestor mantém as Pendências do NIR (cobrança)')
})

test('as telas ligam a aba Regulação do paciente e a lista', () => {
  const leito = readFileSync('src/components/internacao/LeitoAberto.tsx', 'utf8')
  assert.match(leito, /\['regulacao', 'Regulação'\]/)
  assert.match(leito, /<AbaRegulacaoPaciente pacienteId=\{pacienteId\} \/>/)
  assert.match(readFileSync('src/pages/plantao/porta/JanelaAtendimento.tsx', 'utf8'), /<AbaRegulacaoPaciente pacienteId=\{ep\.paciente_id\} \/>/)
  assert.match(readFileSync('src/components/observacao/CartaoObservacao.tsx', 'utf8'), /<AbaRegulacaoPaciente pacienteId=\{linha\.paciente_id\}/)
  assert.match(readFileSync('src/pages/plantao/AtendimentoPorta.tsx', 'utf8'), /<PacientesRegulacao unidadeId=\{unidadeAtiva\.unidade_id\} modo="medico" \/>/)
  // NI1 e NIR1 (modelo do RT, 25/11/2026): o aviso do topo abre o paciente do
  // pedido no Painel NIR; o dossiê traz a conversa e os anexos do pedido
  const nir = readFileSync('src/pages/nir/NirInternacao.tsx', 'utf8')
  // NI6 (revisão unslop): o aviso também recebe o tempo real sem evolução
  assert.match(nir, /<AvisosNirBotao unidadeId=\{unidadeId\} abrirPedido=\{abrirPedido\} tempoReal=\{tempoReal\} \/>/)
  assert.match(nir, /<PainelNir unidadeId=\{unidadeId\}/)
  const dossie = readFileSync('src/components/nir/DossieNir.tsx', 'utf8')
  assert.match(dossie, /<ConversaRegulacao solicitacaoId=\{p\.id\}/)
  assert.match(dossie, /<AnexosRegulacao solicitacaoId=\{p\.id\} \/>/)
  assert.match(readFileSync('src/pages/regulacao/Regulacao.tsx', 'utf8'), /<PacientesRegulacao unidadeId=\{unidadeId\} modo="gestor" \/>/)
  assert.match(readFileSync('src/pages/regulacao/Regulacao.tsx', 'utf8'), /<ConversaRegulacao solicitacaoId=\{s\.id\}/)
})
