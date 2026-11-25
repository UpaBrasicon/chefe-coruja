// Menu do médico (RT, 24/11/2026): o Plantão tem as abas Meu turno, Minha agenda
// e Prontuários; a Internação, item novo, tem Internação, Observação e Passômetro;
// a Evolução clínica saiu (a evolução mora no caderno do leito). Na UBS nada muda.
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'

import { foraDoItem, itensDeNavegacao } from '../components/casca/navegacao.ts'
import { ABAS_INTERNACAO, ABAS_PLANTAO } from '../components/plantao/rotasMedico.ts'

const rotulos = (tipo: 'ubs' | null) => itensDeNavegacao('plantonista', false, false, tipo).map((i) => i.rotulo)

test('menu do médico fora da UBS, na ordem pedida; sem Passômetro, Minha agenda, Prontuários e Evolução clínica soltos', () => {
  assert.deepEqual(rotulos(null), ['Central do Médico', 'Plantão', 'Internação', 'Atendimento', 'Contingência', 'Telemedicina',
    'Pareceres', 'Notificação compulsória', 'Farmácia', 'Avisos'])
})

test('na UBS o menu do médico não muda', () => {
  assert.deepEqual(rotulos('ubs'), ['Atendimento', 'Agenda de consultas', 'Encaminhados', 'Hiperdia', 'Pré-natal', 'Puericultura',
    'Telemedicina', 'Farmácia', 'Minha agenda', 'Avisos', 'Prontuários', 'Regulação'])
})

test('o leito aberto e as abas da Internação acendem a Internação, não o Plantão', () => {
  const itens = itensDeNavegacao('plantonista')
  const plantao = itens.find((i) => i.to === '/plantao')!
  const internacao = itens.find((i) => i.to === '/plantao/internacao')!
  assert.equal(internacao.icone, itensDeNavegacao('gestor').find((i) => i.to === '/internacao')!.icone, 'mesmo ícone da Internação do gestor')
  for (const p of ['/plantao/internacao/pacientes', '/plantao/internacao/observacao', '/plantao/internacao/passometro']) {
    assert.ok(foraDoItem(plantao, p), p)
    assert.ok(!foraDoItem(internacao, p), p)
  }
  assert.ok(!foraDoItem(plantao, '/plantao/agenda'))
})

test('abas do Plantão e da Internação: uma acesa por rota', () => {
  assert.deepEqual(ABAS_PLANTAO.map((a) => a.rotulo), ['Meu turno', 'Minha agenda', 'Prontuários'])
  assert.deepEqual(ABAS_INTERNACAO.map((a) => a.rotulo), ['Internação', 'Observação', 'Passômetro'])
  const acesa = (abas: typeof ABAS_PLANTAO, p: string) => abas.filter((a) => a.casa(p)).map((a) => a.rotulo)
  assert.deepEqual(acesa(ABAS_PLANTAO, '/plantao'), ['Meu turno'])
  assert.deepEqual(acesa(ABAS_PLANTAO, '/plantao/agenda'), ['Minha agenda'])
  assert.deepEqual(acesa(ABAS_PLANTAO, '/plantao/prontuarios'), ['Prontuários'])
  assert.deepEqual(acesa(ABAS_INTERNACAO, '/plantao/internacao/pacientes'), ['Internação'])
  assert.deepEqual(acesa(ABAS_INTERNACAO, '/plantao/internacao/observacao'), ['Observação'])
  assert.deepEqual(acesa(ABAS_INTERNACAO, '/plantao/internacao/passometro'), ['Passômetro'])
})

test('as rotas antigas levam à aba certa e a Evolução clínica saiu', () => {
  const app = readFileSync('src/App.tsx', 'utf8')
  for (const r of [
    '<Route path="/plantao/agenda" element={<PlantaoAba aba="agenda" />} />',
    '<Route path="/plantao/prontuarios" element={<PlantaoAba aba="prontuarios" />} />',
    '<Route path="/plantao/internacao" element={<Redirecionar para={ROTA_INTERNADOS} />} />',
    '<Route path="/plantao/observacao" element={<Redirecionar para={ROTA_OBSERVACAO_MEDICO} />} />',
    '<Route path="/plantao/evolucao" element={<Redirecionar para={ROTA_INTERNADOS} />} />',
    '<Route path="/agenda" element={<AbaDoPlantao antiga="/agenda" tela={<AgendaGrupo />} />} />',
    '<Route path="/prontuarios" element={<AbaDoPlantao antiga="/prontuarios" tela={<PedidosProntuario />} />} />',
  ]) assert.ok(app.includes(r), r)
  assert.match(app, /plantonista=\{<Redirecionar para=\{ROTA_OBSERVACAO_MEDICO\} \/>\}/)
  // o redirecionamento de /agenda e /prontuarios é só do médico fora da UBS
  assert.match(app, /papelAtivo === 'plantonista' && !!unidadeAtiva && unidadeAtiva\.unidade\.tipo !== 'ubs'/)
  assert.ok(!existsSync('src/pages/plantao/EvolucaoClinica.tsx'))
  assert.ok(!readFileSync('src/content/plantaoRegistry.tsx', 'utf8').includes("slug: 'evolucao'"))
})
