import type { Ficha } from './ficha.ts'

// Dengue: classificação em grupos A–D e volumes de hidratação do ADULTO.
// A classificação vale para qualquer idade; o volume da criança segue faixa de
// peso no manual do Ministério e não está aqui — o volume de adulto não serve.

export const fichaDengue: Ficha = {
  id: 'dengue-classificacao',
  titulo: 'Dengue — classificação e hidratação',
  versao: '2026-09-27.1',
  publico: 'adulto',
  fontes: [
    { citacao: 'Ministério da Saúde. Dengue: diagnóstico e manejo clínico — adulto e criança. SVSA.', url: 'https://www.gov.br/saude/pt-br/centrais-de-conteudo/publicacoes/svsa/dengue' },
    { citacao: 'World Health Organization. Dengue: guidelines for diagnosis, treatment, prevention and control. Geneva: WHO; 2009.' },
  ],
  revisadoEm: '27/09/2026',
}

export type GrupoDengue = 'A' | 'B' | 'C' | 'D'

export type SinaisDengue = {
  sangramentoPele: boolean
  sangramentoMucosa: boolean
  sinaisAlarme: number
  sinaisChoque: number
}

/** O sinal mais grave presente define o grupo. */
export function grupoDengue(s: SinaisDengue): GrupoDengue {
  if (s.sinaisChoque > 0) return 'D'
  if (s.sinaisAlarme > 0 || s.sangramentoMucosa) return 'C'
  if (s.sangramentoPele) return 'B'
  return 'A'
}

export type FaseHidratacao = { etapa: string; regra: string; volumeMl: number | null }

/** Volumes do adulto por grupo. Peso inválido não gera volume. */
export function hidratacaoAdulto(grupo: GrupoDengue, pesoKg: number): FaseHidratacao[] {
  const ok = Number.isFinite(pesoKg) && pesoKg > 0
  const v = (mlKg: number) => (ok ? Math.round(mlKg * pesoKg) : null)
  switch (grupo) {
    case 'A':
      return [
        { etapa: 'Volume em 24 h', regra: 'via oral, 60 mL/kg/dia', volumeMl: v(60) },
        { etapa: 'Primeiras 4 a 6 h', regra: 'um terço do volume, com SRO', volumeMl: v(20) },
        { etapa: 'Restante do dia', regra: 'dois terços em líquidos caseiros', volumeMl: v(40) },
      ]
    case 'B':
      return [
        { etapa: 'Hemograma', regra: 'obrigatório antes de definir a conduta', volumeMl: null },
        { etapa: 'Hematócrito normal', regra: 'hidratação oral do grupo A (60 mL/kg/dia)', volumeMl: v(60) },
        { etapa: 'Hemoconcentração ou alarme', regra: 'conduzir como grupo C', volumeMl: null },
      ]
    case 'C':
      return [
        { etapa: '1ª hora', regra: 'SF 0,9%, 10 mL/kg', volumeMl: v(10) },
        { etapa: '2ª hora', regra: 'repetir 10 mL/kg, até 3 fases', volumeMl: v(10) },
        { etapa: 'Manutenção — 6 h', regra: 'SF 0,9%, 25 mL/kg', volumeMl: v(25) },
        { etapa: 'Manutenção — 8 h seguintes', regra: 'SF 0,9%, 25 mL/kg', volumeMl: v(25) },
      ]
    case 'D':
      return [
        { etapa: 'Expansão rápida', regra: 'SF 0,9%, 20 mL/kg em até 20 min', volumeMl: v(20) },
        { etapa: 'Repetição', regra: 'até 3 vezes conforme resposta (teto)', volumeMl: v(60) },
      ]
  }
}
