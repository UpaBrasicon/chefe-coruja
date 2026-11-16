import { DIRETRIZ_AVC_2026 } from './adulto/avcTrombolise.ts'
import { DIRETRIZ_EI } from './adulto/duke.ts'
import { DIRETRIZ_HDA } from './adulto/hemorragiaDigestiva.ts'
import { DIRETRIZ_TEP_2026 } from './adulto/tep2026.ts'
import { DIRETRIZ_PLEURA_2023 } from './escores/light.ts'
import { DIRETRIZ_DAS_2025 } from './adulto/isr.ts'
import { NOTAS_PADIS_2025 } from './adulto/infusoes.ts'
import { COSTR_2026_PCR, DIRETRIZ_ALS_2025 } from './adulto/pcr.ts'
import { DIRETRIZES_2026 } from './adulto/ressuscitacaoVolemica.ts'
import { DIRETRIZ_DOR_TORACICA_2025 } from './escores/heart.ts'
import type { Guia, ItemGuia, PassoGuia } from './guia.ts'

// Guias das ferramentas do piloto, pelo id da ficha (RT, 16/11/2026: próximos
// passos = o que a fonte citada recomenda, com classe e página). Toda frase
// sai de fonte que a ficha já cita:
// - HEART: linhas da diretriz brasileira de dor torácica de 2025 (heart.ts);
// - sepse: linhas da SSC 2026 e do ILAS jul/2026 (ressuscitacaoVolemica.ts),
//   lidas no texto em 28/09/2026;
// - CURB-65: ATS/IDSA 2019 (Metlay et al.), lida no texto integral do PMC
//   (PMC6812437) em 16/11/2026; o PMC não traz a página, vai a questão.
// Glasgow e doses pediátricas: fontes abertas no PMC (fontesPubmed.ts), pedido
// do RT de 16/11/2026.

type Faixas = (0 | 1 | 2)[]

const SBC = 'SBC 2025 — Diretriz Brasileira de Dor Torácica na Unidade de Emergência'

function linhaSbc(tema: string, faixas?: Faixas): PassoGuia {
  const l = DIRETRIZ_DOR_TORACICA_2025.find((d) => d.tema === tema)
  if (!l) throw new Error(`linha da SBC 2025 sem tema "${tema}"`)
  return { tema, texto: l.diretriz, ref: { fonte: SBC, grau: l.grau }, faixas }
}

/** Uma linha da tabela SSC 2026 × ILAS vira até dois passos, um por fonte. */
function linhaSepse(tema: string, faixas?: Faixas): PassoGuia[] {
  const l = DIRETRIZES_2026.find((d) => d.tema === tema)
  if (!l) throw new Error(`linha SSC/ILAS sem tema "${tema}"`)
  const out: PassoGuia[] = []
  if (l.ssc) out.push({ tema: `${tema} — SSC 2026`, texto: l.ssc.texto, ref: { fonte: 'Surviving Sepsis Campaign 2026', pagina: l.ssc.pagina }, faixas })
  if (l.ilas) out.push({ tema: `${tema} — ILAS`, texto: l.ilas.texto, ref: { fonte: 'ILAS, protocolo de sepse do adulto, jul/2026', pagina: l.ilas.pagina }, faixas })
  return out
}

function linhaDas(tema: string): PassoGuia {
  const l = DIRETRIZ_DAS_2025.find((d) => d.tema === tema)
  if (!l) throw new Error(`linha da DAS 2025 sem tema "${tema}"`)
  return { tema, texto: l.das, ref: { fonte: 'Difficult Airway Society 2025', pagina: l.onde, grau: 'consenso, sem classe' } }
}

function linhaAha(tema: string): PassoGuia {
  const l = DIRETRIZ_ALS_2025.find((d) => d.tema === tema)
  if (!l) throw new Error(`linha da AHA 2025 sem tema "${tema}"`)
  return { tema: `${tema} — AHA 2025`, texto: l.aha, ref: { fonte: 'AHA 2025, Part 9 (suporte avançado do adulto)', pagina: l.onde } }
}

function linhaCostr(tema: string): PassoGuia {
  const l = COSTR_2026_PCR.find((d) => d.tema === tema)
  if (!l) throw new Error(`linha do CoSTR 2026 sem tema "${tema}"`)
  return { tema: `${tema} — CoSTR 2026`, texto: l.recomendacao, ref: { fonte: 'ILCOR CoSTR 2026', pagina: l.codigo, grau: l.forca } }
}

function linhaPadis(tema: string, faixas?: Faixas): PassoGuia {
  const l = NOTAS_PADIS_2025.find((d) => d.tema === tema)
  if (!l) throw new Error(`linha da PADIS 2025 sem tema "${tema}"`)
  return { tema: `${tema} — PADIS 2025`, texto: l.texto, ref: { fonte: 'SCCM PADIS 2025 (atualização focada)', grau: l.forca }, faixas }
}

const ATS_IDSA = 'ATS/IDSA 2019 — pneumonia adquirida na comunidade no adulto (Metlay et al.)'
const atsIdsa = (questao: string, grau?: string) => ({ fonte: ATS_IDSA, pagina: questao, grau })

const CURB65_ARMADILHAS: ItemGuia[] = [
  { texto: 'O PSI e o CURB-65 não foram desenhados para escolher o nível de cuidado de quem já está internado por pneumonia.', ref: atsIdsa('questão 7, resumo da evidência') },
]

const CURB65_EVIDENCIAS: ItemGuia[] = [
  { texto: 'Comparado ao CURB-65, o PSI classifica mais pacientes como baixo risco e discrimina melhor a mortalidade.', ref: atsIdsa('questão 6, resumo da evidência') },
  { texto: 'Há menos evidência de que o CURB-65 funcione como apoio à decisão do local do tratamento; a recomendação condicional pesa a simplicidade de uso.', ref: atsIdsa('questão 6, resumo da evidência e justificativa') },
]

const ICR = 'Pronto-Socorro de Pediatria ICr-HCFMUSP, 4ª ed., cap. 32 (diarreia aguda)'

// Glasgow: fontes do TCE abertas no PMC (lidas em 16/11/2026). Valem para o
// trauma de crânio; a faixa do escore é a do próprio Glasgow (13–15, 9–12, 3–8).
const BTF = 'Brain Trauma Foundation 2023, diretriz pré-hospitalar do TCE'
const SNC13 = 'Scandinavian Neurotrauma Committee 2013 (TCE mínimo, leve e moderado no adulto)'
const SNC26 = 'Scandinavian Neurotrauma Committee 2026'
const WSES = 'WSES 2019 (TCE grave com politrauma, primeiras 24 h)'

// Doses pediátricas por peso: ILCOR 2020 (PLS 420) e Wells 2017 e 2024, abertos no PMC.
const ILCOR_PLS = 'ILCOR 2020, Pediatric Life Support (PLS 420)'
const WELLS17 = 'Wells, Goldstein e Bentley 2017, revisão sistemática (texto integral, PMC5608658)'
const WELLS24 = 'Wells e Yende 2024, revisão sistemática'

