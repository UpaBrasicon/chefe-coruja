// Padrão do frontend — verificação com catraca (trilha "Padrão do frontend", parte 3).
//
// Lê cada arquivo de src/ pela árvore do TypeScript e conta, por arquivo e por
// regra, o que foge do guia (docs/frontend/GUIA.md). A contagem de hoje fica em
// scripts/padrao-frontend.base.json. Na CI, o passo falha se algum número subir,
// se um arquivo novo nascer com divergência ou se a base ficar para trás de uma
// correção (decisões do RT "1a 2a 3a" de 19/10/2026).
//
//   node scripts/padrao-frontend.mjs              relatório (totais e arquivos)
//   node scripts/padrao-frontend.mjs --ci         compara com a base; sai 1 se piorar
//   node scripts/padrao-frontend.mjs --ci --comparar origin/master
//                                                 também barra a base que sobe no PR
//   node scripts/padrao-frontend.mjs --atualizar  regrava a base (depois de corrigir)
//
// Exceção pontual: comentário `// padrao-ok: <motivo>` (ou `{/* padrao-ok: <motivo> */}`
// no JSX) na própria linha ou na linha de cima. O motivo é obrigatório; as
// exceções saem listadas no relatório.

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BASE = join(RAIZ, 'scripts', 'padrao-frontend.base.json')

/** Regras, com a seção do guia de onde vêm. */
export const REGRAS = {
  'cor-crua': 'Cor da paleta do Tailwind, branco ou preto em classe (guia 1.1 e 1.4)',
  'cor-arbitraria': 'Cor ou opacidade arbitrária em classe, como bg-[#FEF2F2] ou bg-critico/[0.06] (guia 1.4 e 2.1)',
  'cor-hex': 'Hex, rgb ou hsl fora de classe: style, HTML montado, gráfico (guia 1.4 e 5.5)',
  'texto-escala': 'Tamanho de texto do Tailwind ou arbitrário, fora dos tokens do projeto (guia 1.5)',
  'canto': 'Canto fora de rounded-controle, -container, -cartao e -capsula (guia 4.3)',
  'botao-solto': '<button> fora dos componentes de base (guia 3.1)',
  'select-solto': '<select> fora do CampoSelecao (guia 3.2)',
  'tabela-solta': '<table> fora do componente de tabela (guia 3.3)',
  'titulo-solto': '<h1>/<h2> fora de TituloPagina, TituloSecao e TituloCartao (guia 4.1)',
  'data-local': 'Data, hora ou número formatado fora de src/lib/formato.ts (guia 4.4)',
  'importacao-cruzada': 'Tela importando peça de outra área, ou componente importando tela (guia 4.5)',
  'emoji': 'Emoji na tela ou na folha impressa (guia 5.4)',
  'pronto-socorro': '"Pronto Socorro" sem hífen no texto (guia 5.3)',
}

// Onde a peça de base pode usar o elemento nativo (guia 3.1, 3.2, 3.3 e 4.1).
const BASE_DE_COMPONENTES = ['src/components/ui/', 'src/components/monitor/', 'src/components/TabsPagina.tsx']
const ELEMENTOS = { button: 'botao-solto', select: 'select-solto', table: 'tabela-solta', h1: 'titulo-solto', h2: 'titulo-solto' }

// Roteadores: montam as rotas e as ferramentas sob demanda, por isso importam telas.
const ROTEADORES = ['src/App.tsx', 'src/main.tsx', 'src/content/registry.tsx', 'src/content/plantaoRegistry.tsx']

// Exceções declaradas no guia (1.5): painel da TV e folha impressa têm escala
// própria; a folha impressa monta o próprio CSS (não lê os tokens do app).
const EXCECOES = {
  'texto-escala': ['src/pages/public/PainelChamada.tsx', 'src/lib/folhas.ts'],
  'cor-hex': ['src/lib/folhas.ts'],
  'data-local': ['src/lib/formato.ts'],
}

