import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

// Prontuário completo redesenhado (achado guardado, item 6; A em P1 a P7 e
// direção A do RT, 06/11/2026). A tela continua só de leitura, grava o acesso
// ao abrir e mantém alergias, regulações e o botão de impressão.
const tela = readFileSync('src/pages/prontuario/ProntuarioLeitura.tsx', 'utf8')
const linha = readFileSync('src/pages/prontuario/LinhaDoTempo.tsx', 'utf8')
const ambos = tela + linha

test('abrir a tela grava o acesso antes de ler a linha do tempo', () => {
  assert.match(tela, /await abrirProntuario\(pacienteId!\)/)
  // a leitura só começa depois que a abertura deu certo
  assert.match(tela, /enabled: abertura\.isSuccess/)
  assert.match(tela, /supabase\.rpc\('prontuario_leitura'/)
})

test('só leitura: nenhuma escrita e nenhuma outra RPC', () => {
  assert.doesNotMatch(ambos, /\.(insert|update|upsert|delete)\(/)
  assert.deepEqual([...ambos.matchAll(/\.rpc\('([a-z_]+)'/g)].map((m) => m[1]), ['prontuario_leitura'])
  assert.doesNotMatch(ambos, /useMutation|Salvar|Assinar|Registrar|Excluir|Editar/)
})

test('alergias (três estados) e regulações seguem na ficha', () => {
  assert.match(tela, /<AlergiasLeitura pacienteId=\{paciente\.id\}/)
  assert.match(tela, /<HistoricoRegulacao\s+pacienteId=\{paciente\.id\}/)
  assert.match(tela, /estado === 'nega'/)
  assert.match(tela, /estado === 'nao_registrada'/)
})

// Polish de 06/11/2026 (critique e decisão do RT)
test('sem dado do paciente: estado próprio, com "Voltar aos pedidos" como ação principal', () => {
  assert.match(tela, /Sem acesso a este paciente/)
  assert.match(tela, /O pedido pode ter vencido ou ainda não foi aprovado\./)
  assert.match(tela, /if \(!pac\.data\) throw new SemAcesso\(\)/)
  // a ação principal é o botão cheio (sem variant)
  assert.match(tela, /<Button nativeButton=\{false\} render=\{<Link to="\/prontuarios" \/>\}>Voltar aos pedidos<\/Button>/)
})

test('falha de rede ou de servidor tem "Tentar de novo", também ao carregar mais', () => {
  assert.match(tela, /abertura\.refetch\(\)/)
  assert.match(tela, /linha\.refetch\(\)/)
  assert.match(tela, /acao="carregar mais atendimentos" tentando=\{isFetchingNextPage\} tentar=\{\(\) => void verMais\(\)\}/)
  assert.match(tela, /Tentar de novo/)
})

test('Button com Link leva nativeButton={false} (aviso do Base UI)', () => {
  const comLink = [...tela.matchAll(/<Button[^>]*render=\{<Link/g)].map((m) => m[0])
  assert.ok(comLink.length >= 3)
  for (const b of comLink) assert.match(b, /nativeButton=\{false\}/)
})

test('atendimento fechado fica encontrável pelo Ctrl+F e o foco não é cortado', () => {
  assert.match(linha, /setAttribute\('hidden', 'until-found'\)/)
  assert.match(linha, /addEventListener\('beforematch'/)
  assert.match(linha, /focus-visible:outline-offset-\[-2px\]/)
  // data em h2, atendimento em h3
  assert.match(linha, /<h2\s/)
  assert.match(linha, /<h3>\s*<BotaoLinha/)
})

test('o plantonista continua com o botão de imprimir', () => {
  assert.match(tela, /papelAtivo === 'plantonista'[\s\S]{0,200}\/impressao-prontuario\?paciente=\$\{paciente\.id\}/)
  assert.match(tela, /Imprimir prontuário/)
})

test('cor da enfermagem e sinais vitais crus', () => {
  assert.match(linha, /<PilulaRisco cor=\{comoCor\(g\.classificacao\.cor\)\} \/>/)
  // nada de faixa de referência nem marca do valor na tela
  assert.doesNotMatch(linha, /\.flag\b|ref_min|ref_max|\.critico\b/)
})

test('a rota do prontuário não mudou', () => {
  const app = readFileSync('src/App.tsx', 'utf8')
  assert.match(app, /path="\/prontuarios\/:pacienteId"/)
})
