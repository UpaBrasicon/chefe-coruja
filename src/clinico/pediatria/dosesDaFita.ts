import type { Ficha, Fonte } from '../ficha.ts'
import { numeroSemMilhar } from '../../lib/formato.ts'
import { calcularBolus, type Bolus, type DoseCalculada, type Regra, type Condicao } from './bolus.ts'
import { CORES_BROSELOW, pesoDaCor, type CorBroselow } from './fitaBroselow.ts'
import { LIVRO_PS_PED } from './fonte.ts'
import { AHA_AAP_2025 } from './rcp.ts'

// Doses pela cor da fita e pelo peso (pedido do RT de 17/11/2026: "doses pela
// cor e peso, vai para todas as ferramentas que iremos construir em conjunto").
// Diagnóstico e decisões D1–D12 (todas A) em
// docs/clinico/DOSES-FITA-BROSELOW-DIAGNOSTICO.md; trechos, PMID e DOI de cada
// dose em docs/clinico/DOSES-FITA-CONFERENCIA-PUBMED.md.
//
// Regras do RT:
// - Com peso informado, a dose sai do peso, não da cor. Só sem peso a dose usa
//   o peso da cor (meio da faixa, o mesmo da fita: "6–7 kg → 6,5 kg").
// - Nenhum número sai das páginas do e-book Fita PED (D1): ele tem erros
//   conferidos no texto (glucagon de 15 a 35 mg, atropina até 1,6 mg, "16 g" de
//   succinilcolina). A dose por kg e o máximo vêm da fonte conferida no PubMed,
//   com o trecho literal; tetos sem fonte aberta vêm do livro do ICr (D9).
// - Volume em mL só quando a concentração tem fonte (livro do ICr ou a própria
//   definição da solução, ex.: 10% = 100 mg/mL); ao lado, a concentração (D12).
// - Fentanil na intubação fica fora até haver fonte aberta (D8).

const pmc = (id: string) => `https://pmc.ncbi.nlm.nih.gov/articles/${id}/`

export const COREIA_PALS_2025: Fonte = {
  citacao: 'Kim DK, et al. 2025 Korean Guidelines for Cardiopulmonary Resuscitation: Part 8. Pediatric advanced life support. Clin Exp Emerg Med. 2026;13(Suppl 1):S115–S141 (PMID 42297411, PMC13277418). Tabela 2 (drogas da reanimação) e Tabela 4 (taquiarritmias).',
  url: 'https://doi.org/10.15441/ceem.26.103',
  pediatrica: true,
}

export const SBA_VIA_AEREA_PED_2024: Fonte = {
  citacao: 'Lima LC, et al. Recommendations from the Brazilian Society of Anesthesiology (SBA) for difficult airway management in pediatric care. Braz J Anesthesiol. 2024;74(1):744478 (PMID 38147975, PMC10877349). Tabela 7.',
  url: pmc('PMC10877349'),
  pediatrica: true,
}

export const SFAR_IOT_2019: Fonte = {
  citacao: 'Quintard H, et al. Experts\' guidelines of intubation and extubation of the ICU patient (SFAR/SRLF). Ann Intensive Care. 2019;9:13 (PMID 30671726, PMC6342741). R 3.3 (pediatria).',
  url: pmc('PMC6342741'),
  pediatrica: true,
}

export const AES_2016: Fonte = {
  citacao: 'Glauser T, et al. Evidence-Based Guideline: Treatment of Convulsive Status Epilepticus in Children and Adults. Epilepsy Curr. 2016;16(1):48–61 (PMID 26900382, PMC4749120). Figura 1.',
  url: pmc('PMC4749120'),
  pediatrica: true,
}

export const WAO_ANAFILAXIA_2020_PED: Fonte = {
  citacao: 'Cardona V, et al. World Allergy Organization anaphylaxis guidance 2020. World Allergy Organ J. 2020;13(10):100472 (PMID 33204386, PMC7607509). "Management of anaphylaxis" e Tabela 6 (dose por idade).',
  url: pmc('PMC7607509'),
  pediatrica: true,
}

export const CHINA_ANAFILAXIA_2020: Fonte = {
  citacao: 'Li X, et al. A Clinical Practice Guideline for the Emergency Management of Anaphylaxis (2020). Front Pharmacol. 2022;13:845689 (PMID 35418863, PMC8996305).',
  url: pmc('PMC8996305'),
  pediatrica: true,
}

export const COCHRANE_CRUPE_2018: Fonte = {
  citacao: 'Gates A, et al. Glucocorticoids for croup in children. Cochrane Database Syst Rev. 2018;8:CD001955 (PMID 30133690, PMC6513469).',
  url: pmc('PMC6513469'),
  pediatrica: true,
}

export const COCHRANE_MG_ASMA_2016: Fonte = {
  citacao: 'Griffiths B, Kew KM. Intravenous magnesium sulfate for treating children with acute asthma in the emergency department. Cochrane Database Syst Rev. 2016;4:CD011050 (PMID 27126744, PMC6599814).',
  url: pmc('PMC6599814'),
  pediatrica: true,
}

