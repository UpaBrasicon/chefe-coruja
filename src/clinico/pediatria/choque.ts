import type { Ficha, Fonte } from '../ficha.ts'
import { fichaP2, type DosePeso, type Faixa } from './fonteP2.ts'

// Choque séptico na criança — livro do ICr, cap. 5 (p. 79–88). Expansão
// volêmica em mL/kg (p. 85), drogas vasoativas da Tabela 2 (p. 87) e metas do
// manejo inicial (p. 83). A tabela de sinais vitais anormais (Tabela 1, p. 87)
// está em sinaisVitais.ts.
//
// Versão .1 de 28/09/2026 (decisão do RT: implementar as diretrizes pós-livro):
// critérios de Phoenix 2024 (JAMA) para sepse e choque séptico, com o escore
// calculado a partir dos dados informados, e a Surviving Sepsis Campaign
// pediátrica 2026 (Intensive Care Med 2026;52:937–983) para bolus conforme a
// disponibilidade de UTI, antimicrobiano, cristaloide, vasoativo, corticoide,
// lactato e SpO₂. Páginas do JAMA são as do PDF (E1–E10); as da SSC são as do
// periódico (937–983). O livro fica como base; as diferenças aparecem.

export const PHOENIX_2024: Fonte = {
  citacao: 'Schlapbach LJ, Watson RS, Sorce LR, et al. International Consensus Criteria for Pediatric Sepsis and Septic Shock (Phoenix). JAMA. 2024;331(8):665–674.',
  url: 'https://doi.org/10.1001/jama.2024.0179',
  pediatrica: true,
}

export const SSC_PED_2026: Fonte = {
  citacao: 'Surviving Sepsis Campaign International Guidelines for the Management of Sepsis and Septic Shock in Children 2026. Intensive Care Med. 2026;52:937–983.',
  url: 'https://doi.org/10.1007/s00134-026-08360-2',
  pediatrica: true,
}

// Revisão PubMed de 09/10/2026 (decisão do RT): o ECR PRoMPT BOLUS (NEJM
// 2026), posterior à SSC pediátrica 2026, não achou diferença entre fluido
// balanceado e SF 0,9% no desfecho principal. Entra como nota no tema "Qual
// fluido"; volume e dose não mudam.
export const PROMPT_BOLUS_2026: Fonte = {
  citacao: 'Balamuth F, Weiss SL, Long E, et al. Balanced Fluid or 0.9% Saline in Children Treated for Septic Shock. N Engl J Med. 2026;395(9):870–881 (PMID 42028918).',
  url: 'https://doi.org/10.1056/NEJMoa2601969',
  pediatrica: true,
}

export const NOTA_PROMPT_BOLUS =
  'PRoMPT BOLUS (NEJM 2026, posterior à SSC): ECR pragmático em 47 prontos-socorros de 5 países, 8.482 crianças de 2 meses a < 18 anos com choque séptico suspeito e perfusão anormal, fluido por até 48 h. Evento renal maior em 30 dias (morte, diálise nova ou disfunção renal persistente): 3,4% com balanceado e 3,0% com SF 0,9% (RR 1,10; IC 95% 0,88–1,40), sem diferença. Hipercloremia 31,4% vs 49,0% e hipernatremia 1,8% vs 3,1% (mais com SF); hiperlactatemia 19,8% vs 16,7% (mais com balanceado). A preferência por balanceado da SSC (certeza muito baixa) fica relativizada: os dois são aceitáveis; volume e velocidade não mudam.'

export const fichaChoquePediatrico: Ficha = {
  ...fichaP2('ped-choque-icr', 'Choque séptico — criança', 'cap. 5, p. 79–88'),
  versao: '2026-10-09.1',
  fontes: [
    ...fichaP2('ped-choque-icr', 'Choque séptico — criança', 'cap. 5, p. 79–88').fontes,
    { ...PHOENIX_2024, citacao: `${PHOENIX_2024.citacao} Tabela do escore (p. E3 do PDF).` },
    { ...SSC_PED_2026, citacao: `${SSC_PED_2026.citacao} Tabela 3, rec. 3, 5–7, 19–24, 28–32, 39 e 40 (p. 944–951).` },
    PROMPT_BOLUS_2026,
  ],
  revisadoEm: '09/10/2026 (nota do PRoMPT BOLUS no fluido; Phoenix 2024 e SSC pediátrica 2026 conferidas no texto; livro do ICr mantido como base)',
}

