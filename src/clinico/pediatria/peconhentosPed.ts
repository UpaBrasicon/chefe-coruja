import type { Ficha, Fonte } from '../ficha.ts'
import { fichaP4 } from './fonteP4.ts'

// Escorpionismo e araneísmo — livro do ICr, cap. 19 (p. 209–216). A gravidade
// é CLÍNICA e é escolhida pelo médico (Tabelas 1 a 4); a ferramenta mostra o
// número de ampolas que a tabela do livro associa àquela classe e o volume
// (1 ampola de SAAr = 5 mL, p. 212). Não classifica nada sozinha (ADR 0007).
//
// Versão .1 de 28/09/2026 (decisão do RT: PCDT do MS como fonte): PCDT dos
// Acidentes Escorpiônicos (MS/CONITEC, 2026), lido no texto — 3 e 6 ampolas,
// máximo 6, independentemente da idade, diluição, via e tempos de observação;
// aranhas pelo portal do MS (tabela adaptada do Manual 2001 e do Ofício
// Circular 2/2014): Latrodectus não tem soro disponível no SUS.

export const PCDT_ESCORPIAO_2026: Fonte = {
  citacao: 'Ministério da Saúde. Protocolo Clínico e Diretrizes Terapêuticas dos Acidentes Escorpiônicos. Brasília: MS/CONITEC; 2026.',
  url: 'https://www.gov.br/conitec/pt-br/midias/protocolos/2026/publicacao-ms/pcdt-acidentes-escorpionicos',
  pediatrica: true,
}

export const MS_ARANHAS: Fonte = {
  citacao: 'Ministério da Saúde. Acidentes por aranhas — tratamento (portal Saúde de A a Z; tabela adaptada do Manual de Diagnóstico e Tratamento de Acidentes por Animais Peçonhentos, 2001, e do Ofício Circular nº 2/2014-CGDT/DEVIT/SVS/MS). Consultado em 28/09/2026.',
  url: 'https://www.gov.br/saude/pt-br/assuntos/saude-de-a-a-z/a/animais-peconhentos/acidentes-por-aranhas/tratamento',
  pediatrica: true,
}

const base = fichaP4('ped-escorpiao-aranhas', 'Escorpião e aranhas — soro por gravidade', 'cap. 19, p. 209–216')

export const fichaPeconhentosPed: Ficha = {
  ...base,
  versao: '2026-09-28.1',
  fontes: [
    ...base.fontes,
    { ...PCDT_ESCORPIAO_2026, citacao: `${PCDT_ESCORPIAO_2026.citacao} Quadro 3 (p. 9), determinantes de gravidade (p. 10), tratamento específico (p. 15–17, Quadro 4), fluxo (p. 25).` },
    MS_ARANHAS,
  ],
  revisadoEm: '28/09/2026 (PCDT escorpiônicos 2026 e portal do MS conferidos; livro do ICr mantido como base)',
}

/** PCDT dos Acidentes Escorpiônicos (MS, 2026): soro por gravidade, independentemente da idade. */
export const PCDT_ESCORPIAO = {
  ampolas: { leve: null as [number, number] | null, moderado: [3, 3] as [number, number], grave: [6, 6] as [number, number] },
  maximo: 6,
  soro: 'soro antiescorpiônico (SAEsc) ou, na falta ou na dúvida com araneísmo, antiaracnídico (SAA: Loxosceles, Phoneutria e Tityus)',
  via: 'IV, diluído em SF 0,9% ou SG 5% na proporção de 1:2 a 1:5 (ou 1:1), em 10 a 15 min, ou em bolus a 8–12 mL/min; sem acesso venoso, intraóssea',
  observacao: {
    semClinica: '4 horas',
    leve: '6 a 12 horas, conforme o serviço, garantindo que não surja comprometimento sistêmico',
    comSoro: 'mínimo 24 horas após o soro (moderado internado; grave em CTI com monitoramento contínuo); persistindo as manifestações, reclassificar e complementar o soro',
  },
  risco: 'Crianças com 10 anos ou menos, sobretudo as menores de 7, são mais vulneráveis a manifestações sistêmicas graves',
  pagina: 'Quadro 3, p. 9; p. 10; p. 15–17 (Quadro 4); fluxo, p. 25',
}