export const ISPAD_HIPOGLICEMIA_2022: Fonte = {
  citacao: 'Abraham MB, et al. ISPAD Clinical Practice Consensus Guidelines 2022: Assessment and management of hypoglycemia in children and adolescents with diabetes. Pediatr Diabetes. 2022;23(8):1322–1340 (PMID 36537534, PMC10107518). Seção "Glucagon".',
  url: pmc('PMC10107518'),
  pediatrica: true,
}

export const SANDELICH_OPIOIDE_2024: Fonte = {
  citacao: 'Sandelich S, et al. Acute opioid overdose in pediatric patients. JACEP Open. 2024;5(2):e13134 (PMID 38464332, PMC10920943). Seção 6 e tabela de tratamento.',
  url: pmc('PMC10920943'),
  pediatrica: true,
}

export const CUNICO_DOR_2023: Fonte = {
  citacao: 'Cunico D, et al. Pain Management in Children Admitted to the Emergency Room: A Narrative Review. Pharmaceuticals (Basel). 2023;16(8):1178 (PMID 37631093, PMC10459115). Seção 3.2.4 e tabela de doses (revisão narrativa).',
  url: pmc('PMC10459115'),
  pediatrica: true,
}

export const NIEHUES_FEBRE_2026: Fonte = {
  citacao: 'Niehues T, et al. Clinical Practice Guideline: The Outpatient Management of Fever in Children and Adolescents. Dtsch Arztebl Int. 2026;123:226–30 (PMID 41733151, PMC13247625).',
  url: pmc('PMC13247625'),
  pediatrica: true,
}

// Rodada D10 (17/11/2026): ondansetrona, salbutamol e gluconato de cálcio.
export const RERKSUPPAPHOL_ONDANSETRONA_2010: Fonte = {
  citacao: 'Rerksuppaphol S, Rerksuppaphol L. Efficacy of intravenous ondansetron to prevent vomiting episodes in acute gastroenteritis: a randomized, double blind, and controlled trial. Pediatr Rep. 2010;2(2):e17 (PMID 21589830, PMC3093998). Methods.',
  url: pmc('PMC3093998'),
  pediatrica: true,
}

export const CPS_ONDANSETRONA_2011: Fonte = {
  citacao: 'Cheng A; Canadian Paediatric Society, Acute Care Committee. Emergency department use of oral ondansetron for acute gastroenteritis-related vomiting in infants and children. Paediatr Child Health. 2011;16(3):177–179 (PMID 22379383, PMC3077311). Recommendations.',
  url: pmc('PMC3077311'),
  pediatrica: true,
}

export const INDINNIMEO_ASMA_2018: Fonte = {
  citacao: 'Indinnimeo L, et al. Clinical practice guidelines for the management of acute asthma attacks in children (Italian Society of Pediatrics). Ital J Pediatr. 2018;44(1):46 (PMID 29625590, PMC5889573).',
  url: pmc('PMC5889573'),
  pediatrica: true,
}

export const AHA_CIRCUNSTANCIAS_2025: Fonte = {
  citacao: 'Cao D, et al. Part 10: Adult and Pediatric Special Circumstances of Resuscitation: 2025 American Heart Association Guidelines for Cardiopulmonary Resuscitation and Emergency Cardiovascular Care. Circulation. 2025;152(suppl 2):S578–S672 (PMID 41122889). Tabela 4 (antídotos na intoxicação por betabloqueador ou bloqueador de canal de cálcio); texto integral em cpr.heart.org.',
  url: 'https://doi.org/10.1161/CIR.0000000000001380',
  pediatrica: true,
}

export const fichaDosesDaFita: Ficha = {
  id: 'ped-doses-fita',
  titulo: 'Doses pela cor da fita e pelo peso (Guia rápido da criança)',
  versao: '2026-11-17.1',
  publico: 'pediatrico',
  fontes: [
    AHA_AAP_2025, COREIA_PALS_2025, SBA_VIA_AEREA_PED_2024, SFAR_IOT_2019, AES_2016, WAO_ANAFILAXIA_2020_PED,
    CHINA_ANAFILAXIA_2020, COCHRANE_CRUPE_2018, COCHRANE_MG_ASMA_2016, ISPAD_HIPOGLICEMIA_2022,
    SANDELICH_OPIOIDE_2024, CUNICO_DOR_2023, NIEHUES_FEBRE_2026, RERKSUPPAPHOL_ONDANSETRONA_2010,
    CPS_ONDANSETRONA_2011, INDINNIMEO_ASMA_2018, AHA_CIRCUNSTANCIAS_2025, LIVRO_PS_PED,
  ],
  revisadoEm: '17/11/2026 (cada dose conferida no PubMed com trecho literal; e-book Fita PED só organiza as seções; decisões D1–D12 do RT de 17/11/2026; aguarda aprovação do RT)',
}

