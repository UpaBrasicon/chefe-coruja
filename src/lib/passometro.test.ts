// Pedido 8: passômetro do médico (PS1 a PS3 = A do RT, 23/11/2026).
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const pend = (o: Record<string, unknown>) => ({
  id: 'x', tipo: 'outro', descricao: 'Fazer', prazo: null, impeditiva: false, situacao: 'aberta',
  criada_em: '2026-11-23T10:00:00Z', autor_id: 'm', resolvida_por: null, resolvida_em: null, ...o,
})
const json = [
  { internacao_id: 'i1', paciente_id: 'p1', nome: 'Bruno <script>alert(1)</script>', data_nascimento: '1975-05-05', sexo: 'M',
    setor_id: 's1', setor: 'Clínica Médica', leito: 'CM 3', status: 'internado', desde: '2026-11-20T12:00:00Z',
    cid_principal: 'J18.9', queixa: null,
    pendencias: [
      pend({ id: 'a', descricao: 'Ver tomografia' }),
      pend({ id: 'b', tipo: 'exame', descricao: 'Checar potássio', prazo: '2026-11-23T21:00:00Z' }),
      pend({ id: 'c', descricao: 'Já feita', situacao: 'concluida', resolvida_em: '2026-11-23T11:00:00Z' }),
      pend({ id: 'd', tipo: 'observacao', descricao: 'Observação de 6 horas' }),
    ] },
  { internacao_id: 'i2', paciente_id: 'p2', nome: 'Ana', data_nascimento: null, sexo: 'F', setor_id: 's2', setor: 'Observação',
    leito: null, status: 'em_observacao', desde: null, cid_principal: null, queixa: 'Dor torácica', pendencias: 'estranho' },
]

test('lê o passômetro, agrupa por setor e conta as vencidas', async () => {
  const { lerPassometro, porSetor, vencidas, abertas, diasDesde } = await import('../domain/passometro.ts')
  const l = lerPassometro(json)
  assert.equal(l.length, 2)
  assert.deepEqual(l[1].pendencias, [], 'formato estranho vira lista vazia')
  assert.deepEqual(porSetor(l).map((g) => `${g.setor}:${g.pacientes.length}`), ['Clínica Médica:1', 'Observação:1'])
  assert.equal(abertas(l[0]).length, 3)
  assert.deepEqual(vencidas(l[0], Date.parse('2026-11-23T22:00:00Z')).map((x) => x.id), ['b'])
  assert.equal(diasDesde('2026-11-20T12:00:00Z', Date.parse('2026-11-23T13:00:00Z')), 3)
  assert.equal(diasDesde(null, Date.now()), null)
  assert.deepEqual(lerPassometro(null), [])
})

test('revisão de tela: resumo do topo, vencidas primeiro e motivo do vazio', async () => {
  const { lerPassometro, resumoPassometro, ordenarPorUrgencia, contagemPendencias, motivoVazio } = await import('../domain/passometro.ts')
  const l = lerPassometro(json)
  const agora = Date.parse('2026-11-23T22:00:00Z')
  assert.deepEqual(contagemPendencias(l[0], agora), { abertas: 3, vencidas: 1 })
  assert.deepEqual(resumoPassometro(l, agora), { pacientes: 2, abertas: 3, vencidas: 1 })
  assert.deepEqual(ordenarPorUrgencia([l[1], l[0]], agora).map((p) => p.internacao_id), ['i1', 'i2'], 'quem tem vencida sobe')
  assert.deepEqual(ordenarPorUrgencia([l[1], l[0]], Date.parse('2026-11-23T10:00:00Z')).map((p) => p.internacao_id), ['i1', 'i2'], 'depois, mais abertas')
  assert.equal(motivoVazio(null), 'indefinido')
  assert.equal(motivoVazio({ na_janela: false, liberado: false, pendente: null }), 'sem_escala')
  assert.equal(motivoVazio({ na_janela: true, liberado: false, pendente: { setor_nome: 'PS' } }), 'sem_checkin')
  assert.equal(motivoVazio({ na_janela: true, liberado: false, pendente: null }), 'checkout')
  assert.equal(motivoVazio({ na_janela: true, liberado: true, pendente: null }), 'sem_pacientes')
})

test('o resumo da passagem começa com as pendências abertas, sem a observação', async () => {
  const { lerPassometro, textoPassagem } = await import('../domain/passometro.ts')
  const [p] = lerPassometro(json)
  assert.equal(textoPassagem(p.pendencias), 'Pendências: Checar potássio (até 18:00); Ver tomografia.\n')
  assert.equal(textoPassagem([]), '')
})

test('a folha A4 escapa o texto e traz só as pendências abertas', async () => {
  const { lerPassometro, htmlFolha } = await import('../domain/passometro.ts')
  const html = htmlFolha(lerPassometro(json), { unidade: 'UPA <Centro>', medico: 'Dra. Teste', emitidoEm: '2026-11-23T20:00:00Z', idade: () => '51a' })
  assert.ok(!html.includes('<script>alert(1)</script>'), 'nome não vira código')
  assert.ok(html.includes('Bruno &lt;script&gt;'))
  assert.ok(html.includes('UPA &lt;Centro&gt;'))
  assert.ok(html.includes('Checar potássio') && html.includes('Ver tomografia') && !html.includes('Já feita'))
  assert.ok(html.includes('Clínica Médica · 1 paciente'))
  assert.ok(html.includes('size: A4 landscape'))
  assert.ok(html.includes('Emitido por Dra. Teste em 23/11/2026'))
})

test('a folha só abre depois de gravar a impressão; menu e rota do médico, fora da UBS', () => {
  const pagina = readFileSync('src/pages/plantao/Passometro.tsx', 'utf8')
  const iRegistro = pagina.indexOf("rpc('registrar_impressao_passometro'")
  const iEscreve = pagina.indexOf('janela.document.write(htmlFolha(')
  assert.ok(iRegistro > 0 && iEscreve > iRegistro, 'grava a impressão antes de escrever a folha')
  assert.match(pagina, /janela\.close\(\)/, 'sem registro, fecha a janela')
  // RT, 24/11/2026: o Passômetro é aba da Internação do médico, que sai do menu na UBS
  const nav = readFileSync('src/components/casca/navegacao.ts', 'utf8')
  assert.match(nav, /to: '\/plantao\/internacao', rotulo: 'Internação'/)
  assert.match(nav, /'\/plantao', '\/plantao\/internacao', '\/plantao\/internacao\/pacientes', '\/passometro'/, 'sai do menu na UBS')
  assert.match(readFileSync('src/components/plantao/rotasMedico.ts', 'utf8'), /\{ to: ROTA_PASSOMETRO, rotulo: 'Passômetro'/)
  const app = readFileSync('src/App.tsx', 'utf8')
  const iBloco = app.indexOf("<RequireRole papeis={['plantonista']} />}>")
  assert.ok(iBloco > 0 && app.indexOf('path={ROTA_PASSOMETRO} element={<AreaInternacao aba="passometro" />}') > iBloco, 'rota só do médico')
  assert.ok(app.indexOf('<Route path="/passometro" element={<Redirecionar para={ROTA_PASSOMETRO} />} />') > iBloco, 'o endereço antigo leva à aba')
  assert.match(readFileSync('src/components/internacao/caderno/Passagem.tsx', 'utf8'), /useState\(\(\) => textoPassagem\(pendencias \?\? \[\]\)\)/)
})
