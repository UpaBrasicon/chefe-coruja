// 2. Carga média — 0 → ALVO em 5 min, mantém 15 min, desce em 2 min.
// Responde: aguenta o uso esperado dentro dos limites?
import { thresholds, ALVO } from '../lib/config.js'
import { rodarPorPapel } from '../cenarios/mix.js'

export const options = {
  scenarios: {
    carga: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '5m', target: ALVO },
        { duration: '15m', target: ALVO },
        { duration: '2m', target: 0 },
      ],
    },
  },
  thresholds,
}

export default rodarPorPapel
