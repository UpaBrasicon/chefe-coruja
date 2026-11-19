// Textos do cronômetro da parada (G3, RT em 18/11/2026). Causas reversíveis da
// AHA 2025 (Figura 2 das Parts 8 e 9), cada uma com "identificar" e "tratar"
// (pedido do RT; CR1–CR4 = A). Versão .3 (RT em 19/11/2026, CL1–CL4 = A): as
// lacunas foram buscadas no PubMed; cada linha diz a fonte e o nível (diretriz,
// consenso ou revisão); a ERC 2021 (tradução alemã aberta no PMC) vale enquanto a
// 2025 não estiver aberta. Trechos em docs/clinico/CRONOMETRO-PARADA-CAUSAS.md e
// CRONOMETRO-PARADA-LACUNAS.md. Onde ainda falta fonte, a tela diz.

import type { PublicoParada } from '../clinico/cronometroParada.ts'

export type CausaReversivel = { causa: string; identificar: string; tratar: string; fonte: string }

export const CAUSAS_REVERSIVEIS: Record<PublicoParada, { itens: CausaReversivel[]; fonte: string }> = {
  crianca: {
    fonte: 'Lista: AHA 2025, Part 8, Figura 2 (algoritmo da parada pediátrica).',
    itens: [
      { causa: 'Hipovolemia', identificar: 'Perda de sangue ou de líquido na história; POCUS sem atrasar as compressões.',
        tratar: 'Controlar o sangramento; cristaloide 10 a 20 mL/kg, reavaliando a cada bolus (dose do choque); no trauma, sangue cedo.',
        fonte: 'AHA 2025, Part 8; Coreia 2025, Part 8 e ERC 2021 pediátrica (diretrizes)' },
      { causa: 'Hipóxia', identificar: 'Causa respiratória ou asfixia antes da parada.', tratar: 'Ventilar com O₂ a 100%.',
        fonte: 'AHA 2025, Part 8; Coreia 2025, Part 8 (diretrizes)' },
      { causa: 'Íon hidrogênio (acidose)', identificar: 'Falência respiratória antes da parada; acidose grave já conhecida.',
        tratar: 'Ventilar, oxigenar e restaurar a perfusão; bicarbonato só na hipercalemia, na hipermagnesemia ou no tricíclico.',
        fonte: 'Coreia 2025, Part 8 (diretriz)' },
      { causa: 'Hipoglicemia', identificar: 'Glicemia capilar durante a reanimação.', tratar: 'Glicose 0,5 a 1 g/kg IV/IO.',
        fonte: 'Coreia 2025, Part 8, Tabela 2 (diretriz; dose do módulo ped-doses-fita)' },
      { causa: 'Hipo ou hipercalemia', identificar: 'Doença renal ou distúrbio de potássio na história; ECG com T apiculada e QRS largo.',
        tratar: 'Hipercalemia: cálcio, bicarbonato e glicose com insulina (benefício na parada não estabelecido). Hipocalemia (K < 2,5, peri-parada): KCl 1 mEq/kg IV (máx. 30 mEq) em 20 min ou mais, monitorado, e magnésio 30 a 50 mg/kg.',
        fonte: 'AHA 2025, Part 10; ERC 2021 pediátrica, peri-parada (diretrizes)' },
      { causa: 'Hipotermia', identificar: 'Temperatura central abaixo de 30 °C; pulso e respiração difíceis de achar.',
        tratar: 'RCP e reaquecimento ao mesmo tempo; adiar a adrenalina até 30 °C ou mais.', fonte: 'AHA 2025, Part 10 (diretriz)' },
      { causa: 'Pneumotórax hipertensivo', identificar: 'Murmúrio abolido de um lado, traqueia desviada, jugular túrgida, enfisema subcutâneo; POCUS confirma se não atrasar.',
        tratar: 'Agulha no 4º ou 5º EIC, linha axilar média (alternativa: 2º EIC, linha hemiclavicular); depois, dreno de tórax.',
        fonte: 'ERC 2021, circunstâncias especiais e pediátrica (diretriz; local da punção na criança por consenso); ESPNIC 2020' },
      { causa: 'Tamponamento cardíaco', identificar: 'Jugular túrgida, taquicardia e pulso paradoxal antes da parada; POCUS: derrame com colapso do VD.',
        tratar: 'Pericardiocentese subxifoide guiada por ultrassom; no pós-operatório cardíaco, reabrir o esterno cedo.',
        fonte: 'ERC 2021 pediátrica (consenso); Pérez-Casares 2017 (revisão); AHA 2025, Part 8' },
      { causa: 'Tóxicos', identificar: 'Exposição na história; QRS largo sugere tricíclico ou bloqueador de sódio.',
        tratar: 'Antídoto: naloxona no opioide; bicarbonato no tricíclico; anestésico local: emulsão lipídica 20%, 1,5 mL/kg em 1 min e 0,25 mL/kg/min (máx. 12 mL/kg).',
        fonte: 'AHA 2025, Part 10; ERC 2021 (diretrizes); Lee 2024 (revisão de casos pediátricos)' },
      { causa: 'Trombose pulmonar', identificar: 'AESP ou assistolia com fator de risco para trombose.',
        tratar: 'Na suspeita, considerar trombolítico: alteplase 0,5 mg/kg em 2 min (máx. 50 mg), repetir em 15 min, total máx. 1 mg/kg. Protocolo de revisão, sem diretriz.',
        fonte: 'AHA 2025, Part 10 (diretriz); Zia 2025, Blood (revisão: protocolo de um hospital)' },
      { causa: 'Trombose coronária', identificar: 'Kawasaki com aneurisma: suspeitar mesmo com ECG e troponina normais; a criança pequena pode só chorar ou ficar pálida.',
        tratar: 'Depois do RCE, com supra de ST, chamar a hemodinâmica.',
        fonte: 'Brogan 2020, consenso britânico de Kawasaki (Heart) — trata da síndrome coronária, não da parada' },
    ],
  },
  adulto: {
    fonte: 'Lista: AHA 2025, Part 9, Figura 2 (algoritmo da parada do adulto).',
    itens: [
      { causa: 'Hipovolemia', identificar: 'Perda de sangue ou de líquido na história; POCUS sem atrasar as compressões.',
        tratar: 'Cristaloide aquecido ou sangue conforme a causa; na parada traumática por hipovolemia, sangue. Sem hipovolemia, não fazer volume de rotina.',
        fonte: 'ERC 2021, circunstâncias especiais (diretriz); ILCOR CoSTR 2026' },
      { causa: 'Hipóxia', identificar: 'Asfixia, asma ou DPOC, afogamento; EtCO₂ inicial alto na AESP ou assistolia sugere asfixia.',
        tratar: 'O₂ a 100% durante a RCP.', fonte: 'Coreia 2025, Part 4; AHA 2025, Part 9 (diretrizes); Van den Bempt 2021 (revisão)' },
      { causa: 'Íon hidrogênio (acidose)', identificar: 'Acidose metabólica grave já conhecida; a gasometria na RCP tem valor incerto.',
        tratar: 'Sem bicarbonato de rotina; só na hipercalemia, no tricíclico ou na acidose grave conhecida.', fonte: 'AHA 2025, Part 9; Coreia 2025, Part 4 (diretrizes)' },
      { causa: 'Hipo ou hipercalemia', identificar: 'Doença renal ou distúrbio de potássio; ECG com T apiculada e QRS largo, ou onda U na hipocalemia.',
        tratar: 'Hipercalemia: glicose com insulina, cálcio e bicarbonato (doses na PCR do adulto). Hipocalemia: KCl 2 mEq/min por 10 min.',
        fonte: 'Coreia 2025, Part 5 (diretriz); manual do HCFMUSP, p. 50' },
      { causa: 'Hipotermia', identificar: 'Temperatura central abaixo de 30 °C; pulso e respiração difíceis de achar.',
        tratar: 'RCP e reaquecimento ao mesmo tempo; adiar a adrenalina até 30 °C ou mais.', fonte: 'AHA 2025, Part 10 (diretriz)' },
      { causa: 'Pneumotórax hipertensivo', identificar: 'Murmúrio abolido de um lado, traqueia desviada, jugular túrgida; POCUS sem deslizamento pleural.',
        tratar: 'Agulha longa no 4º ou 5º EIC, linha axilar anterior; depois, toracostomia ou dreno de tórax.',
        fonte: 'ERC 2021, circunstâncias especiais; Coreia 2025, Part 5 (diretrizes); Anto 2026 (revisão de POCUS)' },
      { causa: 'Tamponamento cardíaco', identificar: 'Trauma, pós-operatório cardíaco ou angioplastia; jugular túrgida e pulso paradoxal antes da parada; POCUS: derrame com colapso do VD.',
        tratar: 'Pericardiocentese guiada por ultrassom (às cegas se não houver); toracotomia de emergência no trauma.',
        fonte: 'Coreia 2025, Parts 4 e 5 (diretrizes); Anto 2026 (revisão de POCUS)' },
      { causa: 'Tóxicos', identificar: 'Exposição na história; QRS largo sugere tricíclico ou bloqueador de sódio.',
        tratar: 'Antídoto: naloxona no opioide (sem interromper a RCP), emulsão lipídica no anestésico local, bicarbonato no tricíclico.',
        fonte: 'AHA 2025, Part 10; Coreia 2025, Part 5 (diretrizes)' },
      { causa: 'Trombose pulmonar', identificar: 'AESP ou assistolia com TVP ou fator de risco; EtCO₂ abaixo de 13 mmHg com boas compressões sugere (sinal inespecífico); VD dilatado no POCUS sugere, não confirma.',
        tratar: 'Trombolítico na suspeita (alteplase na PCR do adulto); embolectomia ou ECLS no confirmado.',
        fonte: 'AHA 2025, Part 10; Coreia 2025, Part 5; ERC 2021, circunstâncias especiais (diretrizes)' },
      { causa: 'Trombose coronária', identificar: 'Dor torácica antes da parada, FV; supra de ST depois do RCE.',
        tratar: 'Cateterismo de emergência depois do RCE se houver supra de ST ou choque cardiogênico.', fonte: 'Coreia 2025, Part 6 (diretriz)' },
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
