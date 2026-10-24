import type { Ficha, Fonte } from '../ficha.ts'

// PEP de HIV, IST e hepatites virais no adulto (lacunas da Central, lote 2,
// 23/10/2026). Fonte única: PCDT PEP do Ministério da Saúde (Portaria SECTICS/MS
// nº 14, de 8/4/2024; arquivo da Conitec de 19/03/2025), lido no PDF; a página é
// a do rodapé do documento. A ferramenta devolve o passo do protocolo que casa
// com o que quem atende informou; a prescrição é do profissional (ADR 0007).
// Criança e adolescente com menos de 45 kg ficam fora (Quadro 10 e coluna
// pediátrica do Quadro 13): esta é a tela do adulto.

export const PCDT_PEP_2024: Fonte = {
  citacao: 'Ministério da Saúde. Protocolo Clínico e Diretrizes Terapêuticas para Profilaxia Pós-Exposição de Risco (PEP) à Infecção pelo HIV, IST e Hepatites Virais. Portaria SECTICS/MS nº 14, de 8 de abril de 2024 (versão da Conitec de 19/03/2025). Quadros 1–7 (p. 4–12), gestantes (Quadros 8–9, p. 14), seguimento (Quadro 12, p. 21), IST na violência sexual (Quadro 13, p. 26), hepatite B (p. 29–30), levonorgestrel (Quadro 17, p. 35), violência sexual e notificação (Quadros 20–21, p. 36–37).',
  url: 'https://www.gov.br/conitec/pt-br/midias/protocolos/PCDTPEP.pdf',
}

export const fichaPepHivAdulto: Ficha = {
  id: 'adulto-pep-hiv',
  titulo: 'PEP de HIV, IST e hepatite B — adulto',
  versao: '2026-10-23.1',
  publico: 'adulto',
  fontes: [PCDT_PEP_2024],
  revisadoEm: '23/10/2026 (lacunas da Central, lote 2; doses e critérios conferidos no texto do PCDT, com página)',
}

export type StatusFonte = 'reagente' | 'nao_reagente' | 'desconhecida'
export type EntradaPep = {
  materialDeRisco: boolean
  exposicaoDeRisco: boolean
  horas: number
  /** teste rápido da pessoa exposta */
  exposta: 'nao_reagente' | 'reagente' | 'discordante'
  fonte: StatusFonte
  /** fonte não reagente com exposição de risco nos 30 dias anteriores */
  fonteJanela?: boolean
}

export type Indicacao = { status: 'indicada' | 'nao_indicada' | 'individualizar'; texto: string; pagina: string }

/** Os quatro passos (Quadro 1) e o status da fonte (5.5). */
export function indicacaoPep(e: EntradaPep): Indicacao {
  if (!e.materialDeRisco) return { status: 'nao_indicada', texto: 'Material biológico sem risco de transmissão do HIV. Com sangue presente, o material passa a ser potencialmente infectante e a PEP pode ser indicada.', pagina: 'Quadro 2, p. 5' }
  if (!e.exposicaoDeRisco) return { status: 'nao_indicada', texto: 'Exposição sem risco: pele íntegra ou mordedura sem sangue.', pagina: 'Quadro 3, p. 5' }
  if (!Number.isFinite(e.horas) || e.horas < 0) return { status: 'individualizar', texto: 'Informe as horas desde a exposição.', pagina: 'Quadro 1, p. 4' }
  if (e.horas > 72) return { status: 'nao_indicada', texto: 'Mais de 72 horas: a PEP não está mais indicada. Com material e exposição de risco, fazer o acompanhamento sorológico e as medidas de prevenção combinada (PrEP, testagem, vacinas, anticoncepção de emergência).', pagina: 'p. 6' }
  if (e.exposta === 'reagente') return { status: 'nao_indicada', texto: 'Pessoa exposta reagente (TR1 e TR2): a infecção é anterior à exposição; encaminhar para acompanhamento e início da TARV.', pagina: 'p. 6' }
  if (e.exposta === 'discordante') return { status: 'individualizar', texto: 'TR1 e TR2 discordantes: repetir o fluxograma e, se persistir, testar em laboratório. Iniciar ou não a profilaxia é decisão clínica conjunta com a pessoa exposta.', pagina: 'p. 6–7' }
  if (e.fonte === 'reagente') return { status: 'indicada', texto: 'Os quatro passos são sim e a fonte é reagente (TR1 e TR2): PEP indicada.', pagina: 'Quadro 1, p. 4; p. 7' }
  if (e.fonte === 'nao_reagente') {
    return e.fonteJanela
      ? { status: 'individualizar', texto: 'Fonte não reagente, mas com exposição de risco nos 30 dias anteriores (janela imunológica): avaliação individualizada; a PEP pode ser indicada.', pagina: 'p. 7' }
      : { status: 'nao_indicada', texto: 'Fonte não reagente no TR1: a PEP não está indicada.', pagina: 'p. 7' }
  }
  return { status: 'individualizar', texto: 'Os quatro passos são sim e a fonte é desconhecida: decisão individualizada pela gravidade da exposição e pela probabilidade de a fonte ter HIV. A ausência da fonte não deve atrasar a PEP.', pagina: 'Quadro 1, p. 4; p. 7' }
}

