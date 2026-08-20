// ─────────────────────────────────────────────────────────────────────────────
// Parser CSV mínimo (sem dependências) — suporta:
//   * separador `;` ou `,` (auto-detectado)
//   * aspas duplas com escape `""`
//   * quebras de linha CRLF e LF
//   * BOM UTF-8
//   * cabeçalho na primeira linha
//   * encoding: UTF-8 (BOM ou válido) ou Windows-1252 (DATASUS)
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs'

export type LinhaCsv = Record<string, string>

/**
 * Lê um arquivo e decodifica com detecção de encoding:
 *   1. BOM UTF-8 → UTF-8
 *   2. UTF-8 válido (sem U+FFFD) → UTF-8
 *   3. senão → Windows-1252 (padrão dos CSVs do DATASUS)
 */
export function lerArquivoCsv(caminho: string): string {
  const buf = readFileSync(caminho)
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return buf.toString('utf8').replace(/^\uFEFF/, '')
  }
  const utf8 = buf.toString('utf8')
  if (!utf8.includes('\uFFFD')) return utf8
  return new TextDecoder('windows-1252').decode(buf)
}

/** Normaliza o nome de uma coluna: minúsculas, sem acento, sem espaços/símbolos. */
export function normalizarCabecalho(nome: string): string {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

/** Detecta o separador predominante em uma linha de amostra. */
function detectarSeparador(amostra: string): string {
  // ignora separadores dentro de aspas
  let dentro = false
  const contagem: Record<string, number> = { ';': 0, ',': 0, '\t': 0 }
  for (const ch of amostra) {
    if (ch === '"') dentro = !dentro
    else if (!dentro && ch in contagem) contagem[ch]++
  }
  if (contagem[';'] >= contagem[','] && contagem[';'] > 0) return ';'
  if (contagem[','] > 0) return ','
  if (contagem['\t'] > 0) return '\t'
  return ';'
}

/** Divide uma linha em campos, respeitando aspas. */
function dividirCampos(linha: string, sep: string): string[] {
  const campos: string[] = []
  let atual = ''
  let dentro = false
  for (let i = 0; i < linha.length; i++) {
    const ch = linha[i]
    if (ch === '"') {
      if (dentro && linha[i + 1] === '"') {
        atual += '"'
        i++
      } else {
        dentro = !dentro
      }
    } else if (ch === sep && !dentro) {
      campos.push(atual)
      atual = ''
    } else {
      atual += ch
    }
  }
  campos.push(atual)
  return campos.map((c) => c.trim())
}

/**
 * Lê um CSV e devolve linhas como objetos { colunaNormalizada: valor }.
 * Lança erro se o arquivo estiver vazio ou sem cabeçalho.
 */
export function lerCsv(conteudo: string): LinhaCsv[] {
  const semBom = conteudo.replace(/^\uFEFF/, '')
  const linhasBrutas = semBom.split(/\r?\n/)
  // descarta linhas totalmente vazias
  const linhas = linhasBrutas.filter((l) => l.trim() !== '')
  if (linhas.length === 0) throw new Error('CSV vazio')

  const sep = detectarSeparador(linhas[0])
  const cabecalho = dividirCampos(linhas[0], sep).map(normalizarCabecalho)
  if (cabecalho.length === 0) throw new Error('CSV sem cabeçalho')

  const resultado: LinhaCsv[] = []
  for (let i = 1; i < linhas.length; i++) {
    const campos = dividirCampos(linhas[i], sep)
    const obj: LinhaCsv = {}
    for (let j = 0; j < cabecalho.length; j++) {
      obj[cabecalho[j]] = campos[j] ?? ''
    }
    resultado.push(obj)
  }
  return resultado
}

/** Busca o valor de uma coluna por aliases (nomes já normalizados). */
export function coluna(linha: LinhaCsv, aliases: string[]): string {
  for (const alias of aliases) {
    const v = linha[normalizarCabecalho(alias)]
    if (v !== undefined && v !== '') return v
  }
  return ''
}
