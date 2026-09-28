import { MANUAL_HC } from '../adulto/fonte.ts'
import { LIVRO_PS_PED, fichaPediatrica } from './fonte.ts'

// Doses pediátricas em bolus por peso — Apêndice do PS Pediatria ICr-HCFMUSP
// (4ª ed., 2023): tabela 1 (emergência e RCP) e os itens de emergência da
// tabela 2 (antídotos, crise epiléptica, asma, hipoglicemia). Antibióticos não
// entram nesta ferramenta. Todo número tem página (numeração do PDF).
//
// Cálculo puro: dose = faixa por kg × peso, limitada ao máximo do livro. A
// ferramenta mostra a FAIXA inteira (não escolhe um ponto dentro dela). Volume
// só quando o livro dá a concentração da apresentação. O Anexo 2 do manual do
// adulto HC aparece só como nota de divergência (`anexo2Adulto`).
// O apêndice NÃO cobre o período neonatal (p. 894).

export const fichaBolusPediatrico = fichaPediatrica(
  'ped-bolus',
  'Doses pediátricas por peso',
  'Apêndice, tabelas 1 e 2 (p. 894–910); RCP (p. 31–32); arritmias (p. 50); SRI (p. 69–73); choque séptico (p. 88); anafilaxia (p. 99–102); asma (p. 118–119); crise epiléptica (p. 127); intoxicações (p. 206–208); miocardite (p. 253); emergência hipertensiva (p. 276); crupe (p. 294); hemorragia digestiva (p. 349); distúrbios do potássio (p. 549); emergências oncológicas (p. 701–702, 720); sedação (p. 849)',
  LIVRO_PS_PED,
  [{ fonte: MANUAL_HC, paginas: 'Anexo 2, p. 1490–1494 (só como nota de divergência)' }],
)

export const NEONATO_FORA =
  'O apêndice do livro não contempla doses do período neonatal (p. 894). Para recém-nascido, esta ferramenta não tem referência.'

export type Grupo = 'pcr' | 'isr' | 'anafilaxia' | 'respiratorio' | 'neuro' | 'metabolico' | 'cardio' | 'antidoto'

export const GRUPOS: Record<Grupo, string> = {
  pcr: 'Parada cardiorrespiratória e arritmias',
  isr: 'Intubação, sedação e analgesia',
  anafilaxia: 'Anafilaxia',
  respiratorio: 'Asma e crupe',
  neuro: 'Crise epiléptica e hipertensão intracraniana',
  metabolico: 'Hipercalemia, hipoglicemia e insuficiência adrenal',
  cardio: 'Emergência hipertensiva, cardiovascular e doses de ataque',
  antidoto: 'Antídotos e intoxicações',
}

export type Unidade = 'mg' | 'µg' | 'g' | 'mEq' | 'mL' | 'UI'

/** Uma regra de peso ou idade. Idade em anos COMPLETOS ou meses completos. */
export type Regra = { campo: 'peso' | 'anos' | 'meses'; op: '<' | '<=' | '>' | '>='; valor: number }

/** Condição do livro: vale se QUALQUER alternativa valer; cada alternativa exige TODAS as regras. */
export type Condicao = { texto: string; alternativas: Regra[][] }

export type Bolus = {
  id: string
  nome: string
  grupo: Grupo
  unidade: Unidade
  /** true: faixa por kg; false: faixa é a dose absoluta */
  porKg: boolean
  faixa: [number, number]
  maximo?: number
  /** unidade por mL da apresentação que o livro cita (mesma unidade da dose) */
  porMl?: number
  apresentacao?: string
  via: string
  pagina: string
  condicao?: Condicao
  /** alerta quando a dose calculada fica abaixo de um valor citado pelo livro */
  aviso?: { abaixoDe: number; texto: string }
  /** o livro não dá dado para calcular: mostra só o texto */
  semCalculo?: string
  nota?: string
  errata?: string
  /** divergência com o Anexo 2 do manual do adulto HC (3ª ed., 2022) */
  anexo2Adulto?: string
}

const B = (b: Bolus) => b
const r = (campo: Regra['campo'], op: Regra['op'], valor: number): Regra => ({ campo, op, valor })
const so = (texto: string, ...regras: Regra[]): Condicao => ({ texto, alternativas: [regras] })
const ou = (texto: string, ...alternativas: Regra[][]): Condicao => ({ texto, alternativas })

const MENOR_5 = so('< 5 anos (o livro não define a dose aos 5 anos completos)', r('anos', '<', 5))
const MAIOR_5 = so('> 5 anos (o livro não define a dose aos 5 anos completos)', r('anos', '>', 5))
const ANEXO2_ATROPINA = 'Anexo 2 do manual do adulto: 0,02 mg/kg com mínimo de 0,1 mg e máximo de 1 mg (p. 1490).'
const AVISO_ATROPINA = {
  abaixoDe: 0.1,
  texto: 'O apêndice comenta que doses < 0,1 mg causam bradicardia (p. 894); o cap. de SRI diz "sem dose mínima" (p. 71). O sistema não impõe mínimo.',
}
const EPI_1_10000 = 'solução 1:10.000 = 0,1 mg/mL (1 ampola de 1 mg/mL + 9 mL de SF ou AD — p. 31)'
const EPI_1_1000 = 'solução 1:1.000 = 1 mg/mL (p. 895)'
const BIC = 'NaHCO₃ 8,4%: 1 mL = 1 mEq (p. 32)'
const MGSO4 = 'MgSO₄ 50% = 500 mg/mL (p. 32)'
const CETAMINA = 'Ketamin S® 50 mg/mL (p. 88)'

