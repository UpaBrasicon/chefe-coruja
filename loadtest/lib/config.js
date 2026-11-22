// Configuração comum da suíte. O k6 recebe só a URL e a chave anon por env
// (-e SUPABASE_URL=... -e SUPABASE_ANON_KEY=...). NUNCA passar service_role (R2).
import { sleep } from 'k6'

export const URL = __ENV.SUPABASE_URL
export const ANON = __ENV.SUPABASE_ANON_KEY
export const ALVO = Number(__ENV.ALVO || 150)
// Escrita desligada por padrão: smoke roda só leitura (0 erro) até os payloads
// de escrita estarem 100% conferidos. Ligar com -e ESCRITA=1.
export const ESCRITA = __ENV.ESCRITA === '1'

if (!URL || !ANON) {
  throw new Error('Defina SUPABASE_URL e SUPABASE_ANON_KEY (-e ... ou no ambiente).')
}

// Thresholds = critérios de aprovação (seção 8 do prompt).
export const thresholds = {
  http_req_failed: [
    { threshold: 'rate<0.01', abortOnFail: false },
    { threshold: 'rate<0.05', abortOnFail: true, delayAbortEval: '1m' },
  ],
  'http_req_duration{tipo:leitura}': ['p(95)<800', 'p(99)<2000'],
  'http_req_duration{tipo:escrita}': ['p(95)<1500'],
  checks: ['rate>0.99'],
}

// Pausa realista entre ações de uma "visita" (5–25 s).
export function pausa(min = 5, max = 25) {
  sleep(min + Math.random() * (max - min))
}
