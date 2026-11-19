import type { Fonte } from './ficha.ts'

// Fontes abertas no PubMed Central, lidas no texto integral em 16/11/2026 para
// os próximos passos do piloto das calculadoras (pedido do RT: "use o plugin
// da PubMed para colocar os dados"). Cada uma entra na ficha que a usa.

// ---------------------------------------------------------------- Glasgow / TCE

export const BTF_PREHOSPITALAR_2023: Fonte = {
  citacao: 'Hawryluk GWJ, Lulla A, Bell R, et al. Guidelines for Prehospital Management of Traumatic Brain Injury 3rd Edition: Executive Summary. Neurosurgery. 2023;93(6):e159–e169 (PMID 37750693; PMC10627685). Diretriz pré-hospitalar da Brain Trauma Foundation; Tabelas 1 e 2.',
  url: 'https://doi.org/10.1227/neu.0000000000002672',
}

export const SNC_2013: Fonte = {
  citacao: 'Undén J, Ingebrigtsen T, Romner B; Scandinavian Neurotrauma Committee. Scandinavian guidelines for initial management of minimal, mild and moderate head injuries in adults: an evidence and consensus-based update. BMC Med. 2013;11:50 (PMID 23432764; PMC3621842). Resultados, recomendações das questões 1 e 2 (GRADE).',
  url: 'https://doi.org/10.1186/1741-7015-11-50',
}

export const SNC_2026: Fonte = {
  citacao: 'Yang LJ, Undén J, Fletcher-Sandersjöö A, et al. The Scandinavian Neurotrauma Committee 2026 guidelines for initial management of minimal, mild and moderate head injuries in adults. Lancet Reg Health Eur. 2026;72:101911 (PMID 43034829; PMC13769473). Lida a justificativa das recomendações 3 e 5; a tabela das recomendações não veio no texto do PMC.',
  url: 'https://doi.org/10.1016/j.lanepe.2026.101911',
}

export const WSES_TCE_2019: Fonte = {
  citacao: 'Picetti E, Rossi S, Abu-Zidan FM, et al. WSES consensus conference guidelines: monitoring and management of severe adult traumatic brain injury patients with polytrauma in the first 24 hours. World J Emerg Surg. 2019;14:53 (PMID 31798673; PMC6884766). Recomendações 2 e 3 (Delphi, sem graduação).',
  url: 'https://doi.org/10.1186/s13017-019-0270-1',
}

// ---------------------------------------------------------------- doses pediátricas por peso

export const ILCOR_PLS_2020: Fonte = {
  citacao: 'Maconochie IK, Aickin R, Hazinski MF, et al. Pediatric Life Support: 2020 International Consensus on Cardiopulmonary Resuscitation and Emergency Cardiovascular Care Science With Treatment Recommendations. Resuscitation. 2020;156:A120–A155 (PMID 33098916; PMC7576321). PLS 420, métodos de cálculo da dose (recomendações mantidas de 2010, sem graduação).',
  url: 'https://doi.org/10.1016/j.resuscitation.2020.09.013',
  pediatrica: true,
}

export const WELLS_YENDE_DOSE: Fonte = {
  citacao: 'Wells M, Yende P. Is there evidence that length-based tapes with precalculated drug doses increase the accuracy of drug dose calculations in children? A systematic review. Clin Exp Emerg Med. 2024;11(2):145–160 (PMID 38018070; PMC11237260). Conclusões (sem graduação; qualidade dos estudos baixa).',
  url: 'https://doi.org/10.15441/ceem.23.110',
  pediatrica: true,
}

// ---------------------------------------------------------------- hipocalemia

// Não há diretriz de sociedade com texto aberto no PMC (KDIGO 2020 fechada; ERC
// 2021 só em alemão). Fica a revisão narrativa, sem graduação, por pedido do
// RT de 16/11/2026 (usar o PubMed). A Tabela 3 não entrou: não veio no texto.
export const KARDALAS_HIPOK_2018: Fonte = {
  citacao: 'Kardalas E, Paschou SA, Anagnostis P, et al. Hypokalemia: a clinical update. Endocr Connect. 2018;7(4):R135–R146 (PMID 29540487; PMC5881435). Revisão narrativa, sem graduação: ECG, tratamento, magnésio e excreção urinária de potássio.',
  url: 'https://doi.org/10.1530/EC-18-0109',
}

// ---------------------------------------------------------------- síndrome coronariana sem supra

// A ESC 2023 de SCA não está no PMC; a diretriz brasileira de 2021 está.
export const SBC_SCASSST_2021: Fonte = {
  citacao: 'Nicolau JC, Feitosa Filho GS, Petriz JL, et al. Diretrizes da Sociedade Brasileira de Cardiologia sobre Angina Instável e Infarto Agudo do Miocárdio sem Supradesnível do Segmento ST – 2021. Arq Bras Cardiol. 2021;117(1):181–264 (PMID 34320090; PMC8294740). Estratificação de risco (5.3), estratégia invasiva (6.1) e revascularização; texto integral lido no PMC em 16/11/2026.',
  url: 'https://doi.org/10.36660/abc.20210180',
}

// ---------------------------------------------------------------- AIT

// A declaração da AHA de 2023 (AIT no pronto-socorro) não está no PMC; a ESO 2021 está.
export const ESO_AIT_2021: Fonte = {
  citacao: 'Fonseca AC, Merwick Á, Dennis M, et al. European Stroke Organisation (ESO) guidelines on management of transient ischaemic attack. Eur Stroke J. 2021;6(2):CLXIII–CLXXXVI (PMID 34414299; PMC8370080). GRADE; PICO 1.1, 4.1, 6.1 e 8.1, texto integral lido no PMC em 16/11/2026.',
  url: 'https://doi.org/10.1177/2396987321992905',
}

// ---------------------------------------------------------------- doses da fita e da parada

// Lote D11 (RT em 19/11/2026, "Todas A"): estas fontes eram de dosesDaFita.ts e
// cronometroParada.ts. Vieram para cá porque rcp.ts, bolus.ts e adulto/pcr.ts
// passam a citá-las, e esses arquivos são importados por aqueles (importação
// circular). Os arquivos de origem reexportam cada uma, com o mesmo objeto.
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

export const ISPAD_HIPOGLICEMIA_2022: Fonte = {
  citacao: 'Abraham MB, et al. ISPAD Clinical Practice Consensus Guidelines 2022: Assessment and management of hypoglycemia in children and adolescents with diabetes. Pediatr Diabetes. 2022;23(8):1322–1340 (PMID 36537534, PMC10107518). Seção "Glucagon".',
  url: pmc('PMC10107518'),
  pediatrica: true,
}

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

export const COREIA_CIRCUNSTANCIAS_2025: Fonte = {
  citacao: 'Korean Guidelines for Cardiopulmonary Resuscitation 2025: Part 5. Special circumstances. Clin Exp Emerg Med. 2026 (PMC13277411).',
  url: pmc('PMC13277411'),
}

export const ERC_CIRCUNSTANCIAS_2021: Fonte = {
  citacao: 'Lott C, et al. Kreislaufstillstand unter besonderen Umständen (ERC Leitlinien 2021, tradução alemã de "Cardiac arrest in special circumstances"). Notf Rett Med. 2021;24(4):447–523 (PMID 34127910, PMC8190767).',
  url: pmc('PMC8190767'),
}