const PALETA = 'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose'
const PREFIXO_COR = '(?:text|bg|border(?:-[xytrblse])?|ring(?:-offset)?|outline|fill|stroke|from|via|to|divide|decoration|accent|caret|placeholder|shadow)'
const RE_COR_CRUA = new RegExp(`^${PREFIXO_COR}-(?:(?:${PALETA})-\\d{2,3}|white|black)(?:\\/\\S+)?$`)
const RE_COR_ARBITRARIA = new RegExp(`^${PREFIXO_COR}-\\[(?:#|rgba?\\(|hsla?\\(|oklch\\(|color:)`, 'i')
const RE_OPACIDADE_ARBITRARIA = /^[a-z][\w-]*\/\[[\d.]+%?\]$/
const RE_TEXTO = /^text-(?:xs|sm|base|lg|xl|[2-9]xl|\[(?:length:)?[\d.]+(?:px|rem|em|pt|vh|vw)\])$/
const RE_CANTO = /^rounded(?:-(?:[trblse]|t[lr]|b[lr]|s[se]|e[se]))?(?:-(.+))?$/
const CANTOS_DO_PROJETO = new Set(['controle', 'container', 'cartao', 'capsula', 'none'])
const RE_HEX = /(?<![\w&])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])|\b(?:rgba?|hsla?)\(/g
const RE_EMOJI = /\p{Emoji_Presentation}|\p{Extended_Pictographic}️/gu
const RE_PRONTO_SOCORRO = /\bpronto\s+socorro\b/gi
const FORMATADORES = new Set(['toLocaleDateString', 'toLocaleTimeString', 'toLocaleString'])
const INTL = new Set(['DateTimeFormat', 'NumberFormat', 'RelativeTimeFormat'])
const PADRAO_OK = /(?:\/\/|\/\*)\s*padrao-ok\b(.*)$/

/** Tira as variantes (`hover:`, `md:`, `[&>svg]:`) e o `!` de uma classe. */
export function utilitario(classe) {
  let t = classe.replace(/^!/, '').replace(/!$/, '')
  let profundidade = 0
  let corte = -1
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (c === '[' || c === '(') profundidade++
    else if (c === ']' || c === ')') profundidade--
    else if (c === ':' && profundidade === 0) corte = i
  }
  if (corte >= 0) t = t.slice(corte + 1)
  return t.replace(/^!/, '')
}

/** Regra que uma classe quebra, ou null. */
export function regraDaClasse(classe) {
  const u = utilitario(classe)
  if (!u) return null
  if (RE_COR_CRUA.test(u)) return 'cor-crua'
  if (RE_COR_ARBITRARIA.test(u) || RE_OPACIDADE_ARBITRARIA.test(u)) return 'cor-arbitraria'
  if (RE_TEXTO.test(u)) return 'texto-escala'
  const canto = RE_CANTO.exec(u)
  if (canto && !CANTOS_DO_PROJETO.has(canto[1] ?? '')) return 'canto'
  return null
}

const posix = (p) => p.split(sep).join('/')
const dentro = (arquivo, lista) => lista.some((p) => (p.endsWith('/') ? arquivo.startsWith(p) : arquivo === p))

/** Área de uma tela: a pasta logo abaixo de src/pages (arquivos soltos são a área "raiz"). */
function areaDaTela(arquivo) {
  const m = /^src\/pages\/([^/]+)(\/)?/.exec(arquivo)
  if (!m) return null
  return m[2] ? m[1] : '(raiz)'
}

/** Caminho em src/ de um import, ou null quando é pacote. */
function alvoDoImport(arquivo, especificador) {
  if (especificador.startsWith('@/')) return 'src/' + especificador.slice(2)
  if (especificador.startsWith('.')) return posix(join(dirname(arquivo), especificador))
  return null
}

function quebraImportacao(arquivo, especificador, telaInteira = false) {
  const alvo = alvoDoImport(arquivo, especificador)
  if (!alvo || !alvo.startsWith('src/pages/')) return false
  const origem = areaDaTela(arquivo)
  // Fora de src/pages, só os roteadores e a entrada importam telas.
  if (origem === null) return !ROTEADORES.includes(arquivo) && !arquivo.startsWith('src/routes/')
  // Tela que agrupa telas (abas de grupos/, Indicadores, Configuração) monta a
  // tela inteira; isso não é peça emprestada.
  if (telaInteira) return false
  const destino = alvo.split('/').length > 3 ? alvo.split('/')[2] : '(raiz)'
  return destino !== origem
}

/**
 * O import traz só a tela inteira: o default, ou o nome igual ao do arquivo
 * (`import { EscalaMes } from '@/pages/gestor/EscalaMes'`). Peça, hook ou
 * constante com outro nome não conta.
 */
function importaTelaInteira(no) {
  const clausula = no.importClause
  if (!clausula || clausula.isTypeOnly) return false
  const arquivo = no.moduleSpecifier.text.split('/').pop()
  if (!/^[A-Z]/.test(arquivo)) return false
  const nomes = clausula.namedBindings
  if (nomes && !ts.isNamedImports(nomes)) return false
  return (nomes?.elements ?? []).every((e) => (e.propertyName ?? e.name).text === arquivo)
}