/** Phoenix como ferramenta própria da Central (onda 9): mesma regra de phoenix(), só a fonte do escore. */
export const fichaPhoenixPed: Ficha = {
  id: 'ped-phoenix',
  titulo: 'Escore de Phoenix — sepse e choque séptico (criança)',
  versao: '2026-09-30.1',
  publico: 'pediatrico',
  fontes: [{ ...PHOENIX_2024, citacao: `${PHOENIX_2024.citacao} Tabela do escore (p. E3 do PDF).` }],
  revisadoEm: '30/09/2026 (mesma regra conferida no texto em 28/09; aguarda aprovação do RT como ferramenta própria)',
}

export type Volume = {
  bolus: Faixa
  primeiraHora: Faixa
  semSuporte: number
}

/** Bolus de 10 a 20 mL/kg; 40 a 60 mL/kg na primeira hora; sem suporte ventilatório/vasoativo, até 40 mL/kg e só no hipotenso (p. 85). */
export function volumesChoque(pesoKg: number): Volume | null {
  if (!Number.isFinite(pesoKg) || pesoKg <= 0) return null
  return {
    bolus: [10 * pesoKg, 20 * pesoKg],
    primeiraHora: [40 * pesoKg, 60 * pesoKg],
    semSuporte: 40 * pesoKg,
  }
}

/** Diurese-alvo acima de 1 mL/kg/h (p. 82–83). */
export const diureseAlvo = (pesoKg: number) => (Number.isFinite(pesoKg) && pesoKg > 0 ? pesoKg : null)

export const VASOATIVAS: DosePeso[] = [
  { id: 'epinefrina', nome: 'Epinefrina (Adrenalina® 1 mg/mL)', unidade: 'µg/min', porKg: [0.1, 1], via: 'IV contínua; inotrópico, vasodilatador em dose baixa e vasopressor em dose alta', pagina: 'p. 87 (Tabela 2)',
    nota: 'O texto (p. 86) diz que entre 0,05 e 0,3 µg/kg/min a epinefrina é inotrópico e cronotrópico potente, com queda da resistência vascular periférica.' },
  { id: 'dopamina', nome: 'Dopamina (5 mg/mL)', unidade: 'µg/min', porKg: [2, 20], via: 'IV contínua; quando epinefrina e noradrenalina não estão disponíveis (p. 86)', pagina: 'p. 87 (Tabela 2)' },
  { id: 'dobutamina', nome: 'Dobutamina (Dobutrex® 12,5 mg/mL)', unidade: 'µg/min', porKg: [2, 20], via: 'IV contínua; inotrópico, vasodilatador', pagina: 'p. 87 (Tabela 2)' },
]

export const METAS_CHOQUE: { texto: string; pagina: string }[] = [
  { texto: 'Enchimento capilar < 2 s; pulsos periféricos normais; extremidades quentes; diurese > 1 mL/kg/h; estado mental recuperado; PA normal para a idade; glicemia e cálcio iônico normais.', pagina: 'p. 83' },
  { texto: 'Acesso periférico ou intraósseo em 5 min; volume em até 30 min; antibiótico e inotrópico (se refratário a volume) em até 60 min.', pagina: 'p. 83' },
  { texto: 'Droga vasoativa quando a hipoperfusão persiste após 40 a 60 mL/kg, ou antes se houver sobrecarga; epinefrina e noradrenalina são as preferenciais. Em veia periférica, concentração máxima de 16 µg/mL.', pagina: 'p. 86' },
  { texto: 'Cristaloides balanceados (Ringer lactato, Plasmalyte) preferidos ao soro fisiológico.', pagina: 'p. 86' },
  { texto: 'Glicemia entre 140 e 180 mg/dL (consenso citado); transfusão não indicada com Hb > 7 g/dL no paciente estabilizado.', pagina: 'p. 86–87' },
  { texto: 'Além da primeira hora: índice cardíaco entre 3,3 e 6,0 L/min/m² e ScvO₂ > 70%.', pagina: 'p. 87' },
]

