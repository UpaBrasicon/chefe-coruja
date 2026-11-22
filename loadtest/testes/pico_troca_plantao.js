// 4. Pico — troca de plantão 🛑 — ALVO/3 → 2×ALVO em 30 s, mantém 5 min, volta.
// PEDIR OK AO RICARDO. Precisa de ESCRITA=1 e lat/lng da massa (check-in).
import { thresholds, ALVO } from '../lib/config.js'
import { pico } from '../cenarios/pico.js'

export const options = {
  scenarios: {
    pico: {
      executor: 'ramping-vus',
      startVUs: Math.round(ALVO / 3),
      stages: [
        { duration: '30s', target: ALVO * 2 },
        { duration: '5m', target: ALVO * 2 },
        { duration: '1m', target: Math.round(ALVO / 3) },
      ],
    },
  },
  thresholds,
}

export default pico