export type SecaoDaFita = 'reanimacao' | 'intubacao' | 'gerais'

export const SECOES_DA_FITA: Record<SecaoDaFita, string> = {
  reanimacao: 'Reanimação e arritmias',
  intubacao: 'Intubação',
  gerais: 'Gerais',
}

/** Dose da fita: o cálculo é o mesmo das doses por peso (`calcularBolus`); muda a fonte. */
export type DoseDaFita = Bolus & {
  secao: SecaoDaFita
  fontes: Fonte[]
  /** frase copiada da fonte, na língua original */
  trecho: string
}

const r = (campo: Regra['campo'], op: Regra['op'], valor: number): Regra => ({ campo, op, valor })
const so = (texto: string, ...regras: Regra[]): Condicao => ({ texto, alternativas: [regras] })
const ou = (texto: string, ...alternativas: Regra[][]): Condicao => ({ texto, alternativas })
const D = (d: DoseDaFita) => d

const EPI_0_1 = 'epinefrina 0,1 mg/mL (1 ampola de 1 mg/mL + 9 mL de SF ou AD; livro do ICr, p. 31)'
const EPI_1 = 'epinefrina 1 mg/mL (ampola pura; livro do ICr, p. 895)'
const MG_50 = 'sulfato de magnésio 50% = 500 mg/mL (livro do ICr, p. 32)'
const BIC_84 = 'bicarbonato de sódio 8,4%: 1 mL = 1 mEq (livro do ICr, p. 32)'
const CETAMINA_50 = 'cetamina 50 mg/mL (livro do ICr, p. 88)'

const LACTENTE = so('lactente (< 12 meses)', r('meses', '<', 12))
const CRIANCA = so('criança (≥ 12 meses)', r('meses', '>=', 12))