// ---------------------------------------------------------------- Phoenix 2024

export type FaixaEtariaPhoenix = '<1m' | '1-11m' | '1-<2a' | '2-<5a' | '5-<12a' | '12-17a'

/** PAM por idade (Tabela, p. E3): 1 ponto na faixa, 2 pontos abaixo do menor valor. */
export const PAM_PHOENIX: Record<FaixaEtariaPhoenix, { umPonto: [number, number]; doisPontos: number; rotulo: string }> = {
  '<1m': { umPonto: [17, 30], doisPontos: 17, rotulo: '< 1 mês' },
  '1-11m': { umPonto: [25, 38], doisPontos: 25, rotulo: '1 a 11 meses' },
  '1-<2a': { umPonto: [31, 43], doisPontos: 31, rotulo: '1 a < 2 anos' },
  '2-<5a': { umPonto: [32, 44], doisPontos: 32, rotulo: '2 a < 5 anos' },
  '5-<12a': { umPonto: [36, 48], doisPontos: 36, rotulo: '5 a < 12 anos' },
  '12-17a': { umPonto: [38, 51], doisPontos: 38, rotulo: '12 a 17 anos' },
}

/** Faixa de Phoenix pela idade em meses (o Phoenix não vale para < 37 semanas de idade pós-concepcional, internação de nascimento nem ≥ 18 anos). */
export function faixaPhoenix(idadeMeses: number): FaixaEtariaPhoenix | null {
  if (!Number.isFinite(idadeMeses) || idadeMeses < 0 || idadeMeses >= 216) return null
  if (idadeMeses < 1) return '<1m'
  if (idadeMeses < 12) return '1-11m'
  if (idadeMeses < 24) return '1-<2a'
  if (idadeMeses < 60) return '2-<5a'
  if (idadeMeses < 144) return '5-<12a'
  return '12-17a'
}

export type EntradaPhoenix = {
  idadeMeses: number
  /** PaO₂/FiO₂, se houver gasometria */
  pf?: number
  /** SpO₂/FiO₂ (só vale com SpO₂ ≤ 97%) */
  sf?: number
  suporteRespiratorio?: boolean
  vmInvasiva?: boolean
  vasoativos?: number
  lactato?: number
  pam?: number
  plaquetas?: number
  inr?: number
  dDimero?: number
  fibrinogenio?: number
  glasgow?: number
  pupilasFixasBilaterais?: boolean
}

export type ResultadoPhoenix = {
  respiratorio: number
  cardiovascular: number
  coagulacao: number
  neurologico: number
  total: number
  sepse: boolean
  choqueSeptico: boolean
  faixa: FaixaEtariaPhoenix
  avisos: string[]
}

const num = (x?: number) => x !== undefined && Number.isFinite(x)

/**
 * Escore de Phoenix (Tabela, p. E3): respiratório 0–3, cardiovascular 0–6,
 * coagulação 0–2, neurológico 0–2. Sepse = infecção suspeita + ≥ 2 pontos;
 * choque séptico = sepse + ≥ 1 ponto cardiovascular. O escore pode ser
 * calculado sem algumas variáveis (nota a da tabela). Não é ferramenta de
 * triagem precoce (p. E5).
 */
