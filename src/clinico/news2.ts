// NEWS2 (Royal College of Physicians, 2017). Mesmos cortes de
// private.calcular_acuidade (migration 20260928000002): o escore da Central e o
// da acuidade do prontuário não podem divergir. A escala 2 de SpO₂ só existe
// aqui — a acuidade usa a escala 1.

export type VitaisNews2 = {
  fr: number
  spo2: number
  /** escala 2: hipercapnia documentada, com alvo de SpO₂ 88–92% definido pelo médico */
  escala2: boolean
  oxigenio: boolean
  pas: number
  fc: number
  /** A do ACVPU; confusão nova, voz, dor ou sem resposta = false */
  alerta: boolean
  temp: number
}

export type PontosNews2 = { fr: number; spo2: number; oxigenio: number; pas: number; fc: number; consciencia: number; temp: number }

export function pontosNews2(v: VitaisNews2): PontosNews2 {
  const fr = v.fr <= 8 ? 3 : v.fr <= 11 ? 1 : v.fr <= 20 ? 0 : v.fr <= 24 ? 2 : 3
  const spo2 = v.escala2
    ? v.spo2 <= 83 ? 3 : v.spo2 <= 85 ? 2 : v.spo2 <= 87 ? 1
      : v.spo2 <= 92 || !v.oxigenio ? 0 // 88–92, ou 93 ou mais em ar ambiente
        : v.spo2 <= 94 ? 1 : v.spo2 <= 96 ? 2 : 3
    : v.spo2 <= 91 ? 3 : v.spo2 <= 93 ? 2 : v.spo2 <= 95 ? 1 : 0
  const pas = v.pas <= 90 ? 3 : v.pas <= 100 ? 2 : v.pas <= 110 ? 1 : v.pas <= 219 ? 0 : 3
  const fc = v.fc <= 40 ? 3 : v.fc <= 50 ? 1 : v.fc <= 90 ? 0 : v.fc <= 110 ? 1 : v.fc <= 130 ? 2 : 3
  const temp = v.temp <= 35 ? 3 : v.temp <= 36 ? 1 : v.temp <= 38 ? 0 : v.temp <= 39 ? 1 : 2
  return { fr, spo2, oxigenio: v.oxigenio ? 2 : 0, pas, fc, consciencia: v.alerta ? 0 : 3, temp }
}

export type FaixaNews2 = {
  total: number
  maior: number
  banda: 0 | 1 | 2
  /** nome da faixa na versão brasileira oficial */
  rotulo: string
  /** frequência mínima de monitoramento, da versão brasileira oficial */
  monitoramento: string
  /** resposta clínica resumida, da versão brasileira oficial */
  resposta: string
}

// Faixas, monitoramento e resposta clínica: "Descrição da resposta clínica dos
// desencadeadores NEWS 2 — versão brasileira" (Oliveira APA, Urbanetto JS,
// Caregnato RCA. Rev Gaúcha Enferm. 2020;41:e20190424; figura lida no SciELO em
// 16/11/2026; decisão do RT, H14 N1 e N2 = A). É a adaptação autorizada do
// Chart 4 do RCP 2017. Os cortes e a banda (cor) não mudam.
const FAIXAS = {
  zero: { rotulo: 'Total 0', monitoramento: 'mínimo a cada 12 horas', resposta: 'continuar com o monitoramento NEWS2 de rotina' },
  baixa: { rotulo: 'Total 1–4', monitoramento: 'mínimo a cada 4–6 horas', resposta: 'informar o enfermeiro, que avalia o paciente e decide se aumenta a frequência de monitoramento ou intensifica o cuidado' },
  parametro: { rotulo: '3 em um único parâmetro', monitoramento: 'mínimo a cada 1 hora', resposta: 'o enfermeiro informa a equipe médica, que revisa e decide se intensifica o cuidado' },
  urgente: { rotulo: 'Total de 5 ou mais (limite de resposta urgente)', monitoramento: 'mínimo a cada 1 hora', resposta: 'o enfermeiro informa imediatamente a equipe médica e solicita avaliação urgente; cuidado em ambiente com monitoramento' },
  emergencia: { rotulo: 'Total de 7 ou mais (limite de resposta de emergência)', monitoramento: 'monitoramento contínuo dos sinais vitais', resposta: 'informar imediatamente a equipe médica; avaliação de emergência por equipe de cuidado crítico; considerar transferência para unidade intermediária ou UTI' },
} as const

/** Faixa da versão brasileira oficial (RCP 2017): 7 ou mais emergência; 5 ou mais urgente; 3 em um parâmetro isolado. */
export function faixaNews2(p: PontosNews2): FaixaNews2 {
  const valores = Object.values(p)
  const total = valores.reduce((a, b) => a + b, 0)
  const maior = Math.max(...valores)
  const banda = total >= 7 ? 2 : total >= 5 || maior === 3 ? 1 : 0
  const f = total >= 7 ? FAIXAS.emergencia : total >= 5 ? FAIXAS.urgente : maior === 3 ? FAIXAS.parametro : total === 0 ? FAIXAS.zero : FAIXAS.baixa
  return { total, maior, banda, ...f }
}
