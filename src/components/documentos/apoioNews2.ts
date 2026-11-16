// Apoio do laudo de AIH (bloco 3): NEWS2 e qSOFA calculados pelo MESMO
// código do leito (src/clinico/news2.ts e src/clinico/qsofa.ts), a partir dos
// vitais digitados no laudo. O escore diz gravidade e ritmo de
// monitorização — NÃO diz enfermaria ou UTI: essa escolha é do médico e do
// protocolo da unidade. Adulto apenas (NEWS2 e qSOFA não valem na criança).
import { faixaNews2, pontosNews2 } from '@/clinico/news2'
import { qsofa } from '@/clinico/qsofa'

export type VitaisAih = { pas?: string; pad?: string; fc?: string; fr?: string; temp?: string; spo2?: string; o2?: boolean; cons?: boolean }

export const CAMPOS_VITAIS_AIH: [keyof VitaisAih, string, string][] = [
  ['pas', 'PA sistólica', 'mmHg'], ['pad', 'PA diastólica', 'mmHg'], ['fc', 'FC', 'bpm'], ['fr', 'FR', 'irpm'],
  ['temp', 'Temp.', '°C'], ['spo2', 'SpO₂', '%'],
]

const num = (v: string | undefined) => {
  const x = String(v ?? '').replace(',', '.').trim()
  return x === '' || Number.isNaN(Number(x)) ? null : Number(x)
}

// Valor neutro (0 ponto) para o parâmetro não medido: o escore fica parcial.
const NEUTRO = { fr: 16, spo2: 98, pas: 120, fc: 80, temp: 37 }
// Nome da faixa e conduta: versão brasileira oficial do NEWS2 (Rev Gaúcha Enferm
// 2020; RT, H14 N2 = A, 16/11/2026), pelo faixaNews2. A cor segue a banda.
const FONTE_CONDUTA = 'NEWS2, versão brasileira oficial (Rev Gaúcha Enferm 2020)'
const ROTULOS: Record<string, string> = { fr: 'FR', spo2: 'SpO₂', pas: 'PA sistólica', fc: 'FC', temp: 'temperatura' }

export type ResultadoApoio = {
  total: string
  banda: string
  bandaN: 0 | 1 | 2
  conduta: string
  qsofa: string
  qsofaAlerta: boolean
  parcial: boolean
  faltando: string
  resumo: string
}

export function apoioNews2(v: VitaisAih | undefined): ResultadoApoio | null {
  const x = v ?? {}
  const medidos = { fr: num(x.fr), spo2: num(x.spo2), pas: num(x.pas), fc: num(x.fc), temp: num(x.temp) }
  const faltando = (Object.keys(medidos) as (keyof typeof medidos)[]).filter((k) => medidos[k] === null)
  if (faltando.length === 5) return null
  const p = pontosNews2({
    fr: medidos.fr ?? NEUTRO.fr, spo2: medidos.spo2 ?? NEUTRO.spo2, pas: medidos.pas ?? NEUTRO.pas, fc: medidos.fc ?? NEUTRO.fc,
    temp: medidos.temp ?? NEUTRO.temp, oxigenio: !!x.o2, alerta: !x.cons, escala2: false,
  })
  const f = faixaNews2(p)
  const q = qsofa({ fr: medidos.fr, pas: medidos.pas, consciencia: x.cons ? 'C' : 'A' })
  const parcial = faltando.length > 0
  const total = `${f.total}${parcial ? '*' : ''}`
  const conduta = `Monitoramento ${f.monitoramento}; ${f.resposta} (${FONTE_CONDUTA}).`
  const resumo = `NEWS2 ${total} pontos (${f.rotulo}). ${conduta} qSOFA ${q.total}${q.parcial ? '*' : ''} de 3${q.alerta ? ' (sinal de alerta: avaliar sepse)' : ''}.`
  return {
    total, banda: f.rotulo, bandaN: f.banda, conduta,
    qsofa: `${q.total}${q.parcial ? '*' : ''} de 3`, qsofaAlerta: q.alerta, parcial,
    faltando: faltando.map((k) => ROTULOS[k]).join(', '), resumo,
  }
}
