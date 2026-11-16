// Texto do botão "Copiar" das ferramentas da Central (diagnóstico das
// calculadoras, C4 = A, RT em 16/11/2026): pronto para colar na evolução.
// Leva a ferramenta, os dados usados com unidade, o resultado, a fonte, a
// versão da regra e a hora. Nunca o nome do paciente (a Central não tem).

export type CopiaCalculo = {
  ferramenta: string
  /** [rótulo, valor com unidade]; os vazios ficam de fora */
  dados: [string, string][]
  /** uma linha por resultado (no escore, a frase do resultado e os derivados) */
  resultado: string[]
  fonte?: string
  versao?: string
  quando: Date
}

const dois = (n: number) => String(n).padStart(2, '0')

/** dd/mm/aaaa hh:mm na hora local do aparelho */
export function dataHoraBr(d: Date): string {
  return `${dois(d.getDate())}/${dois(d.getMonth() + 1)}/${d.getFullYear()} ${dois(d.getHours())}:${dois(d.getMinutes())}`
}

export function textoCopia(c: CopiaCalculo): string {
  const dados = c.dados.filter(([, v]) => v.trim() !== '')
  const linhas = [c.ferramenta]
  if (dados.length) linhas.push(`Dados: ${dados.map(([k, v]) => `${k}: ${v}`).join('; ')}`)
  linhas.push(...(c.resultado.length ? c.resultado : ['(sem resultado)']))
  if (c.fonte) linhas.push(`Fonte: ${c.fonte}`)
  linhas.push(`${c.versao ? `Regra versão ${c.versao} · ` : ''}calculado em ${dataHoraBr(c.quando)}`)
  linhas.push('Apoio à decisão clínica; conferido pelo médico.')
  return linhas.join('\n')
}

/** número com vírgula e sem zeros à toa (7.50 → "7,5") */
export function numeroBr(n: number): string {
  return String(Math.round(n * 100) / 100).replace('.', ',')
}

/**
 * Texto digitado num campo numérico → número. Aceita vírgula ou ponto.
 * Vazio → 0 (as ferramentas tratam 0 como "não informado"); lixo → null.
 */
export function lerNumeroDigitado(texto: string): number | null {
  const t = texto.trim().replace(',', '.')
  if (t === '') return 0
  if (!/^\d*\.?\d*$/.test(t) || t === '.') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}
