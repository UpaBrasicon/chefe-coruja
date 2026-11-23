// 5. Resistência (soak) — 0,6×ALVO por 45 min. Responde: degrada com o tempo?
// Conexões acumulam? Os jobs do pg_cron interferem? (Não passar de 50 min: JWT.)
import { thresholds, ALVO } from '../lib/config.js'
import { rodarPorPapel } from '../cenarios/mix.js'

export const options = {
  scenarios: {
    soak: {
      executor: 'constant-vus',
      vus: Math.round(ALVO * 0.6),
      duration: '45m',
    },
  },
  thresholds,
}

export default rodarPorPapel