export const DOSES_DA_FITA: DoseDaFita[] = [
  // Reanimação e arritmias
  D({ secao: 'reanimacao', grupo: 'pcr', id: 'fita-epinefrina-iv', nome: 'Epinefrina IV/IO', unidade: 'mg', porKg: true, faixa: [0.01, 0.01], maximo: 1, porMl: 0.1, apresentacao: EPI_0_1,
    via: 'IV/IO, a cada 3 a 5 min', pagina: 'AHA 2025, Figura 2', fontes: [AHA_AAP_2025],
    trecho: 'Epinephrine IV/IO dose: 0.01 mg/kg (0.1 mg/mL concentration). Max dose 1 mg.' }),
  D({ secao: 'reanimacao', grupo: 'pcr', id: 'fita-amiodarona', nome: 'Amiodarona', unidade: 'mg', porKg: true, faixa: [5, 5], maximo: 300,
    via: 'IV/IO em bolus na FV/TV sem pulso; até 3 doses', pagina: 'AHA 2025, Figura 2', fontes: [AHA_AAP_2025],
    trecho: 'Amiodarone IV/IO dose: 5 mg/kg bolus (max 300 mg). May repeat up to 3 doses (max 150 mg subsequent doses).',
    nota: 'Nas doses seguintes, máximo de 150 mg por dose.' }),
  D({ secao: 'reanimacao', grupo: 'pcr', id: 'fita-lidocaina', nome: 'Lidocaína', unidade: 'mg', porKg: true, faixa: [1, 1],
    via: 'IV/IO na FV/TV sem pulso (alternativa à amiodarona)', pagina: 'AHA 2025, Figura 2', fontes: [AHA_AAP_2025],
    trecho: 'Lidocaine IV/IO dose: 1 mg/kg' }),
  D({ secao: 'reanimacao', grupo: 'pcr', id: 'fita-adenosina-1', nome: 'Adenosina — 1ª dose', unidade: 'mg', porKg: true, faixa: [0.1, 0.1], maximo: 6,
    via: 'IV em bolus rápido, seguido de flush', pagina: 'AHA 2025, Figura 7', fontes: [AHA_AAP_2025],
    trecho: '0.1 mg/kg (max 6 mg) rapid push followed by IV flush.' }),
  D({ secao: 'reanimacao', grupo: 'pcr', id: 'fita-adenosina-2', nome: 'Adenosina — 2ª dose', unidade: 'mg', porKg: true, faixa: [0.2, 0.2], maximo: 12,
    via: 'IV em bolus rápido, seguido de flush', pagina: 'AHA 2025, Figura 7', fontes: [AHA_AAP_2025],
    trecho: 'Consider repeat dose 0.2 mg/kg rapid push followed by IV flush; maximum dose 12 mg.' }),
  D({ secao: 'reanimacao', grupo: 'pcr', id: 'fita-atropina', nome: 'Atropina — bradicardia', unidade: 'mg', porKg: true, faixa: [0.02, 0.02], maximo: 0.5,
    via: 'IV/IO; pode repetir 1 vez', pagina: 'Coreia 2025, seção Atropine', fontes: [COREIA_PALS_2025, AHA_AAP_2025],
    trecho: 'A dose of 0.02 mg/kg (maximum, 0.5 mg) is administered via IV or IO routes, and it is used with no minimum dose.',
    nota: 'Sem dose mínima (decisão D3). A Figura 6 da AHA 2025 (bradicardia) ainda traz mínimo de 0,1 mg; a seção 17 da mesma diretriz tirou o mínimo.' }),
  D({ secao: 'reanimacao', grupo: 'pcr', id: 'fita-cloreto-calcio', nome: 'Cloreto de cálcio 10%', unidade: 'mg', porKg: true, faixa: [20, 20], maximo: 2000, porMl: 100,
    apresentacao: 'cloreto de cálcio 10% = 100 mg/mL', via: 'IV/IO lento; hipocalcemia, hipercalemia, intoxicação por bloqueador de canal de cálcio', pagina: 'Coreia 2025, Tabela 2', fontes: [COREIA_PALS_2025],
    trecho: '20 mg/kg of calcium chloride may be administered via IV or IO routes over 10 to 20 seconds.',
    nota: 'Não é de rotina na parada (AHA 2025).' }),
  D({ secao: 'reanimacao', grupo: 'pcr', id: 'fita-gluconato-calcio', nome: 'Gluconato de cálcio 10%', unidade: 'mg', porKg: true, faixa: [60, 60], maximo: 6000, porMl: 100,
    apresentacao: 'gluconato de cálcio 10% = 100 mg/mL (0,6 mL/kg)', via: 'IV lento; alternativa ao cloreto', pagina: 'AHA 2025 Part 10, Tabela 4', fontes: [AHA_CIRCUNSTANCIAS_2025],
    trecho: '60 mg/kg 0.28 mEq/kg Ca2+ 0.6 mL/kg 100 mg/mL solution',
    nota: 'A dose está na tabela de intoxicação por betabloqueador ou bloqueador de canal de cálcio. O teto de 6 g é a dose de adulto da mesma tabela ("Maximum pediatric dose should not exceed adult dose"). Não é de rotina na parada (AHA 2025).' }),
  D({ secao: 'reanimacao', grupo: 'pcr', id: 'fita-magnesio-torsades', nome: 'Sulfato de magnésio — torsades', unidade: 'mg', porKg: true, faixa: [25, 50], maximo: 2000, porMl: 500, apresentacao: MG_50,
    via: 'IV rápido (em alguns minutos)', pagina: 'Coreia 2025, seção Magnesium', fontes: [COREIA_PALS_2025],
    trecho: 'Regardless of the cause, torsades de pointes should be treated with 25 to 50 mg/kg (maximum, 2 g) of magnesium sulfate, administered rapidly via IV (over several minutes).' }),
  D({ secao: 'reanimacao', grupo: 'pcr', id: 'fita-bicarbonato', nome: 'Bicarbonato de sódio 8,4%', unidade: 'mEq', porKg: true, faixa: [1, 1], porMl: 1, apresentacao: BIC_84,
    via: 'IV/IO lento, depois de ventilação adequada', pagina: 'Coreia 2025, Tabela 2', fontes: [COREIA_PALS_2025, AHA_AAP_2025],
    trecho: '1 mEq/kg per dose IV/IO slowly',
    nota: 'Não é de rotina na parada; vale na hipercalemia e na intoxicação por bloqueador de canal de sódio (AHA 2025).' }),
  D({ secao: 'reanimacao', grupo: 'metabolico', id: 'fita-glicose', nome: 'Glicose — hipoglicemia', unidade: 'g', porKg: true, faixa: [0.5, 1], porMl: 0.25,
    apresentacao: 'glicose 25% = 0,25 g/mL (2 a 4 mL/kg)', via: 'IV/IO', pagina: 'Coreia 2025, Tabela 2', fontes: [COREIA_PALS_2025],
    trecho: '0.5–1 g/kg IV/IO' }),

  // Intubação
  D({ secao: 'intubacao', grupo: 'isr', id: 'fita-atropina-iot', nome: 'Atropina — pré-medicação', unidade: 'mg', porKg: true, faixa: [0.02, 0.02], maximo: 0.5,
    via: 'IV, quando usada (não é de rotina)', pagina: 'AHA 2025, seção 17', fontes: [AHA_AAP_2025, COREIA_PALS_2025],
    trecho: 'When atropine is used as a premedication for emergency intubation of infants and children, a dose of 0.02 mg/kg with no minimum dose, may be considered.',
    nota: 'Máximo de 0,5 mg pela Coreia 2025.' }),
  D({ secao: 'intubacao', grupo: 'isr', id: 'fita-etomidato', nome: 'Etomidato', unidade: 'mg', porKg: true, faixa: [0.2, 0.4],
    via: 'IV', pagina: 'SBA 2024, Tabela 7', fontes: [SBA_VIA_AEREA_PED_2024],
    trecho: 'Etomidate IV: 0.2–0.4 mg.kg−1' }),
  D({ secao: 'intubacao', grupo: 'isr', id: 'fita-cetamina-iv', nome: 'Cetamina — IV', unidade: 'mg', porKg: true, faixa: [1, 2], porMl: 50, apresentacao: CETAMINA_50,
    via: 'IV', pagina: 'SBA 2024, Tabela 7', fontes: [SBA_VIA_AEREA_PED_2024],
    trecho: 'Ketamine IV: 1–2 mg.kg−1' }),
  D({ secao: 'intubacao', grupo: 'isr', id: 'fita-cetamina-im', nome: 'Cetamina — IM', unidade: 'mg', porKg: true, faixa: [3, 5], porMl: 50, apresentacao: CETAMINA_50,
    via: 'IM', pagina: 'SBA 2024, Tabela 7', fontes: [SBA_VIA_AEREA_PED_2024],
    trecho: 'Ketamine IM: 3–5 mg.kg−1' }),
  D({ secao: 'intubacao', grupo: 'isr', id: 'fita-propofol', nome: 'Propofol', unidade: 'mg', porKg: true, faixa: [2, 2],
    via: 'IV', pagina: 'SBA 2024, Tabela 7', fontes: [SBA_VIA_AEREA_PED_2024],
    trecho: 'Propofol IV: 2 mg.kg−1 (for small children up to 3 mg.kg−1)',
    nota: 'Em criança pequena, até 3 mg/kg (decisão D5).' }),
  D({ secao: 'intubacao', grupo: 'isr', id: 'fita-succinilcolina-lactente', nome: 'Succinilcolina — IV, lactente', unidade: 'mg', porKg: true, faixa: [2, 2],
    via: 'IV', pagina: 'SBA 2024, Tabela 7', fontes: [SBA_VIA_AEREA_PED_2024], condicao: LACTENTE,
    trecho: 'Succinylcholine Infant IV: 2 mg.kg−1' }),
  D({ secao: 'intubacao', grupo: 'isr', id: 'fita-succinilcolina-crianca', nome: 'Succinilcolina — IV, criança', unidade: 'mg', porKg: true, faixa: [1, 1.5],
    via: 'IV', pagina: 'SBA 2024, Tabela 7', fontes: [SBA_VIA_AEREA_PED_2024], condicao: CRIANCA,
    trecho: 'Succinylcholine Children IV: 1–1.5 mg.kg−1' }),
  D({ secao: 'intubacao', grupo: 'isr', id: 'fita-succinilcolina-im-lactente', nome: 'Succinilcolina — IM, lactente', unidade: 'mg', porKg: true, faixa: [4, 4],
    via: 'IM (o dobro da dose IV)', pagina: 'SBA 2024, Tabela 7', fontes: [SBA_VIA_AEREA_PED_2024], condicao: LACTENTE,
    trecho: 'IM: Multiply the IV dose by two' }),
  D({ secao: 'intubacao', grupo: 'isr', id: 'fita-succinilcolina-im-crianca', nome: 'Succinilcolina — IM, criança', unidade: 'mg', porKg: true, faixa: [2, 3],
    via: 'IM (o dobro da dose IV)', pagina: 'SBA 2024, Tabela 7', fontes: [SBA_VIA_AEREA_PED_2024], condicao: CRIANCA,
    trecho: 'IM: Multiply the IV dose by two' }),
  D({ secao: 'intubacao', grupo: 'isr', id: 'fita-rocuronio', nome: 'Rocurônio', unidade: 'mg', porKg: true, faixa: [1, 1.2],
    via: 'IV (sequência rápida)', pagina: 'SFAR 2019, R 3.3', fontes: [SFAR_IOT_2019, SBA_VIA_AEREA_PED_2024],
    trecho: 'Rocuronium at a dose above 0.9 mg/kg [1.0–1.2 mg/kg] should be used when succinylcholine is contraindicated.',
    nota: 'A SBA 2024 dá 0,6 a 1,2 mg/kg fora da sequência rápida.' }),

  // Gerais
  D({ secao: 'gerais', grupo: 'anafilaxia', id: 'fita-epinefrina-im', nome: 'Epinefrina IM — anafilaxia', unidade: 'mg', porKg: true, faixa: [0.01, 0.01], maximo: 0.5, porMl: 1, apresentacao: EPI_1,
    via: 'IM na face lateral da coxa; repetir a cada 5 a 15 min se não melhorar', pagina: 'WAO 2020, "Management of anaphylaxis"', fontes: [WAO_ANAFILAXIA_2020_PED],
    trecho: 'The dose recommended for use by healthcare professionals is 0.01 mg/kg of body weight, to a maximum total dose of 0.5 mg, given by the intramuscular route' }),
  D({ secao: 'gerais', grupo: 'antidoto', id: 'fita-difenidramina', nome: 'Difenidramina', unidade: 'mg', porKg: true, faixa: [1, 1], maximo: 50,
    via: 'IV ou IM', pagina: 'diretriz chinesa de anafilaxia 2020', fontes: [CHINA_ANAFILAXIA_2020],
    trecho: 'diphenhydramine, 20–50 mg for adults, 1 mg/kg for children (up to a maximum of 50 mg)' }),
  D({ secao: 'gerais', grupo: 'respiratorio', id: 'fita-dexametasona-crupe', nome: 'Dexametasona — crupe', unidade: 'mg', porKg: true, faixa: [0.15, 0.6], maximo: 10,
    via: 'VO, IM ou IV, dose única', pagina: 'Cochrane 2018; teto: livro do ICr, p. 294', fontes: [COCHRANE_CRUPE_2018, LIVRO_PS_PED],
    trecho: 'Three studies compared 0.6 mg/kg to 0.15 mg/kg dosages of dexamethasone, a common clinical question.',
    nota: 'A Cochrane não define teto; o máximo de 10 mg é do livro do ICr (p. 294), decisão D9.' }),
  D({ secao: 'gerais', grupo: 'respiratorio', id: 'fita-magnesio-asma', nome: 'Sulfato de magnésio — asma grave', unidade: 'mg', porKg: true, faixa: [40, 40], maximo: 2000, porMl: 500, apresentacao: MG_50,
    via: 'IV em 20 min', pagina: 'Cochrane 2016 (BNFc)', fontes: [COCHRANE_MG_ASMA_2016],
    trecho: 'The British National Formulary for Children advises 40 mg/kg and up to a maximum total dose of 2 g, delivered by intravenous infusion over 20 minutes.',
    nota: 'Os estudos usaram de 25 a 75 mg/kg.' }),
  D({ secao: 'gerais', grupo: 'respiratorio', id: 'fita-salbutamol-nebulizacao', nome: 'Salbutamol — nebulização (asma grave)', unidade: 'mg', porKg: false, faixa: [2.5, 5],
    via: 'nebulização com oxigênio; até 3 vezes, a cada 20 a 30 min, na 1ª hora', pagina: 'Sociedade Italiana de Pediatria 2018', fontes: [INDINNIMEO_ASMA_2018],
    trecho: 'Children with severe asthma should receive frequent doses of nebulised bronchodilators (2.5 to 5 mg of salbutamol), driven by oxygen',
    nota: 'Dose fixa. Na crise leve, spray com espaçador: 200 a 400 µg (2 a 4 jatos) pela mesma diretriz.' }),
  D({ secao: 'gerais', grupo: 'antidoto', id: 'fita-ondansetrona-iv', nome: 'Ondansetrona IV — vômitos', unidade: 'mg', porKg: true, faixa: [0.15, 0.15], maximo: 8,
    via: 'IV em 2 min, dose única', pagina: 'Rerksuppaphol 2010, Methods', fontes: [RERKSUPPAPHOL_ONDANSETRONA_2010],
    trecho: 'single bolus of intravenous ondansetron … at the dose of 0.15 mg/kg up to the maximal dose of 8 mg over 2 min.' }),
  D({ secao: 'gerais', grupo: 'antidoto', id: 'fita-ondansetrona-vo-8a15', nome: 'Ondansetrona VO — vômitos', unidade: 'mg', porKg: false, faixa: [2, 2],
    via: 'VO, dose única', pagina: 'Sociedade Canadense de Pediatria 2011', fontes: [CPS_ONDANSETRONA_2011], condicao: so('8 a 15 kg', r('peso', '>=', 8), r('peso', '<=', 15)),
    trecho: '8 kg to 15 kg: 2 mg' }),
  D({ secao: 'gerais', grupo: 'antidoto', id: 'fita-ondansetrona-vo-15a30', nome: 'Ondansetrona VO — vômitos', unidade: 'mg', porKg: false, faixa: [4, 4],
    via: 'VO, dose única', pagina: 'Sociedade Canadense de Pediatria 2011', fontes: [CPS_ONDANSETRONA_2011], condicao: so('15 a 30 kg', r('peso', '>', 15), r('peso', '<=', 30)),
    trecho: '15 kg to 30 kg: 4 mg',
    nota: 'A fonte escreve as faixas com 15 kg nas duas; aqui 15 kg fica na faixa de 2 mg.' }),
  D({ secao: 'gerais', grupo: 'antidoto', id: 'fita-ondansetrona-vo-maior30', nome: 'Ondansetrona VO — vômitos', unidade: 'mg', porKg: false, faixa: [6, 8],
    via: 'VO, dose única', pagina: 'Sociedade Canadense de Pediatria 2011', fontes: [CPS_ONDANSETRONA_2011], condicao: so('> 30 kg', r('peso', '>', 30)),
    trecho: 'Greater than 30 kg: 6 mg to 8 mg' }),
  D({ secao: 'gerais', grupo: 'metabolico', id: 'fita-glucagon-menor20', nome: 'Glucagon — hipoglicemia', unidade: 'mg', porKg: false, faixa: [0.5, 0.5],
    via: 'IM ou SC', pagina: 'ISPAD 2022, "Glucagon"', fontes: [ISPAD_HIPOGLICEMIA_2022], condicao: so('< 20 kg', r('peso', '<', 20)),
    trecho: 'The recommended glucagon dose is weight based: 1 mg for adults and children >25 kg and 0.5 mg for children <25 kg (according to Novo Nordisk manufacture guidelines) while Eli Lilly uses a weight cut‐off of 20 kg.',
    nota: 'Dose fixa; corte de 20 kg (decisão D7).' }),
  D({ secao: 'gerais', grupo: 'metabolico', id: 'fita-glucagon-maior20', nome: 'Glucagon — hipoglicemia', unidade: 'mg', porKg: false, faixa: [1, 1],
    via: 'IM ou SC', pagina: 'ISPAD 2022, "Glucagon"', fontes: [ISPAD_HIPOGLICEMIA_2022], condicao: so('≥ 20 kg', r('peso', '>=', 20)),
    trecho: 'The recommended glucagon dose is weight based: 1 mg for adults and children >25 kg and 0.5 mg for children <25 kg (according to Novo Nordisk manufacture guidelines) while Eli Lilly uses a weight cut‐off of 20 kg.',
    nota: 'Dose fixa; corte de 20 kg (decisão D7).' }),
  D({ secao: 'gerais', grupo: 'neuro', id: 'fita-diazepam-iv', nome: 'Diazepam IV — crise epiléptica', unidade: 'mg', porKg: true, faixa: [0.15, 0.2], maximo: 10,
    via: 'IV; pode repetir 1 vez', pagina: 'AES 2016, Figura 1', fontes: [AES_2016],
    trecho: 'Intravenous diazepam (0.15-0.2 mg/kg/dose, max: 10 mg/dose, may repeat dose once, Level A)' }),
  D({ secao: 'gerais', grupo: 'isr', id: 'fita-morfina-iv', nome: 'Morfina IV — analgesia', unidade: 'mg', porKg: true, faixa: [0.05, 0.1],
    via: 'IV lento, a cada 4 a 6 h', pagina: 'Cunico 2023, tabela de doses', fontes: [CUNICO_DOR_2023],
    trecho: 'Intravenous bolus: 0.05–0.1 mg/kg 4–6 hourly (give slowly)' }),
  D({ secao: 'gerais', grupo: 'isr', id: 'fita-fentanil-menor6', nome: 'Fentanil IV — analgesia', unidade: 'µg', porKg: true, faixa: [0.3, 1.5],
    via: 'IV', pagina: 'Cunico 2023, seção 3.2.4', fontes: [CUNICO_DOR_2023], condicao: so('< 6 anos', r('anos', '<', 6)),
    trecho: 'In children <6 years, IV FE is given at 0.3–1.5 µg/kg/dose.' }),
  D({ secao: 'gerais', grupo: 'isr', id: 'fita-fentanil-maior6', nome: 'Fentanil IV — analgesia', unidade: 'µg', porKg: true, faixa: [1, 5],
    via: 'IV', pagina: 'Cunico 2023, seção 3.2.4', fontes: [CUNICO_DOR_2023], condicao: so('≥ 6 anos', r('anos', '>=', 6)),
    trecho: 'In children aged ≥6 years, it is administered at 1–5 µg/kg/dose.' }),
  D({ secao: 'gerais', grupo: 'antidoto', id: 'fita-naloxona', nome: 'Naloxona — intoxicação por opioide', unidade: 'mg', porKg: true, faixa: [0.1, 0.1], maximo: 2,
    via: 'IV/IO/ET', pagina: 'Coreia 2025, Tabela 2', fontes: [COREIA_PALS_2025, SANDELICH_OPIOIDE_2024],
    condicao: ou('< 5 anos ou < 20 kg', [r('anos', '<', 5)], [r('peso', '<', 20)]),
    trecho: '<5 yr or <20 kg: 0.1 mg/kg IV/IO/ET' }),
  D({ secao: 'gerais', grupo: 'antidoto', id: 'fita-naloxona-maior', nome: 'Naloxona — intoxicação por opioide', unidade: 'mg', porKg: false, faixa: [2, 2],
    via: 'IV/IO/ET', pagina: 'Coreia 2025, Tabela 2', fontes: [COREIA_PALS_2025],
    condicao: ou('≥ 5 anos ou ≥ 20 kg', [r('anos', '>=', 5)], [r('peso', '>=', 20)]),
    trecho: '≥5 yr or ≥20 kg: 2 mg IV/IO/ET' }),
  D({ secao: 'gerais', grupo: 'antidoto', id: 'fita-naloxona-baixa', nome: 'Naloxona — dose baixa (opioide terapêutico)', unidade: 'µg', porKg: true, faixa: [1, 5],
    via: 'IV, titulando até o efeito', pagina: 'Coreia 2025, Tabela 2', fontes: [COREIA_PALS_2025],
    trecho: 'Use lower doses to reverse respiratory depression associated with therapeutic opioid use (1–5 μg/kg titrate to effect)' }),
  D({ secao: 'gerais', grupo: 'antidoto', id: 'fita-carvao', nome: 'Carvão ativado', unidade: 'g', porKg: true, faixa: [1, 1], maximo: 50,
    via: 'VO ou SNG, ingestão recente', pagina: 'Sandelich 2024; teto: livro do ICr, p. 899', fontes: [SANDELICH_OPIOIDE_2024, LIVRO_PS_PED],
    trecho: 'Activated charcoal, 1 g/kg orally for recent ingestions.',
    nota: 'A fonte não dá teto; o máximo de 50 g é do livro do ICr (p. 899), decisão D9.' }),
  D({ secao: 'gerais', grupo: 'isr', id: 'fita-paracetamol', nome: 'Paracetamol', unidade: 'mg', porKg: true, faixa: [10, 15], maximo: 1000,
    via: 'VO', pagina: 'Niehues 2026', fontes: [NIEHUES_FEBRE_2026],
    trecho: 'The recommended single dose of paracetamol (10 to 15 mg/kg) should not be exceeded.',
    nota: 'Máximo de 1000 mg por dose.' }),
  D({ secao: 'gerais', grupo: 'isr', id: 'fita-ibuprofeno', nome: 'Ibuprofeno', unidade: 'mg', porKg: true, faixa: [7, 10], maximo: 600,
    via: 'VO', pagina: 'Niehues 2026', fontes: [NIEHUES_FEBRE_2026],
    trecho: 'The recommended single dose for ibuprofen (7 to 10 mg/kg) should not be exceeded.',
    nota: 'Máximo de 600 mg por dose (citado para > 12 anos) e 40 mg/kg/dia.' }),
]

