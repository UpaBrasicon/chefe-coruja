// LG10 (docs/regulatorio/LG10-GATE-APROVACAO-DIAGNOSTICO.md, decisões do RT de
// 17/11/2026, todas A): regras da guarda de versão (G2) e do gate de aprovação
// (G1), sem acesso a disco, git ou rede, para poder testar.

/** Texto estável de um valor: chaves em ordem e funções pelo código-fonte. */
export function serializar(v) {
  const visto = new WeakSet()
  const ir = (x) => {
    if (typeof x === 'function') return { '#fn': String(x) }
    if (x === undefined) return { '#undefined': true }
    if (x === null || typeof x !== 'object') return x
    if (visto.has(x)) return '#ciclo'
    visto.add(x)
    if (Array.isArray(x)) return x.map(ir)
    const o = {}
    for (const k of Object.keys(x).sort()) o[k] = ir(x[k])
    return o
  }
  return JSON.stringify(ir(v))
}

/** A ficha sem o campo `versao` (é o que precisa mudar junto). */
export const conteudoDaFicha = (f) => {
  const { versao: _versao, ...resto } = f
  return serializar(resto)
}

export const LINHA_DISPENSA = /^\s*Sem mudança clínica:\s*\S.{4,}/im

/** O corpo do PR traz a linha "Sem mudança clínica: <motivo>". */
export const temDispensa = (corpo) => LINHA_DISPENSA.test(corpo ?? '')

/** Arquivos de tela da Central, onde mora texto clínico das ferramentas. */
export const ehTela = (arq) =>
  /^src\/(pages|components)\/plantonista\/.+\.(tsx?|jsx?)$/.test(arq) && !/\.test\.[tj]sx?$/.test(arq)

/** Arquivos do pacote clínico (fora os testes e o índice gerado). */
export const ehPacoteClinico = (arq) =>
  /^src\/clinico\/.+\.ts$/.test(arq) && !arq.endsWith('.test.ts') && arq !== 'src/clinico/indice.ts'

/**
 * Guarda e gate.
 * @param {object} p
 * @param {Map<string, {ficha, arquivos: string[]}>} p.base    fichas do master, por id
 * @param {Map<string, {ficha, arquivos: string[]}>} p.cabeca  fichas do PR, por id (arquivos que a exportam)
 * @param {Record<string, unknown>} p.toposBase, p.toposCabeca, p.guiasBase, p.guiasCabeca
 * @param {string[]} p.mudados                         arquivos mudados no PR
 * @param {Map<string, string[]>} p.fichasDaTela      arquivo de tela → ids das fichas que ele usa
 * @param {boolean} p.dispensa                         o PR traz "Sem mudança clínica: …"
 * @returns {{ erros: string[], avisos: string[], novas: {ferramenta_id: string, versao: string}[] }}
 */
