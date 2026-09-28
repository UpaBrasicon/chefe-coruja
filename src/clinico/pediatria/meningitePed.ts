import { fichaP4, type DoseLivro } from './fonteP4.ts'

// Meningites e meningoencefalites — livro do ICr, cap. 40 (p. 403–414).
// Correção do liquor no acidente de punção, Bacterial Meningitis Score,
// antibióticos empíricos (neonatal e pós-neonatal), aciclovir, dexametasona,
// duração por agente e quimioprofilaxia. Onde o capítulo dá valor para o
// período neonatal, a linha é marcada `neonatal` e calcula para o RN; as
// demais não. Máximos que o capítulo não traz vêm do Apêndice (p. 897–910).

export const fichaMeningitePed = fichaP4('ped-meningite', 'Meningite — criança', 'cap. 40, p. 403–414; Apêndice, p. 897–909')

/**
 * Leucócitos ajustados no liquor (p. 409) = leucócitos no liquor −
 * (leucócitos no sangue × hemácias no liquor) / hemácias no sangue.
 * Todas as contagens na mesma unidade (/mm³).
 */
export function leucocitosLiquorAjustados(p: { leucLiquor: number; hemLiquor: number; leucSangue: number; hemSangue: number }): number | null {
  const v = [p.leucLiquor, p.hemLiquor, p.leucSangue, p.hemSangue]
  if (!v.every((x) => Number.isFinite(x) && x >= 0) || p.hemSangue <= 0) return null
  return p.leucLiquor - (p.leucSangue * p.hemLiquor) / p.hemSangue
}

/** Estimativa rápida (p. 409): subtrair 1 leucócito a cada 500 a 1.500 hemácias no liquor. Devolve [menor, maior] ajuste. */
export function leucocitosLiquorEstimativa(leucLiquor: number, hemLiquor: number): [number, number] | null {
  if (![leucLiquor, hemLiquor].every((x) => Number.isFinite(x) && x >= 0)) return null
  return [leucLiquor - hemLiquor / 500, leucLiquor - hemLiquor / 1500]
}

/** Proteína (p. 409): subtrair 1 mg/dL a cada 1.000 hemácias no liquor. */
export function proteinaLiquorAjustada(proteinaMgDl: number, hemLiquor: number): number | null {
  if (![proteinaMgDl, hemLiquor].every((x) => Number.isFinite(x) && x >= 0)) return null
  return proteinaMgDl - hemLiquor / 1000
}

/** Bacterial Meningitis Score (p. 410): muito baixo risco só se TODOS ausentes. */
export const BMS_CRITERIOS: { id: string; texto: string }[] = [
  { id: 'gram', texto: 'Bacterioscopia positiva (Gram)' },
  { id: 'neutroLcr', texto: 'Neutrófilos no LCR > 1.000' },
  { id: 'proteina', texto: 'Proteinorraquia > 80 mg/dL' },
  { id: 'neutroSangue', texto: 'Neutrófilos no sangue periférico > 10.000' },
  { id: 'convulsao', texto: 'Crise convulsiva' },
]

export function bms(marcados: Set<string>): { pontos: number; muitoBaixoRisco: boolean } {
  const pontos = BMS_CRITERIOS.filter((c) => marcados.has(c.id)).length
  return { pontos, muitoBaixoRisco: pontos === 0 }
}

export const ERRATA_BMS =
  'O BMS está impresso com unidade "células/mL" para neutrófilos no LCR (> 1.000) e no sangue (> 10.000) (p. 410); a Tabela 4 do mesmo capítulo usa /mm³. A tela mostra só o número de corte.'

const AP_CEFTRIAXONA = 'máx. do Apêndice: 2 g/dose (p. 899)'

