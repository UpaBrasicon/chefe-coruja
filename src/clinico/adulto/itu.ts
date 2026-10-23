import type { Ficha, Fonte } from '../ficha.ts'
import { fichaAdulto, pagina } from './fonte.ts'

// ITU do adulto (lacunas da Central, lote 2, 23/10/2026). Fonte das doses: Manual
// de Medicina de Emergência do HCFMUSP (3ª ed., 2022), cap. 89 Infecção do trato
// urinário (p. 1209–1216), lido no PDF (página do livro = página do PDF + 1). A
// IDSA 2025 de ITU complicada entra ao lado, só no que o resumo diz: duração e
// troca EV→VO; não traz doses aqui. A escolha é do médico (ADR 0007).
// Dois trechos do livro ficam como estão, com errata: a norfloxacina "400 mg ao
// dia 12/12 horas" e o SMX-TMP sem intervalo — nenhum intervalo é inventado.

export const IDSA_ITU_DURACAO_2025: Fonte = {
  citacao: 'Trautner BW, Cortés-Penfield NW, Gupta K, et al. IDSA 2025 Guidelines on Management and Treatment of Complicated Urinary Tract Infections — Duration of Antibiotics. Clin Infect Dis. 2026;82(Suppl 3):i79–i88 (PMID 41419448): 5–7 dias de fluoroquinolona ou 7 dias de outra classe em quem melhora, com ou sem bacteremia por Gram-negativo; 10–14 dias no homem febril com suspeita de prostatite.',
  url: 'https://doi.org/10.1093/cid/ciaf462',
}

export const IDSA_ITU_EV_VO_2025: Fonte = {
  citacao: 'Trautner BW, Cortés-Penfield NW, Gupta K, et al. IDSA 2025 Guidelines on Management and Treatment of Complicated Urinary Tract Infections — Timing of Intravenous to Oral Antibiotics Transition. Clin Infect Dis. 2026;82(Suppl 3):i68–i78 (PMID 41414903): passar para via oral quando melhora, aceita medicação oral e há opção oral eficaz.',
  url: 'https://doi.org/10.1093/cid/ciaf461',
}

export const IDSA_ITU_EMPIRICO_2025: Fonte = {
  citacao: 'Trautner BW, Cortés-Penfield NW, Gupta K, et al. IDSA 2025 Guideline on Management and Treatment of Complicated Urinary Tract Infections — Selection of Antibiotic Therapy. Clin Infect Dis. 2026;82(Suppl 3):i36–i67 (PMID 41419213): escolha empírica em 4 passos (gravidade, risco de resistência, fatores do paciente, antibiograma local na sepse).',
  url: 'https://doi.org/10.1093/cid/ciaf460',
}

const PAG_ITU = 'cap. 89 Infecção do trato urinário, p. 1209–1216'

export const fichaItuAdulto: Ficha = {
  ...fichaAdulto('adulto-itu', 'ITU — cistite, pielonefrite e sonda vesical (adulto)', PAG_ITU),
  versao: '2026-10-23.1',
  fontes: [pagina(PAG_ITU), IDSA_ITU_EMPIRICO_2025, IDSA_ITU_DURACAO_2025, IDSA_ITU_EV_VO_2025],
  revisadoEm: '23/10/2026 (lacunas da Central, lote 2; doses conferidas no texto do manual, com página; IDSA 2025 pelo resumo)',
}

export type QuadroItu = 'cistite' | 'pielonefrite' | 'sonda'

export type Esquema = { droga: string; dose: string; duracao?: string; pagina: string; errata?: string; nota?: string }

/** Cistite (p. 1212–1213): padrão de 3 dias; dose única recorre mais, mas é boa opção na gestante. */
export const CISTITE: Esquema[] = [
  { droga: 'Nitrofurantoína', dose: '100 mg 12/12 h', duracao: '5 dias', pagina: 'p. 1213' },
  { droga: 'Sulfametoxazol-trimetoprima', dose: '160/800 mg', duracao: '3 dias', pagina: 'p. 1213', errata: 'O manual não traz o intervalo entre as doses.', nota: 'Pode ser a escolha quando a resistência local ao SMX-TMP é menor que 20%.' },
  { droga: 'Fosfomicina', dose: '3 g', duracao: 'dose única', pagina: 'p. 1213', nota: 'Eficácia menor; evitar se houver possibilidade de pielonefrite.' },
  { droga: 'Norfloxacina', dose: '400 mg', duracao: '3 dias', pagina: 'p. 1213', errata: 'O texto diz "400 mg ao dia 12/12 horas": "ao dia" e "12/12 horas" no mesmo trecho.', nota: 'Não serve para pielonefrite (não penetra no trato urinário alto, p. 1213).' },
]

/** Pielonefrite (p. 1213): antibiótico com penetração no trato urinário alto; 7 a 14 dias. */
export const PIELONEFRITE: Esquema[] = [
  { droga: 'Ciprofloxacina', dose: '400 mg IV ou 500 mg VO 12/12 h', pagina: 'p. 1213' },
  { droga: 'Ceftriaxona', dose: '1 a 2 g IM/IV 1 vez ao dia', pagina: 'p. 1213' },
]