/** Choques pelo peso (AHA 2025): desfibrilação 2 → 4 J/kg, até 10 J/kg; cardioversão 0,5–1 → 2 J/kg (D4). */
export type ChoquesDoPeso = {
  desfibrilacaoPrimeiro: number
  desfibrilacaoSeguinte: number
  desfibrilacaoTeto: number
  cardioversaoInicial: [number, number]
  cardioversaoSeguinte: number
}

export const TRECHOS_CHOQUE = {
  desfibrilacao: 'Subsequent shocks ≥4 J/kg, maximum 10 J/kg or adult dose',
  desfibrilacaoInicial: 'for ease of teaching, it is reasonable to use an initial dose of 2 J/kg.',
  cardioversao: 'it is reasonable to perform electrical synchronized cardioversion starting with a dose of 0.5 to 1 J/kg. If unsuccessful, increase the dose to 2 J/kg.',
  teto: 'Não passar de 10 J/kg nem da dose de adulto do aparelho.',
}

export function choquesDoPeso(pesoKg: number): ChoquesDoPeso | null {
  if (!Number.isFinite(pesoKg) || pesoKg <= 0) return null
  return {
    desfibrilacaoPrimeiro: 2 * pesoKg,
    desfibrilacaoSeguinte: 4 * pesoKg,
    desfibrilacaoTeto: 10 * pesoKg,
    cardioversaoInicial: [0.5 * pesoKg, 1 * pesoKg],
    cardioversaoSeguinte: 2 * pesoKg,
  }
}

