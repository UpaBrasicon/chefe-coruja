import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

// Item 01 do kit de desempenho, decisão do RT em 09/11/2026: esqueleto ao
// carregar, começando por Central do Plantonista, Observação, Internação da
// enfermagem, fila da Triagem e Regulação. O esqueleto tem a forma da lista e
// avisa o leitor de tela; não é só um círculo girando.
const TELAS: [arquivo: string, antes: RegExp][] = [
  ['src/components/plantonista/central/CartaoTurno.tsx', /'Carregando o turno…'/],
  ['src/components/observacao/PainelObservacao.tsx', /painel\.isLoading \? \(\s*<div className="flex h-40 items-center justify-center"><Spinner \/><\/div>/],
  ['src/pages/enfermagem/InternacaoEnfermagem.tsx', /\{carregando && <div className="flex justify-center py-6"><Spinner \/><\/div>\}/],
  ['src/pages/enfermagem/triagem/Fila.tsx', /Carregando a fila…<\/p>/],
  ['src/pages/regulacao/Regulacao.tsx', /\{lista\.isLoading \? <Spinner \/> : lista\.error/],
]

// Pedido 1 do desempenho (23/11/2026, F2): as telas principais que ainda
// giravam um círculo ou deixavam a tela vazia ao carregar. O /plantao tem um
// caso próprio no fim do arquivo.
const TELAS_F2: [arquivo: string, antes: RegExp][] = [
  ['src/pages/enfermagem/InicioEnfermagem.tsx', /if \(carregando\) return <div[^>]*><Spinner \/>/],
  ['src/pages/enfermagem/ProntoSocorroEnfermagem.tsx', /\{carregando && <div className="px-5 py-4"><Spinner \/><\/div>\}/],
  ['src/pages/plantao/porta/FilaPS.tsx', /\{carregando && <div className="px-5 py-4"><Spinner \/><\/div>\}/],
  ['src/components/internacao/ListaInternados.tsx', /carregando \? \(\s*<div className="flex h-32 items-center justify-center"><Spinner \/>/],
  ['src/pages/MeuPlantao.tsx', /isLoading \? \(\s*<div className="flex h-20 items-center justify-center">\s*<Spinner \/>/],
  ['src/pages/gestor/PainelGestor.tsx', /if \(isLoading \|\| !data\) return <div[^>]*><Spinner \/>/],
  ['src/components/TabsPagina.tsx', /fallback=\{\s*<div className="flex h-40 items-center justify-center">\s*<Spinner \/>/],
  ['src/pages/InternacaoPainel.tsx', /carregandoTransf \? \(\s*<div className="flex h-16 items-center justify-center">\s*<Spinner \/>/],
  ['src/pages/plantao/Passometro.tsx', /lista\.isLoading && <div className="py-6"><Spinner \/>/],
  ['src/pages/vacina/LotesVacina.tsx', /painel\.isLoading && <Spinner \/>/],
  ['src/pages/enfermagem/SinaisVitaisUbs.tsx', /fichas\.isLoading && <Spinner \/>/],
  ['src/pages/admin/UsoDoApp.tsx', /painel\.isLoading && <div className="py-6"><Spinner \/>/],
  ['src/pages/admin/SisabAba.tsx', /message\} \/> : <Spinner \/>|itens\.isLoading \? <Spinner \/>/],
  ['src/pages/Tecnovigilancia.tsx', /if \(isLoading\) return <div[^>]*><Spinner \/>/],
  ['src/pages/vacina/SalaVacina.tsx', /!lotes\.data\) return <Spinner \/>/],
]

test('as cinco telas usam esqueleto no carregamento principal', () => {
  const faltam: string[] = []
  for (const [arquivo, antes] of TELAS) {
    const fonte = readFileSync(arquivo, 'utf8')
    if (antes.test(fonte)) faltam.push(`${arquivo} (ainda com o carregamento antigo)`)
    if (!/<EsqueletoLinhas\b|<Skeleton\b/.test(fonte)) faltam.push(`${arquivo} (sem esqueleto)`)
  }
  assert.deepEqual(faltam, [])
})

test('o esqueleto avisa o leitor de tela e some do leitor nas faixas', () => {
  const fonte = readFileSync('src/components/ui/esqueleto-linhas.tsx', 'utf8')
  assert.match(fonte, /role="status"/)
  assert.match(fonte, /sr-only/)
  assert.match(fonte, /<Skeleton\b/)
})

test('as telas principais do pedido 1 usam esqueleto no carregamento', () => {
  const faltam: string[] = []
  for (const [arquivo, antes] of TELAS_F2) {
    const fonte = readFileSync(arquivo, 'utf8')
    if (antes.test(fonte)) faltam.push(`${arquivo} (ainda com o carregamento antigo)`)
    if (!/<EsqueletoLinhas\b|<Skeleton\b/.test(fonte)) faltam.push(`${arquivo} (sem esqueleto)`)
  }
  assert.deepEqual(faltam, [])
})

// O /plantao mostrava "Check-in pendente", "Fazer check-in", "Sem setor na
// escala agora" e "Ninguém em observação" enquanto carregava: informação
// errada naquele instante.
test('o /plantao só mostra o estado do check-in e os cartões depois de carregar', () => {
  const fonte = readFileSync('src/pages/plantao/PlantaoHome.tsx', 'utf8')
  assert.match(fonte, /isLoading: carregandoPresenca/)
  // o selo: o ramo de carga vem antes de qualquer selo do check-in e tem esqueleto
  const carga = fonte.indexOf('{carregandoPresenca ? (')
  assert.ok(carga > 0, 'falta o ramo de carga do selo')
  assert.ok(carga < fonte.indexOf('Check-in pendente'), '"Check-in pendente" fora do ramo que confere o fim da carga')
  assert.match(fonte.slice(carga, fonte.indexOf(') : emPlantao ? (')), /<Skeleton\b/)
  // os horários e o botão também esperam a carga
  assert.match(fonte, /\{!carregandoPresenca && \(\s*<>\s*<span className="text-apoio text-tinta-apoio tabular">/)
  // os dois cartões recebem o estado da faixa e trocam número e texto por esqueleto
  assert.equal(fonte.match(/carregando=\{faixa\.isLoading\}/g)?.length, 2)
  assert.match(fonte, /\{carregando \? \([\s\S]{0,500}<Skeleton\b[\s\S]{0,300}\) : \(/)
})
