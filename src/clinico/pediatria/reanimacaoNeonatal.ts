import type { Ficha, Fonte } from '../ficha.ts'

// Reanimação do RN ≥ 34 semanas em sala de parto (lacunas da Central, lote 2,
// 25/10/2026; inclusão do neonato decidida pelo RT em 23/10/2026). Fonte: Diretrizes
// 2026 do Programa de Reanimação Neonatal da SBP (12/06/2026), lidas no PDF oficial
// (página = página impressa). A AHA/AAP 2025 (Circulation, Parte 5) não foi lida: o
// site da revista pediu verificação anti-robô. A conduta é da equipe (ADR 0007).

export const SBP_REANIMACAO_2026: Fonte = {
  citacao: 'Almeida MFB, Guinsburg R; Coordenadores Estaduais do PRN-SBP; Grupo Executivo do PRN-SBP; Departamento de Neonatologia da SBP. Reanimação do recém-nascido ≥34 semanas em sala de parto: diretrizes 2026 da Sociedade Brasileira de Pediatria. Rio de Janeiro: SBP; 2026. Normotermia (p. 12), clampeamento (p. 13), SpO2 alvo (Quadro 2, p. 15), VPP com ar ambiente (p. 16–17), cânula (Quadro 4, p. 23), massagem 3:1 e O2 100% (p. 27–29), adrenalina (p. 30–32, Quadro 8) e expansor (p. 33).',
  url: 'https://doi.org/10.25060/PRN-SBP-2026-1',
  pediatrica: true,
}

export const fichaReanimacaoNeonatal: Ficha = {
  id: 'ped-reanimacao-neonatal',
  titulo: 'Reanimação do RN ≥ 34 semanas em sala de parto (SBP 2026)',
  versao: '2026-10-25.1',
  publico: 'pediatrico',
  fontes: [SBP_REANIMACAO_2026],
  revisadoEm: '25/10/2026 (lacunas da Central, lote 2; doses e quadros conferidos no PDF da SBP, com página)',
}

/** Adrenalina diluída: 1 mL da ampola de 1 mg/mL em 9 mL de SF = 0,1 mg/mL (p. 32). */
export const ADRENALINA = {
  concentracaoMgMl: 0.1,
  intravascularMlKg: 0.2,
  traquealMlKg: 1.0,
  intervaloMin: '3-5',
  flushMl: 3,
}

/** SF 10 mL/kg lentamente, em 5–10 minutos (p. 33). */
export const EXPANSOR_ML_KG = 10

export type DosesRn = {
  adrenalinaIvMl: number
  adrenalinaIvMg: number
  adrenalinaTraquealMl: number
  adrenalinaTraquealMg: number
  expansorMl: number
}

export function dosesReanimacao(pesoKg: number): DosesRn | null {
  if (!Number.isFinite(pesoKg) || pesoKg <= 0 || pesoKg > 6) return null
  const a = ADRENALINA
  return {
    adrenalinaIvMl: a.intravascularMlKg * pesoKg,
    adrenalinaIvMg: a.intravascularMlKg * pesoKg * a.concentracaoMgMl,
    adrenalinaTraquealMl: a.traquealMlKg * pesoKg,
    adrenalinaTraquealMg: a.traquealMlKg * pesoKg * a.concentracaoMgMl,
    expansorMl: EXPANSOR_ML_KG * pesoKg,
  }
}

/** Quadro 2 (p. 15): SpO2 alvo pré-ductal por minuto de vida. */
export const SPO2_ALVO: { minuto: number; faixa: string }[] = [
  { minuto: 2, faixa: '65-70%' },
  { minuto: 3, faixa: '70-75%' },
  { minuto: 4, faixa: '75-80%' },
  { minuto: 5, faixa: '80-85%' },
  { minuto: 10, faixa: '85-95%' },
]

/** Quadro 4 (p. 23): marca da cânula no lábio superior por IG e peso estimado. */
export const CANULA: { ig: [number, number]; peso: [number, number]; cm: number }[] = [
  { ig: [33, 34], peso: [1500, 1800], cm: 7.5 },
  { ig: [35, 37], peso: [1900, 2400], cm: 8.0 },
  { ig: [38, 40], peso: [2500, 3100], cm: 8.5 },
  { ig: [40, 43], peso: [3200, 4200], cm: 9.0 },
]

/** Linhas do Quadro 4 que cabem na IG (com 40 semanas o quadro tem duas linhas; o peso desempata, se couber). */
export function marcaCanula(igSemanas: number, pesoG?: number): { cm: number; peso: [number, number] }[] {
  if (!Number.isFinite(igSemanas)) return []
  const ig = Math.floor(igSemanas)
  let linhas = CANULA.filter((l) => ig >= l.ig[0] && ig <= l.ig[1])
  if (linhas.length > 1 && pesoG !== undefined && Number.isFinite(pesoG)) {
    const porPeso = linhas.filter((l) => pesoG >= l.peso[0] && pesoG <= l.peso[1])
    if (porPeso.length === 1) linhas = porPeso
  }
  return linhas.map((l) => ({ cm: l.cm, peso: l.peso }))
}

/** Sequência que a diretriz traz, com a página. */
export const SEQUENCIA: { passo: string; texto: string; pagina: string }[] = [
  { passo: 'Ao nascer', texto: 'RN com boa vitalidade (respirando ou chorando, tônus em flexão) fica com a mãe, com clampeamento do cordão no mínimo 60 segundos após o nascimento. Temperatura corporal entre 36,5 e 37,5 °C.', pagina: 'p. 12–13' },
  { passo: 'VPP', texto: 'Apneia ou respiração irregular e/ou FC < 100 bpm após os passos iniciais: VPP nos primeiros 60 segundos ("Minuto de Ouro"), iniciada com ar ambiente (O2 21%), com monitor cardíaco e oxímetro.', pagina: 'p. 16–17' },
  { passo: 'Massagem cardíaca', texto: 'FC < 60 bpm em VPP com cânula traqueal, depois de corrigidos os problemas de dispositivo e técnica: massagem coordenada à ventilação, 3:1, 120 eventos por minuto (90 compressões e 30 ventilações), com O2 a 100%; reavaliar a FC após 60 segundos.', pagina: 'p. 27–29' },
  { passo: 'Adrenalina', texto: 'FC < 60 bpm apesar de ventilação efetiva por cânula com O2 a 100% e massagem adequada por no mínimo 60 segundos. Via de eleição: cateterismo venoso umbilical. Repetir a cada 3–5 minutos por via intravascular.', pagina: 'p. 30–32' },
  { passo: 'Expansor de volume', texto: 'Suspeita de hipovolemia (sem resposta da FC, perda de sangue, palidez, má perfusão, pulsos débeis): SF 10 mL/kg em 5–10 minutos. Cautela sem choque ou perda aguda de sangue.', pagina: 'p. 33' },
  { passo: 'Não usar', texto: 'Bicarbonato de sódio e naloxona não são recomendados; não há referência ao uso de atropina, albumina ou vasopressores na reanimação em sala de parto. Dose de adrenalina acima de 0,1 mg/kg não deve ser usada por nenhuma via.', pagina: 'p. 30, 32' },
]
