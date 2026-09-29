// CÓPIA de hermes/src/gateway/desidentificacao.ts (gateway de IA, ADR 0006).
// Não edite só aqui: edite o original e copie. scripts/gateway/copia.test.ts
// falha se as duas cópias divergirem.

// ─────────────────────────────────────────────────────────────────────────────
// GATEWAY DE IA (JEV) — gateway/desidentificacao.ts
// ADR 0006 (produto/docs/adr): nenhum identificador de paciente sai do
// perímetro. Este módulo é puro — sem rede, sem banco, sem relógio — para ser
// testado à exaustão e reaproveitado por qualquer chamada de IA.
//
// Três passos:
//   1. desidentificar: troca identificadores por pseudônimos estáveis na
//      conversa ([PACIENTE_1], [CPF_1]…), guardando o original num cofre que
//      NUNCA sai do servidor.
//   2. residuos: varre o texto já limpo atrás do que sobrou. Se sobrou algo
//      com cara de identificador, o gateway não envia (falha fechada).
//   3. reidentificar: na volta, troca os pseudônimos pelos originais antes de
//      entregar ao profissional — e descarta pseudônimo que o modelo inventou.
//
// Limite honesto: texto livre nunca fica 100% limpo (um nome de terceiro sem
// gatilho, escrito em minúsculas, passa). O gateway reduz o risco; a saída de
// IA continua sendo rascunho que o profissional confere.
// ─────────────────────────────────────────────────────────────────────────────

export type Categoria =
  | 'PESSOA' | 'PACIENTE' | 'CPF' | 'CNS' | 'TELEFONE' | 'EMAIL' | 'CEP' | 'DATA' | 'PRONTUARIO'

export type Cofre = {
  /** pseudônimo → original */
  paraOriginal: Map<string, string>
  /** original normalizado → pseudônimo (mesmo valor, mesmo pseudônimo) */
  paraPseudonimo: Map<string, string>
  contadores: Map<Categoria, number>
}

export function criarCofre(): Cofre {
  return { paraOriginal: new Map(), paraPseudonimo: new Map(), contadores: new Map() }
}

const normalizar = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase()

function pseudonimo(cofre: Cofre, categoria: Categoria, original: string): string {
  const chave = `${categoria}:${normalizar(original)}`
  const existente = cofre.paraPseudonimo.get(chave)
  if (existente) return existente
  const n = (cofre.contadores.get(categoria) ?? 0) + 1
  cofre.contadores.set(categoria, n)
  const p = `[${categoria}_${n}]`
  cofre.paraPseudonimo.set(chave, p)
  cofre.paraOriginal.set(p, original)
  return p
}

// ── Validadores de documento ─────────────────────────────────────────────────

const soDigitos = (s: string) => s.replace(/\D/g, '')

export function cpfValido(valor: string): boolean {
  const d = soDigitos(valor)
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false
  const dv = (base: string, pesoInicial: number) => {
    let soma = 0
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (pesoInicial - i)
    const r = (soma * 10) % 11
    return r === 10 ? 0 : r
  }
  return dv(d.slice(0, 9), 10) === Number(d[9]) && dv(d.slice(0, 10), 11) === Number(d[10])
}

/** CNS: 15 dígitos; definitivos (1, 2) e provisórios (7, 8, 9) somam múltiplo de 11. */
export function cnsValido(valor: string): boolean {
  const d = soDigitos(valor)
  if (d.length !== 15 || !/^[12789]/.test(d)) return false
  let soma = 0
  for (let i = 0; i < 15; i++) soma += Number(d[i]) * (15 - i)
  return soma % 11 === 0
}

// ── Padrões ──────────────────────────────────────────────────────────────────
// A ordem importa: o mais específico primeiro (CNS e CPF antes de telefone).

