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

/** Linha da tela Servidores: medida em dólar e nota com perguntas e tokens. */
export function linhaCustoIa(c: CustoIaMes): { medida: string; nota: string } {
  const usd = Number(c.usd_estimado)
  const medida = `US$ ${usd < 0.01 && usd > 0 ? '< 0,01' : usd.toFixed(2).replace('.', ',')}`
  const tokens = Number(c.tokens_entrada_cache) + Number(c.tokens_entrada) + Number(c.tokens_saida)
  const partes = [
    `${c.perguntas} ${c.perguntas === 1 ? 'pergunta' : 'perguntas'} ao modelo neste mês`,
    `${mil(tokens)} tokens`,
    c.perguntas_sem_tokens ? `${c.perguntas_sem_tokens} sem contagem (bloqueadas ou de antes da medição)` : null,
    'estimado pelo preço oficial da DeepSeek, com o desconto fora do pico',
  ]
  return { medida, nota: partes.filter(Boolean).join(' · ') }
}
