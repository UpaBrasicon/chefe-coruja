import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

// 5A, tarefa 2, parte 2.2 (D3 e D7 do RT em 02/11/2026): na UBS a recepção
// abre a ficha no consultório com o tipo de atendimento, e a fila do médico
// não tem cor nem alvo.
const recepcao = readFileSync('src/pages/recepcao/Recepcao.tsx', 'utf8')
const fila = readFileSync('src/pages/plantao/porta/FilaPS.tsx', 'utf8')

test('a recepção da UBS abre a ficha no consultório, com o tipo de atendimento', () => {
  assert.match(recepcao, /\.eq\('tipo', ubs \? 'consultorio' : 'emergencia'\)/)
  assert.match(recepcao, /tipo_atendimento: tipoAps/)
  assert.match(recepcao, /if \(ubs && !tipoAps\) return setErroLocal\('Escolha o tipo de atendimento\.'\)/)
  assert.match(recepcao, /TIPOS_ATENDIMENTO_APS\.map/)
})

test('na UBS a recepção não mostra painel; a fila da enfermagem é a escuta, e o consultório ordena por prioridade e chegada', () => {
  assert.match(recepcao, /const abas = ubs \? ABAS_UBS : ABAS/)
  const abasUbs = recepcao.match(/const ABAS_UBS[\s\S]*?\n\]/)![0]
  assert.doesNotMatch(abasUbs, /ABAS\[3\]/)
  // percurso da UBS (R9, 17/11/2026): a "triagem" vira a fila da enfermagem
  assert.match(abasUbs, /\{ \.\.\.ABAS\[1\], rotulo: 'Fila da enfermagem'/)
  // parte 2.4: a cor da escuta ordena; quem aguarda a escuta fica na fila da enfermagem
  assert.match(recepcao, /const todos = \(fila\.data \?\? \[\]\)\.filter\(\(e\) => e\.etapa !== 'triagem'\)/)
  // RF1 (23/11/2026): a ordem leva a hora marcada da agenda de hoje
  assert.match(recepcao, /const ordem = ordemFilaUbsComAgenda<NaFila>\(\(e\) => horaMarcada\.get\(e\.episodio_id\)\)/)
  assert.match(recepcao, /return \[\.\.\.todos\.filter\(\(e\) => !e\.atendimento_iniciado_em\)\.sort\(ordem\)/)
})

// Refinamento da UBS, RF1 = A (RT, 23/11/2026): a fila do consultório em três
// faixas — vermelho e amarelo; agendados pela hora marcada; o resto.
test('RF1: vermelho e amarelo, depois agendados pela hora marcada, depois a demanda espontânea', async () => {
  const { faixaFilaUbs, ordemFilaUbsComAgenda } = await import('../domain/aps.ts')
  type E = { id: string; prioridades_legais: string[]; chegada_em: string; cor_atual: string | null; tipo_atendimento_aps: string | null }
  const e = (id: string, chegada: string, cor: string | null, tipo: string | null = 'consulta_no_dia', pri: string[] = []): E =>
    ({ id, prioridades_legais: pri, chegada_em: `2026-11-23T${chegada}:00Z`, cor_atual: cor, tipo_atendimento_aps: tipo })
  const marcada: Record<string, string> = { ag1: '2026-11-23T13:20:00Z', ag2: '2026-11-23T12:40:00Z', agVerm: '2026-11-23T12:00:00Z' }
  const lista = [
    e('semEscuta', '10:00', null),
    e('verde', '10:30', 'verde'),
    e('ag1', '09:00', null, 'consulta_agendada'),
    e('ag2', '11:00', 'verde', 'consulta_agendada'),
    e('amarelo', '11:30', 'amarelo'),
    e('agVerm', '08:00', 'vermelho', 'consulta_agendada'),
    e('verdeIdoso', '10:45', 'verde', 'consulta_no_dia', ['idoso_80']),
  ]
  const ordem = [...lista].sort(ordemFilaUbsComAgenda<E>((x) => marcada[x.id])).map((x) => x.id)
  assert.deepEqual(ordem, ['agVerm', 'amarelo', 'ag2', 'ag1', 'verdeIdoso', 'verde', 'semEscuta'])
  // agendado de outro dia (sem hora hoje) conta como agendado pelo tipo
  assert.equal(faixaFilaUbs(e('x', '10:00', null, 'consulta_programada'), null), 'agendado')
  assert.equal(faixaFilaUbs(e('y', '10:00', 'verde'), null), 'espontaneo')
  assert.equal(faixaFilaUbs(e('z', '10:00', 'amarelo', 'consulta_agendada'), '2026-11-23T12:00:00Z'), 'prioritario')
  // a fila do médico usa a mesma ordem e mostra a hora marcada
  assert.match(fila, /if \(ubs\) aguardando\.sort\(ordemFilaUbsComAgenda<EpFila>\(\(e\) => horaMarcada\.get\(e\.id\)\)\)/)
  assert.match(fila, /· marcada \{hora\(horaMarcada\.get\(e\.id\)!\)\}/)
  assert.match(recepcao, /`Consulta marcada às \$\{hora\(e\.hora_marcada\)\}` : 'Demanda espontânea'/)
})

test('a fila do médico na UBS não tem cor nem alvo e mostra a conduta nas saídas', () => {
  assert.match(fila, /\.sort\(ubs \? ordemFilaUbs : ordemMedica\)/)
  assert.match(fila, /\{!ubs && <Cabeca col="cor"/)
  assert.match(fila, /const acimaDoAlvo = ubs \? 0 :/)
  assert.match(fila, /if \(!ubs\) q = q\.not\('desfecho', 'is', null\)/)
  assert.match(fila, /rotuloCondutaAps\(conduta\[0\]\)/)
})

test('U2 do percurso da UBS: as filas mostram a espera pelo formatarDuracao, nunca minutos crus', () => {
  assert.match(recepcao, /\{formatarDuracao\(espera\)\}/)
  assert.doesNotMatch(recepcao, /\{espera\} min/)
  const fila = readFileSync('src/pages/enfermagem/triagem/Fila.tsx', 'utf8')
  assert.match(fila, /\{esperaTexto\(e\.chegada_em\)\}/)
  const espera = readFileSync('src/pages/enfermagem/triagem/Espera.tsx', 'utf8')
  assert.match(espera, /\{formatarDuracao\(desde\)\}/)
})

test('U8 do percurso da UBS: escuta com DUM, azul abre a agenda e a recepção avisa quando não há enfermeiro', () => {
  const escuta = readFileSync('src/pages/enfermagem/triagem/EscutaInicial.tsx', 'utf8')
  assert.match(escuta, /p_dum: pedeDum && dum \? dum : undefined/)
  assert.match(escuta, /const pedeDum = !\/\^m\/i\.test\(ep\.paciente\?\.sexo \?\? ''\)/)
  assert.match(escuta, /if \(cor === 'azul' && saidaAzul === 'agendamento'\) \{\s*navigate\(linkMarcarNaAgenda\(ep\.paciente_id, ep\.id\)\)/)
  assert.doesNotMatch(escuta, /EnviarUpa|Ambulance/)
  assert.match(recepcao, /const semEnfermeiro = ubs && tipoAps === 'escuta_inicial' && r\.etapa === 'atendimento'/)
})

test('U10 do percurso da UBS: o CID do SOAP conta como problema avaliado na conduta', () => {
  const conduta = readFileSync('src/pages/plantao/porta/AbaConduta.tsx', 'utf8')
  assert.match(conduta, /\{ ok: problemas\.length > 0 \|\| !!cidSoap, texto: 'Ao menos um problema ou condição avaliada' \}/)
  assert.match(conduta, /o CID do registro do atendimento, já conta como problema avaliado/)
})

test('U6, PR 3 do percurso da UBS: a janela da consulta de enfermagem tem só as abas do enfermeiro', () => {
  const janela = readFileSync('src/pages/plantao/porta/JanelaAtendimento.tsx', 'utf8')
  assert.match(janela, /const consultaEnfermagem = !!ep\.tipo_atendimento_aps && papelAtivo === 'enfermeiro'/)
  assert.match(janela, /consultaEnfermagem \? \['atend', 'alg', 'aval', 'exames', 'proc', 'docs', 'conduta'\]\.includes\(a\.k\)/)
  const conduta = readFileSync('src/pages/plantao/porta/AbaConduta.tsx', 'utf8')
  assert.match(conduta, /\{urgencia && unidadeAtiva && !enfermagem && \(/)
  assert.match(conduta, /\{regulacao && !enfermagem && \(/)
})
