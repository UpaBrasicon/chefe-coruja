// Textos do cronômetro da parada (G3, RT em 18/11/2026). Causas reversíveis da
// AHA 2025 (Figura 2 das Parts 8 e 9), cada uma com "identificar" e "tratar"
// (pedido do RT; decisões CR1–CR4 = A): só o que tem fonte aberta, com o trecho
// em docs/clinico/CRONOMETRO-PARADA-CAUSAS.md; onde falta fonte, a tela diz;
// doses só as já aprovadas no app. As rotas abrem as ferramentas completas.

import type { PublicoParada } from '../clinico/cronometroParada.ts'

export type CausaReversivel = { causa: string; identificar: string; tratar: string; fonte: string }

const SEM_FONTE = 'Sem fonte aberta.'

export const CAUSAS_REVERSIVEIS: Record<PublicoParada, { itens: CausaReversivel[]; fonte: string }> = {
  crianca: {
    fonte: 'Lista: AHA 2025, Part 8, Figura 2 (algoritmo da parada pediátrica).',
    itens: [
      { causa: 'Hipovolemia', identificar: 'Perda de sangue ou de líquido na história; POCUS sem atrasar as compressões.', tratar: 'Controlar o sangramento e repor volume.', fonte: 'AHA 2025, Part 8 (trauma)' },
      { causa: 'Hipóxia', identificar: 'Causa respiratória ou asfixia antes da parada.', tratar: 'Ventilar com O₂ a 100%.', fonte: 'AHA 2025, Part 8; Coreia 2025, Part 8' },
      { causa: 'Íon hidrogênio (acidose)', identificar: 'Falência respiratória antes da parada; acidose grave já conhecida.', tratar: 'Ventilar, oxigenar e restaurar a perfusão; bicarbonato só na hipercalemia, na hipermagnesemia ou no tricíclico.', fonte: 'Coreia 2025, Part 8' },
      { causa: 'Hipoglicemia', identificar: 'Glicemia capilar durante a reanimação.', tratar: 'Glicose 0,5 a 1 g/kg IV/IO.', fonte: 'Coreia 2025, Part 8, Tabela 2 (dose do módulo ped-doses-fita)' },
      { causa: 'Hipo ou hipercalemia', identificar: 'Doença renal ou distúrbio de potássio na história; ECG com T apiculada e QRS largo.', tratar: `Hipercalemia: cálcio, bicarbonato e glicose com insulina (benefício na parada não estabelecido). Hipocalemia: ${SEM_FONTE.toLowerCase()}`, fonte: 'AHA 2025, Part 10' },
      { causa: 'Hipotermia', identificar: 'Temperatura central abaixo de 30 °C; pulso e respiração difíceis de achar.', tratar: 'RCP e reaquecimento ao mesmo tempo; adiar a adrenalina até 30 °C ou mais.', fonte: 'AHA 2025, Part 10' },
      { causa: 'Pneumotórax hipertensivo', identificar: 'Trauma de tórax; dificuldade súbita de ventilar.', tratar: 'Descomprimir junto com a RCP.', fonte: 'AHA 2025, Parts 8 e 10' },
      { causa: 'Tamponamento cardíaco', identificar: 'Trauma ou pós-operatório cardíaco; ecocardiograma à beira do leito.', tratar: 'Tratar o tamponamento; no pós-operatório cardíaco, reabrir o esterno cedo.', fonte: 'AHA 2025, Parts 8 e 10' },
      { causa: 'Tóxicos', identificar: 'Exposição na história; QRS largo sugere tricíclico ou bloqueador de sódio.', tratar: 'Antídoto: naloxona no opioide, emulsão lipídica no anestésico local, bicarbonato no tricíclico.', fonte: 'AHA 2025, Part 10' },
      { causa: 'Trombose pulmonar', identificar: 'AESP ou assistolia com fator de risco para trombose.', tratar: 'Na suspeita, considerar trombolítico (o app não tem dose pediátrica).', fonte: 'AHA 2025, Part 10' },
      { causa: 'Trombose coronária', identificar: SEM_FONTE, tratar: SEM_FONTE, fonte: 'nenhuma fonte aberta para a criança' },
    ],
  },
  adulto: {
    fonte: 'Lista: AHA 2025, Part 9, Figura 2 (algoritmo da parada do adulto).',
    itens: [
      { causa: 'Hipovolemia', identificar: 'Perda de sangue ou de líquido na história; POCUS sem atrasar as compressões.', tratar: 'Volume só se havia hipovolemia antes da parada; não fazer volume de rotina.', fonte: 'ILCOR CoSTR 2026 (já na ferramenta PCR do adulto)' },
      { causa: 'Hipóxia', identificar: 'Asfixia, asma ou DPOC, afogamento.', tratar: 'O₂ a 100% durante a RCP.', fonte: 'Coreia 2025, Part 4; AHA 2025, Part 9' },
      { causa: 'Íon hidrogênio (acidose)', identificar: 'Acidose metabólica grave já conhecida; a gasometria na RCP tem valor incerto.', tratar: 'Sem bicarbonato de rotina; só na hipercalemia, no tricíclico ou na acidose grave conhecida.', fonte: 'AHA 2025, Part 9; Coreia 2025, Part 4' },
      { causa: 'Hipo ou hipercalemia', identificar: 'Doença renal ou distúrbio de potássio; ECG com T apiculada e QRS largo, ou onda U na hipocalemia.', tratar: 'Hipercalemia: glicose com insulina, cálcio e bicarbonato (doses na PCR do adulto). Hipocalemia: KCl 2 mEq/min por 10 min.', fonte: 'Coreia 2025, Part 5; manual do HCFMUSP, p. 50' },
      { causa: 'Hipotermia', identificar: 'Temperatura central abaixo de 30 °C; pulso e respiração difíceis de achar.', tratar: 'RCP e reaquecimento ao mesmo tempo; adiar a adrenalina até 30 °C ou mais.', fonte: 'AHA 2025, Part 10' },
      { causa: 'Pneumotórax hipertensivo', identificar: 'Dificuldade súbita de ventilar; pressão de pico alta.', tratar: 'Agulha e depois dreno de tórax.', fonte: 'Coreia 2025, Part 5' },
      { causa: 'Tamponamento cardíaco', identificar: 'Trauma, pós-operatório cardíaco ou angioplastia; POCUS.', tratar: 'Pericardiocentese guiada por ultrassom (às cegas se não houver); toracotomia de emergência no trauma.', fonte: 'Coreia 2025, Parts 4 e 5' },
      { causa: 'Tóxicos', identificar: 'Exposição na história; QRS largo sugere tricíclico ou bloqueador de sódio.', tratar: 'Antídoto: naloxona no opioide (sem interromper a RCP), emulsão lipídica no anestésico local, bicarbonato no tricíclico.', fonte: 'AHA 2025, Part 10; Coreia 2025, Part 5' },
      { causa: 'Trombose pulmonar', identificar: 'AESP ou assistolia com TVP ou fator de risco; VD dilatado no POCUS sugere, não confirma.', tratar: 'Trombolítico na suspeita (alteplase na PCR do adulto); embolectomia ou ECLS no confirmado.', fonte: 'AHA 2025, Part 10; Coreia 2025, Part 5' },
      { causa: 'Trombose coronária', identificar: 'Dor torácica antes da parada, FV; supra de ST depois do RCE.', tratar: 'Cateterismo de emergência depois do RCE se houver supra de ST ou choque cardiogênico.', fonte: 'Coreia 2025, Part 6' },
    ],
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
