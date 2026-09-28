import { fichaP4 } from './fonteP4.ts'

// Escorpionismo e araneísmo — livro do ICr, cap. 19 (p. 209–216). A gravidade
// é CLÍNICA e é escolhida pelo médico (Tabelas 1 a 4); a ferramenta mostra o
// número de ampolas que a tabela do livro associa àquela classe e o volume
// (1 ampola de SAAr = 5 mL, p. 212). Não classifica nada sozinha (ADR 0007).

export const fichaPeconhentosPed = fichaP4('ped-escorpiao-aranhas', 'Escorpião e aranhas — soro por gravidade', 'cap. 19, p. 209–216')

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