const RE_EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g
const RE_CNS = /(?<!\d)\d{3}[ .]?\d{4}[ .]?\d{4}[ .]?\d{4}(?!\d)/g
const RE_CPF = /(?<!\d)\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?!\d)/g
const RE_PRONTUARIO = /(?<!\d)(?:19|20)\d{2}\.\d{6}(?!\d)/g
const RE_DATA = /(?<!\d)(?:0?[1-9]|[12]\d|3[01])[/.-](?:0?[1-9]|1[0-2])[/.-](?:19|20)\d{2}(?!\d)/g
const RE_CEP = /(?<!\d)\d{5}-\d{3}(?!\d)/g
const RE_TELEFONE = /(?<![\w\d])(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?9?\d{4}[-\s]?\d{4}(?!\d)/g

// Nome depois de um gatilho: "paciente João da Silva", "sra. Maria", "mãe: Ana Souza".
const PARTICULA = '(?:da|de|do|das|dos|e)'
const PALAVRA_NOME = '[A-ZÀ-Ý][a-zà-ÿ]+'
// Só o gatilho ignora maiúsculas; o nome precisa começar com maiúscula — com a
// regex inteira case-insensitive, "no leito" e "às" viravam nome.
const semCaixa = (palavra: string) =>
  [...palavra].map((c) => (/\p{L}/u.test(c) ? `[${c.toLowerCase()}${c.toUpperCase()}]` : escaparRegex(c))).join('')
const GATILHOS = [
  'paciente', 'pcte', 'pct', 'pac.', 'sr.', 'sr', 'sra.', 'sra', 'srta.', 'dona', 'seu', 'mãe', 'mae', 'pai',
  'responsável', 'responsavel', 'acompanhante', 'nome do paciente', 'nome da paciente', 'nome',
].map((g) => g.split(' ').map(semCaixa).join('\\s+'))
const RE_NOME_APOS_GATILHO = new RegExp(
  `((?<![\\p{L}])(?:${GATILHOS.join('|')})\\s*:?\\s+)` +
    `(${PALAVRA_NOME}(?:\\s+(?:${PARTICULA}\\s+)?${PALAVRA_NOME}){0,4})`,
  'gu',
)

export type Contagem = Partial<Record<Categoria, number>>

export type Conhecido = { valor: string; categoria: 'PESSOA' | 'PACIENTE' }

/**
 * Troca identificadores por pseudônimos. `conhecidos` são valores que o
 * servidor já sabe serem identificadores (o nome do usuário, nomes vindos de
 * ferramentas) — esses saem sempre, com ou sem gatilho.
 */
export function desidentificar(
  texto: string,
  cofre: Cofre,
  conhecidos: Conhecido[] = [],
): { texto: string; contagem: Contagem } {
  const contagem: Contagem = {}
  const contar = (c: Categoria) => { contagem[c] = (contagem[c] ?? 0) + 1 }
  let t = texto

  // 1. Valores conhecidos, do mais longo para o mais curto (evita trocar
  //    "Ana" dentro de "Ana Paula" antes de "Ana Paula").
  const ordenados = [...conhecidos]
    .filter((k) => k.valor && k.valor.trim().length >= 3)
    .sort((a, b) => b.valor.length - a.valor.length)
  for (const k of ordenados) {
    const re = new RegExp(`(?<![\\p{L}])${escaparRegex(k.valor.trim()).replace(/\s+/g, '\\s+')}(?![\\p{L}])`, 'giu')
    t = t.replace(re, (m) => { contar(k.categoria); return pseudonimo(cofre, k.categoria, m) })
  }

  // 2. Padrões com validação: só vira CPF/CNS o que confere o dígito.
  t = t.replace(RE_EMAIL, (m) => { contar('EMAIL'); return pseudonimo(cofre, 'EMAIL', m) })
  t = t.replace(RE_CNS, (m) => (cnsValido(m) ? (contar('CNS'), pseudonimo(cofre, 'CNS', m)) : m))
  t = t.replace(RE_CPF, (m) => (cpfValido(m) ? (contar('CPF'), pseudonimo(cofre, 'CPF', m)) : m))
  t = t.replace(RE_PRONTUARIO, (m) => { contar('PRONTUARIO'); return pseudonimo(cofre, 'PRONTUARIO', m) })
  t = t.replace(RE_DATA, (m) => { contar('DATA'); return pseudonimo(cofre, 'DATA', m) })
  t = t.replace(RE_CEP, (m) => { contar('CEP'); return pseudonimo(cofre, 'CEP', m) })
  t = t.replace(RE_TELEFONE, (m) => {
    // Número curto ou dose ("500 mg") não é telefone: exige 8+ dígitos.
    if (soDigitos(m).length < 8) return m
    contar('TELEFONE')
    return pseudonimo(cofre, 'TELEFONE', m)
  })

  // 3. Nome depois de gatilho.
  t = t.replace(RE_NOME_APOS_GATILHO, (_m, gatilho: string, nome: string) => {
    contar('PACIENTE')
    return gatilho + pseudonimo(cofre, 'PACIENTE', nome)
  })

  return { texto: t, contagem }
}

/** Chaves cujo valor, num resultado de ferramenta, é nome de pessoa. */
const CHAVES_DE_NOME = /^(nome|nome_completo|profissional|medico|m[eé]dico|paciente|responsavel|autor)$/i

/** Varre um resultado de ferramenta e devolve os nomes de pessoa que ele traz. */
export function nomesEmResultado(dados: unknown, achados: Conhecido[] = []): Conhecido[] {
  if (Array.isArray(dados)) dados.forEach((d) => nomesEmResultado(d, achados))
  else if (dados && typeof dados === 'object') {
    for (const [k, v] of Object.entries(dados)) {
      if (typeof v === 'string' && CHAVES_DE_NOME.test(k) && v.trim().length >= 3 && v !== '?') {
        achados.push({ valor: v, categoria: /paciente/i.test(k) ? 'PACIENTE' : 'PESSOA' })
      } else nomesEmResultado(v, achados)
    }
  }
  return achados
}

export type Residuo = { tipo: string; trecho: string }

/**
 * O que sobrou com cara de identificador depois da limpeza. Qualquer resíduo
 * bloqueia o envio: na dúvida, não sai.
 */
export function residuos(textoLimpo: string): Residuo[] {
  const achados: Residuo[] = []
  const semTokens = textoLimpo.replace(/\[[A-Z]+_\d+\]/g, ' ')
  for (const m of semTokens.matchAll(/(?<!\d)\d(?:[\d .-]{9,18})\d(?!\d)/g)) {
    const d = soDigitos(m[0])
    if (d.length === 11 || d.length === 15) achados.push({ tipo: `sequência de ${d.length} dígitos`, trecho: mascarar(m[0]) })
  }
  for (const m of semTokens.matchAll(RE_DATA)) achados.push({ tipo: 'data completa', trecho: mascarar(m[0]) })
  for (const m of semTokens.matchAll(RE_EMAIL)) achados.push({ tipo: 'e-mail', trecho: mascarar(m[0]) })
  return achados
}

/** Troca os pseudônimos pelos originais; pseudônimo que não está no cofre sai. */
export function reidentificar(texto: string, cofre: Cofre): string {
  return texto.replace(/\[(?:PESSOA|PACIENTE|CPF|CNS|TELEFONE|EMAIL|CEP|DATA|PRONTUARIO)_\d+\]/g, (p) => cofre.paraOriginal.get(p) ?? '')
}

function escaparRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Para log e erro: nunca o valor inteiro. */
function mascarar(s: string) {
  return s.length <= 4 ? '****' : `${s.slice(0, 2)}${'*'.repeat(Math.max(0, s.length - 4))}${s.slice(-2)}`
}