/** Portal do MS — aranhas (tabela adaptada do Manual 2001 e do Ofício Circular 2/2014). */
export const MS_ARANHAS_TABELA = {
  loxosceles: [
    { forma: 'Cutânea leve', clinica: 'lesão incaracterística sem alterações clínicas ou laboratoriais', ampolas: null as [number, number] | null },
    { forma: 'Cutânea moderada', clinica: 'lesão característica ou altamente sugestiva (< 3 cm no maior diâmetro, incluindo a enduração) com dor em queimação, ou lesão sugestiva', ampolas: [5, 5] as [number, number] },
    { forma: 'Cutânea grave', clinica: 'lesão extensa (> 3 cm) com dor em queimação intensa', ampolas: [10, 10] as [number, number] },
    { forma: 'Cutâneo-hemolítica', clinica: 'hemólise, qualquer tamanho de lesão e tempo decorrido — grave', ampolas: [10, 10] as [number, number] },
  ],
  loxoscelesSoro: 'SALox (antiloxoscélico) ou SAAr (antiaracnídico)',
  phoneutria: [
    { forma: 'Leve', clinica: 'dor, edema, eritema, irradiação, sudorese, parestesia, taquicardia e agitação secundárias à dor', ampolas: null as [number, number] | null },
    { forma: 'Moderado', clinica: 'manifestações locais com sudorese, taquicardia, vômitos ocasionais, agitação, hipertensão', ampolas: [2, 4] as [number, number] },
    { forma: 'Grave', clinica: 'prostração, sudorese profusa, hipotensão, priapismo, diarreia, bradicardia, arritmias, convulsões, cianose, edema pulmonar, choque', ampolas: [5, 10] as [number, number] },
  ],
  phoneutriaSoro: 'SAAr',
  latrodectus: 'Não há tratamento soroterápico disponível para acidentes latrodécticos: analgésicos, benzodiazepínicos, gluconato de cálcio e clorpromazina (relatos de prostigmina, fenitoína, fenobarbital e morfina); suporte cardiorrespiratório e internação por, no mínimo, 24 horas',
}

/** Onde o PCDT/portal do MS muda o que o livro do ICr traz. */
export const DIFERENCAS_MS_2026: string[] = [
  'Escorpião moderado: o livro põe 3 ampolas "em crianças ≤ 10 anos" e manda tratar a dor primeiro nos maiores; o PCDT 2026 indica 3 ampolas imediatamente em todo moderado, independentemente da idade, e 6 no grave (máximo 6).',
  'Escorpião: o PCDT fixa a diluição (1:2 a 1:5, ou 1:1) e o tempo (10–15 min ou 8–12 mL/min); o livro fala em 15–20 min sem diluição padrão.',
  'Observação: sem clínica 4 h; leve 6–12 h; com soro no mínimo 24 h (PCDT, Quadro 3 e p. 15). O livro: leve 4 h, moderado 24 h.',
  'Latrodectus: o livro traz soro antilatrodéctico 1 ampola IM; o portal do MS informa que não há soro disponível — tratamento sintomático e internação ≥ 24 h.',
  'Loxosceles: mesmos números (5 e 10 ampolas); o portal do MS separa a forma cutâneo-hemolítica (10). Prednisona 1 mg/kg/dia por 5 dias é só do livro (p. 214); o portal não a cita.',
]

export type Animal = 'escorpiao' | 'phoneutria' | 'loxosceles' | 'latrodectus'
export type Gravidade = 'leve' | 'moderado' | 'grave'

