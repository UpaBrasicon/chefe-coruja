import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import assert from 'node:assert/strict'

// Item 34 do BACKLOG (achado no PR #1097): a tela de favoritos de prescrição e a
// prescrição estruturada usavam a mesma chave ['busca-medicamento', termo, unidade],
// com respostas de formato diferente (a dos favoritos não traz alta_vigilancia).
// Com o cache compartilhado do TanStack Query, uma tela podia mostrar por um
// instante a lista guardada pela outra, sem o marcador de alta vigilância.
// Regra: a mesma chave de busca de medicamento só pode ser usada por consultas
// que buscam a mesma coisa (mesma RPC ou mesma tabela, colunas e limite).

function arquivosFonte(dir: string): string[] {
  const saida: string[] = []
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) saida.push(...arquivosFonte(caminho))
    else if (/\.tsx?$/.test(nome) && !/\.test\.tsx?$/.test(nome)) saida.push(caminho)
  }
  return saida
}

/** Texto do objeto passado ao useQuery que contém a posição dada (chaves balanceadas). */
function blocoDaConsulta(fonte: string, posicao: number): string {
  const inicio = fonte.lastIndexOf('useQuery(', posicao)
  const abre = fonte.indexOf('{', inicio)
  let nivel = 0
  for (let i = abre; i < fonte.length; i++) {
    if (fonte[i] === '{') nivel++
    else if (fonte[i] === '}' && --nivel === 0) return fonte.slice(abre, i + 1)
  }
  return fonte.slice(abre)
}

/** O que a consulta busca: RPC, tabela, colunas e limite. */
function origem(bloco: string): string {
  const fn = bloco.slice(bloco.indexOf('queryFn'))
  const partes = [
    ...[...fn.matchAll(/\.rpc\(\s*'([^']+)'/g)].map((m) => `rpc ${m[1]}`),
    ...[...fn.matchAll(/\.from\(\s*'([^']+)'\s*\)/g)].map((m) => `from ${m[1]}`),
    ...[...fn.matchAll(/\.select\(\s*'([^']*)'/g)].map((m) => `select ${m[1].replace(/\s+/g, ' ').trim()}`),
    ...[...fn.matchAll(/\.limit\(\s*(\d+)\s*\)/g)].map((m) => `limit ${m[1]}`),
  ]
  return partes.join(' | ')
}

type Uso = { arquivo: string; origem: string }

function usosDasChaves(): Map<string, Uso[]> {
  const porChave = new Map<string, Uso[]>()
  for (const arquivo of arquivosFonte('src')) {
    const fonte = readFileSync(arquivo, 'utf8')
    for (const m of fonte.matchAll(/queryKey:\s*\[\s*'([^']*busca-medicamento[^']*)'/g)) {
      const uso = { arquivo: arquivo.replace(/\\/g, '/'), origem: origem(blocoDaConsulta(fonte, m.index ?? 0)) }
      porChave.set(m[1], [...(porChave.get(m[1]) ?? []), uso])
    }
  }
  return porChave
}

test('a guarda acha as buscas de medicamento e o que cada uma consulta', () => {
  const usos = usosDasChaves()
  const estruturada = usos.get('busca-medicamento') ?? []
  assert.ok(estruturada.some((u) => u.arquivo === 'src/components/prescricao/PrescricaoEstruturada.tsx'))
  for (const lista of usos.values()) for (const u of lista) assert.notEqual(u.origem, '', `${u.arquivo}: não achei o que a consulta busca`)
})

test('a mesma chave busca-medicamento não serve a consultas diferentes', () => {
  const conflitos: string[] = []
  for (const [chave, lista] of usosDasChaves()) {
    const origens = new Set(lista.map((u) => u.origem))
    if (origens.size > 1) conflitos.push(`${chave}: ${lista.map((u) => `${u.arquivo} (${u.origem})`).join(' × ')}`)
  }
  assert.deepEqual(conflitos, [])
})

test('os favoritos de prescrição têm chave própria', () => {
  const fonte = readFileSync('src/pages/PreferenciasPrescricao.tsx', 'utf8')
  assert.match(fonte, /queryKey: \['busca-medicamento-favoritos'/)
  assert.doesNotMatch(fonte, /queryKey: \['busca-medicamento'[,\]]/)
})