// Hipocalemia: revisão narrativa aberta no PMC (sem diretriz de sociedade aberta).
const KARDALAS = 'Kardalas et al. 2018, revisão narrativa (Endocr Connect)'

// Fibrilação atrial: diretriz brasileira SBC/SOBRAC 2025, texto integral do PMC
// (PMC13400077), Quadro 5 (seção 6.2). A ESC 2024 não está no PMC.
const SBC_FA = 'Diretriz Brasileira de Fibrilação Atrial 2025 (SBC/SOBRAC), Quadro 5'

// SCA sem supra: diretriz da SBC 2021, texto integral do PMC (PMC8294740).
const SBC_SCA = 'Diretriz da SBC sobre angina instável e IAM sem supra de ST, 2021'
const SCA_MUITO_ALTO: PassoGuia = {
  tema: 'Muito alto risco: cateterismo imediato',
  texto: 'Cineangiocoronariografia imediata (intervenção em até 2 h) com instabilidade hemodinâmica ou choque cardiogênico, angina recorrente ou persistente refratária ao tratamento clínico, arritmia ventricular maligna ou PCR, complicação mecânica, insuficiência cardíaca aguda ou alterações dinâmicas recorrentes de ST/T.',
  ref: { fonte: SBC_SCA, pagina: 'estratégia invasiva de urgência (6.1) e Tabela 1.8', grau: 'classe I, nível A' },
}
const SCA_ESTRATIFICAR: PassoGuia = {
  tema: 'Estratificar por mais de um método',
  texto: 'Classificar todo paciente em risco alto, intermediário ou baixo, de preferência por mais de um método, e decidir pelo pior cenário.',
  ref: { fonte: SBC_SCA, pagina: 'estratificação de risco (5.3)', grau: 'classe I, nível B' },
}
const SCA_ALTO_24H: PassoGuia = {
  tema: 'Alto risco: cateterismo em até 24 h',
  texto: 'Cineangiocoronariografia precoce, em até 24 h, no alto risco (troponina positiva, alteração dinâmica de ST/T ou GRACE acima de 140).',
  ref: { fonte: SBC_SCA, pagina: 'estudo hemodinâmico, sumário de recomendações', grau: 'classe I, nível A' },
}
const SCA_INTERMEDIARIO_72H: PassoGuia = {
  tema: 'Risco intermediário: cateterismo em até 72 h',
  texto: 'Cineangiocoronariografia em até 72 h no risco intermediário, com recorrência de sintomas ou com teste não invasivo positivo para isquemia.',
  ref: { fonte: SBC_SCA, pagina: 'estudo hemodinâmico, sumário de recomendações', grau: 'classe I, nível C' },
}

function linhaEi(tema: string, faixas?: Faixas): PassoGuia {
  const l = DIRETRIZ_EI.find((d) => d.tema === tema)
  if (!l) throw new Error(`linha da ESC 2023 de endocardite sem tema "${tema}"`)
  return { tema, texto: l.diretriz, ref: { fonte: 'ESC 2023, endocardite infecciosa', grau: l.grau }, faixas }
}

// Síncope: validação multicêntrica do escore canadense (JAMA Intern Med 2020),
// já citada na ficha e aberta no PMC (PMC7091474). Conclusão do estudo, não diretriz.
const CSRS_2020 = 'Thiruganasambandamoorthy et al. 2020, validação do escore canadense (JAMA Intern Med)'

// TEP: diretriz AHA/ACC 2026 já lida e citada (tep2026.ts). Light: BTS 2023 (light.ts).
function linhaTep(tema: string, faixas?: Faixas): PassoGuia {
  const l = DIRETRIZ_TEP_2026.find((d) => d.tema === tema)
  if (!l) throw new Error(`linha da AHA/ACC 2026 de TEP sem tema "${tema}"`)
  return { tema, texto: l.aha, ref: { fonte: 'AHA/ACC 2026, embolia pulmonar aguda', pagina: l.onde, grau: l.classe === 'figura' ? 'fluxograma da diretriz' : `classe ${l.classe}` }, faixas }
}
function linhaPleura(tema: string, faixas?: Faixas): PassoGuia {
  const l = DIRETRIZ_PLEURA_2023.find((d) => d.tema === tema)
  if (!l) throw new Error(`linha da BTS 2023 sem tema "${tema}"`)
  return { tema, texto: l.diretriz, ref: { fonte: 'BTS 2023, doença pleural', grau: l.grau }, faixas }
}
const TEP_DIAGNOSTICO = (alta: Faixas, naoAlta: Faixas): PassoGuia[] => [
  linhaTep('PERC', [0]),
  linhaTep('D-dímero ajustado pela idade', naoAlta),
  linhaTep('YEARS', naoAlta),
  linhaTep('Exame de imagem'),
  linhaTep('Início da anticoagulação', alta),
  linhaTep('Gestante'),
]

// TVP: ASH 2018 (diagnóstico de TEV), já citada na ficha e lida no texto integral do PMC (PMC6258916).
const ASH_TEV = 'ASH 2018, diagnóstico de tromboembolismo venoso'
// CRB-65: McNally 2010 (PMC2944951), já citada; a conduta por faixa só está numa figura (imagem) e a BTS 2009 não está no PMC.
const MCNALLY = 'McNally et al. 2010, revisão sistemática do CRB-65 (Br J Gen Pract)'

// AVC: diretriz AHA/ASA 2026 já lida e guardada em avcTrombolise.ts (classe e página do PDF).
function linhaAvc(tema: string, faixas?: Faixas): PassoGuia {
  const l = DIRETRIZ_AVC_2026.find((d) => d.tema === tema)
  if (!l) throw new Error(`linha da AHA/ASA 2026 sem tema "${tema}"`)
  return { tema, texto: l.texto, ref: { fonte: 'AHA/ASA 2026, AVC isquêmico agudo', pagina: l.pagina, grau: l.classe }, faixas }
}

// AIT: ESO 2021 (PMC8370080); a declaração da AHA 2023 não está no PMC.
const ESO_AIT = 'ESO 2021, ataque isquêmico transitório'

// Hemorragia digestiva alta: ESGE 2026 (úlcera) e Baveno VIII (varizes), já lidas (hemorragiaDigestiva.ts).
function linhaHda(tema: string, faixas?: Faixas): PassoGuia {
  const l = DIRETRIZ_HDA.find((d) => d.tema === tema)
  if (!l) throw new Error(`linha de HDA sem tema "${tema}"`)
  return { tema, texto: l.diretriz, ref: { fonte: l.fonte === 'ESGE 2026' ? 'ESGE 2026, hemorragia digestiva alta não varicosa' : 'Baveno VIII, hipertensão portal', grau: l.grau }, faixas }
}
const HDA_INICIAL = (risco: Faixas): PassoGuia[] => [
  linhaHda('Transfusão (úlcera)', risco),
  linhaHda('IBP antes da EDA', risco),
  linhaHda('Eritromicina antes da EDA (úlcera)', risco),
  linhaHda('Intubação antes da EDA (úlcera)', risco),
  linhaHda('Tempo da EDA (úlcera)', risco),
  linhaHda('Tempo da EDA (varizes)', risco),
]