export const DOSES_MENINGITE: DoseLivro[] = [
  { id: 'ampicilina-neo', nome: 'Ampicilina — período neonatal (com aminoglicosídeo)', unidade: 'mg', porKgDia: [300, 400], doses: [4, 4], via: 'EV de 6/6 h', pagina: 'p. 410', neonatal: true,
    nota: 'O capítulo associa aminoglicosídeo (p. ex., gentamicina) sem dar a dose do aminoglicosídeo.' },
  { id: 'cefotaxima-neo', nome: 'Cefotaxima — período neonatal (suspeita de resistente, + ampicilina)', unidade: 'mg', porKgDia: [300, 300], doses: [4, 4], via: 'EV de 6/6 h', pagina: 'p. 410–411', neonatal: true },
  { id: 'aciclovir-neo', nome: 'Aciclovir — período neonatal (herpes)', unidade: 'mg', porKgDia: [60, 60], doses: [3, 3], via: 'EV de 8/8 h por 21 dias', pagina: 'p. 410', neonatal: true },
  { id: 'ceftriaxona', nome: 'Ceftriaxona — pós-neonatal', unidade: 'mg', porKgDia: [100, 100], doses: [2, 2], maxDose: 2000, fonteMaximo: AP_CEFTRIAXONA, via: 'EV de 12/12 h', pagina: 'p. 411',
    nota: 'Apêndice (p. 899): meningite 100 mg/kg/dia; "não deve ser usada em neonatos".' },
  { id: 'cefotaxima', nome: 'Cefotaxima — pós-neonatal', unidade: 'mg', porKgDia: [300, 300], doses: [4, 4], maxDia: 6000, fonteMaximo: 'máx. do Apêndice: 6 g/dia (p. 899)', via: 'EV de 6/6 h', pagina: 'p. 411',
    nota: 'O máximo de 6 g/dia do Apêndice está na linha geral (150 a 200 mg/kg/dia); acima de 20 kg os 300 mg/kg/dia do capítulo passam dele.' },
  { id: 'vancomicina', nome: 'Vancomicina — associada (risco de pneumococo resistente)', unidade: 'mg', porKgDia: [60, 60], doses: [4, 4], maxDia: 2000, fonteMaximo: 'máx. do Apêndice: 2.000 mg/dia (p. 909)', via: 'EV de 6/6 h; nunca isolada (baixa penetração liquórica)', pagina: 'p. 411' },
  { id: 'aciclovir', nome: 'Aciclovir — meningoencefalite herpética', unidade: 'mg', porKgDose: [10, 15], doses: [3, 3], via: 'EV de 8/8 h por 14 a 21 dias (idealmente até PCR negativo)', pagina: 'p. 410',
    nota: 'Apêndice (p. 897): 10 a 15 mg/kg/dose para < 12 anos; ≥ 12 anos, 500 mg/m²/dose (a ferramenta não calcula por superfície).' },
  { id: 'dexametasona', nome: 'Dexametasona adjuvante (decisão individualizada)', unidade: 'mg', porKgDose: [0.15, 0.15], doses: [4, 4], via: 'EV de 6/6 h por 2 a 4 dias; antes ou junto da 1ª dose do antibiótico', pagina: 'p. 411',
    nota: 'Parece mais benéfica no Hib; sem efeito observado em países de baixa renda (p. 411).' },
]

/** Quimioprofilaxia (p. 412–413). */
export const DOSES_PROFILAXIA: DoseLivro[] = [
  { id: 'rifampicina-mening', nome: 'Rifampicina — meningococo', unidade: 'mg', porKgDia: [20, 20], doses: [2, 2], maxDose: 600, fonteMaximo: 'máx. do Apêndice: 600 mg/dose (p. 908)', via: 'VO de 12/12 h por 2 dias', pagina: 'p. 412' },
  { id: 'rifampicina-mening-neo', nome: 'Rifampicina — meningococo, período neonatal (metade da dose)', unidade: 'mg', porKgDia: [10, 10], doses: [2, 2], via: 'VO de 12/12 h por 2 dias', pagina: 'p. 412', neonatal: true },
  { id: 'ceftriaxona-mening', nome: 'Ceftriaxona — meningococo (< 15 anos)', unidade: 'mg', fixo: [125, 125], doses: [1, 1], via: 'IM, dose única', pagina: 'p. 412', nota: '250 mg a partir dos 15 anos (fora da faixa pediátrica deste sistema).' },
  { id: 'cipro-mening', nome: 'Ciprofloxacino — meningococo', unidade: 'mg', porKgDose: [20, 20], doses: [1, 1], via: 'dose única', pagina: 'p. 412', nota: 'O capítulo não traz máximo para esta indicação.' },
  { id: 'rifampicina-hib', nome: 'Rifampicina — Hib', unidade: 'mg', porKgDia: [20, 20], doses: [1, 2], maxDose: 600, fonteMaximo: 'máx. do Apêndice: 600 mg/dose (p. 908)', via: 'VO de 12/12 h ou 1 vez ao dia por 4 dias', pagina: 'p. 413',
    nota: 'O Apêndice (p. 908) dá 1 vez ao dia por 4 dias.' },
]