export type EntradaEsquema = {
  gestante?: boolean
  /** contraindicação ou intolerância ao tenofovir (inclui insuficiência renal aguda) */
  semTenofovir?: boolean
  /** contraindicação ou intolerância ao dolutegravir, ou uso de dofetilida, pilsicainida ou oxcarbazepina */
  semDolutegravir?: boolean
  /** rifampicina, carbamazepina, fenitoína ou fenobarbital */
  indutor?: boolean
  /** taxa de filtração glomerular, mL/min */
  tfg?: number
}

export type Remedio = { droga: string; posologia: string }
export type Esquema = { nome: string; remedios: Remedio[]; pagina: string; avisos: string[] }

const TDF_3TC: Remedio = { droga: 'Tenofovir/lamivudina (TDF/3TC) 300 mg/300 mg', posologia: '1 comprimido VO 1 vez ao dia' }
const AZT_3TC: Remedio = { droga: 'Zidovudina/lamivudina (AZT/3TC) 300 mg/150 mg', posologia: '1 comprimido VO 2 vezes ao dia' }

/** Esquema por 28 dias (Quadros 4–9, p. 10–14) com as trocas que o PCDT traz. */
export function esquemaPep(e: EntradaEsquema): Esquema {
  const avisos: string[] = []
  const nrti = e.semTenofovir ? AZT_3TC : TDF_3TC
  let terceiro: Remedio[]
  if (e.semDolutegravir) {
    terceiro = e.gestante
      ? [{ droga: 'Darunavir 600 mg + ritonavir 100 mg', posologia: 'ambos 2 vezes ao dia (gestante; até o parto)' }]
      : [{ droga: 'Darunavir 800 mg + ritonavir 100 mg', posologia: '1 comprimido de cada VO 1 vez ao dia' }]
  } else {
    terceiro = [{ droga: 'Dolutegravir (DTG) 50 mg', posologia: e.indutor ? '1 comprimido VO de 12/12 horas (dose dobrada pelo indutor)' : '1 comprimido VO 1 vez ao dia' }]
    if (e.indutor) avisos.push('Rifampicina, carbamazepina, fenitoína ou fenobarbital: dolutegravir 50 mg de 12/12 horas (p. 12).')
  }
  if (e.semTenofovir) avisos.push('Sem tenofovir: zidovudina/lamivudina; pedir hemograma (Quadro 12).')
  if (!e.semTenofovir && e.tfg !== undefined && Number.isFinite(e.tfg) && e.tfg > 0 && e.tfg < 50) {
    avisos.push('TFG menor que 50 mL/min: o tenofovir pode ser nefrotóxico; avaliar a indicação, sabendo que o uso é curto (28 dias) e a toxicidade provavelmente reversível (p. 12). Não indicado na insuficiência renal aguda (Quadro 5, p. 11).')
  }
  if (!e.semDolutegravir) avisos.push('O dolutegravir aumenta a concentração da metformina e pode causar hipoglicemia (p. 12).')
  const nome = e.semTenofovir && e.semDolutegravir
    ? 'Fora dos esquemas do PCDT'
    : e.semTenofovir ? 'Alternativo sem tenofovir' : e.semDolutegravir ? 'Alternativo sem dolutegravir' : 'Preferencial'
  if (e.semTenofovir && e.semDolutegravir) avisos.push('O PCDT não traz esquema para quem não pode usar tenofovir nem dolutegravir: discutir com o serviço de referência, sem atrasar o início.')
  return { nome, remedios: [nrti, ...terceiro], pagina: e.gestante ? 'Quadros 8–9, p. 14' : 'Quadros 4–7, p. 10–12', avisos }
}

