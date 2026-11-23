// 3. Stress 🛑 — ALVO → 1,5× → 2× → 3× (5 min por degrau). PEDIR OK AO RICARDO.
// Responde: em que degrau começa a degradar?
import { thresholds, ALVO } from '../lib/config.js'
import { rodarPorPapel } from '../cenarios/mix.js'

export const options = {
  scenarios: {
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '3m', target: ALVO },
        { duration: '5m', target: Math.round(ALVO * 1.5) },
        { duration: '5m', target: ALVO * 2 },
        { duration: '5m', target: ALVO * 3 },
        { duration: '2m', target: 0 },
      ],
    },
  },
  thresholds,
}

export default rodarPorPapel
