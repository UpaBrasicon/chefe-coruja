// 6. Ruptura (breakpoint) 🛑 — taxa de iterações crescendo até falhar.
// PEDIR OK AO RICARDO. Aborta sozinho pelo threshold de erro (rate<0.05, 1 min).
// Responde: número máximo antes de quebrar.
import { ALVO } from '../lib/config.js'
import { rodarPorPapel } from '../cenarios/mix.js'

export const options = {
  scenarios: {
    ruptura: {
      executor: 'ramping-arrival-rate',
      startRate: Math.round(ALVO / 4),
      timeUnit: '1s',
      preAllocatedVUs: ALVO,
      maxVUs: ALVO * 6,
      stages: [
        { duration: '3m', target: ALVO },
        { duration: '5m', target: ALVO * 2 },
        { duration: '5m', target: ALVO * 4 },
        { duration: '5m', target: ALVO * 8 },
      ],
    },
  },
  // abortOnFail para parar no ponto de ruptura
  thresholds: {
    http_req_failed: [{ threshold: 'rate<0.05', abortOnFail: true, delayAbortEval: '30s' }],
  },
}

export default rodarPorPapel