export function phoenix(e: EntradaPhoenix): ResultadoPhoenix | null {
  const faixa = faixaPhoenix(e.idadeMeses)
  if (!faixa) return null
  const avisos: string[] = []
  // respiratório
  let resp = 0
  const pf = num(e.pf) ? e.pf! : null
  const sf = num(e.sf) ? e.sf! : null
  if (e.vmInvasiva && ((pf !== null && pf < 100) || (sf !== null && sf < 148))) resp = 3
  else if (e.vmInvasiva && ((pf !== null && pf >= 100 && pf <= 200) || (sf !== null && sf >= 148 && sf <= 220))) resp = 2
  else if ((e.suporteRespiratorio || e.vmInvasiva) && ((pf !== null && pf < 400) || (sf !== null && sf < 292))) resp = 1
  if (sf !== null && pf === null) avisos.push('SpO₂/FiO₂ só vale com SpO₂ ≤ 97% (nota b da tabela).')
  // cardiovascular
  let cv = 0
  const vaso = num(e.vasoativos) ? e.vasoativos! : 0
  cv += vaso >= 2 ? 2 : vaso === 1 ? 1 : 0
  if (num(e.lactato)) cv += e.lactato! >= 11 ? 2 : e.lactato! >= 5 ? 1 : 0
  if (num(e.pam)) {
    const f = PAM_PHOENIX[faixa]
    cv += e.pam! < f.doisPontos ? 2 : e.pam! <= f.umPonto[1] ? 1 : 0
  } else avisos.push('Sem PAM: o componente pressórico não pontua (a PAM calculada 1/3 PAS + 2/3 PAD serve, nota g).')
  cv = Math.min(cv, 6)
  // coagulação (1 ponto cada, máximo 2)
  let coag = 0
  if (num(e.plaquetas) && e.plaquetas! < 100) coag++
  if (num(e.inr) && e.inr! > 1.3) coag++
  if (num(e.dDimero) && e.dDimero! > 2) coag++
  if (num(e.fibrinogenio) && e.fibrinogenio! < 100) coag++
  coag = Math.min(coag, 2)
  // neurológico
  let neuro = 0
  if (e.pupilasFixasBilaterais) neuro = 2
  else if (num(e.glasgow) && e.glasgow! <= 10) neuro = 1
  const total = resp + cv + coag + neuro
  const sepse = total >= 2
  return { respiratorio: resp, cardiovascular: cv, coagulacao: coag, neurologico: neuro, total, sepse, choqueSeptico: sepse && cv >= 1, faixa, avisos }
}

export const PHOENIX_TEXTO = {
  criterios: 'Sepse = infecção suspeita + escore de Phoenix ≥ 2; choque séptico = sepse + ≥ 1 ponto cardiovascular (hipotensão grave para a idade, lactato ≥ 5 mmol/L ou vasoativo). SIRS e "sepse grave" saem.',
  naoVale: 'Não vale para internação de nascimento, idade pós-concepcional < 37 semanas nem ≥ 18 anos; não é ferramenta de triagem precoce — a triagem segue o procedimento do serviço (PEWS/POPS na Central).',
  mortalidade: 'Escore ≥ 2: mortalidade hospitalar 7,1% (alto recurso) e 28,5% (baixo recurso); choque séptico: 10,8% e 33,5%.',
  pagina: 'JAMA 2024, p. E1–E5 do PDF (Tabela na p. E3)',
}

// ---------------------------------------------------------------- SSC pediátrica 2026 × livro

export type DiretrizPed = { tema: string; ssc: { texto: string; pagina: string }; livro?: { texto: string; pagina: string }; nota?: string }