/** IGHAHB: 0,06 mL/kg IM, máximo de 5 mL (p. 29). */
export function ighahbMl(pesoKg: number): { ml: number; noTeto: boolean } | null {
  if (!Number.isFinite(pesoKg) || pesoKg <= 0) return null
  const ml = 0.06 * pesoKg
  return { ml: Math.min(ml, 5), noTeto: ml > 5 }
}

export type Dose = { nome: string; dose: string; pagina: string; nota?: string }

/** Profilaxia das IST na violência sexual, adulto e adolescente com mais de 45 kg (Quadro 13, p. 26). */
export const IST_VIOLENCIA: Dose[] = [
  { nome: 'Sífilis — penicilina G benzatina', dose: '2,4 milhões UI IM (1,2 milhão UI em cada glúteo), dose única', pagina: 'Quadro 13, p. 26' },
  { nome: 'Gonorreia e clamídia — ceftriaxona + azitromicina', dose: 'ceftriaxona 500 mg IM dose única MAIS azitromicina VO dose única, dose total de 1 g', pagina: 'Quadro 13, p. 26', nota: 'O quadro descreve a azitromicina como "500 mg, 2 comprimidos de 250 mg" e, ao lado, "dose total: 1 g"; vale a dose total.' },
  { nome: 'Tricomoníase — metronidazol', dose: '2 g VO dose única (5 comprimidos de 400 mg ou 8 de 250 mg)', pagina: 'Quadro 13, p. 26', nota: 'Não no primeiro trimestre da gestação; postergar se em uso de contracepção de urgência ou ARV.' },
]

/** Anticoncepção de emergência (Quadro 17, p. 35). */
export const LEVONORGESTREL: Dose = {
  nome: 'Levonorgestrel',
  dose: '1,5 mg VO dose única (ou 2 comprimidos de 0,75 mg juntos); 2ª opção: 0,75 mg de 12/12 horas, 2 comprimidos — até 5 dias após a relação',
  pagina: 'Quadro 17, p. 35',
  nota: 'Excluir gravidez antes (teste se atraso menstrual ou sinais de gravidez); quanto mais cedo, maior a eficácia.',
}

/** Seguimento laboratorial (Quadro 12, p. 21). */
export const SEGUIMENTO_PEP: string[] = [
  'Teste de HIV no primeiro atendimento, na 4ª e na 12ª semana após o início (não usar teste de fluido oral).',
  'Creatinina no primeiro atendimento se alto risco ou doença renal prévia; glicemia se diabetes; hemograma se zidovudina.',
  'ALT, AST e amilase se houver suspeita de efeito adverso.',
]

/** Cuidados na violência sexual e notificação (Quadros 20–21, p. 36–37). */
export const VIOLENCIA_SEXUAL: string[] = [
  'Atendimento clínico-laboratorial, psicológico e social imediato; o atendimento não pode ser negado se a vítima não tomar providências policiais.',
  'Anticoncepção de emergência, profilaxia das IST não virais e do HIV.',
  'Vacina e imunoglobulina para hepatite B; vacina para HPV (9 a 45 anos, se não vacinada) e hepatite A, quando indicado.',
  'Testes rápidos para HIV, sífilis e hepatites B e C; investigação de clamídia e gonococo.',
  'Retorno para sorologias em 30 dias.',
  'Notificar na ficha de violência interpessoal/autoprovocada (Sinan); acidente de trabalho tem ficha própria de exposição a material biológico.',
]
