// Sinais vitais da triagem e da reclassificação (Fase 2). Obrigatórios:
// PA, FC, FR, temperatura, SpO₂ e dor; na pediatria a PA é opcional (CLAUDE.md).
// Nada aqui marca valor como alterado: a análise é da enfermagem e do médico.

export type Publico = 'adulto' | 'pediatrico'

export const VITAIS = [
  { k: 'pressao-arterial-sistolica', rotulo: 'PA sistólica', un: 'mmHg', adulto: true, ped: false },
  { k: 'pressao-arterial-diastolica', rotulo: 'PA diastólica', un: 'mmHg', adulto: true, ped: false },
  { k: 'frequencia-cardiaca', rotulo: 'FC', un: 'bpm', adulto: true, ped: true },
  { k: 'frequencia-respiratoria', rotulo: 'FR', un: 'irpm', adulto: true, ped: true },
  { k: 'temperatura', rotulo: 'Temperatura', un: '°C', adulto: true, ped: true },
  { k: 'saturacao-o2', rotulo: 'SpO₂', un: '%', adulto: true, ped: true },
  { k: 'escala-dor', rotulo: 'Dor (0–10)', un: '', adulto: true, ped: true },
  { k: 'glicemia-capilar', rotulo: 'Glicemia capilar', un: 'mg/dL', adulto: false, ped: false },
  { k: 'peso', rotulo: 'Peso', un: 'kg', adulto: false, ped: false },
] as const

export const obrigatorio = (v: (typeof VITAIS)[number], publico: Publico | null) => (publico === 'pediatrico' ? v.ped : v.adulto)

export function faltandoVitais(valores: Record<string, string>, publico: Publico | null) {
  return VITAIS.filter((v) => obrigatorio(v, publico) && !(valores[v.k] ?? '').trim())
}

/** Texto do formulário → números para o servidor. Lança erro com o rótulo do campo. */
export function paraNumeros(valores: Record<string, string>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(valores)
      .filter(([, v]) => v.trim() !== '')
      .map(([k, v]) => {
        const n = Number(v.replace(',', '.'))
        if (Number.isNaN(n)) throw new Error(`Valor inválido em ${VITAIS.find((x) => x.k === k)?.rotulo ?? k}`)
        return [k, n]
      })
  )
}
