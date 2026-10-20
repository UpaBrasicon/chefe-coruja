// Testes da verificação do padrão do frontend (scripts/padrao-frontend.mjs).
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { analisar, comparar, regraDaClasse, utilitario } from './padrao-frontend.mjs'

const regras = (arquivo, texto) => analisar(arquivo, texto).achados.map((a) => a.regra).sort()

test('classes: variantes e important saem antes da regra', () => {
  assert.equal(utilitario('hover:md:bg-white'), 'bg-white')
  assert.equal(utilitario('[&>svg]:text-sm'), 'text-sm')
  assert.equal(utilitario('!rounded-lg'), 'rounded-lg')
})

test('classes: o que foge do guia', () => {
  assert.equal(regraDaClasse('bg-red-500'), 'cor-crua')
  assert.equal(regraDaClasse('text-white'), 'cor-crua')
  assert.equal(regraDaClasse('border-t-slate-200/50'), 'cor-crua')
  assert.equal(regraDaClasse('bg-[#FEF2F2]'), 'cor-arbitraria')
  assert.equal(regraDaClasse('bg-critico/[0.06]'), 'cor-arbitraria')
  assert.equal(regraDaClasse('text-sm'), 'texto-escala')
  assert.equal(regraDaClasse('text-[11px]'), 'texto-escala')
  assert.equal(regraDaClasse('rounded-lg'), 'canto')
  assert.equal(regraDaClasse('rounded'), 'canto')
  assert.equal(regraDaClasse('rounded-menu'), 'canto')
  assert.equal(regraDaClasse('rounded-[9px]'), 'canto')
})

test('classes: tokens do projeto passam', () => {
  for (const c of ['bg-acao', 'text-tinta-apoio', 'bg-critico/10', 'text-rotulo', 'text-controle', 'text-[var(--x)]',
    'rounded-controle', 'rounded-t-cartao', 'rounded-capsula', 'rounded-none', 'text-left', 'text-critico', 'p-[7px]']) {
    assert.equal(regraDaClasse(c), null, c)
  }
})

test('elementos nativos fora da base', () => {
  const tela = 'export const T = () => <div><button>a</button><select /><table /><h1>t</h1><h2>s</h2></div>'
  assert.deepEqual(regras('src/pages/x/T.tsx', tela), ['botao-solto', 'select-solto', 'tabela-solta', 'titulo-solto', 'titulo-solto'])
  assert.deepEqual(regras('src/components/ui/button.tsx', tela), [])
  assert.deepEqual(regras('src/components/monitor/Pagina.tsx', tela), [])
})

test('classes em className, template e constante', () => {
  const t = 'const SELECT = "rounded-lg text-sm"\nexport const T = ({ a }) => <p className={`bg-white ${a ? "text-xs" : ""}`} />'
  assert.deepEqual(regras('src/pages/x/T.tsx', t), ['canto', 'cor-crua', 'texto-escala', 'texto-escala'])
})

test('hex fora de classe, sem contar o valor arbitrário duas vezes', () => {
  const t = 'const s = { color: "#B91C1C", fill: "rgba(0,0,0,.1)" }\nconst c = "bg-[#FEF2F2]"\nconst id = "#secao"'
  assert.deepEqual(regras('src/pages/x/T.tsx', t), ['cor-arbitraria', 'cor-hex', 'cor-hex'])
  assert.deepEqual(regras('src/lib/folhas.ts', 'const css = "color:#000"'), [])
})

test('data local, emoji e Pronto Socorro', () => {
  const t = 'const a = d.toLocaleDateString("pt-BR")\nconst f = new Intl.NumberFormat("pt-BR")\nconst e = "📄 Anexo"\nexport const T = () => <p>Pronto Socorro ⚠️</p>'
  assert.deepEqual(regras('src/pages/x/T.tsx', t), ['data-local', 'data-local', 'emoji', 'emoji', 'pronto-socorro'])
  assert.deepEqual(regras('src/lib/formato.ts', 'export const h = (d) => d.toLocaleTimeString("pt-BR")'), [])
  assert.deepEqual(regras('src/pages/x/T.tsx', 'const ok = "Pronto-Socorro ✓"\n// Pronto Socorro no comentário não conta'), [])
})