export const ANIMAIS: Record<Animal, string> = {
  escorpiao: 'Escorpião (Tityus)',
  phoneutria: 'Armadeira (Phoneutria)',
  loxosceles: 'Aranha-marrom (Loxosceles)',
  latrodectus: 'Viúva-negra (Latrodectus)',
}

/** 1 ampola de SAAr = 5 mL (rodapé da Tabela 2, p. 212). */
export const ML_POR_AMPOLA_SAAR = 5

export type LinhaSoro = {
  clinica: string
  /** faixa de ampolas; null = sem soro nesta classe */
  ampolas: [number, number] | null
  soro?: string
  via?: string
  outros: string
  pagina: string
  /** condição de idade escrita na tabela */
  idade?: string
}

export const TABELA_SORO: Record<Animal, Record<Gravidade, LinhaSoro>> = {
  escorpiao: {
    leve: { clinica: 'Apenas manifestações locais: dor local ou irradiada, edema, eritema, sudorese, parestesia, frialdade; pode haver ponto de inoculação', ampolas: null, outros: 'Observação clínica por 4 horas; analgesia VO/parenteral e/ou anestesia local', pagina: 'p. 211 (Tabela 1)' },
    moderado: { clinica: 'Quadro local + alguns episódios de vômito, sudorese fria, hipertensão, taquicardia (ou bradicardia) e agitação leve', ampolas: [3, 3], soro: 'soro antiescorpiônico ou antiaracnídico', via: 'EV em 15–20 min', outros: 'Internação por 24 h; analgesia e/ou anestesia local', pagina: 'p. 211 (Tabela 1)',
      idade: 'Na tabela, 3 ampolas para crianças ≤ 10 anos; > 10 anos e adultos: tratar primeiro a dor e, sem melhora em 30–40 min, está indicada a soroterapia (a tabela não repete o número de ampolas para esse grupo).' },
    grave: { clinica: 'Além do moderado: vários vômitos, sudorese intensa, taquicardia ou bradicardia, hiper ou hipotensão, taquipneia, priapismo, agitação alternada com sonolência; pode evoluir para choque e edema agudo de pulmão', ampolas: [6, 6], soro: 'soro antiescorpiônico ou antiaracnídico', via: 'EV em 15–20 min', outros: 'Suporte vital/cuidados intensivos; analgesia e/ou anestesia local', pagina: 'p. 212 (Tabela 1)' },
  },
  phoneutria: {
    leve: { clinica: 'Dor local na maioria dos casos, eventualmente taquicardia e agitação', ampolas: null, outros: 'Observação até 6 horas', pagina: 'p. 212 (Tabela 2)' },
    moderado: { clinica: 'Dor local intensa + sudorese e/ou vômitos ocasionais e/ou agitação e/ou hipertensão', ampolas: [2, 4], soro: 'SAAr', via: 'EV', outros: 'Internação', pagina: 'p. 212 (Tabela 2)', idade: 'A tabela traz as ampolas "em crianças"; no adulto, só nos graves (p. 212).' },
    grave: { clinica: 'Além das anteriores, uma ou mais: sudorese profusa, sialorreia, vômitos frequentes, hipertonia, priapismo, choque e/ou edema pulmonar agudo', ampolas: [5, 10], soro: 'SAAr', via: 'EV', outros: 'Unidade de cuidados intensivos', pagina: 'p. 212 (Tabela 2)' },
  },
  loxosceles: {
    leve: { clinica: 'Loxosceles identificada; lesão característica; sem comprometimento do estado geral nem alteração laboratorial', ampolas: null, outros: 'Sintomático; acompanhamento até 72 h após a picada (a classificação pode mudar nesse período)', pagina: 'p. 214 (Tabela 3)' },
    moderado: { clinica: 'Lesão sugestiva ou característica; alterações sistêmicas (rash, petéquias); sem laboratório sugestivo de hemólise', ampolas: [5, 5], soro: 'SAAr', via: 'IV', outros: 'Soroterapia e/ou prednisona (crianças 1 mg/kg/dia por 5 dias)', pagina: 'p. 214 (Tabela 3)' },
    grave: { clinica: 'Lesão característica; anemia aguda, icterícia; evolução rápida; laboratório indicativo de hemólise', ampolas: [10, 10], soro: 'SAAr', via: 'IV', outros: 'Soroterapia e prednisona (crianças 1 mg/kg/dia por 5 dias)', pagina: 'p. 214 (Tabela 3)' },
  },
  latrodectus: {
    leve: { clinica: 'Dor, edema e sudorese locais discretos; dor nos membros inferiores; parestesia; tremores e contraturas', ampolas: null, outros: 'Sintomático: analgésicos, gluconato de cálcio, observação (o texto diz que o gluconato não é mais recomendado na literatura internacional, p. 215)', pagina: 'p. 215 (Tabela 4)' },
    moderado: { clinica: 'Além dos anteriores: dor abdominal, sudorese generalizada, ansiedade/agitação, mialgia, dificuldade de deambulação, cefaleia e tontura, hipertermia', ampolas: [1, 1], soro: 'soro antilatrodéctico (SALatr)', via: 'IM', outros: 'Analgésicos, sedativos; preparar recursos para reverter anafilaxia (5 a 9% de anafilaxia com o soro, p. 215)', pagina: 'p. 215 (Tabela 4)' },
    grave: { clinica: 'Todos os anteriores e: taquicardia/bradicardia, hipertensão, taquipneia/dispneia, náuseas e vômitos, priapismo, retenção urinária, fácies latrodectísmica', ampolas: [1, 1], soro: 'soro antilatrodéctico (SALatr)', via: 'IM', outros: 'Analgésicos, sedativos; preparar recursos para reverter anafilaxia', pagina: 'p. 215 (Tabela 4)' },
  },
}

