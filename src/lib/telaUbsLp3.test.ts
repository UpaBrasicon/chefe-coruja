import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const recepcao = readFileSync('src/pages/recepcao/Recepcao.tsx', 'utf8')
const fila = readFileSync('src/pages/plantao/porta/FilaPS.tsx', 'utf8')

// Limpeza do percurso da UBS, LP3 = A (RT, 23/11/2026): ficha em atendimento de
// outro dia. Ninguém fecha sozinho: o médico retoma; o gestor encerra com motivo.
test('LP3: aviso no topo da fila do médico, lista do gestor e aviso da recepção', () => {
  assert.match(fila, /const naoEncerrados = ubs \? emAtendimento\.filter\(\(e\) => diaSP\(e\.atendimento_iniciado_em!\) < hoje\(\)\) : \[\]/)
  assert.match(fila, /onClick=\{\(\) => onAbrir\(e\)\}>Retomar<\/Button>/)
  const gestor = readFileSync('src/components/gestor/AtendimentosNaoEncerrados.tsx', 'utf8')
  assert.match(gestor, /rpc\('ubs_atendimentos_nao_encerrados', \{ p_unidade: unidadeId \}\)/)
  assert.match(gestor, /rpc\('ubs_encerrar_nao_concluido', \{ p_episodio: a\.episodio_id, p_motivo: motivo\.trim\(\) \}\)/)
  assert.match(gestor, /disabled=\{motivo\.trim\(\)\.length < 10/)
  const painel = readFileSync('src/pages/gestor/PainelGestor.tsx', 'utf8')
  assert.match(painel, /unidadeAtiva\?\.unidade\.tipo === 'ubs' && <AtendimentosNaoEncerrados unidadeId=\{unidadeId\} \/>/)
  assert.match(recepcao, /rpc\('atendimento_aberto_info', \{ p_paciente: alvoAberto! \}\)/)
  assert.match(recepcao, /Na UBS, quem encerra atendimento de outro dia é o gestor\./)
})