export const BOLUS: Bolus[] = [
  // ── PCR e arritmias ──
  B({ id: 'adenosina-1', nome: 'Adenosina — 1ª dose', grupo: 'pcr', unidade: 'mg', porKg: true, faixa: [0.1, 0.1], maximo: 6, via: 'IV em bolo rápido, próximo ao tronco, com flush de 3 a 5 mL de SF', pagina: 'p. 894',
    condicao: so('< 50 kg (o livro não define a dose em exatamente 50 kg)', r('peso', '<', 50)),
    nota: 'Máximo de 6 mg na 1ª dose: cap. de arritmias (p. 50); o apêndice não traz máximo para < 50 kg. O cap. cita dose reduzida (em torno de 50%) com acesso venoso central (p. 50).' }),
  B({ id: 'adenosina-2', nome: 'Adenosina — 2ª dose', grupo: 'pcr', unidade: 'mg', porKg: true, faixa: [0.2, 0.2], maximo: 12, via: 'IV em bolo rápido, com flush de SF', pagina: 'p. 894',
    condicao: so('< 50 kg (o livro não define a dose em exatamente 50 kg)', r('peso', '<', 50)),
    nota: 'Máximo de 12 mg na 2ª dose: cap. de arritmias (p. 50).' }),
  B({ id: 'adenosina-50-1', nome: 'Adenosina — 1ª dose', grupo: 'pcr', unidade: 'mg', porKg: false, faixa: [6, 6], via: 'IV em bolo rápido, com flush de SF', pagina: 'p. 894',
    condicao: so('> 50 kg (o livro não define a dose em exatamente 50 kg)', r('peso', '>', 50)) }),
  B({ id: 'adenosina-50-2', nome: 'Adenosina — 2ª dose', grupo: 'pcr', unidade: 'mg', porKg: false, faixa: [12, 12], via: 'IV em bolo rápido, com flush de SF', pagina: 'p. 894',
    condicao: so('> 50 kg (o livro não define a dose em exatamente 50 kg)', r('peso', '>', 50)) }),
  B({ id: 'amiodarona-fvtv', nome: 'Amiodarona — FV/TV sem pulso', grupo: 'pcr', unidade: 'mg', porKg: true, faixa: [5, 5], maximo: 300, via: 'IV/IO em bolo, até 3 vezes', pagina: 'p. 894',
    nota: 'Máximo de 300 mg por dose e 15 mg/kg/dia: tabela de drogas da PCR (p. 32).' }),
  B({ id: 'amiodarona-iv', nome: 'Amiodarona — IV em 60 minutos', grupo: 'pcr', unidade: 'mg', porKg: true, faixa: [5, 5], maximo: 300, via: 'IV em 60 min; pode repetir até 15 mg/kg/dia', pagina: 'p. 894',
    nota: 'Diluir em SG 5%, concentração máxima de 2 mg/mL em cateter periférico (p. 894).' }),
  B({ id: 'atropina-bradicardia', nome: 'Atropina — bradicardia', grupo: 'pcr', unidade: 'mg', porKg: true, faixa: [0.02, 0.02], maximo: 0.5, via: 'IV/IO/IT; pode repetir 1 vez', pagina: 'p. 894',
    aviso: AVISO_ATROPINA, nota: 'Cap. de SRI (p. 71): 0,02 mg/kg, máximo de 1 mg, "sem dose mínima".', anexo2Adulto: ANEXO2_ATROPINA }),
  B({ id: 'bicarbonato-pcr', nome: 'Bicarbonato de sódio — PCR', grupo: 'pcr', unidade: 'mEq', porKg: true, faixa: [0.5, 1], porMl: 1, apresentacao: BIC, via: 'IV/IO; pode repetir 0,5 mEq/kg 1 vez', pagina: 'p. 894',
    nota: 'Tabela de drogas da PCR (p. 32): 1 mEq/kg/dose, não indicado de rotina (p. 32).' }),
  B({ id: 'epinefrina-pcr', nome: 'Epinefrina — PCR', grupo: 'pcr', unidade: 'mg', porKg: true, faixa: [0.01, 0.01], porMl: 0.1, apresentacao: EPI_1_10000, via: 'IV/IO, a cada 3 a 5 min', pagina: 'p. 895; p. 31' }),
  B({ id: 'epinefrina-et', nome: 'Epinefrina — endotraqueal', grupo: 'pcr', unidade: 'mg', porKg: true, faixa: [0.1, 0.1], porMl: 1, apresentacao: EPI_1_1000, via: 'ET (só sem acesso vascular — p. 31)', pagina: 'p. 895; p. 31' }),
  B({ id: 'gluconato-pcr', nome: 'Gluconato de cálcio — PCR', grupo: 'pcr', unidade: 'mg', porKg: true, faixa: [60, 100], maximo: 3000, porMl: 100, apresentacao: 'solução a 10% = 100 mg/mL (p. 896)', via: 'IV; pode repetir em 10 min; evitar infusão rápida', pagina: 'p. 896',
    nota: 'Tabela de drogas da PCR (p. 32): 5 a 7 mg/kg de cálcio elementar = 0,6 mL/kg de gluconato de cálcio 10%. Incompatível com ceftriaxona (p. 896).' }),
  B({ id: 'lidocaina-iv', nome: 'Lidocaína — IV (arritmia)', grupo: 'pcr', unidade: 'mg', porKg: true, faixa: [1, 1], maximo: 100, via: 'IV, seguida de infusão contínua (ver infusões)', pagina: 'p. 896',
    nota: 'Tabela de drogas da PCR (p. 32): FV/TV sem pulso 1 mg/kg IV/IO; endotraqueal 2 a 3 mg/kg.' }),
  B({ id: 'magnesio-torsades', nome: 'Sulfato de magnésio — torsades de pointes', grupo: 'pcr', unidade: 'mg', porKg: true, faixa: [25, 50], maximo: 2000, porMl: 500, apresentacao: MGSO4, via: 'IV; infusão rápida pode causar hipotensão', pagina: 'p. 908',
    nota: 'O apêndice escreve "concentração máxima 20% para emergências (60 mg/mL)" (p. 908); 20% seriam 200 mg/mL, então os dois números não batem. O sistema não calcula diluição.' }),

  // ── Intubação, sedação e analgesia ──
  B({ id: 'atropina-pre', nome: 'Atropina — pré-anestésica', grupo: 'isr', unidade: 'mg', porKg: true, faixa: [0.01, 0.02], maximo: 0.4, via: 'IV', pagina: 'p. 894',
    aviso: AVISO_ATROPINA, nota: 'Cap. de SRI (p. 71): 0,02 mg/kg, máximo de 1 mg; não recomendada de rotina como pré-tratamento.', anexo2Adulto: ANEXO2_ATROPINA }),
  B({ id: 'lidocaina-sri', nome: 'Lidocaína — pré-medicação na SRI', grupo: 'isr', unidade: 'mg', porKg: true, faixa: [1, 2], via: 'IV', pagina: 'p. 896',
    anexo2Adulto: 'Anexo 2 do manual do adulto: 1,5 mg/kg (p. 1490).' }),
  B({ id: 'fentanil', nome: 'Fentanil', grupo: 'isr', unidade: 'µg', porKg: true, faixa: [1, 2], via: 'IM ou IV lento (3 a 5 min); pode repetir a cada 30 a 60 min', pagina: 'p. 895',
    nota: 'Tabela de sedativos da SRI (p. 70): 2 a 7 mcg/kg.', anexo2Adulto: 'Anexo 2 do manual do adulto: 2 µg/kg (p. 1490–1491).' }),
  B({ id: 'morfina-menor6m', nome: 'Morfina — IV', grupo: 'isr', unidade: 'mg', porKg: true, faixa: [0.025, 0.03], via: 'IV, a cada 2 a 4 h', pagina: 'p. 905',
    condicao: so('< 6 meses (o livro não define a dose aos 6 meses completos)', r('meses', '<', 6)) }),
  B({ id: 'morfina-maior6m', nome: 'Morfina — IV/IM', grupo: 'isr', unidade: 'mg', porKg: true, faixa: [0.05, 0.2], via: 'IV/IM, a cada 2 a 4 h', pagina: 'p. 905',
    condicao: so('> 6 meses (o livro não define a dose aos 6 meses completos)', r('meses', '>', 6)),
    anexo2Adulto: 'Anexo 2 do manual do adulto: 0,05 mg/kg (p. 1491).' }),
  B({ id: 'cetamina-iv', nome: 'Cetamina — IV', grupo: 'isr', unidade: 'mg', porKg: true, faixa: [0.5, 2], porMl: 50, apresentacao: CETAMINA, via: 'IV', pagina: 'p. 894',
    nota: 'Contraindicada em < 3 meses (p. 894). SRI (p. 69) e choque séptico (p. 88): 1 a 4 mg/kg.', anexo2Adulto: 'Anexo 2 do manual do adulto: 1 a 4 mg/kg EV (p. 1493).' }),
  B({ id: 'cetamina-im', nome: 'Cetamina — IM', grupo: 'isr', unidade: 'mg', porKg: true, faixa: [2, 5], porMl: 50, apresentacao: CETAMINA, via: 'IM', pagina: 'p. 894',
    nota: 'Contraindicada em < 3 meses (p. 894).', anexo2Adulto: 'Anexo 2 do manual do adulto: 3 a 6 mg/kg IM (p. 1493).' }),
  B({ id: 'dexmedetomidina-proc', nome: 'Dexmedetomidina — sedação para procedimento', grupo: 'isr', unidade: 'µg', porKg: true, faixa: [0.25, 3], via: 'IV', pagina: 'p. 895',
    nota: 'Pode causar hipotensão e bradicardia com doses repetidas, infusão rápida ou doses altas (p. 895).' }),
  B({ id: 'dexmedetomidina-ataque', nome: 'Dexmedetomidina — ataque da sedação contínua', grupo: 'isr', unidade: 'µg', porKg: true, faixa: [0.25, 0.5], via: 'IV', pagina: 'p. 895',
    nota: 'Cap. de sedação (p. 849): ataque de 1 mcg/kg em até 30 min.' }),
  B({ id: 'etomidato', nome: 'Etomidato', grupo: 'isr', unidade: 'mg', porKg: true, faixa: [0.1, 0.3], maximo: 20, via: 'IV', pagina: 'p. 895',
    nota: 'Tabela de sedativos da SRI (p. 70): 0,2 a 0,4 mg/kg. Não recomendado no choque séptico (p. 895).', anexo2Adulto: 'Anexo 2 do manual do adulto: 0,2 a 0,4 mg/kg (p. 1491).' }),
  B({ id: 'midazolam-im', nome: 'Midazolam — IM', grupo: 'isr', unidade: 'mg', porKg: true, faixa: [0.1, 0.15], maximo: 10, via: 'IM (vasto lateral da coxa)', pagina: 'p. 896',
    nota: 'Máximo total de 10 mg (p. 896). Crise epiléptica (p. 127): IM 0,2 a 0,4 mg/kg, máximo 5 mg.' }),
  B({ id: 'midazolam-iv-menor5', nome: 'Midazolam — IV', grupo: 'isr', unidade: 'mg', porKg: true, faixa: [0.1, 0.5], maximo: 6, via: 'IV', pagina: 'p. 896', condicao: MENOR_5,
    nota: 'O máximo do livro é o TOTAL (soma das doses). SRI (p. 70): 0,1 a 0,4 mg/kg; 0,3 mg/kg na SRI (p. 72). Crise epiléptica (p. 127): 0,1 a 0,3 mg/kg, máx. 10 mg.',
    anexo2Adulto: 'Anexo 2 do manual do adulto: 0,1 a 0,3 mg/kg (p. 1491–1492).' }),
  B({ id: 'midazolam-iv-maior5', nome: 'Midazolam — IV', grupo: 'isr', unidade: 'mg', porKg: true, faixa: [0.1, 0.5], maximo: 10, via: 'IV', pagina: 'p. 896', condicao: MAIOR_5,
    nota: 'O máximo do livro é o TOTAL (soma das doses). SRI (p. 70): 0,1 a 0,4 mg/kg; 0,3 mg/kg na SRI (p. 72). Crise epiléptica (p. 127): 0,1 a 0,3 mg/kg, máx. 10 mg.',
    anexo2Adulto: 'Anexo 2 do manual do adulto: 0,1 a 0,3 mg/kg (p. 1491–1492).' }),
  B({ id: 'midazolam-in', nome: 'Midazolam — intranasal', grupo: 'isr', unidade: 'mg', porKg: true, faixa: [0.2, 0.3], via: 'IN', pagina: 'p. 896',
    nota: 'O apêndice não traz máximo para IN. Crise epiléptica (p. 127): IN ou bucal 0,2 a 0,3 mg/kg, máximo 7,5 mg.' }),
  B({ id: 'propofol', nome: 'Propofol — SRI', grupo: 'isr', unidade: 'mg', porKg: true, faixa: [1, 2], via: 'IV', pagina: 'p. 896',
    nota: 'Evitar na hipotensão ou choque; contraindicado em alergia a ovo e soja (p. 72).', anexo2Adulto: 'Anexo 2 do manual do adulto: 1 a 3 mg/kg (p. 1492–1493).' }),
  B({ id: 'tiopental', nome: 'Tiopental', grupo: 'isr', unidade: 'mg', porKg: true, faixa: [2, 5], via: 'IV', pagina: 'p. 897',
    nota: 'SRI (p. 69): 2 a 5 mg/kg. Crise epiléptica (p. 127): bolus de 5 mg/kg, máximo 500 mg.' }),
  B({ id: 'rocuronio', nome: 'Rocurônio — SRI', grupo: 'isr', unidade: 'mg', porKg: true, faixa: [0.6, 1.2], via: 'IV; associar sedação', pagina: 'p. 896',
    nota: 'Tabela de BNM da SRI (p. 70): 0,9 a 1,2 mg/kg; o texto (p. 73) diz que 1 mg/kg dá melhores condições de intubação que 0,6 mg/kg.' }),
  B({ id: 'succinilcolina-iv', nome: 'Succinilcolina — IV', grupo: 'isr', unidade: 'mg', porKg: true, faixa: [1, 2], via: 'IV; infusão contínua não recomendada em crianças', pagina: 'p. 897',
    nota: 'Tabela de BNM da SRI (p. 70): 1 a 2 mg/kg (< 10 kg) e 1 a 1,5 mg/kg (> 10 kg). Contraindicações no quadro 4 (p. 73).',
    anexo2Adulto: 'Anexo 2 do manual do adulto: lactente 2 mg/kg; criança não lactente 1 a 1,5 mg/kg (p. 1494).' }),
  B({ id: 'succinilcolina-im', nome: 'Succinilcolina — IM', grupo: 'isr', unidade: 'mg', porKg: true, faixa: [3, 4], maximo: 150, via: 'IM', pagina: 'p. 897',
    anexo2Adulto: 'Anexo 2 do manual do adulto: IM 4 mg/kg no lactente e 2 a 3 mg/kg na criança não lactente (p. 1494).' }),
  B({ id: 'vecuronio', nome: 'Vecurônio', grupo: 'isr', unidade: 'mg', porKg: true, faixa: [0.08, 0.1], via: 'IV; associar sedação', pagina: 'p. 897',
    condicao: so('1 a 10 anos (fora disso o apêndice não dá dose)', r('anos', '>=', 1), r('anos', '<=', 10)),
    nota: 'Tabela de BNM da SRI (p. 70): 0,15 a 0,2 mg/kg.' }),
  B({ id: 'sugamadex', nome: 'Sugamadex', grupo: 'isr', unidade: 'mg', porKg: true, faixa: [2, 16], via: 'IV; reverte rocurônio/vecurônio', pagina: 'p. 897' }),
  B({ id: 'neostigmina-0a2', nome: 'Neostigmina — reversão de BNM não despolarizante', grupo: 'isr', unidade: 'mg', porKg: true, faixa: [0.025, 0.1], via: 'IV; se bradicardia, atropina antes ou junto', pagina: 'p. 905',
    condicao: so('0 a 2 anos', r('anos', '<=', 2)) }),
  B({ id: 'neostigmina-maior2', nome: 'Neostigmina — reversão de BNM não despolarizante', grupo: 'isr', unidade: 'mg', porKg: true, faixa: [0.025, 0.08], via: 'IV; se bradicardia, atropina antes ou junto', pagina: 'p. 905',
    condicao: so('> 2 anos', r('anos', '>', 2)) }),

  // ── Anafilaxia ──
  B({ id: 'epinefrina-im', nome: 'Epinefrina — IM', grupo: 'anafilaxia', unidade: 'mg', porKg: true, faixa: [0.01, 0.01], maximo: 0.5, porMl: 1, apresentacao: EPI_1_1000, via: 'IM no vasto lateral da coxa; a cada 20 min', pagina: 'p. 895; p. 99' }),
  B({ id: 'epinefrina-iv-anafilaxia', nome: 'Epinefrina — IV (anafilaxia refratária)', grupo: 'anafilaxia', unidade: 'mg', porKg: true, faixa: [0.01, 0.01], maximo: 0.5, porMl: 0.1, apresentacao: EPI_1_10000, via: 'IV em bolus, a cada 20 min', pagina: 'p. 100; p. 102' }),
  B({ id: 'glucagon-anafilaxia', nome: 'Glucagon — hipotensão persistente (betabloqueado)', grupo: 'anafilaxia', unidade: 'µg', porKg: true, faixa: [20, 30], maximo: 1000, via: 'IV em 5 min; depois infusão de 5 a 15 mcg/min', pagina: 'p. 101; p. 102' }),
  B({ id: 'azul-metileno-anafilaxia', nome: 'Azul de metileno 1% — anafilaxia refratária', grupo: 'anafilaxia', unidade: 'mg', porKg: true, faixa: [1, 2], porMl: 10, apresentacao: 'azul de metileno 1% = 10 mg/mL (p. 102)', via: 'IV, uma dose', pagina: 'p. 102',
    nota: 'O livro também dá 25 a 50 mg/m² IV (p. 102). Uso na anafilaxia restrito a relatos de caso (p. 100).' }),

  // ── Asma e crupe ──
  B({ id: 'magnesio-asma', nome: 'Sulfato de magnésio — asma', grupo: 'respiratorio', unidade: 'mg', porKg: true, faixa: [25, 75], maximo: 2000, porMl: 500, apresentacao: MGSO4, via: 'IV em 20 a 40 min (p. 119), com monitorização', pagina: 'p. 908',
    nota: 'Cap. de asma (p. 119): dose padrão 50 mg/kg (margem 25 a 75 mg/kg); o texto cita 25 mg/kg, máximo 2 g, em > 4 anos.' }),
  B({ id: 'hidrocortisona-asma', nome: 'Hidrocortisona — asma (ataque)', grupo: 'respiratorio', unidade: 'mg', porKg: true, faixa: [4, 8], maximo: 250, via: 'IV; manutenção 2 mg/kg a cada 6 h', pagina: 'p. 903',
    nota: 'Cap. de asma (p. 118–119): 10 mg/kg/dose, máximo 200 mg/dia.' }),
  B({ id: 'dexametasona-crupe', nome: 'Dexametasona — crupe', grupo: 'respiratorio', unidade: 'mg', porKg: true, faixa: [0.6, 0.6], maximo: 10, via: 'VO/IM/IV, dose única', pagina: 'p. 900; p. 294',
    nota: 'Cap. de crupe (p. 294): doses de 0,15 a 0,6 mg/kg, máximo de 10 mg.',
    errata: 'O apêndice escreve "máx. 12 g" (p. 900). Não é possível confirmar 12 mg no livro; o máximo aplicado aqui é o de 10 mg do cap. de crupe (p. 294).' }),
  B({ id: 'epinefrina-nebulizacao', nome: 'Epinefrina — nebulização', grupo: 'respiratorio', unidade: 'mL', porKg: false, faixa: [3, 5], apresentacao: EPI_1_1000, via: 'inalatória; efeito breve, possível rebote', pagina: 'p. 895' }),

  // ── Crise epiléptica e HIC ──
  B({ id: 'diazepam-iv-menor5', nome: 'Diazepam — IV', grupo: 'neuro', unidade: 'mg', porKg: true, faixa: [0.15, 0.2], maximo: 5, via: 'IV, a cada 2 a 5 min; infusão rápida pode deprimir a respiração', pagina: 'p. 901', condicao: MENOR_5,
    nota: 'Crise epiléptica (p. 127): 0,2 a 0,4 mg/kg, máximo 10 mg.', anexo2Adulto: 'Anexo 2 do manual do adulto: 0,3 a 0,6 mg/kg (p. 1492).' }),
  B({ id: 'diazepam-iv-maior5', nome: 'Diazepam — IV', grupo: 'neuro', unidade: 'mg', porKg: true, faixa: [0.15, 0.2], maximo: 10, via: 'IV, a cada 2 a 5 min; infusão rápida pode deprimir a respiração', pagina: 'p. 901', condicao: MAIOR_5,
    nota: 'Crise epiléptica (p. 127): 0,2 a 0,4 mg/kg, máximo 10 mg.', anexo2Adulto: 'Anexo 2 do manual do adulto: 0,3 a 0,6 mg/kg (p. 1492).' }),
  B({ id: 'diazepam-vr-2a5', nome: 'Diazepam — retal', grupo: 'neuro', unidade: 'mg', porKg: true, faixa: [0.5, 0.5], via: 'VR', pagina: 'p. 901',
    condicao: so('2 a 5 anos (de 6 meses a 2 anos o livro diz "dose não estabelecida")', r('anos', '>=', 2), r('anos', '<=', 5)),
    nota: 'Crise epiléptica (p. 127): VR 0,5 a 1 mg/kg.' }),
  B({ id: 'diazepam-vr-6a11', nome: 'Diazepam — retal', grupo: 'neuro', unidade: 'mg', porKg: true, faixa: [0.3, 0.3], via: 'VR', pagina: 'p. 901',
    condicao: so('6 a 11 anos', r('anos', '>=', 6), r('anos', '<=', 11)) }),
  B({ id: 'diazepam-vr-12', nome: 'Diazepam — retal', grupo: 'neuro', unidade: 'mg', porKg: true, faixa: [0.2, 0.2], maximo: 20, via: 'VR', pagina: 'p. 901',
    condicao: so('≥ 12 anos', r('anos', '>=', 12)) }),
  B({ id: 'fenitoina', nome: 'Fenitoína — ataque', grupo: 'neuro', unidade: 'mg', porKg: true, faixa: [15, 20], maximo: 1000, via: 'IV em SF (precipita em SG); vel. máx. 1 a 3 mg/kg/min ou 50 mg/min, o que for mais lento', pagina: 'p. 901',
    nota: 'Crise epiléptica (p. 127): 10 a 20 mg/kg; 5 a 10 mg/kg em quem já usa fenitoína.' }),
  B({ id: 'fenobarbital', nome: 'Fenobarbital — ataque', grupo: 'neuro', unidade: 'mg', porKg: true, faixa: [15, 20], maximo: 1000, via: 'IV a 1 mg/kg/min (máx. 30 mg/min); pode repetir a cada 10 min até 40 mg/kg', pagina: 'p. 902',
    nota: 'Crise epiléptica (p. 127): 20 mg/kg IV ou IM, em 10 min.' }),
  B({ id: 'manitol', nome: 'Manitol', grupo: 'neuro', unidade: 'g', porKg: true, faixa: [0.25, 1], porMl: 0.2, apresentacao: 'manitol 20% = 0,2 g/mL (p. 720)', via: 'IV em 20 a 30 min; pode repetir a cada 6 a 8 h (osmolalidade < 320)', pagina: 'p. 896' }),
  B({ id: 'nacl3-bolus', nome: 'Cloreto de sódio 3% — bolo', grupo: 'neuro', unidade: 'mL', porKg: true, faixa: [5, 5], via: 'IV; pode repetir após 1 h; limite de Na sérico 160 mEq/L', pagina: 'p. 895',
    nota: 'Emergências oncológicas (p. 720): ataque de 2 a 6 mL/kg.' }),

  // ── Hipercalemia, hipoglicemia, insuficiência adrenal ──
  B({ id: 'bicarbonato-hipercalemia', nome: 'Bicarbonato de sódio — hipercalemia', grupo: 'metabolico', unidade: 'mEq', porKg: true, faixa: [1, 1], porMl: 1, apresentacao: BIC, via: 'IV em bolo lento', pagina: 'p. 894',
    nota: 'Cap. de distúrbios do potássio (p. 549): 1 a 2 mEq/kg EV em 10 a 15 min.' }),
  B({ id: 'polarizante-insulina', nome: 'Solução polarizante — insulina regular', grupo: 'metabolico', unidade: 'UI', porKg: true, faixa: [0.1, 0.1], maximo: 10, via: 'IV com a glicose (0,5 g/kg), em 30 min; monitorar glicemia', pagina: 'p. 549; p. 701–702',
    errata: 'O apêndice escreve "Insulina regular: 1 un/kg (máx 10 un.)" (p. 897, conferido no PDF). Os caps. de distúrbios do potássio (p. 549, tabela 7) e de emergências oncológicas (p. 701–702) dão 0,1 UI/kg (máx. 10 UI) com a mesma glicose de 0,5 g/kg; vale 0,1 UI/kg.' }),
  B({ id: 'polarizante-g10', nome: 'Solução polarizante — glicose 10%', grupo: 'metabolico', unidade: 'mL', porKg: true, faixa: [5, 5], via: 'IV com a insulina, em 30 min (0,5 g/kg de glicose)', pagina: 'p. 897', condicao: MENOR_5 }),
  B({ id: 'polarizante-g25', nome: 'Solução polarizante — glicose 25%', grupo: 'metabolico', unidade: 'mL', porKg: true, faixa: [2, 2], via: 'IV com a insulina, em 30 min (0,5 g/kg de glicose)', pagina: 'p. 897', condicao: MAIOR_5 }),
  B({ id: 'glicose-25', nome: 'Glicose 25% — hipoglicemia', grupo: 'metabolico', unidade: 'mL', porKg: true, faixa: [2, 4], via: 'IV/IO (0,5 a 1 g/kg de glicose)', pagina: 'p. 32' }),
  B({ id: 'glucagon-menor20', nome: 'Glucagon — hipoglicemia', grupo: 'metabolico', unidade: 'mg', porKg: true, faixa: [0.02, 0.03], maximo: 0.5, via: 'IM/IV; pode repetir até 3 doses', pagina: 'p. 902',
    condicao: so('< 20 kg (o livro não define a dose em exatamente 20 kg)', r('peso', '<', 20)) }),
  B({ id: 'glucagon-maior20', nome: 'Glucagon — hipoglicemia', grupo: 'metabolico', unidade: 'mg', porKg: false, faixa: [1, 1], via: 'IM/IV; pode repetir até 3 doses', pagina: 'p. 902',
    condicao: so('> 20 kg (o livro não define a dose em exatamente 20 kg)', r('peso', '>', 20)),
    semCalculo: 'O apêndice traz para > 20 kg só "dose máx. 1 mg", sem dose por kg (p. 902). Sem cálculo.' }),
  B({ id: 'hidrocortisona-adrenal', nome: 'Hidrocortisona — insuficiência adrenal aguda (inicial)', grupo: 'metabolico', unidade: 'mg', porKg: true, faixa: [2, 3], via: 'IM/IV; manutenção 1 a 5 mg/kg/dose 4x ao dia', pagina: 'p. 903',
    nota: 'O apêndice (p. 903) põe "máx. 100 mg/dose" depois da manutenção; o texto não deixa claro se vale para a dose inicial, por isso o sistema não aplica o limite.' }),

  // ── Emergência hipertensiva, cardiovascular e ataques ──
  B({ id: 'esmolol-bolus', nome: 'Esmolol — bolus', grupo: 'cardio', unidade: 'µg', porKg: true, faixa: [100, 500], via: 'IV em 1 min (emergência hipertensiva ou TSV); preferir cateter central', pagina: 'p. 895' }),
  B({ id: 'hidralazina', nome: 'Hidralazina — hipertensão aguda grave', grupo: 'cardio', unidade: 'mg', porKg: true, faixa: [0.1, 0.2], maximo: 25, via: 'IV/IM a cada 4 ou 6 h', pagina: 'p. 902',
    nota: 'Cap. de emergência hipertensiva (p. 276): 0,1 a 0,2 mg/kg/dose até 0,4 mg/kg/dose.' }),
  B({ id: 'milrinona-ataque', nome: 'Milrinona — ataque', grupo: 'cardio', unidade: 'µg', porKg: true, faixa: [50, 75], via: 'IV em 10 a 60 min', pagina: 'p. 896',
    nota: 'Cap. de miocardite (p. 253) escreve "Ataque: 25 a 50 mcg/kg/min" — unidade diferente da do apêndice; não usado no cálculo.' }),
  B({ id: 'octreotida-ataque', nome: 'Octreotida — ataque', grupo: 'cardio', unidade: 'µg', porKg: true, faixa: [1, 2], via: 'IV em bolus', pagina: 'p. 896',
    nota: 'Cap. de hemorragia digestiva (p. 349): bolus de 1 mcg/kg até o máximo de 50 mcg.',
    errata: 'A tabela 2 do apêndice (p. 905) escreve "Ataque: 1 – 2 mcg em bolus", sem "/kg"; vale a tabela 1 (p. 896), que é por kg e bate com o cap. de hemorragia digestiva (p. 349).' }),
  B({ id: 'somatostatina-ataque', nome: 'Somatostatina — ataque', grupo: 'cardio', unidade: 'µg', porKg: true, faixa: [3.5, 3.5], maximo: 250, via: 'IV', pagina: 'p. 908' }),
  B({ id: 'terbutalina-ataque', nome: 'Terbutalina — ataque', grupo: 'cardio', unidade: 'µg', porKg: true, faixa: [4, 10], via: 'IV ou IO', pagina: 'p. 909' }),
  B({ id: 'terlipressina-ataque', nome: 'Terlipressina — ataque', grupo: 'cardio', unidade: 'µg', porKg: true, faixa: [20, 20], via: 'IV em bolus', pagina: 'p. 909',
    nota: 'Estudos limitados em pediatria (p. 909); o cap. de hemorragia digestiva diz que ainda é pouco usada em crianças (p. 349).' }),

  // ── Antídotos e intoxicações ──
  B({ id: 'acetilcisteina-1', nome: 'Acetilcisteína IV — 1ª etapa (paracetamol)', grupo: 'antidoto', unidade: 'mg', porKg: true, faixa: [150, 150], via: 'IV em 1 h; iniciar até 8 h após a ingestão', pagina: 'p. 897',
    nota: 'Cap. de intoxicações (p. 206) descreve o esquema oral: 140 mg/kg de ataque e 70 mg/kg a cada 4 h por 17 doses.' }),
  B({ id: 'acetilcisteina-2', nome: 'Acetilcisteína IV — 2ª etapa', grupo: 'antidoto', unidade: 'mg', porKg: true, faixa: [50, 50], via: 'IV em 4 h', pagina: 'p. 897' }),
  B({ id: 'acetilcisteina-3', nome: 'Acetilcisteína IV — 3ª etapa', grupo: 'antidoto', unidade: 'mg', porKg: true, faixa: [100, 100], via: 'IV em 16 h', pagina: 'p. 897' }),
  B({ id: 'atropina-organofosforado', nome: 'Atropina — organofosforados', grupo: 'antidoto', unidade: 'mg', porKg: true, faixa: [0.02, 0.05], via: 'IV a cada 10 a 20 min, até efeito atropínico', pagina: 'p. 894',
    nota: 'Cap. de intoxicações (p. 206): 0,01 a 0,05 mg/kg. O apêndice não traz máximo para esta indicação.' }),
  B({ id: 'pralidoxima', nome: 'Pralidoxima — organofosforados (com atropina)', grupo: 'antidoto', unidade: 'mg', porKg: true, faixa: [20, 50], maximo: 2000, via: 'IM/IV; infundir em 15 a 30 min (máx. 200 mg/min); evitar em carbamatos', pagina: 'p. 907',
    nota: 'Cap. de intoxicações (p. 207): mesma dose, seguida de infusão de 10 a 20 mg/kg/h (ver infusões); IM 15 mg/kg.' }),
  B({ id: 'azul-metileno', nome: 'Azul de metileno — metemoglobinemia', grupo: 'antidoto', unidade: 'mg', porKg: true, faixa: [1, 2], porMl: 10, apresentacao: 'azul de metileno 1% = 10 mg/mL (p. 102)', via: 'IV lento (30 a 60 min); vesicante', pagina: 'p. 898',
    nota: 'Risco de síndrome serotoninérgica; considerar alternativa se não melhorar com 2 doses (p. 898).' }),
  B({ id: 'carvao', nome: 'Carvão ativado', grupo: 'antidoto', unidade: 'g', porKg: true, faixa: [0.5, 1], maximo: 50, via: 'VO ou SNG, de preferência até 1 h', pagina: 'p. 899' }),
  B({ id: 'flumazenil', nome: 'Flumazenil', grupo: 'antidoto', unidade: 'mg', porKg: true, faixa: [0.01, 0.01], maximo: 0.2, via: 'IV em 15 s; pode repetir a cada 1 min (até 4 vezes)', pagina: 'p. 895; p. 207',
    nota: 'Total acumulado: 0,05 mg/kg ou 1 mg (p. 895). Não usar se o benzodiazepínico controlou crise epiléptica (p. 895, p. 207).' }),
  B({ id: 'naloxona-menor', nome: 'Naloxona', grupo: 'antidoto', unidade: 'mg', porKg: true, faixa: [0.1, 0.1], maximo: 2, via: 'IV, SC, IM ou ET, a cada 2 a 3 min', pagina: 'p. 896; p. 207',
    condicao: ou('< 5 anos ou < 20 kg (o livro sobrepõe as faixas: a criança pode caber nas duas)', [r('anos', '<', 5)], [r('peso', '<', 20)]),
    nota: 'Dose máxima cumulativa de 10 mg (p. 896).' }),
  B({ id: 'naloxona-maior', nome: 'Naloxona', grupo: 'antidoto', unidade: 'mg', porKg: false, faixa: [2, 2], via: 'IV, SC, IM ou ET, a cada 2 a 3 min', pagina: 'p. 896; p. 207',
    condicao: ou('> 5 anos ou > 20 kg (o livro sobrepõe as faixas: a criança pode caber nas duas)', [r('anos', '>', 5)], [r('peso', '>', 20)]),
    nota: 'Dose máxima cumulativa de 10 mg (p. 896).' }),
  B({ id: 'vitamina-k', nome: 'Vitamina K (fitomenadiona) — anticoagulantes', grupo: 'antidoto', unidade: 'mg', porKg: true, faixa: [0.03, 0.03], via: 'IV', pagina: 'p. 910; p. 208',
    nota: 'Alternativa: 2 a 5 mg/dose SC, IM ou VO (p. 910); 5 mg no sangramento significativo (p. 208).' }),
  B({ id: 'difenidramina', nome: 'Difenidramina', grupo: 'antidoto', unidade: 'mg', porKg: true, faixa: [1, 1], maximo: 50, via: 'IV ou IM a cada 6 a 8 h (máx. 5 mg/kg/dia)', pagina: 'p. 901',
    nota: 'Antídoto de metoclopramida e haloperidol (tabela de antídotos, p. 206).' }),
]

