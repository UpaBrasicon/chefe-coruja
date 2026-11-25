// Trilha Hermes / Evidências, E6 (decisão do RT de 12/11/2026): custo do mês da
// busca clínica ("Pergunte à IA"), pela RPC ia_custo_busca_mes (só super admin).

export type CustoIaMes = {
  mes: string
  perguntas: number
  perguntas_sem_tokens: number
  tokens_entrada_cache: number
  tokens_entrada: number
  tokens_saida: number
  usd_estimado: number
  modelos: string[]
}

const mil = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace('.', ',')} milhão` : n >= 1000 ? `${Math.round(n / 1000)} mil` : String(n))

/** "US$ 0,03"; abaixo de um centavo, "US$ < 0,01". */
export function emDolar(usd: number): string {
  return `US$ ${usd < 0.01 && usd > 0 ? '< 0,01' : usd.toFixed(2).replace('.', ',')}`
}

/** Linha da tela Servidores: medida em dólar e nota com perguntas e tokens. */
export function linhaCustoIa(c: CustoIaMes): { medida: string; nota: string } {
  const usd = Number(c.usd_estimado)
  const medida = emDolar(usd)
  const tokens = Number(c.tokens_entrada_cache) + Number(c.tokens_entrada) + Number(c.tokens_saida)
  const partes = [
    `${c.perguntas} ${c.perguntas === 1 ? 'pergunta' : 'perguntas'} ao modelo neste mês`,
    `${mil(tokens)} tokens`,
    c.perguntas_sem_tokens ? `${c.perguntas_sem_tokens} sem contagem (bloqueadas ou de antes da medição)` : null,
    'estimado pelo preço oficial da DeepSeek, com o desconto fora do pico',
  ]
  return { medida, nota: partes.filter(Boolean).join(' · ') }
}

// Ajustes da revisão, item 5 (RT, 24/11/2026): teto mensal da IA, em dólar,
// definido pelo administrador geral (RPCs ia_teto_mensal e
// definir_ia_teto_mensal, migration 20270421000074). Sem valor padrão.
export type TetoIa = { usd: number; definido_em: string; definido_por: string | null }

/**
 * Linha do teto na tela Servidores: o consumo do mês contra o teto, quando há
 * custo medido; sem custo medido, só o teto. O selo diz se passou do teto.
 */
export function linhaTetoIa(custo: CustoIaMes | null, teto: TetoIa): { medida: string; nota: string; selo: 'dentro' | 'acima' | 'sem_medida' } {
  const limite = Number(teto.usd)
  const quem = teto.definido_por ? `definido por ${teto.definido_por}` : 'definido pelo administrador geral'
  if (!custo) {
    return { medida: emDolar(limite), nota: `${quem} · sem dado de consumo medido neste mês para comparar`, selo: 'sem_medida' }
  }
  const gasto = Number(custo.usd_estimado)
  const pct = limite > 0 ? Math.round((gasto / limite) * 100) : 0
  return {
    medida: `${emDolar(gasto)} de ${emDolar(limite)}`,
    nota: `${pct}% do teto neste mês · ${quem} · o consumo medido é só o da busca clínica; nada bloqueia a IA ao passar do teto`,
    selo: gasto >= limite ? 'acima' : 'dentro',
  }
}

/** Lê o valor digitado ("50", "50,5", "1.200,00" não): número positivo com até 2 casas, ou null. */
export function lerTeto(texto: string): number | null {
  const t = texto.trim().replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null
  const n = Number(t)
  return n > 0 && n <= 1_000_000 ? n : null
}