/** ITU associada à sonda vesical (p. 1214–1215). */
export const SONDA: Esquema[] = [
  { droga: 'Ceftriaxona', dose: '2 g/dia', pagina: 'p. 1214', nota: 'Sem cocos Gram-positivos no Gram.' },
  { droga: 'Ciprofloxacina', dose: '400 mg EV 12/12 h', pagina: 'p. 1214', nota: 'Sem cocos Gram-positivos no Gram.' },
  { droga: 'Ceftazidima', dose: '2 g a cada 8 h', pagina: 'p. 1214', nota: 'Suspeita de Pseudomonas (ou aminoglicosídeo).' },
  { droga: 'Vancomicina', dose: '1 g a cada 12 h', pagina: 'p. 1215', nota: 'Estafilococo coagulase-negativo. No enterococo: ampicilina, vancomicina e, eventualmente, aminoglicosídeo (sem dose no capítulo).' },
]

/** Aminoglicosídeo na pielonefrite, dose única diária IM/EV (p. 1213). */
export const AMINOGLICOSIDEO = { amicacinaMgKg: 15, gentamicinaMgKg: 5, pagina: 'p. 1213' }

export function aminoglicosideo(pesoKg: number): { amicacinaMg: number; gentamicinaMg: number } | null {
  if (!Number.isFinite(pesoKg) || pesoKg <= 0) return null
  return { amicacinaMg: AMINOGLICOSIDEO.amicacinaMgKg * pesoKg, gentamicinaMg: AMINOGLICOSIDEO.gentamicinaMgKg * pesoKg }
}

export type EntradaItu = { quadro: QuadroItu; homem?: boolean; prostatiteSuspeita?: boolean }

export type Duracao = { texto: string; pagina: string }

/** Duração pelo manual e, ao lado, pela IDSA 2025 (que vale para a ITU complicada). */
export function duracaoItu(e: EntradaItu): { manual: Duracao; idsa: Duracao | null } {
  if (e.quadro === 'cistite') {
    return {
      manual: e.homem
        ? { texto: 'Homem: pelo menos 7 dias (em geral associada à hiperplasia prostática ou a outra complicação).', pagina: 'p. 1213' }
        : { texto: 'Padrão de 3 dias (nitrofurantoína, 5 dias; fosfomicina, dose única).', pagina: 'p. 1212–1213' },
      idsa: e.homem && e.prostatiteSuspeita ? { texto: 'Homem febril com suspeita de prostatite bacteriana aguda: 10–14 dias.', pagina: 'IDSA 2025' } : null,
    }
  }
  const idsa: Duracao = e.homem && e.prostatiteSuspeita
    ? { texto: 'Homem febril com suspeita de prostatite bacteriana aguda: 10–14 dias.', pagina: 'IDSA 2025' }
    : { texto: 'Melhorando com terapia eficaz: 5–7 dias de fluoroquinolona ou 7 dias de outra classe, com ou sem bacteremia por Gram-negativo.', pagina: 'IDSA 2025' }
  return {
    manual: e.quadro === 'pielonefrite'
      ? { texto: '7 a 14 dias; na pielonefrite não complicada, 7 dias têm resposta semelhante a 14.', pagina: 'p. 1213' }
      : { texto: 'Retirar a sonda; bacteriúria que persiste 48 h depois é indicação de tratamento. O capítulo não traz duração.', pagina: 'p. 1214' },
    idsa,
  }
}

/** Indicações de urocultura na cistite (Tabela 2, p. 1211–1212). */
export const UROCULTURA_CISTITE: string[] = [
  'Febre', 'Sintomas há mais de 7 dias', 'Sintomas sugestivos de vaginite', 'Dor abdominal, náuseas e vômitos',
  'Hematúria franca acima de 50 anos', 'Imunossupressão', 'Diabetes mellitus', 'Gestação',
  'Alterações urológicas ou doença renal crônica', 'Cálculos renais recentes ou atuais', 'Internação nas últimas 2 semanas',
  'Tratamento de ITU nas últimas 2 semanas', 'ITU sintomática recente',
]

/** Quando tratar a bacteriúria assintomática (Tabela 3, p. 1212). */
export const BACTERIURIA_TRATAR: string[] = [
  'Gestantes', 'Granulocitopênicos', 'Transplante de órgão sólido', 'Pré-operatório de cirurgia urológica', 'Pré-operatório de colocação de prótese',
]

/** Internação e imagem (p. 1210–1211, 1213–1214). */
export const ALERTAS_ITU: { texto: string; pagina: string }[] = [
  { texto: 'Internar: hipotensão não rapidamente reversível, alteração da função renal e suspeita de pielonefrite com obstrução; reavaliar a internação a cada 48 h.', pagina: 'p. 1213–1214' },
  { texto: 'Febre após 72 h de antibiótico: suspeitar de abscesso e fazer imagem (ultrassonografia, também se houver suspeita de nefrolitíase).', pagina: 'p. 1210–1211' },
  { texto: 'Pielonefrite: sempre urina 1 e urocultura com antibiograma; com ITU prévia, checar o antibiograma anterior.', pagina: 'p. 1213' },
  { texto: 'Idoso pode ter como única manifestação um quadro confusional agudo.', pagina: 'p. 1210' },
]