// Pancreatite aguda: iLATAM-AP 2026 (Tabela 1) e WSES 2019 (pancreatite grave), lidas no PMC
// em 16/11/2026. O IAP 2025 e a AGA 2018 não estão abertos no PMC.
const ILATAM = 'iLATAM-AP 2026, pancreatite aguda'
const WSES_PA = 'WSES 2019, pancreatite aguda grave'
const PANCREATITE_GERAL: PassoGuia[] = [
  { tema: 'Volume', texto: 'Reposição moderada de volume, 1,5 mL/kg/h, com bolus opcional de 10 mL/kg no paciente hipovolêmico. Reavaliar o estado hemodinâmico com frequência: o excesso de volume faz mal.', ref: { fonte: ILATAM, pagina: 'Tabela 1, volume', grau: 'forte, qualidade alta' } },
  { tema: 'Tipo de solução', texto: 'Ringer lactato é a solução preferida.', ref: { fonte: ILATAM, pagina: 'Tabela 1, volume', grau: 'forte, qualidade moderada' } },
  { tema: 'Dieta oral precoce', texto: 'Dieta oral precoce (antes de 24–48 h) em todos os casos, se tolerada; na pancreatite leve, pode começar logo com dieta branda ou sólida. Sem tolerância depois de 3–4 dias, nutrição enteral por sonda; parenteral só quando as outras vias falharem.', ref: { fonte: ILATAM, pagina: 'Tabela 1, nutrição', grau: 'forte, qualidade moderada' } },
  { tema: 'Sem antibiótico profilático', texto: 'Antibiótico profilático de rotina não é recomendado, nem na pancreatite necrosante; usar só na infecção bacteriana confirmada ou suspeita.', ref: { fonte: ILATAM, pagina: 'Tabela 1, antibióticos', grau: 'forte, qualidade alta' } },
  { tema: 'UTI', texto: 'UTI cedo para falência orgânica que não responde à reposição inicial ou para necrose infectada com repercussão sistêmica; falência orgânica persistente (mais de 48 h) também é manejada na UTI.', ref: { fonte: ILATAM, pagina: 'Tabela 1, nível de cuidado', grau: 'forte, qualidade moderada' } },
  { tema: 'Ultrassom na admissão', texto: 'Ultrassom na admissão para definir a causa (biliar).', ref: { fonte: WSES_PA, pagina: 'Statements, imagem', grau: '1C' } },
  { tema: 'TC com contraste', texto: 'Na pancreatite grave, TC com contraste ou RM; o melhor momento da primeira TC é 72–96 h depois do início dos sintomas.', ref: { fonte: WSES_PA, pagina: 'Statements, imagem', grau: '1C' } },
  { tema: 'CPRE', texto: 'CPRE de rotina na pancreatite biliar não é indicada; CPRE urgente (até 24 h) quando há colangite. Com coledocolitíase sem colangite, a CPRE pode esperar.', ref: { fonte: ILATAM, pagina: 'Tabela 1, CPRE; WSES 2019 1A e 1B', grau: 'forte, qualidade alta' } },
  { tema: 'Colecistectomia', texto: 'Na pancreatite biliar leve, colecistectomia videolaparoscópica na mesma internação; nos casos moderadamente graves a graves, adiar até 8 semanas depois da alta ou até resolver as complicações locais.', ref: { fonte: ILATAM, pagina: 'Tabela 1, colecistectomia', grau: 'forte, moderada (leve); condicional, baixa (grave)' } },
]

// Apendicite aguda: WSES 2020 (Jerusalém), lida no PMC em 16/11/2026.
const WSES_AA = 'WSES 2020, apendicite aguda'

// UTI: NEWS2 pelo relatório do RCP 2017 (PDF lido em 16/11/2026; recomendações do grupo de
// trabalho, sem graduação); RASS e CAM-ICU pela PADIS 2018 e pela atualização de 2025 (texto
// integral gratuito na LWW, lido em 16/11/2026); SOFA-2 pelo artigo (PMC) e pela Sepsis-3 (PMC).
const RCP_NEWS2 = 'RCP 2017, NEWS2'
const SEM_GRAU_RCP = 'recomendação do grupo de trabalho, sem graduação'
const PADIS_2018 = 'SCCM PADIS 2018'

