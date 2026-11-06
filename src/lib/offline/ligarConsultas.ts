// Recarga sem conexão, parte 3: liga as consultas guardadas ao react-query.
// Grava (cifrado, na aba) a cada resposta nova do servidor nas consultas da
// enfermagem; restaura só quando a casca cai no modo sem rede (AuthContext).
import { dehydrate, hydrate, type QueryClient } from '@tanstack/react-query'

import { consultaPermitida, guardarConsultas, lerConsultas } from './consultasGuardadas'

let restauradasEm: number | null = null

/** Hora em que os dados mostrados agora foram lidos, se vieram da recarga sem rede. */
export const dadosRestauradosEm = () => restauradasEm

export function ligarConsultasSemConexao(qc: QueryClient) {
  let espera: ReturnType<typeof setTimeout> | undefined
  return qc.getQueryCache().subscribe((ev) => {
    if (ev.type !== 'updated' || ev.action.type !== 'success' || !consultaPermitida(ev.query.queryKey)) return
    clearTimeout(espera)
    espera = setTimeout(() => {
      guardarConsultas(dehydrate(qc, {
        shouldDehydrateQuery: (q) => q.state.status === 'success' && consultaPermitida(q.queryKey),
      }))
    }, 2000)
  })
}

/** Põe de volta o que as telas da enfermagem leram por último nesta aba. */
export function restaurarConsultas(qc: QueryClient) {
  const r = lerConsultas()
  if (!r) return
  hydrate(qc, r.estado as Parameters<typeof hydrate>[1])
  restauradasEm = r.guardadoEm
}