test('importação cruzada', () => {
  assert.deepEqual(regras('src/pages/faturamento/Bpa.tsx', "import { Erro } from '@/pages/farmacia/Farmacia'"), ['importacao-cruzada'])
  assert.deepEqual(regras('src/pages/faturamento/Bpa.tsx', "import { X } from './Contas'"), [])
  assert.deepEqual(regras('src/pages/faturamento/Bpa.tsx', "import { X } from '../farmacia/Farmacia'"), ['importacao-cruzada'])
  assert.deepEqual(regras('src/components/casca/Faixa.tsx', "import { l } from '@/pages/gestor/limites'"), ['importacao-cruzada'])
  assert.deepEqual(regras('src/pages/Indicadores.tsx', "import { P } from '@/pages/Pessoas'"), [])
  assert.deepEqual(regras('src/App.tsx', "const L = lazy(() => import('@/pages/Login'))"), [])
  assert.deepEqual(regras('src/lib/x.ts', "const L = () => import('@/pages/Login')"), ['importacao-cruzada'])
  // tela que agrupa telas monta a tela inteira; peça com outro nome continua barrada
  assert.deepEqual(regras('src/pages/grupos/UnidadeGrupo.tsx', "import MapaLeitos from '@/pages/gestor/MapaLeitos'"), [])
  assert.deepEqual(regras('src/pages/Indicadores.tsx', "import { EsperaMedico } from '@/pages/gestor/EsperaMedico'"), [])
  assert.deepEqual(regras('src/pages/Indicadores.tsx', "import { limites } from '@/pages/gestor/limites'"), ['importacao-cruzada'])
  assert.deepEqual(regras('src/pages/gestor/X.tsx', "import { Painel, Filtro } from '@/pages/farmacia/PainelFarmacia'"), ['importacao-cruzada'])
  assert.deepEqual(regras('src/components/AppShell.tsx', "import { ForaDoExpediente } from '@/pages/plantonista/ForaDoExpediente'"), ['importacao-cruzada'])
})

test('padrao-ok com motivo vira exceção; sem motivo é inválido', () => {
  const t = 'const a = "text-sm" // padrao-ok: eixo do gráfico\n// padrao-ok: folha impressa\nconst b = "bg-white"\nconst c = "rounded-lg" // padrao-ok'
  const r = analisar('src/pages/x/T.tsx', t)
  assert.deepEqual(r.achados.map((a) => a.regra), ['canto'])
  assert.deepEqual(r.excecoes.map((e) => e.motivo), ['eixo do gráfico', 'folha impressa'])
  assert.deepEqual(r.invalidas, [4])
  const jsx = analisar('src/pages/x/T.tsx', 'export const T = () => (\n  <div>\n    {/* padrao-ok: tecla do atalho */}\n    <button />\n  </div>\n)')
  assert.equal(jsx.achados.length, 0)
  assert.equal(jsx.excecoes[0].motivo, 'tecla do atalho')
})

test('catraca: sobe, desce e arquivo novo', () => {
  const base = { 'src/a.tsx': { canto: 2, 'texto-escala': 1 } }
  assert.deepEqual(comparar(base, base), { subiu: [], desceu: [] })
  const r = comparar(base, { 'src/a.tsx': { canto: 3 }, 'src/novo.tsx': { emoji: 1 } })
  assert.deepEqual(r.subiu.map((s) => `${s.arquivo} ${s.regra} ${s.antes}>${s.agora}`), ['src/a.tsx canto 2>3', 'src/novo.tsx emoji 0>1'])
  assert.deepEqual(r.desceu.map((s) => `${s.arquivo} ${s.regra}`), ['src/a.tsx texto-escala'])
})