/** Tabela 5 (p. 410): duração por agente. Empírico: 14 dias no neonato, 10 dias nas demais idades. */
export const DURACAO: [string, string][] = [
  ['Neisseria meningitidis', '5–7 dias'],
  ['Haemophilus influenzae', '7–10 dias'],
  ['Streptococcus pneumoniae', '10–14 dias'],
  ['Streptococcus agalactiae (grupo B)', '14–21 dias'],
  ['Bacilos Gram-negativos', '21 dias'],
  ['Listeria monocytogenes', '21 dias'],
]

/** Tabela 4 (p. 409): liquor por etiologia — referência. */
export const LIQUOR: { lab: string; normal: string; virus: string; bacteria: string; fungo: string; tb: string }[] = [
  { lab: 'Leucócitos/mm³', normal: 'Em geral acelular; RN termo ≤ 15; < 1 ano até 9; > 1 ano até 5', virus: '< 1.000', bacteria: '> 1.000', fungo: '< 500', tb: '< 300' },
  { lab: 'Diferencial', normal: '—', virus: '20–40% neutrófilos (linfomonocitário)', bacteria: '85–90% neutrófilos', fungo: '< 10–20% neutrófilos', tb: '< 10–20% neutrófilos' },
  { lab: 'Proteína (mg/dL)', normal: 'RNPT ≤ 125–150; RNT ≤ 100; lactentes 15–50', virus: 'Normal ou < 100', bacteria: '> 100–150', fungo: '> 100–200', tb: '> 200–300' },
  { lab: 'Glicose (mg/dL)', normal: 'RNPT ≤ 20; RNT ≤ 30; lactentes 45–100', virus: 'Normal', bacteria: '< 40', fungo: '< 40', tb: '< 40' },
  { lab: 'Cultura positiva', normal: '—', virus: '—', bacteria: '> 95%', fungo: '> 30%', tb: '< 30%' },
]

export const ERRATA_LIQUOR =
  'Na Tabela 4 (p. 409), a glicorraquia normal do RN aparece como "RNPT ≤ 20; RNT ≤ 30" — com "≤", o que a leitura sugere ser limite inferior (≥). Mantido como impresso, sem uso em cálculo.'

export const REFERENCIAS_MENINGITE: { texto: string; pagina: string }[] = [
  { texto: 'A coleta do LCR não deve atrasar o antibiótico. Punção contraindicada com distúrbio de coagulação, hipertensão intracraniana ou infecção de pele no local. TC antes: convulsão, déficit focal, papiledema, rebaixamento moderado a grave, lesão estrutural prévia, TCE recente, coagulopatia/trombocitopenia.', pagina: 'p. 408' },
  { texto: 'Profilaxia do meningococo: contato íntimo (mesmo domicílio, quarto ou secreções nos 7 dias anteriores; escola/creche nos 7 dias; IOT sem paramentação; voo > 8 h ao lado).', pagina: 'p. 412' },
  { texto: 'Profilaxia do Hib: contato íntimo < 12 meses (vacinado ou não); 12 a 48 meses não imunizado ou incompleto; imunossuprimido; creche com ≥ 2 casos em 60 dias.', pagina: 'p. 413' },
  { texto: 'Precaução para gotículas até 24 h de antibiótico adequado. Sem troca para via oral antes do fim. DVP: 10 dias (não complicada) ou 21 dias (complicada).', pagina: 'p. 410, 412' },
]