export function avaliar(p) {
  const erros = []
  const avisos = []
  const subiu = (id) => {
    const b = p.base.get(id)
    const c = p.cabeca.get(id)
    return !b || !c || b.ficha.versao !== c.ficha.versao
  }

  // Regra 1 (sem dispensa): ficha, topo e guia são conteúdo puro.
  for (const [id, c] of p.cabeca) {
    const b = p.base.get(id)
    if (!b || subiu(id)) continue
    const o_que = []
    if (conteudoDaFicha(b.ficha) !== conteudoDaFicha(c.ficha)) o_que.push('ficha')
    if (serializar(p.toposBase[id]) !== serializar(p.toposCabeca[id])) o_que.push('topo (topos.ts)')
    if (serializar(p.guiasBase[id]) !== serializar(p.guiasCabeca[id])) o_que.push('guia (guias.ts)')
    if (o_que.length) erros.push(`${id}: mudou ${o_que.join(', ')} e a versão continua ${c.ficha.versao}. Suba a versão da ficha.`)
  }

  // Regra 1b: arquivo do pacote que define fichas mudou → as fichas dele sobem.
  // Arquivo do pacote sem ficha (helper, fonte comum) segue a regra das telas.
  const porArquivo = new Map()
  for (const [id, c] of p.cabeca) {
    for (const arq of c.arquivos) {
      if (!porArquivo.has(arq)) porArquivo.set(arq, [])
      porArquivo.get(arq).push(id)
    }
  }
  const compartilhados = []
  for (const arq of p.mudados.filter(ehPacoteClinico)) {
    if (arq === 'src/clinico/topos.ts' || arq === 'src/clinico/guias.ts') continue // comparados por id acima
    const ids = porArquivo.get(arq)
    if (!ids) {
      compartilhados.push(arq)
      continue
    }
    const presas = ids.filter((id) => p.base.has(id) && !subiu(id))
    if (presas.length) erros.push(`${arq} mudou e a versão destas fichas não subiu: ${presas.join(', ')}.`)
  }

  // Regra 2: tela ligada a ficha mudou → as fichas dela sobem, ou o PR declara
  // "Sem mudança clínica".
  const soltas = []
  for (const arq of [...p.mudados.filter(ehTela), ...compartilhados]) {
    const ids = p.fichasDaTela.get(arq) ?? []
    if (!ids.length) {
      soltas.push(arq)
      continue
    }
    const presas = ids.filter((id) => p.base.has(id) && !subiu(id))
    if (!presas.length) continue
    if (p.dispensa) avisos.push(`${arq}: sem versão nova (${presas.join(', ')}), com "Sem mudança clínica" no PR.`)
    else erros.push(`${arq} mudou e a versão destas fichas não subiu: ${presas.join(', ')}. Suba a versão, ou declare no corpo do PR "Sem mudança clínica: <motivo>" se for só interface.`)
  }
  if (soltas.length) avisos.push(`Arquivos clínicos sem ficha ligada (conferir à mão): ${soltas.join(', ')}.`)

  // Gate (G1): toda versão nova ou ficha nova precisa estar aprovada na produção.
  const novas = [...p.cabeca.values()]
    .filter(({ ficha }) => subiu(ficha.id))
    .map(({ ficha }) => ({ ferramenta_id: ficha.id, versao: ficha.versao }))
    .sort((a, b) => a.ferramenta_id.localeCompare(b.ferramenta_id))
  return { erros, avisos, novas }
}

/** Gate com o status lido da produção: só 'aprovada' passa. */
export function conferirAprovacao(novas, status) {
  const porChave = new Map(status.map((s) => [`${s.ferramenta_id}@${s.versao}`, s.status]))
  return novas
    .map((n) => ({ ...n, status: porChave.get(`${n.ferramenta_id}@${n.versao}`) ?? 'sem_resposta' }))
    .filter((n) => n.status !== 'aprovada')
    .map((n) => `${n.ferramenta_id} ${n.versao}: ${n.status} na produção. Aprove na Revisão Clínica e rode o CI de novo.`)
}

/**
 * Ids das fichas que um arquivo de tela usa: nomes importados de
 * '@/clinico/<módulo>' que são ficha (export ficha… com id e versão) ou têm `.ficha`.
 * @param {string} fonte  código do arquivo
 * @param {(modulo: string) => Record<string, unknown> | undefined} modulo
 */
export function fichasUsadas(fonte, modulo) {
  const ids = new Set()
  for (const m of fonte.matchAll(/import\s*\{([^}]*)\}\s*from\s*'@\/clinico\/([\w/]+)'/g)) {
    const mod = modulo(m[2])
    if (!mod) continue
    for (const nome of m[1].split(',').map((s) => s.replace(/^\s*type\s+/, '').split(/\s+as\s+/)[0].trim()).filter(Boolean)) {
      const v = mod[nome]
      if (!v || typeof v !== 'object') continue
      const f = v.id && v.versao ? v : v.ficha?.id && v.ficha?.versao ? v.ficha : null
      if (f) ids.add(f.id)
    }
  }
  return [...ids].sort()
}