export const GUIAS: Record<string, Guia> = {
  news2: {
    proximosPassos: [
      { tema: 'Total 0 a 4', texto: 'Total 0: sinais vitais pelo menos a cada 12 h. Total 1 a 4: pelo menos a cada 4–6 h; avisar o enfermeiro, que avalia e decide se aumenta a frequência ou escala o cuidado.', ref: { fonte: RCP_NEWS2, pagina: 'Chart 4, p. 39', grau: SEM_GRAU_RCP }, faixas: [0] },
      { tema: '3 em um parâmetro', texto: 'Sinais vitais pelo menos de hora em hora; a equipe médica revê o paciente com urgência, busca a causa e decide se escala o cuidado.', ref: { fonte: RCP_NEWS2, pagina: 'Chart 4, p. 39; recomendação 12', grau: SEM_GRAU_RCP }, faixas: [1] },
      { tema: 'Total 5 ou 6: resposta urgente', texto: 'Sinais vitais pelo menos de hora em hora; avisar a equipe médica na hora; avaliação urgente por médico ou equipe com competência no paciente agudo, que decide se chama a equipe de cuidados críticos; cuidado em ambiente com monitorização.', ref: { fonte: RCP_NEWS2, pagina: 'Chart 4, p. 39; recomendação 12', grau: SEM_GRAU_RCP }, faixas: [1] },
      { tema: 'Total 7 ou mais: resposta de emergência', texto: 'Monitorização contínua dos sinais vitais; avaliação de emergência por equipe com competência em cuidados críticos, incluindo manejo avançado de via aérea; considerar a transferência para unidade de cuidado intermediário ou UTI.', ref: { fonte: RCP_NEWS2, pagina: 'Chart 4, p. 39; recomendação 12', grau: SEM_GRAU_RCP }, faixas: [2] },
      { tema: 'Infecção e NEWS de 5 ou mais', texto: 'Com infecção confirmada ou suspeita, ou risco de infecção, NEWS de 5 ou mais levanta a suspeita de sepse e pede resposta clínica urgente por equipe competente no manejo da sepse.', ref: { fonte: RCP_NEWS2, pagina: 'p. 30', grau: SEM_GRAU_RCP }, faixas: [1, 2] },
    ],
    armadilhas: [
      { texto: 'A preocupação clínica com o paciente sempre prevalece sobre o NEWS quando o profissional julga necessário escalar o cuidado.', ref: { fonte: RCP_NEWS2, pagina: 'p. 37', grau: SEM_GRAU_RCP } },
    ],
  },
  rass: {
    proximosPassos: [
      { tema: 'Sedação leve', texto: 'No adulto grave em ventilação mecânica, sedação leve em vez de profunda.', ref: { fonte: PADIS_2018, pagina: 'Agitação/sedação, sedação leve', grau: 'condicional, qualidade baixa' } },
      { tema: 'Interrupção diária ou protocolo', texto: 'Interrupção diária da sedação ou sedação protocolada pela enfermagem alcançam e mantêm a sedação leve; mirar sedação leve, não profunda, salvo indicação clínica de sedação mais profunda.', ref: { fonte: PADIS_2018, pagina: 'Interrupção diária / sedação protocolada', grau: 'sem graduação' }, faixas: [1, 2] },
      { tema: 'Qual sedativo', texto: 'No adulto grave em ventilação mecânica, propofol ou dexmedetomidina em vez de benzodiazepínico.', ref: { fonte: PADIS_2018, pagina: 'Escolha do sedativo', grau: 'condicional, qualidade baixa' } },
      linhaPadis('Dexmedetomidina × propofol'),
    ],
    armadilhas: [
      { texto: 'Não há definição universal de sedação leve: RASS de −2 a +1 foi a faixa usada como sedação leve nos estudos avaliados, não uma meta graduada.', ref: { fonte: PADIS_2018, pagina: 'Sedação leve, justificativa', grau: 'sem graduação' } },
    ],
  },
  'cam-icu': {
    proximosPassos: [
      { tema: 'Rastreio regular', texto: 'Avaliar delirium regularmente no adulto grave com ferramenta validada (CAM-ICU ou ICDSC).', ref: { fonte: PADIS_2018, pagina: 'Delirium, avaliação', grau: 'boa prática, sem graduação' } },
      { tema: 'Não avaliável', texto: 'O nível de alerta pode influenciar a avaliação com a ferramenta de rastreio; não descartar o significado clínico do delirium nesse cenário.', ref: { fonte: PADIS_2018, pagina: 'Nível de alerta e avaliação', grau: 'sem graduação' }, faixas: [1] },
      { tema: 'Medidas não farmacológicas', texto: 'Intervenção não farmacológica com vários componentes: reduzir fatores de risco modificáveis, melhorar a cognição e otimizar sono, mobilidade, audição e visão.', ref: { fonte: PADIS_2018, pagina: 'Delirium, prevenção e tratamento não farmacológicos', grau: 'condicional, qualidade baixa' } },
      { tema: 'Sem prevenção farmacológica', texto: 'Não usar haloperidol, antipsicótico atípico, dexmedetomidina, estatina ou cetamina para prevenir delirium em todos os adultos graves.', ref: { fonte: PADIS_2018, pagina: 'Delirium, prevenção e tratamento farmacológicos', grau: 'condicional, qualidade muito baixa a baixa' }, faixas: [0] },
      linhaPadis('Antipsicótico no delirium', [2]),
      { tema: 'Agitação que impede o desmame', texto: 'Dexmedetomidina para o delirium do adulto em ventilação mecânica quando a agitação impede o desmame ou a extubação.', ref: { fonte: PADIS_2018, pagina: 'Delirium, prevenção e tratamento farmacológicos', grau: 'condicional, qualidade baixa' }, faixas: [2] },
    ],
  },
  'sofa-2': {
    armadilhas: [
      { texto: 'O SOFA-2 descreve a disfunção orgânica no adulto em UTI; foi desenvolvido e validado só na UTI, e o uso fora dela (pronto-socorro, pediatria) ainda precisa de estudo.', ref: { fonte: 'Ranzani et al., JAMA 2025 (SOFA-2)', pagina: 'conclusões e limitações', grau: 'sem graduação' } },
      { texto: 'A regra de sepse (aumento agudo de 2 pontos ou mais) foi definida pela Sepsis-3 para o SOFA original; o artigo do SOFA-2 não a reescreve. O SOFA não serve como ferramenta de manejo, e sim para caracterizar o paciente séptico.', ref: { fonte: 'Sepsis-3, JAMA 2016', pagina: 'Quadro 3 e critérios clínicos', grau: 'consenso' } },
    ],
  },
  bisap: {
    proximosPassos: [
      { tema: 'BISAP de 3 ou mais: cuidado intermediário', texto: 'Pancreatite grave prevista (BISAP de 3 ou mais, SIRS persistente): internar em unidade de cuidado intermediário; sem essa unidade, monitorização próxima.', ref: { fonte: ILATAM, pagina: 'Tabela 1, nível de cuidado', grau: 'forte, qualidade moderada' }, faixas: [2] },
      ...PANCREATITE_GERAL,
    ],
    armadilhas: [
      { texto: 'BISAP e SIRS persistente são recomendados para a predição precoce pela simplicidade, mas a acurácia é limitada.', ref: { fonte: ILATAM, pagina: 'Tabela 1, predição', grau: 'forte, qualidade baixa' } },
    ],
  },
  ranson: {
    proximosPassos: PANCREATITE_GERAL,
    armadilhas: [
      { texto: 'Para a predição precoce, a iLATAM-AP recomenda BISAP e SIRS persistente; nenhuma das duas diretrizes traz recomendação ligada ao Ranson.', ref: { fonte: ILATAM, pagina: 'Tabela 1, predição', grau: 'forte, qualidade baixa' } },
    ],
  },
  alvarado: {
    proximosPassos: [
      { tema: 'Escore para excluir', texto: 'Usar escore clínico para excluir apendicite e achar o paciente de risco intermediário que precisa de imagem.', ref: { fonte: WSES_AA, pagina: 'Q.1.1', grau: 'forte, qualidade alta (1A)' } },
      { tema: 'Risco intermediário: imagem', texto: 'No risco intermediário, imagem em tempo oportuno e de forma sistemática.', ref: { fonte: WSES_AA, pagina: 'Q.1.5', grau: 'fraca, qualidade moderada (2B)' }, faixas: [1] },
      { tema: 'Ultrassom primeiro', texto: 'Se a imagem está indicada, ultrassom à beira do leito (POCUS) é a primeira escolha, em adultos e crianças.', ref: { fonte: WSES_AA, pagina: 'Q.1.5', grau: 'forte, qualidade moderada (1B)' }, faixas: [1, 2] },
      { tema: 'Ultrassom negativo: TC de baixa dose', texto: 'Com ultrassom negativo, TC com contraste de baixa dose em vez da dose padrão.', ref: { fonte: WSES_AA, pagina: 'Q.1.5', grau: 'forte, qualidade alta (1A)' }, faixas: [1, 2] },
      { tema: 'Alto risco abaixo de 40 anos', texto: 'No alto risco abaixo de 40 anos (Alvarado 9–10, AIR 9–12 ou AAS de 16 ou mais), a TC pode ser dispensada antes da laparoscopia diagnóstica ou terapêutica.', ref: { fonte: WSES_AA, pagina: 'Q.1.5', grau: 'fraca, qualidade moderada (2B)' }, faixas: [2] },
      { tema: 'Antibiótico sem cirurgia', texto: 'Na apendicite não complicada sem apendicolito, discutir o tratamento não operatório com antibiótico como alternativa segura à cirurgia em pacientes selecionados, avisando do risco de falha e de apendicite complicada não reconhecida. Nesse caso, antibiótico venoso no início e depois oral, conforme a evolução.', ref: { fonte: WSES_AA, pagina: 'Q.2.1 e Q.2.3', grau: 'forte, qualidade alta (1A); 1B' }, faixas: [2] },
      { tema: 'Cirurgia em até 24 h', texto: 'Quando a cirurgia está indicada, não adiar a apendicectomia além de 24 h da admissão.', ref: { fonte: WSES_AA, pagina: 'Q.3.1', grau: 'forte, qualidade moderada (1B)' }, faixas: [2] },
      { tema: 'Via laparoscópica', texto: 'Apendicectomia videolaparoscópica preferida à aberta, na apendicite não complicada e complicada, onde há equipamento e experiência.', ref: { fonte: WSES_AA, pagina: 'Q.4.1', grau: 'forte, qualidade alta (1A)' }, faixas: [2] },
      { tema: 'Antibiótico profilático', texto: 'Dose única pré-operatória de antibiótico de amplo espectro; sem antibiótico pós-operatório na apendicite não complicada.', ref: { fonte: WSES_AA, pagina: 'Q.7.1', grau: 'forte, qualidade alta (1A)' }, faixas: [2] },
    ],
    armadilhas: [
      { texto: 'Não usar o Alvarado para confirmar a suspeita de apendicite em adultos: serve para excluir e estratificar.', ref: { fonte: WSES_AA, pagina: 'Q.1.1', grau: 'fraca contra, qualidade moderada (2B)' } },
    ],
  },
  'glasgow-blatchford': {
    proximosPassos: [linhaHda('Glasgow-Blatchford', [0]), ...HDA_INICIAL([1, 2])],
  },
  aims65: { proximosPassos: HDA_INICIAL([0, 1, 2]) },
  rockall: {
    proximosPassos: [linhaHda('IBP depois da hemostasia'), linhaHda('Anticoagulante (úlcera)'), linhaHda('Dieta e ferro (úlcera)')],
  },
  'child-pugh': {
    proximosPassos: [linhaHda('TIPS precoce', [1, 2]), linhaHda('Profilaxia primária'), linhaHda('Profilaxia secundária')],
  },
  abcd2: {
    proximosPassos: [
      { tema: 'Avaliação especializada em 24 h', texto: 'Avaliação por especialista em até 24 horas do início dos sintomas.', ref: { fonte: ESO_AIT, pagina: 'PICO 1.1', grau: 'recomendação forte, qualidade baixa' } },
      { tema: 'ABCD2 de 4 ou mais: dupla antiagregação', texto: 'No AIT não cardioembólico de alto risco (ABCD2 de 4 ou mais), dupla antiagregação curta com AAS e clopidogrel em vez de um antiagregante, depois monoterapia.', ref: { fonte: ESO_AIT, pagina: 'PICO 8.1', grau: 'recomendação forte, qualidade alta' }, faixas: [1, 2] },
      { tema: 'Como iniciar a dupla antiagregação', texto: 'Antes, imagem do encéfalo para excluir sangramento ou outra causa. Começar o quanto antes, de preferência nas primeiras 24 horas, com uma dose de ataque (pelo menos 150 mg de AAS e 300 mg de clopidogrel) e depois a dose diária de manutenção; entre 10 dias e 3 semanas, suspender um dos dois e seguir com o outro.', ref: { fonte: ESO_AIT, pagina: 'PICO 8.1, informação adicional', grau: 'sem graduação' }, faixas: [1, 2] },
      { tema: 'ABCD2 abaixo de 4', texto: 'No AIT não cardioembólico de baixo risco ou com diagnóstico incerto, o painel votou contra a dupla antiagregação em vez de um antiagregante.', ref: { fonte: ESO_AIT, pagina: 'PICO 8.1, consenso de especialistas (9 de 9)', grau: 'consenso' }, faixas: [0] },
      { tema: 'Estenose arterial', texto: 'Angio-RM ou angio-TC para confirmar, depois do ultrassom, estenose de grande artéria de 50% ou mais, para guiar a conduta.', ref: { fonte: ESO_AIT, pagina: 'PICO 6.1', grau: 'fraca, qualidade muito baixa' } },
    ],
    armadilhas: [
      { texto: 'Não usar o ABCD2 sozinho para achar o alto risco ou decidir triagem e tratamento: com sensibilidade limitada, escores de 3 ou menos incluem pacientes que recorrem e precisam de avaliação e tratamento precoces.', ref: { fonte: ESO_AIT, pagina: 'PICO 4.1 e resumo', grau: 'fraca contra, qualidade muito baixa' } },
    ],
  },
  'adulto-nihss': {
    proximosPassos: [
      linhaAvc('Trombolítico até 4,5 h'),
      linhaAvc('Déficit leve não incapacitante (até 4,5 h)', [0]),
      linhaAvc('PA antes da trombólise'),
      linhaAvc('Trombectomia 0–6 h', [1, 2]),
      linhaAvc('Trombectomia 6–24 h', [1, 2]),
      linhaAvc('Oclusão de basilar', [1, 2]),
      linhaAvc('Glicemia'),
    ],
  },
  'fast-ed': {
    proximosPassos: [
      linhaAvc('Trombolítico até 4,5 h'),
      linhaAvc('Trombectomia 0–6 h', [1, 2]),
      linhaAvc('Trombectomia 6–24 h', [1, 2]),
      linhaAvc('Oclusão de basilar', [1, 2]),
    ],
  },
  'wells-tvp': {
    proximosPassos: [
      { tema: 'TVP improvável: D-dímero primeiro', texto: 'Começar pelo D-dímero (de alta sensibilidade) para excluir a TVP; D-dímero negativo exclui, sem mais exames nem anticoagulação. Se precisar de mais exames, ultrassom proximal ou de toda a perna; sem D-dímero disponível, ultrassom proximal ou de toda a perna sozinho também serve.', ref: { fonte: ASH_TEV, pagina: 'recomendação 5a', grau: 'forte para o D-dímero; condicional para o ultrassom' }, faixas: [0] },
      { tema: 'TVP improvável: o que não fazer', texto: 'Não diagnosticar TVP só com D-dímero positivo, e não pedir mais exames depois de ultrassom proximal ou de toda a perna negativo.', ref: { fonte: ASH_TEV, pagina: 'recomendação 5b', grau: 'forte' }, faixas: [0] },
      { tema: 'TVP provável: ultrassom primeiro', texto: 'Começar pelo ultrassom proximal ou de toda a perna; se negativo e sem diagnóstico alternativo, repetir o ultrassom (um novo exame em 1 semana).', ref: { fonte: ASH_TEV, pagina: 'recomendação 7a', grau: 'condicional' }, faixas: [2] },
      { tema: 'TVP provável: o que não fazer', texto: 'Não diagnosticar TVP só com D-dímero positivo.', ref: { fonte: ASH_TEV, pagina: 'recomendação 7b', grau: 'forte' }, faixas: [2] },
      { tema: 'Suspeita de TVP recorrente', texto: 'Com probabilidade improvável, começar pelo D-dímero para excluir; D-dímero positivo ou probabilidade provável, ultrassom proximal.', ref: { fonte: ASH_TEV, pagina: 'recomendação 8', grau: 'condicional' } },
    ],
  },
  'crb-65': {
    armadilhas: [
      { texto: 'Fora do hospital (atenção primária), o CRB-65 superestima a mortalidade em 30 dias em todas as faixas; use com cautela nesse cenário.', ref: { fonte: MCNALLY, pagina: 'conclusão do resumo e discussão', grau: 'sem graduação' } },
    ],
  },
  'wells-tep': { proximosPassos: TEP_DIAGNOSTICO([2], [0, 1]) },
  'genebra-revisado': { proximosPassos: TEP_DIAGNOSTICO([2], [0, 1]) },
  years: {
    proximosPassos: [linhaTep('YEARS'), linhaTep('D-dímero ajustado pela idade'), linhaTep('Exame de imagem', [1]), linhaTep('Gestante')],
  },
  'adulto-pesi': {
    proximosPassos: [
      linhaTep('Escores de risco'),
      linhaTep('Tratamento ambulatorial', [0]),
      linhaTep('Início da anticoagulação'),
      linhaTep('Anticoagulante oral'),
      linhaTep('HBPM × HNF', [1, 2]),
    ],
    evidencias: [{ texto: 'Categorias A a E da AHA/ACC 2026: o PESI e o sPESI separam a categoria B (escore baixo) da C (escore elevado).', ref: { fonte: 'AHA/ACC 2026, embolia pulmonar aguda', pagina: 'categorias A a E' } }],
  },
  spesi: {
    proximosPassos: [
      linhaTep('Escores de risco'),
      linhaTep('Tratamento ambulatorial', [0]),
      linhaTep('Início da anticoagulação'),
      linhaTep('Anticoagulante oral'),
      linhaTep('HBPM × HNF', [2]),
    ],
  },
  'psi-port': {
    proximosPassos: [
      {
        tema: 'Internar ou tratar fora do hospital',
        texto: 'Além do julgamento clínico, usar uma regra prognóstica validada para decidir a internação, de preferência o PSI (recomendação forte, qualidade moderada) em vez do CURB-65 (recomendação condicional, qualidade baixa).',
        ref: atsIdsa('questão 6'),
      },
      {
        tema: 'Quem vai direto para a UTI',
        texto: 'Admissão direta na UTI do paciente com hipotensão que exige vasopressor ou com insuficiência respiratória que exige ventilação mecânica.',
        ref: atsIdsa('questão 7, recomendação 1', 'forte, qualidade baixa'),
      },
    ],
    armadilhas: [
      { texto: 'O PSI pode subestimar a gravidade no paciente jovem e simplifica as variáveis contínuas; como apoio à decisão, use junto com o julgamento clínico.', ref: atsIdsa('questão 6, resumo da evidência') },
      ...CURB65_ARMADILHAS,
    ],
  },
  light: {
    proximosPassos: [
      linhaPleura('Toracocentese'),
      linhaPleura('Amostra'),
      linhaPleura('pH na hora'),
      linhaPleura('pH do líquido e drenagem'),
      linhaPleura('Sem pH disponível'),
      linhaPleura('Calibre do dreno', [1]),
      linhaPleura('Terapia intrapleural', [1]),
    ],
  },
  'adulto-duke-modificado': {
    proximosPassos: [
      linhaEi('Hemoculturas'),
      linhaEi('Eco transtorácico'),
      linhaEi('Eco transesofágico'),
      linhaEi('Repetir o eco', [0, 1]),
      linhaEi('Antibiótico empírico: comunitária', [1, 2]),
      linhaEi('Antibiótico empírico: prótese precoce ou hospitalar', [1, 2]),
      linhaEi('Cirurgia por insuficiência cardíaca', [2]),
      linhaEi('Cirurgia por infecção não controlada', [2]),
      linhaEi('Cirurgia para evitar embolia', [2]),
      linhaEi('Trombólise'),
    ],
  },
  'sincope-canadense': {
    proximosPassos: [
      { tema: 'Risco muito baixo ou baixo', texto: 'Alta do pronto-socorro.', ref: { fonte: CSRS_2020, pagina: 'Conclusões', grau: 'conclusão do estudo, sem classe' }, faixas: [0] },
      { tema: 'Risco médio', texto: 'Decisão compartilhada sobre o destino; alta com orientação clara sobre os sinais de doença grave é uma opção razoável, e uma observação breve também.', ref: { fonte: CSRS_2020, pagina: 'Conclusões e Discussão', grau: 'conclusão do estudo, sem classe' }, faixas: [1] },
      { tema: 'Risco alto ou muito alto', texto: 'Internação por período curto.', ref: { fonte: CSRS_2020, pagina: 'Conclusões', grau: 'conclusão do estudo, sem classe' }, faixas: [2] },
      { tema: 'Quando usar o escore', texto: 'Aplicar no fim da avaliação do pronto-socorro, quando nenhuma causa grave foi identificada. Paciente com causa grave, sinais vitais instáveis ou forte suspeita clínica precisa de internação para investigação ou monitorização.', ref: { fonte: CSRS_2020, pagina: 'Discussão', grau: 'conclusão do estudo, sem classe' } },
    ],
  },
  grace: {
    proximosPassos: [
      SCA_MUITO_ALTO,
      { ...SCA_ALTO_24H, faixas: [2] },
      { ...SCA_INTERMEDIARIO_72H, faixas: [1] },
      SCA_ESTRATIFICAR,
    ],
    evidencias: [
      { texto: 'GRACE até 108: baixo risco de óbito hospitalar (até 1%); de 109 a 140: intermediário (1% a 3%); acima de 140: alto (acima de 3%).', ref: { fonte: SBC_SCA, pagina: 'seção 5.3.1 (texto)', grau: 'sem classe' } },
    ],
  },
  'adulto-timi-nstemi': {
    proximosPassos: [SCA_MUITO_ALTO, SCA_ALTO_24H, SCA_INTERMEDIARIO_72H, SCA_ESTRATIFICAR],
    evidencias: [
      { texto: 'A diretriz classifica o TIMI em baixo risco (0 a 2), intermediário (3 a 4) e alto (5 a 7). A escolha do momento do cateterismo segue os critérios clínicos e o GRACE, não a faixa do TIMI.', ref: { fonte: SBC_SCA, pagina: 'seção 5.3.1 (texto) e sumário do estudo hemodinâmico', grau: 'sem classe' } },
    ],
  },
  killip: {
    proximosPassos: [
      { ...SCA_MUITO_ALTO, faixas: [2] },
      { tema: 'Choque cardiogênico: lesão não culpada', texto: 'Não fazer angioplastia de rotina nas lesões não relacionadas ao infarto no choque cardiogênico.', ref: { fonte: SBC_SCA, pagina: 'revascularização, sumário de recomendações', grau: 'classe III, nível B' }, faixas: [2] },
      SCA_ESTRATIFICAR,
    ],
  },
  'cha2ds2-va': {
    proximosPassos: [
      { tema: 'Escore de 2 ou mais', texto: 'Terapia antitrombótica recomendada.', ref: { fonte: SBC_FA, grau: 'classe I, nível A' }, faixas: [2] },
      { tema: 'Escore de 1', texto: 'A terapia antitrombótica pode ser instituída, pesando o benefício clínico, o risco de sangramento, a forma de apresentação da FA e a preferência do paciente.', ref: { fonte: SBC_FA, grau: 'classe IIa, nível B' }, faixas: [1] },
      { tema: 'Escore 0', texto: 'Baixo risco: sem indicação de terapia antitrombótica.', ref: { fonte: SBC_FA, grau: 'classe I, nível A' }, faixas: [0] },
      { tema: 'Qual anticoagulante', texto: 'Nos elegíveis, os anticoagulantes orais diretos são preferíveis aos antagonistas da vitamina K, exceto com válvula cardíaca mecânica ou estenose mitral moderada a grave.', ref: { fonte: SBC_FA, grau: 'classe I, nível A' }, faixas: [1, 2] },
      { tema: 'Antiagregante não substitui', texto: 'Antiagregantes plaquetários, isolados ou combinados, não são recomendados para prevenir tromboembolismo na FA.', ref: { fonte: SBC_FA, grau: 'classe III, nível A' } },
      { tema: 'Reavaliar', texto: 'Reavaliação periódica do risco tromboembólico e de sangramento.', ref: { fonte: SBC_FA, grau: 'classe I, nível B' } },
    ],
  },
  'has-bled': {
    proximosPassos: [
      { tema: 'Sangramento não decide a anticoagulação', texto: 'Na ausência de contraindicação absoluta, a estimativa do risco de sangramento não deve guiar a decisão da terapia antitrombótica.', ref: { fonte: SBC_FA, grau: 'classe III, nível A' } },
      { tema: 'Fatores modificáveis', texto: 'O HAS-BLED pode ser considerado para identificar fatores modificáveis no paciente de alto risco.', ref: { fonte: SBC_FA, grau: 'classe IIa, nível B' } },
      { tema: 'HAS-BLED de 3 ou mais', texto: 'Alto risco, mas não contraindicação à anticoagulação: controlar melhor a pressão, evitar anti-inflamatórios e álcool e trocar a varfarina por anticoagulante oral direto.', ref: { fonte: 'Diretriz Brasileira de Fibrilação Atrial 2025 (SBC/SOBRAC), seção 6.2 (texto)', grau: 'texto da diretriz, sem classe' }, faixas: [2] },
      { tema: 'Reavaliar', texto: 'Reavaliação periódica do risco tromboembólico e de sangramento.', ref: { fonte: SBC_FA, grau: 'classe I, nível B' } },
    ],
  },
  'adulto-reposicao-potassio': {
    proximosPassos: [
      {
        tema: 'ECG',
        texto: 'ECG em todo paciente com hipocalemia.',
        ref: { fonte: KARDALAS, pagina: 'Exames complementares, ECG', grau: 'sem graduação' },
      },
      {
        tema: 'Potássio abaixo de 2,5 mEq/L, grave ou com repercussão cardíaca',
        texto: 'Potássio por via intravenosa, com acompanhamento próximo, monitorização contínua do ECG e dosagens seriadas do potássio.',
        ref: { fonte: KARDALAS, pagina: 'Tratamento e Conclusão', grau: 'sem graduação' },
      },
      {
        tema: 'Magnésio',
        texto: 'Corrigir também o magnésio sérico: a hipocalemia com falta de magnésio costuma não responder à reposição de potássio.',
        ref: { fonte: KARDALAS, pagina: 'Tratamento; Causas', grau: 'sem graduação' },
      },
      {
        tema: 'Procurar a causa',
        texto: 'A excreção de potássio na urina de 24 horas é a melhor medida: acima de 15 mEq/dia indica perda renal inapropriada. Na amostra isolada, potássio/creatinina acima de 13 mEq/g (1,5 mEq/mmol) costuma indicar perda renal inapropriada.',
        ref: { fonte: KARDALAS, pagina: 'Avaliação da excreção urinária de potássio', grau: 'sem graduação' },
      },
    ],
  },
  glasgow: {
    proximosPassos: [
      {
        tema: 'Via aérea no TCE',
        texto: 'Estabelecer a via aérea, pelo meio mais adequado disponível, no paciente com sinais de TCE grave, Glasgow abaixo de 9 (ou 9 e piorando), incapaz de manter a via aérea ou com hipoxemia que não corrige com oxigênio suplementar.',
        ref: { fonte: BTF, pagina: 'Tabela 2 (diretriz do pré-hospitalar)', grau: 'forte' },
        faixas: [1, 2],
      },
      {
        tema: 'TCE grave: neurocirurgia',
        texto: 'Avaliação neurológica urgente (pupilas, componente motor do Glasgow e tomografia de crânio) para definir a gravidade; com lesão cerebral que ameaça a vida em paciente salvável, consulta e intervenção neurocirúrgica urgentes, depois de controlar hemorragia com risco de vida.',
        ref: { fonte: WSES, pagina: 'recomendações 2 e 3', grau: 'consenso Delphi, sem graduação' },
        faixas: [2],
      },
      {
        tema: 'Tomografia no TCE leve e moderado',
        texto: 'Tomografia de crânio no adulto após TCE leve ou moderado com Glasgow de 14 ou menos, perda de consciência, vômitos repetidos (2 ou mais), anticoagulante ou distúrbio da coagulação, sinais de fratura com afundamento ou de base de crânio, convulsão pós-traumática ou déficit neurológico focal.',
        ref: { fonte: SNC13, pagina: 'questão 1, recomendação 1', grau: 'qualidade moderada, recomendação forte' },
        faixas: [0, 1],
      },
      {
        tema: 'Internar para observação',
        texto: 'Com Glasgow de 13 ou menos (ou fratura com afundamento ou de base, anticoagulação ou coagulopatia, convulsão pós-traumática ou déficit focal): tomografia e internação para observação, qualquer que seja o resultado da tomografia.',
        ref: { fonte: SNC13, pagina: 'questão 2, recomendação 1', grau: 'qualidade baixa, recomendação fraca' },
        faixas: [0, 1],
      },
      {
        tema: 'Observação nas primeiras horas',
        texto: 'As 3 primeiras horas depois do trauma pedem observação intensificada.',
        ref: { fonte: SNC26, pagina: 'justificativa da recomendação 5', grau: 'boa prática, consenso' },
        faixas: [0, 1],
      },
      {
        tema: 'Repetir a tomografia',
        texto: 'Repetir a tomografia se houver piora neurológica e/ou queda de 2 pontos ou mais no Glasgow.',
        ref: { fonte: SNC13, pagina: 'questão 2, recomendação 2', grau: 'qualidade baixa, recomendação forte' },
      },
    ],
    armadilhas: [
      { texto: 'A diretriz pré-hospitalar de 2023 deixou de usar a queda de 2 pontos no Glasgow como gatilho único de intervenção.', ref: { fonte: BTF, pagina: 'texto do resumo executivo' } },
    ],
  },
  'ped-bolus': {
    proximosPassos: [
      {
        tema: 'Peso para a dose',
        texto: 'Calcular a dose pelo peso da criança, se conhecido. Sem o peso, é razoável usar a fita de comprimento com doses pré-calculadas.',
        ref: { fonte: ILCOR_PLS, pagina: 'recomendação de tratamento', grau: 'sem graduação (mantida de 2010)' },
      },
      {
        tema: 'Como estimar o peso',
        texto: 'Preferir a estimativa dos pais aos métodos por comprimento e por idade; os sistemas que juntam comprimento e compleição (bidimensionais) são os mais exatos. Fórmulas por idade e o palpite do profissional não devem ser usados. Ter sempre um segundo método à mão.',
        ref: { fonte: WELLS17, pagina: 'Recomendações', grau: 'evidência de alta qualidade' },
      },
      {
        tema: 'Criança obesa',
        texto: 'Doses iniciais das drogas de reanimação pelo peso ideal, estimado pelo comprimento; a dose pelo peso real pode causar toxicidade.',
        ref: { fonte: ILCOR_PLS, pagina: 'recomendação de tratamento', grau: 'sem graduação' },
      },
      {
        tema: 'Doses seguintes',
        texto: 'Ajustar as doses seguintes pelo efeito clínico e pela toxicidade observados, sem passar da dose do adulto.',
        ref: { fonte: ILCOR_PLS, pagina: 'recomendação de tratamento', grau: 'sem graduação' },
      },
    ],
    evidencias: [
      { texto: 'Sistemas completos de dose (dose pré-calculada, preparo e volume a aspirar), junto com a estimativa de peso mais exata, foram mais exatos que a fita de comprimento sozinha.', ref: { fonte: WELLS24, pagina: 'Conclusões', grau: 'sem graduação; estudos de qualidade baixa' } },
    ],
  },
  // Intubação: o que fazer depois da indução, pela DAS 2025 já citada na ficha.
  'adulto-isr': {
    proximosPassos: [
      linhaDas('Confirmação do tubo'),
      linhaDas('Número de tentativas'),
      linhaDas('Ventilação com máscara'),
      linhaDas('Plano B: supraglótico'),
      linhaDas('Plano C: máscara final'),
      linhaDas('Plano D: cricotireoidostomia'),
    ],
  },
  // PCR: CoSTR 2026 e AHA 2025 (Part 9), já citados na ficha.
  'adulto-pcr': {
    proximosPassos: [
      linhaCostr('Compressões'),
      linhaCostr('Ventilação'),
      linhaCostr('Oxigênio durante a RCP'),
      linhaAha('Acesso vascular'),
      linhaAha('Adrenalina'),
      linhaAha('Antiarrítmico'),
      linhaAha('EtCO2 e término da reanimação'),
    ],
  },
  // Infusões: alvo e escolha do vasopressor (SSC 2026 e ILAS, que a ficha passa
  // a citar) e sedação (PADIS 2025, já citada).
  'adulto-infusoes': {
    proximosPassos: [
      ...linhaSepse('Meta de PAM'),
      ...linhaSepse('Vasopressor: qual e por onde'),
      ...linhaSepse('Vasopressina e adrenalina'),
      linhaPadis('Dexmedetomidina × propofol'),
    ],
  },
  'ped-diarreia-desidratacao': {
    proximosPassos: [
      { tema: 'Reavaliar', texto: 'Reavaliar a desidratação a cada 30 minutos no início e depois a cada 1 hora.', ref: { fonte: ICR, pagina: 'p. 330' } },
    ],
  },
  heart: {
    proximosPassos: [
      linhaSbc('Alta do baixo risco', [0, 1]),
      linhaSbc('Dosagem única de troponina', [0]),
      linhaSbc('Troponina de alta sensibilidade'),
      linhaSbc('Angiotomografia de coronárias'),
      linhaSbc('Antiagregação antes do diagnóstico'),
    ],
  },
  'curb-65': {
    proximosPassos: [
      {
        tema: 'Internar ou tratar fora do hospital',
        texto: 'Além do julgamento clínico, usar uma regra prognóstica validada para decidir a internação, de preferência o PSI (recomendação forte, qualidade moderada) em vez do CURB-65 (recomendação condicional, qualidade baixa).',
        ref: atsIdsa('questão 6'),
      },
      {
        tema: 'Quem vai direto para a UTI',
        texto: 'Admissão direta na UTI do paciente com hipotensão que exige vasopressor ou com insuficiência respiratória que exige ventilação mecânica.',
        ref: atsIdsa('questão 7, recomendação 1', 'forte, qualidade baixa'),
      },
      {
        tema: 'Sem vasopressor nem ventilação: critérios menores IDSA/ATS 2007',
        texto: 'Usar os critérios menores, junto com o julgamento clínico, para decidir maior intensidade de cuidado (UTI, semi-intensiva ou telemetria): frequência respiratória ≥ 30/min; PaO₂/FiO₂ ≤ 250; infiltrado multilobar; confusão ou desorientação; nitrogênio ureico sanguíneo (BUN) ≥ 20 mg/dL; leucopenia < 4.000/µL pela infecção; plaquetas < 100.000/µL; temperatura central < 36 °C; hipotensão que exige reposição volêmica agressiva. Pneumonia grave: 1 critério maior (choque séptico com vasopressor ou ventilação mecânica) ou 3 ou mais menores.',
        ref: atsIdsa('questão 7, recomendação 2, e Tabela 1', 'condicional, qualidade baixa'),
      },
    ],
    armadilhas: CURB65_ARMADILHAS,
    evidencias: CURB65_EVIDENCIAS,
  },
  'sepse-adulto': {
    proximosPassos: [
      ...linhaSepse('Antimicrobiano — o que as diretrizes escrevem'),
      ...linhaSepse('Lactato e tempo de enchimento capilar'),
      ...linhaSepse('Volume inicial', [1, 2]),
      ...linhaSepse('Meta de PAM', [2]),
      ...linhaSepse('Vasopressor: qual e por onde', [2]),
      ...linhaSepse('Vasopressina e adrenalina', [2]),
      ...linhaSepse('Corticoide no choque séptico', [2]),
    ],
  },
}

export function guiaDa(fichaId: string): Guia | undefined {
  return GUIAS[fichaId]
}