/** Volume em mL do SAAr (1 ampola = 5 mL). Só para o SAAr: o livro não dá o volume das outras ampolas. */
export function volumeSaarMl(ampolas: [number, number]): [number, number] {
  return [ampolas[0] * ML_POR_AMPOLA_SAAR, ampolas[1] * ML_POR_AMPOLA_SAAR]
}

/** Prednisona no loxoscelismo moderado/grave: crianças 1 mg/kg/dia por 5 dias (p. 214). */
export function prednisonaLoxoscelesMgDia(pesoKg: number): number | null {
  return Number.isFinite(pesoKg) && pesoKg > 0 ? pesoKg : null
}

/** Escorpião em choque: expansão de 5 mL/kg de cristaloide (p. 211). */
export function expansaoEscorpiaoMl(pesoKg: number): number | null {
  return Number.isFinite(pesoKg) && pesoKg > 0 ? 5 * pesoKg : null
}

export const NOTAS_PECONHENTOS: { texto: string; pagina: string }[] = [
  { texto: 'Soro após 3 h do acidente escorpiônico é sinal de mau prognóstico; SAV em 15 a 20 min, sem diluição padrão. Vômitos abundantes indicam potencial gravidade.', pagina: 'p. 210–211' },
  { texto: 'Escorpião leve: bloqueio anestésico sem vasoconstritor (bupivacaína 0,5% ou lidocaína 2%), pode ser repetido até 3 vezes com intervalo de 1 h. Balanço hídrico rigoroso.', pagina: 'p. 211' },
  { texto: 'Phoneutria: infiltração troncular com lidocaína 2% sem vasoconstritor — 1 a 2 mL em crianças (3 a 4 mL em adultos).', pagina: 'p. 212' },
  { texto: 'Loxosceles: eficácia do soro parece reduzida após 36 h; compressas frias, limpeza da ferida; debridamento após delimitação da necrose (em geral após 1 semana).', pagina: 'p. 214' },
]