/** De onde vem o peso da dose. Regra do RT: com peso informado, vale o peso; a cor só sem peso. */
export type PesoDaDose =
  | { origem: 'peso'; kg: number }
  | { origem: 'cor'; kg: number; cor: CorBroselow }
  | { origem: 'nenhum' }

export function pesoDaDose(pesoKg: number | null | undefined, corId?: CorBroselow['id'] | null): PesoDaDose {
  if (pesoKg != null && Number.isFinite(pesoKg) && pesoKg > 0) return { origem: 'peso', kg: pesoKg }
  const cor = corId ? CORES_BROSELOW.find((c) => c.id === corId) : undefined
  if (cor) return { origem: 'cor', kg: pesoDaCor(cor), cor }
  return { origem: 'nenhum' }
}

export type DoseDaFitaCalculada = { dose: DoseDaFita; calculo: DoseCalculada }

/** Todas as doses para o peso (e a idade em meses, quando a regra depende dela). */
export function dosesDoPeso(pesoKg: number, idadeMeses?: number, secao?: SecaoDaFita): DoseDaFitaCalculada[] {
  const lista = secao ? DOSES_DA_FITA.filter((d) => d.secao === secao) : DOSES_DA_FITA
  const out: DoseDaFitaCalculada[] = []
  for (const dose of lista) {
    const calculo = calcularBolus(dose, pesoKg, idadeMeses)
    if (calculo && calculo.aplica !== 'nao') out.push({ dose, calculo })
  }
  return out
}

/** Número para a tela (D12): vírgula decimal, sem ponto de milhar ("1200 mg", não "1.200 mg"). */
export function numeroDaDose(n: number): string {
  return numeroSemMilhar(n, n < 10 ? 2 : 1)
}