/** Comentários `padrao-ok` por linha (1-based): { motivo } ou { invalido: true }. */
function excecoesPorLinha(texto) {
  const mapa = new Map()
  texto.split(/\r?\n/).forEach((linha, i) => {
    const m = PADRAO_OK.exec(linha)
    if (!m) return
    const resto = m[1].replace(/\*\/.*$/, '').trim()
    const motivo = resto.startsWith(':') ? resto.slice(1).trim() : ''
    mapa.set(i + 1, motivo ? { motivo } : { invalido: true })
  })
  return mapa
}

/**
 * Analisa um arquivo. `arquivo` é o caminho relativo à raiz com barras (src/...).
 * Devolve { achados: [{regra, linha, trecho}], excecoes: [...], invalidas: [linha] }.
 */
export function analisar(arquivo, texto) {
  const tipo = arquivo.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const sf = ts.createSourceFile(arquivo, texto, ts.ScriptTarget.Latest, true, tipo)
  const brutos = []
  const linhaDe = (pos) => sf.getLineAndCharacterOfPosition(pos).line + 1
  const anotar = (regra, pos, trecho) => {
    if (EXCECOES[regra] && dentro(arquivo, EXCECOES[regra])) return
    brutos.push({ regra, linha: linhaDe(pos), trecho: String(trecho).slice(0, 80) })
  }
  const naBase = dentro(arquivo, BASE_DE_COMPONENTES)

  const textoCorrido = (inicio, bruto) => {
    for (const m of bruto.matchAll(RE_EMOJI)) anotar('emoji', inicio + m.index, m[0])
    for (const m of bruto.matchAll(RE_PRONTO_SOCORRO)) anotar('pronto-socorro', inicio + m.index, m[0])
  }

  const literal = (no) => {
    const inicio = no.getStart(sf)
    const bruto = texto.slice(inicio, no.end)
    textoCorrido(inicio, bruto)
    // Classes: cada pedaço separado por espaço, sem aspas nem `${`/`}` do template.
    for (const m of bruto.matchAll(/\S+/g)) {
      const pedaco = m[0].replace(/^[`'"}]+/, '').replace(/[`'",;$]+$/, '').replace(/\$\{$/, '')
      const regra = regraDaClasse(pedaco)
      if (regra) anotar(regra, inicio + m.index, pedaco)
    }
    // Hex e rgb fora de classe: tira antes os valores arbitrários de classe (`-[#fff]`).
    const semArbitrarios = bruto.replace(/-\[[^\]\s]*\]/g, (s) => ' '.repeat(s.length))
    for (const m of semArbitrarios.matchAll(RE_HEX)) anotar('cor-hex', inicio + m.index, m[0])
  }

  const visitar = (no) => {
    switch (no.kind) {
      case ts.SyntaxKind.StringLiteral:
      case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
      case ts.SyntaxKind.TemplateHead:
      case ts.SyntaxKind.TemplateMiddle:
      case ts.SyntaxKind.TemplateTail: {
        const pai = no.parent
        const ehModulo = pai && (ts.isImportDeclaration(pai) || ts.isExportDeclaration(pai) || ts.isExternalModuleReference(pai))
        if (!ehModulo) literal(no)
        break
      }
      case ts.SyntaxKind.JsxText:
        textoCorrido(no.getStart(sf), texto.slice(no.getStart(sf), no.end))
        break
      case ts.SyntaxKind.JsxOpeningElement:
      case ts.SyntaxKind.JsxSelfClosingElement: {
        const nome = no.tagName.getText(sf)
        if (ELEMENTOS[nome] && !naBase) anotar(ELEMENTOS[nome], no.getStart(sf), `<${nome}>`)
        break
      }
      case ts.SyntaxKind.ImportDeclaration:
      case ts.SyntaxKind.ExportDeclaration: {
        const esp = no.moduleSpecifier
        const inteira = ts.isImportDeclaration(no) && importaTelaInteira(no)
        if (esp && ts.isStringLiteral(esp) && quebraImportacao(arquivo, esp.text, inteira)) anotar('importacao-cruzada', no.getStart(sf), esp.text)
        break
      }
      case ts.SyntaxKind.CallExpression: {
        const alvo = no.expression
        if (alvo.kind === ts.SyntaxKind.ImportKeyword) {
          const esp = no.arguments[0]
          if (esp && ts.isStringLiteral(esp) && quebraImportacao(arquivo, esp.text, true)) anotar('importacao-cruzada', no.getStart(sf), esp.text)
        } else if (ts.isPropertyAccessExpression(alvo)) {
          const nome = alvo.name.text
          if (FORMATADORES.has(nome)) anotar('data-local', alvo.name.getStart(sf), nome)
          else if (INTL.has(nome) && alvo.expression.getText(sf) === 'Intl') anotar('data-local', no.getStart(sf), `Intl.${nome}`)
        }
        break
      }
      case ts.SyntaxKind.NewExpression: {
        const alvo = no.expression
        if (ts.isPropertyAccessExpression(alvo) && INTL.has(alvo.name.text) && alvo.expression.getText(sf) === 'Intl') {
          anotar('data-local', no.getStart(sf), `Intl.${alvo.name.text}`)
        }
        break
      }
    }
    ts.forEachChild(no, visitar)
  }
  visitar(sf)

  const marcas = excecoesPorLinha(texto)
  const achados = []
  const excecoes = []
  for (const a of brutos) {
    const ok = [marcas.get(a.linha), marcas.get(a.linha - 1)].find((m) => m && m.motivo)
    if (ok) excecoes.push({ ...a, motivo: ok.motivo })
    else achados.push(a)
  }
  const invalidas = [...marcas].filter(([, m]) => m.invalido).map(([linha]) => linha)
  return { achados, excecoes, invalidas }
}

/** Arquivos .ts/.tsx de src/, sem testes nem declarações. */
function arquivosDeSrc() {
  const lista = []
  const andar = (dir) => {
    for (const nome of readdirSync(dir)) {
      const caminho = join(dir, nome)
      if (statSync(caminho).isDirectory()) andar(caminho)
      else if (/\.tsx?$/.test(nome) && !/\.test\.tsx?$/.test(nome) && !nome.endsWith('.d.ts')) lista.push(caminho)
    }
  }
  andar(join(RAIZ, 'src'))
  return lista.map((c) => posix(relative(RAIZ, c))).sort()
}

/** Varre src/ e devolve { contagem: {arquivo: {regra: n}}, detalhes, excecoes, invalidas }. */
export function varrer() {
  const contagem = {}
  const detalhes = {}
  const excecoes = []
  const invalidas = []
  for (const arquivo of arquivosDeSrc()) {
    const r = analisar(arquivo, readFileSync(join(RAIZ, arquivo), 'utf8'))
    excecoes.push(...r.excecoes.map((e) => ({ arquivo, ...e })))
    invalidas.push(...r.invalidas.map((linha) => ({ arquivo, linha })))
    if (!r.achados.length) continue
    detalhes[arquivo] = r.achados
    contagem[arquivo] = {}
    for (const a of r.achados) contagem[arquivo][a.regra] = (contagem[arquivo][a.regra] ?? 0) + 1
  }
  return { contagem, detalhes, excecoes, invalidas }
}

export function totais(contagem) {
  const t = Object.fromEntries(Object.keys(REGRAS).map((r) => [r, 0]))
  for (const regras of Object.values(contagem)) for (const [r, n] of Object.entries(regras)) t[r] = (t[r] ?? 0) + n
  return t
}

/**
 * Compara a contagem atual com a base. Devolve { subiu: [...], desceu: [...] },
 * cada item { arquivo, regra, antes, agora }.
 */
export function comparar(base, atual) {
  const subiu = []
  const desceu = []
  const arquivos = new Set([...Object.keys(base), ...Object.keys(atual)])
  for (const arquivo of [...arquivos].sort()) {
    const regras = new Set([...Object.keys(base[arquivo] ?? {}), ...Object.keys(atual[arquivo] ?? {})])
    for (const regra of [...regras].sort()) {
      const antes = base[arquivo]?.[regra] ?? 0
      const agora = atual[arquivo]?.[regra] ?? 0
      if (agora > antes) subiu.push({ arquivo, regra, antes, agora })
      else if (agora < antes) desceu.push({ arquivo, regra, antes, agora })
    }
  }
  return { subiu, desceu }
}

function lerBase(texto) {
  const json = JSON.parse(texto)
  return json.arquivos ?? {}
}

function gravarBase(contagem) {
  const ordenado = {}
  for (const arquivo of Object.keys(contagem).sort()) {
    ordenado[arquivo] = Object.fromEntries(Object.entries(contagem[arquivo]).sort(([a], [b]) => a.localeCompare(b)))
  }
  const json = {
    _leia: 'Base da catraca do padrão do frontend (scripts/padrao-frontend.mjs). Só desce: depois de corrigir, rode `node scripts/padrao-frontend.mjs --atualizar` e comite junto.',
    totais: totais(contagem),
    arquivos: ordenado,
  }
  writeFileSync(BASE, JSON.stringify(json, null, 2) + '\n')
}

function main(args) {
  const { contagem, detalhes, excecoes, invalidas } = varrer()
  const t = totais(contagem)

  if (args.includes('--atualizar')) {
    gravarBase(contagem)
    console.log(`Base regravada: ${Object.values(t).reduce((a, b) => a + b, 0)} divergências em ${Object.keys(contagem).length} arquivos.`)
    return 0
  }

  if (!args.includes('--ci')) {
    console.log('Padrão do frontend — divergências por regra\n')
    for (const [regra, n] of Object.entries(t)) console.log(`  ${String(n).padStart(5)}  ${regra.padEnd(19)} ${REGRAS[regra]}`)
    const porArquivo = Object.entries(contagem).map(([a, r]) => [a, Object.values(r).reduce((x, y) => x + y, 0)])
    console.log('\nArquivos com mais divergências:')
    for (const [a, n] of porArquivo.sort((x, y) => y[1] - x[1]).slice(0, 15)) console.log(`  ${String(n).padStart(5)}  ${a}`)
    console.log(`\nExceções com padrao-ok: ${excecoes.length}`)
    for (const e of excecoes) console.log(`  ${e.arquivo}:${e.linha} ${e.regra} — ${e.motivo}`)
    return 0
  }

  // --ci
  let falhou = false
  if (!existsSync(BASE)) {
    console.error('Falta scripts/padrao-frontend.base.json. Rode `node scripts/padrao-frontend.mjs --atualizar`.')
    return 1
  }
  const base = lerBase(readFileSync(BASE, 'utf8'))
  const { subiu, desceu } = comparar(base, contagem)

  if (invalidas.length) {
    falhou = true
    console.error('Comentário padrao-ok sem motivo (escreva `padrao-ok: <motivo>`):')
    for (const i of invalidas) console.error(`  ${i.arquivo}:${i.linha}`)
  }
  if (subiu.length) {
    falhou = true
    console.error('O padrão do frontend piorou (docs/frontend/GUIA.md):')
    for (const s of subiu) {
      console.error(`  ${s.arquivo} — ${s.regra}: ${s.antes} → ${s.agora}. ${REGRAS[s.regra]}`)
      const linhas = detalhes[s.arquivo].filter((x) => x.regra === s.regra)
      for (const a of linhas.slice(0, 12)) console.error(`      linha ${a.linha}: ${a.trecho}`)
      if (linhas.length > 12) console.error(`      … e mais ${linhas.length - 12}`)
    }
    console.error('Corrija seguindo o guia. Se for exceção de verdade, marque a linha com `// padrao-ok: <motivo>`.')
  }
  if (desceu.length) {
    falhou = true
    console.error('Divergências corrigidas, mas a base não foi atualizada:')
    for (const d of desceu) console.error(`  ${d.arquivo} — ${d.regra}: ${d.antes} → ${d.agora}`)
    console.error('Rode `node scripts/padrao-frontend.mjs --atualizar` e comite a base junto.')
  }

  // No PR: a base não pode subir em relação à do ramo de destino (só a renomeação de arquivo move números).
  const i = args.indexOf('--comparar')
  if (i >= 0 && args[i + 1]) {
    let anterior = null
    try {
      anterior = execFileSync('git', ['show', `${args[i + 1]}:scripts/padrao-frontend.base.json`], { cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    } catch {
      console.log(`Base de ${args[i + 1]} não encontrada; comparação com o ramo de destino pulada.`)
    }
    if (anterior) {
      const antes = totais(lerBase(anterior))
      const agora = totais(lerBase(readFileSync(BASE, 'utf8')))
      for (const regra of Object.keys(agora)) {
        if ((agora[regra] ?? 0) > (antes[regra] ?? 0)) {
          falhou = true
          console.error(`A base subiu em ${regra}: ${antes[regra] ?? 0} → ${agora[regra]} em relação a ${args[i + 1]}. A base só desce.`)
        }
      }
    }
  }

  const total = Object.values(t).reduce((a, b) => a + b, 0)
  if (falhou) return 1
  console.log(`Padrão do frontend: nada piorou. ${total} divergências antigas na base; ${excecoes.length} exceções com padrao-ok.`)
  return 0
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2))
}