export type Aplica = 'sim' | 'nao' | 'indefinido'

function regraVale(g: Regra, pesoKg: number, idadeMeses?: number): boolean | null {
  let x: number
  if (g.campo === 'peso') x = pesoKg
  else if (idadeMeses === undefined || !Number.isFinite(idadeMeses) || idadeMeses < 0) return null
  else x = g.campo === 'meses' ? Math.floor(idadeMeses) : Math.floor(idadeMeses / 12)
  switch (g.op) {
    case '<': return x < g.valor
    case '<=': return x <= g.valor
    case '>': return x > g.valor
    case '>=': return x >= g.valor
  }
}

/** A condição do livro vale para este peso/idade? Sem idade, regras de idade ficam indefinidas. */
export function avaliarCondicao(c: Condicao | undefined, pesoKg: number, idadeMeses?: number): Aplica {
  if (!c) return 'sim'
  let algumIndefinido = false
  for (const alt of c.alternativas) {
    const v = alt.map((g) => regraVale(g, pesoKg, idadeMeses))
    if (v.every((x) => x === true)) return 'sim'
    if (!v.includes(false)) algumIndefinido = true
  }
  return algumIndefinido ? 'indefinido' : 'nao'
}

export type DoseCalculada = {
  /** dose total para o peso, limitada ao máximo */
  faixa: [number, number]
  /** volume da apresentação citada pelo livro, quando houver */
  volumeMl: [number, number] | null
  noMaximo: boolean
  abaixoDoAviso: boolean
  aplica: Aplica
}

/** Dose para o peso (e idade em meses, quando a regra depende dela). Sem dado no livro ou peso inválido: null. */
export function calcularBolus(b: Bolus, pesoKg: number, idadeMeses?: number): DoseCalculada | null {
  if (!Number.isFinite(pesoKg) || pesoKg <= 0 || b.semCalculo) return null
  const bruto = b.faixa.map((x) => (b.porKg ? x * pesoKg : x)) as [number, number]
  const lim = (x: number) => (b.maximo !== undefined ? Math.min(x, b.maximo) : x)
  const faixa: [number, number] = [lim(bruto[0]), lim(bruto[1])]
  return {
    faixa,
    volumeMl: b.porMl ? [faixa[0] / b.porMl, faixa[1] / b.porMl] : null,
    noMaximo: b.maximo !== undefined && bruto[1] > b.maximo,
    abaixoDoAviso: b.aviso !== undefined && faixa[0] < b.aviso.abaixoDe,
    aplica: avaliarCondicao(b.condicao, pesoKg, idadeMeses),
  }
}
