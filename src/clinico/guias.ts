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

function linhaPadis(tema: string): PassoGuia {
  const l = NOTAS_PADIS_2025.find((d) => d.tema === tema)
  if (!l) throw new Error(`linha da PADIS 2025 sem tema "${tema}"`)
  return { tema: `${tema} — PADIS 2025`, texto: l.texto, ref: { fonte: 'SCCM PADIS 2025 (atualização focada)', grau: l.forca } }
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

export const GUIAS: Record<string, Guia> = {
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