/** Tabela 3 da SSC pediátrica 2026 (p. 944–951), nos pontos que a ferramenta cobre. */
export const DIRETRIZ_SSC_PED_2026: DiretrizPed[] = [
  { tema: 'Lactato', ssc: { texto: 'Medir o lactato na avaliação inicial de sepse provável ou choque séptico suspeito (forte, certeza muito baixa); ≥ 2 mmol/L associa-se a mortalidade', pagina: 'rec. 3, p. 942 e 944' }, livro: { texto: 'Lactato entra nas metas de reavaliação', pagina: 'p. 83' } },
  { tema: 'Antimicrobiano', ssc: { texto: 'Choque séptico suspeito: o mais rápido possível, idealmente em até 1 h do reconhecimento (forte, certeza muito baixa). Sepse provável sem choque: investigação rápida limitada no tempo e, confirmada a suspeita, antimicrobiano idealmente em até 3 h (condicional, certeza muito baixa). Hemoculturas antes, se não atrasarem', pagina: 'rec. 4–7, p. 944' }, livro: { texto: 'Antibiótico em até 60 min', pagina: 'p. 83' } },
  { tema: 'Bolus onde há UTI', ssc: { texto: 'Choque séptico com UTI disponível: até 40–60 mL/kg em bolus (10–20 mL/kg por bolus) na 1ª hora, titulando por marcadores clínicos de débito cardíaco e parando se surgir sobrecarga (condicional, certeza baixa), em vez de nenhum bolus', pagina: 'rec. 19, p. 946' }, livro: { texto: 'Bolus 10–20 mL/kg; 40–60 mL/kg na 1ª hora', pagina: 'p. 85' } },
  { tema: 'Bolus onde não há UTI', ssc: { texto: 'Sem UTI e SEM hipotensão: contra bolus, iniciando manutenção (forte, certeza alta). Sem UTI e COM hipotensão: até 40 mL/kg (10–20 mL/kg por bolus) na 1ª hora, titulando e parando se sobrecarga (condicional, certeza baixa). Marcadores: FC, PA, TEC, consciência, diurese', pagina: 'rec. 20, p. 946–947' }, livro: { texto: 'Sem suporte ventilatório/vasoativo: só no hipotenso, até 40 mL/kg', pagina: 'p. 85' } },
  { tema: 'Qual fluido', ssc: { texto: 'Cristaloide em vez de albumina (condicional, certeza moderada); balanceado/tamponado em vez de SF 0,9% (condicional, certeza muito baixa); contra amidos (forte)', pagina: 'rec. 22–24, p. 947' }, livro: { texto: 'Balanceados (Ringer lactato, Plasmalyte) preferidos ao SF', pagina: 'p. 86' }, nota: NOTA_PROMPT_BOLUS },
  { tema: 'Vasoativo: qual', ssc: { texto: 'Adrenalina em vez de dopamina (condicional, certeza baixa); noradrenalina em vez de dopamina (condicional, certeza muito baixa); sem evidência para eleger adrenalina ou noradrenalina como 1ª linha; dopamina só se as duas não estiverem disponíveis', pagina: 'rec. 28–31, p. 948–949' }, livro: { texto: 'Epinefrina e noradrenalina preferenciais; dopamina quando não disponíveis', pagina: 'p. 86' } },
  { tema: 'Vasoativo: quando e por onde', ssc: { texto: 'Razoável começar após 40–60 mL/kg se a perfusão continua anormal; iniciar por acesso periférico (ou intraósseo) em vez de esperar o acesso central (condicional, certeza muito baixa); sem consenso sobre iniciar antes ou depois de 40 mL/kg', pagina: 'rec. 31–32, p. 948–949' }, livro: { texto: 'Após 40–60 mL/kg ou antes se sobrecarga; periférico com no máximo 16 µg/mL', pagina: 'p. 86' } },
  { tema: 'Catecolamina em dose alta', ssc: { texto: 'Adicionar vasopressina ou titular mais a catecolamina (condicional, certeza baixa); sem consenso sobre o limiar', pagina: 'rec. 32 (2020) / p. 949' } },
  { tema: 'Corticoide', ssc: { texto: 'Contra hidrocortisona IV se fluido e vasoativo restauram a estabilidade (condicional, certeza baixa); no choque refratário, evidência insuficiente; dose de estresse se insuficiência adrenal suspeita ou documentada', pagina: 'rec. 40, p. 951' } },
  { tema: 'Oxigênio no intubado', ssc: { texto: 'Após a ressuscitação, alvo conservador de SpO₂ 88–92% em vez de > 94% (condicional, certeza moderada)', pagina: 'rec. 39, p. 949' } },
  { tema: 'Intubação', ssc: { texto: 'Contra etomidato na intubação de criança com sepse/choque (condicional, certeza baixa); sem recomendação sobre intubar o choque refratário sem insuficiência respiratória', pagina: 'rec. 37–38, p. 949 e 965' } },
  { tema: 'Definição', ssc: { texto: 'A SSC 2026 aceita o Phoenix 2024 (infecção + disfunção respiratória, cardiovascular, de coagulação e/ou neurológica) sem exigir uma definição única', pagina: 'p. 939–941' }, livro: { texto: 'Quadro 2 (disfunção orgânica) e sinais vitais da Tabela 1', pagina: 'p. 81 e 87' } },
]

export const ERRATA_CHOQUE: string[] = [
  'p. 87 — índice cardíaco impresso em "L/min/m3"; a unidade de índice cardíaco é por m² de superfície corporal. Mostrado aqui como L/min/m².',
  'p. 81 (Quadro 2, disfunção respiratória) — "FiO2 > 50% para manter saturação acima de 50%": o valor da saturação parece trocado; o critério não é usado nesta ferramenta.',
]
