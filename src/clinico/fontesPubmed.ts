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
