// Espera na porta por cor (cartão de turno da Central; P/index.html hubEspera):
// quantos triados aguardam o médico em cada cor e a maior espera, contada da
// classificação, comparada ao tempo-alvo da cor (./risco.ts, Manchester). A
// hora entra por parâmetro e vem do servidor (ADR 0003).

import { ALVO_MIN, CORES_RISCO, type CorRisco } from './risco.ts'

export type EsperaCor = { cor: CorRisco; aguardando: number; maiorMin: number | null; acimaDoAlvo: boolean }

export function esperaPorCor(
  fila: readonly { cor_atual: CorRisco | null; classificado_em: string | null }[],
  agoraServidor: Date,
): EsperaCor[] {
  return CORES_RISCO.map((cor) => {
    const minutos = fila
      .filter((e) => e.cor_atual === cor && e.classificado_em)
      .map((e) => Math.max(0, Math.floor((agoraServidor.getTime() - Date.parse(e.classificado_em!)) / 60_000)))
      .filter((m) => Number.isFinite(m))
    const maiorMin = minutos.length ? Math.max(...minutos) : null
    return { cor, aguardando: minutos.length, maiorMin, acimaDoAlvo: maiorMin !== null && maiorMin > ALVO_MIN[cor] }
  })
}
