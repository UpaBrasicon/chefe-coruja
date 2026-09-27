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

export type FaixaNews2 = { total: number; maior: number; banda: 0 | 1 | 2; rotulo: string }

/** Faixa do RCP: 7 ou mais alta; 5–6 média; 3 em um parâmetro isolado, baixa-média. */
export function faixaNews2(p: PontosNews2): FaixaNews2 {
  const valores = Object.values(p)
  const total = valores.reduce((a, b) => a + b, 0)
  const maior = Math.max(...valores)
  const banda = total >= 7 ? 2 : total >= 5 || maior === 3 ? 1 : 0
  const rotulo = total >= 7 ? 'alta' : total >= 5 ? 'média' : maior === 3 ? 'baixa-média (3 em um parâmetro)' : 'baixa'
  return { total, maior, banda, rotulo }
}
