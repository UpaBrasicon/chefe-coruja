// 1. Smoke — 2 VUs, 2 min, todos os cenários. Obrigatório antes de qualquer
// outro: tem que passar com 0 erro. Roda só leitura (ESCRITA desligada).
import { thresholds } from '../lib/config.js'
import { rodarPorPapel } from '../cenarios/mix.js'

export const options = {
  scenarios: { smoke: { executor: 'constant-vus', vus: 2, duration: '2m' } },
  thresholds,
}

export default rodarPorPapel
