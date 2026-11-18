// Textos do cronômetro da parada (G3, RT em 18/11/2026). As causas reversíveis
// seguem a fonte conferida (ver docs/clinico/CRONOMETRO-PARADA.md); as rotas
// abrem as ferramentas completas que já existem.

import type { PublicoParada } from '../clinico/cronometroParada.ts'

export const CAUSAS_REVERSIVEIS: Record<PublicoParada, { itens: string[]; fonte: string }> = {
  // AHA 2025, Part 8, Figura 2 (11 itens; a hipoglicemia está só na criança)
  crianca: {
    itens: ['Hipovolemia', 'Hipóxia', 'Íon hidrogênio (acidose)', 'Hipoglicemia', 'Hipo ou hipercalemia', 'Hipotermia',
      'Pneumotórax hipertensivo', 'Tamponamento cardíaco', 'Tóxicos', 'Trombose pulmonar', 'Trombose coronária'],
    fonte: 'AHA 2025, Part 8, Figura 2 (algoritmo da parada pediátrica).',
  },
  // AHA 2025, Part 9, Figura 2 (10 itens)
  adulto: {
    itens: ['Hipovolemia', 'Hipóxia', 'Íon hidrogênio (acidose)', 'Hipo ou hipercalemia', 'Hipotermia',
      'Pneumotórax hipertensivo', 'Tamponamento cardíaco', 'Tóxicos', 'Trombose pulmonar', 'Trombose coronária'],
    fonte: 'AHA 2025, Part 9, Figura 2 (algoritmo da parada do adulto).',
  },
}

export const FERRAMENTAS_DO_CRONOMETRO: Record<PublicoParada, { nome: string; rota: string }[]> = {
  crianca: [
    { nome: 'Doses, dispositivos e RCP da criança', rota: '/plantonista?guia=parada-crianca' },
    { nome: 'Reanimação neonatal', rota: '/plantonista/pediatria/reanimacao-neonatal' },
  ],
  adulto: [
    { nome: 'PCR do adulto completa', rota: '/plantonista/emergencias/pcr-adulto' },
    { nome: 'Cuidados pós-PCR do adulto', rota: '/plantonista/emergencias/pos-pcr-adulto' },
  ],
}
