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
// O Glasgow fica sem próximos passos: as fontes da ficha que trariam conduta
// (ACS 2024) não estão abertas.

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

export const GUIAS: Record<string, Guia> = {
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
