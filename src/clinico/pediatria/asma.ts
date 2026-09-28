import { fichaP2, type DosePeso } from './fonteP2.ts'

// Crise asmática — livro do ICr, cap. 8 (p. 113–122). Doses da Tabela 3
// (p. 119) e do texto (p. 117–119); onde divergem, os dois aparecem. A
// classificação de gravidade (Tabela 1, p. 114) é referência: o livro diz que
// vários parâmetros, mas não necessariamente todos, indicam a classificação —
// não há pontuação para somar, e a tela não classifica.

export const fichaAsmaPediatrica = fichaP2('ped-asma-icr', 'Crise asmática — criança', 'cap. 8, p. 113–122')

export const DOSES_ASMA: DosePeso[] = [
  { id: 'prednisolona', nome: 'Prednisona ou prednisolona', unidade: 'mg', porKg: [1, 2], maximo: 40, via: 'VO, por dia; geralmente 3 a 5 dias', pagina: 'p. 118–119 (Tabela 3)',
    nota: 'O texto (p. 118) dá máximo de 40 mg/dia para crianças e 50 mg/dia para adolescentes e adultos; a Tabela 3 dá 40 mg/dia.' },
  { id: 'dexametasona', nome: 'Dexametasona', unidade: 'mg', porKg: [0.3, 0.6], maximo: 16, via: 'VO, IM ou IV', pagina: 'p. 118–119 (Tabela 3)',
    nota: 'A Tabela 3 dá máximo de 12 a 16 mg/dia; o cálculo limita na ponta de cima (16 mg).' },
  { id: 'metilprednisolona', nome: 'Metilprednisolona', unidade: 'mg', porKg: [1, 2], maximo: 40, via: 'IV', pagina: 'p. 119 (Tabela 3)',
    nota: 'O texto (p. 118) diz "na mesma dose da prednisolona".' },
  { id: 'hidrocortisona', nome: 'Hidrocortisona', unidade: 'mg', porKg: [10, 10], maximo: 200, via: 'IM ou IV, por dose; máximo 200 mg/dia', pagina: 'p. 118–119 (Tabela 3)' },
  { id: 'magnesio-tabela', nome: 'Sulfato de magnésio — Tabela 3', unidade: 'mg', porKg: [25, 75], via: 'IV em 20 a 40 min, paciente monitorizado; dose padrão 50 mg/kg', pagina: 'p. 119 (Tabela 3)',
    nota: 'O texto (p. 119) dá 25 mg/kg com máximo de 2 g, e sugere acima de 4 anos.' },
  { id: 'magnesio-texto', nome: 'Sulfato de magnésio — texto', unidade: 'mg', porKg: [25, 25], maximo: 2000, via: 'IV; crises graves, ou moderadas sem resposta, acima de 4 anos', pagina: 'p. 119',
    nota: 'A Tabela 3 (p. 119) dá dose padrão de 50 mg/kg, margem de 25 a 75 mg/kg, sem máximo.' },
  { id: 'salbutamol-continuo', nome: 'Salbutamol — nebulização contínua', unidade: 'mg/h', porKg: [0.5, 0.5], maximo: 20, via: 'diluir em SF até 20 mL; bomba a 20 mL/h', pagina: 'p. 117–118',
    errata: 'O livro escreve fluxo de oxigênio de condução "8 a 10 mL por minuto" (p. 118); a unidade está impressa assim e não entra no cálculo.' },
]

/** Magnésio: dose padrão da Tabela 3 (50 mg/kg), que o cálculo por faixa não mostra sozinho. */
export const MAGNESIO_PADRAO_MG_KG = 50

/** Ipratrópio em nebulização (Tabela 3, p. 119): < 20 kg 250 µg (20 gotas); ≥ 20 kg 500 µg (40 gotas). */
export function ipratropioNebulizacao(pesoKg: number): { mcg: number; gotas: number } | null {
  if (!Number.isFinite(pesoKg) || pesoKg <= 0) return null
  return pesoKg < 20 ? { mcg: 250, gotas: 20 } : { mcg: 500, gotas: 40 }
}

export const FIXOS_ASMA: { nome: string; dose: string; pagina: string }[] = [
  { nome: 'Salbutamol aerossol com espaçador (100 µg/jato)', dose: '4 a 10 jatos a cada 20 min na primeira hora (3 vezes)', pagina: 'p. 116 (Figuras 1 e 2), 119 (Tabela 3)' },
  { nome: 'Ipratrópio aerossol com espaçador (18 µg/jato)', dose: '4 a 8 jatos a cada 20 min, na primeira hora, intercalado ao salbutamol; só no atendimento inicial das crises moderadas e graves', pagina: 'p. 118–119' },
  { nome: 'Oxigênio', dose: 'SpO₂ entre 94 e 98%; baixo fluxo (< 10 L/min) nas leves, alto fluxo (> 10 L/min) nas graves', pagina: 'p. 115' },
  { nome: 'Corticoide — quando', dose: 'acima de 6 anos, mesmo nas crises leves; abaixo de 6 anos, nas graves e sem resposta ao tratamento inicial nas leves/moderadas', pagina: 'p. 118' },
  { nome: 'Ventilação mecânica (se inevitável)', dose: 'FR 15 a 20/min, VC 6 a 10 mL/kg, I:E 1:3 ou 1:4, pico até 45 cmH₂O, PEEP fisiológica ou abaixo da auto-PEEP; hipercapnia permissiva com pH > 7,1', pagina: 'p. 120' },
]

/** Tabela 1 (p. 114): classificação da crise — referência, sem pontuação. */
export const CLASSIFICACAO_ASMA: { parametro: string; leveModerada: string; grave: string; muitoGrave: string }[] = [
  { parametro: 'Impressão clínica geral', leveModerada: 'Sem alterações', grave: 'Sem alterações', muitoGrave: 'Cianose, sudorese, exaustão' },
  { parametro: 'Estado mental', leveModerada: 'Normal', grave: 'Normal ou agitação', muitoGrave: 'Agitação, confusão, sonolência' },
  { parametro: 'Dispneia', leveModerada: 'Ausente ou leve', grave: 'Moderada', muitoGrave: 'Intensa' },
  { parametro: 'Fala', leveModerada: 'Frases completas', grave: 'Frases incompletas; lactente: choro curto, dificuldade alimentar', muitoGrave: 'Frases curtas ou monossilábicas; lactente: dificuldade alimentar' },
  { parametro: 'Musculatura acessória', leveModerada: 'Retrações leves/ausentes', grave: 'Retrações acentuadas', muitoGrave: 'Retrações acentuadas' },
  { parametro: 'Sibilância', leveModerada: 'Ausentes com MV normal, localizados ou difusos', grave: 'Localizados ou difusos', muitoGrave: 'Ausentes com MV mínimo' },
  { parametro: 'FR', leveModerada: 'Normal ou aumentada', grave: 'Aumentada', muitoGrave: 'Aumentada' },
  { parametro: 'FC (bpm)', leveModerada: '≤ 110', grave: '> 110', muitoGrave: '> 140 ou bradicardia' },
  { parametro: 'PFE (% do previsto)', leveModerada: '> 50', grave: '30 a 50', muitoGrave: '< 30' },
  { parametro: 'SpO₂ (%)', leveModerada: '> 95', grave: '91 a 95', muitoGrave: '≤ 90' },
  { parametro: 'PaO₂ (mmHg)', leveModerada: 'Normal', grave: 'Ao redor de 60', muitoGrave: '< 60' },
  { parametro: 'PaCO₂ (mmHg)', leveModerada: '< 40', grave: '< 45', muitoGrave: '≥ 45' },
]
