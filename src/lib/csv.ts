// Exportação CSV para o Excel em português (Fase 0, item 18).
//
// - UTF-8 com BOM: sem ele o Excel abre "OcupaÃ§Ã£o".
// - Separador ";" e decimal com vírgula: é o que o Excel pt-BR espera.
// - Fim de linha CRLF; campo entre aspas quando tem ";", aspas ou quebra.
// - Campo que começa com = + - @ (ou tab/CR) ganha um apóstrofo na frente:
//   sem isso um texto digitado vira fórmula ao abrir (CSV injection, OWASP).
// - Cabeçalho com o contexto (unidade, filtros aplicados, quando foi gerado)
//   antes da tabela, separado por uma linha em branco.

export type ValorCsv = string | number | boolean | null | undefined

export type OpcoesCsv = {
  /** linhas "Rótulo;Valor" antes da tabela: unidade, período, filtros */
  contexto?: [string, ValorCsv][]
}

const BOM = '﻿'
const FORMULA = /^[=+\-@\t\r]/

function texto(v: ValorCsv): string {
  if (v == null) return ''
  if (typeof v === 'number') return Number.isFinite(v) ? v.toLocaleString('pt-BR', { useGrouping: false, maximumFractionDigits: 6 }) : ''
  if (typeof v === 'boolean') return v ? 'sim' : 'não'
  return v
}

export function campoCsv(v: ValorCsv): string {
  let t = texto(v)
  // número negativo é número, não fórmula
  if (typeof v !== 'number' && FORMULA.test(t)) t = `'${t}`
  return /[;"\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
}

export function gerarCsv(cabecalho: string[], linhas: ValorCsv[][], opcoes: OpcoesCsv = {}): string {
  const saida: string[] = []
  for (const [rotulo, valor] of opcoes.contexto ?? []) saida.push([campoCsv(rotulo), campoCsv(valor)].join(';'))
  if (saida.length) saida.push('')
  saida.push(cabecalho.map(campoCsv).join(';'))
  for (const l of linhas) saida.push(l.map(campoCsv).join(';'))
  return BOM + saida.join('\r\n') + '\r\n'
}

/** nome de arquivo seguro: sem acento, espaço vira "_" */
export function nomeArquivoCsv(base: string, data: string): string {
  const limpo = base.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  return `${limpo}_${data}.csv`
}

export function baixarCsv(nomeArquivo: string, conteudo: string): void {
  const url = URL.createObjectURL(new Blob([conteudo], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo
  a.click()
  URL.revokeObjectURL(url)
}
