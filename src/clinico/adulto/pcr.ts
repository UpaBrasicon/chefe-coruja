import type { Ficha, Fonte } from '../ficha.ts'
import { fichaAdulto, pagina } from './fonte.ts'
import { INFUSOES_ADULTO, concentracao } from './infusoes.ts'

// Arritmias e PCR do adulto — Manual de Medicina de Emergência do HCFMUSP
// (3ª ed., 2022): cap. 2 PCR no adulto (p. 48–51), cap. 15 Bradiarritmias
// (p. 229) e cap. 18 Outras taquiarritmias (p. 265–266). Uma ficha por
// ferramenta. A ferramenta calcula o que depende de peso ou de tempo; a
// indicação é do médico (ADR 0007).
//
// Bradicardia, versão .1 de 28/09/2026: ERC/RCUK 2025 (texto aberto lido) ao
// lado do cap. 15. A dose de atropina de 1 mg da AHA (2020/2025) não pôde ser
// conferida no texto integral e fica registrada como não confirmada.
//
// PCR, versão .1 de 25/10/2026 (lacunas da Central, lote 3): AHA 2025, Part 9,
// lida no texto integral publicado pela AHA em cpr.heart.org — recomendações
// com classe e nível e as doses do quadro da Figura 2. A Tabela 2 do manual
// continua a base da ferramenta; a AHA aparece ao lado.

export type Faixa = [number, number]

const valido = (x: number) => Number.isFinite(x) && x > 0
const vezes = (f: Faixa, k: number): Faixa => [f[0] * k, f[1] * k]

export type ItemManual = {
  id: string
  nome: string
  dose: string
  quando: string
  pagina: string
  errata?: string
  nota?: string
}

// ── PCR (cap. 2) ─────────────────────────────────────────────────────────────

export const AHA_ALS_2025: Fonte = {
  citacao: 'Wigginton JG, Agarwal S, Bartos JA, Coute RA, Drennan IR, Haamid A, Kudenchuk PJ, Link MS, Panchal AR, Pelter MM, Del Rios M, Rodriguez AJ, Perman SM, Sanko S, Kotini-Shah P, Kurz MC. Part 9: advanced life support: 2025 American Heart Association Guidelines for Cardiopulmonary Resuscitation and Emergency Cardiovascular Care. Circulation. 2025;152(suppl 2):S538–S577. Texto integral em cpr.heart.org: desfibrilação (seção 5), troca de vetor e dupla desfibrilação sequencial (seção 7), acesso vascular (seção 9), vasopressores (seção 10), outras drogas (seção 11), adjuntos da RCP (seção 12), término da reanimação (seção 13); doses e cargas no quadro da Figura 2.',
  url: 'https://doi.org/10.1161/CIR.0000000000001376',
}

// Revisão PubMed de 09/10/2026, itens médios (decisão do RT em 06/11/2026): os
// ensaios por trás de três recomendações da AHA 2025 entram como nota na linha
// de cada uma. A troca de vetor continua 2b (utilidade não estabelecida) e
// não aparece como recomendação; nenhuma dose nem carga muda.
export const IVIO_2025: Fonte = {
  citacao: 'Vallentin MF, Granfeldt A, Klitgaard TL, et al. Intraosseous or Intravenous Vascular Access for Out-of-Hospital Cardiac Arrest (IVIO). N Engl J Med. 2025;392(4):349–360 (PMID 39480221).',
  url: 'https://doi.org/10.1056/NEJMoa2407616',
}

export const PARAMEDIC3_2025: Fonte = {
  citacao: 'Couper K, Ji C, Deakin CD, et al. A Randomized Trial of Drug Route in Out-of-Hospital Cardiac Arrest (PARAMEDIC-3). N Engl J Med. 2025;392(4):336–348 (PMID 39480216).',
  url: 'https://doi.org/10.1056/NEJMoa2407780',
}

export const DOSE_VF_2022: Fonte = {
  citacao: 'Cheskes S, Verbeek PR, Drennan IR, et al. Defibrillation Strategies for Refractory Ventricular Fibrillation (DOSE VF). N Engl J Med. 2022;387(21):1947–1956 (PMID 36342151).',
  url: 'https://doi.org/10.1056/NEJMoa2207304',
}

export const BICARBONATO_PCR_IH_2026: Fonte = {
  citacao: 'Granfeldt A, Kirkegaard BL, Vallentin MF, et al. Sodium Bicarbonate for In-Hospital Cardiac Arrest: A Randomized Clinical Trial. JAMA. 2026;336(8):647–654 (PMID 42273960).',
  url: 'https://doi.org/10.1001/jama.2026.10628',
}

export const NOTA_PCR_ACESSO =
  "IVIO (NEJM 2025; 1.479 PCR extra-hospitalares) e PARAMEDIC-3 (NEJM 2025; 6.082): começar pelo intraósseo não melhorou o RCE sustentado nem a sobrevida em 30 dias; no PARAMEDIC-3 o RCE em qualquer momento foi menor com IO primeiro (36,0% × 39,1%). São a base do 'IV primeiro' da AHA 2025; a dose não muda."

export const NOTA_PCR_TROCA_VETOR =
  'DOSE VF (NEJM 2022; 405 FV refratárias extra-hospitalares; interrompido pela covid-19): sobrevida à alta de 30,4% com dupla desfibrilação sequencial e de 21,7% com troca de vetor (pás anteroposteriores), contra 13,3% com a padrão. A AHA 2025 ainda classifica a utilidade como não estabelecida (2b); a carga do choque não muda.'

export const NOTA_PCR_BICARBONATO =
  'Ensaio dinamarquês (JAMA 2026; 779 PCR intra-hospitalares, duplo-cego): bicarbonato × placebo sem diferença no RCE sustentado (39% × 37%), com mais alcalose e hipernatremia. Reforça o livro: bicarbonato só nas indicações específicas.'

// Lote 1 da revisão do HCFMUSP, L2 (decisão do RT de 13/11/2026): o CoSTR 2026 do
// ILCOR saiu depois da AHA 2025. Lido no texto da pré-publicação aberta do ILCOR
// (maio de 2026; o texto final na Resuscitation está fechado). Só o adulto.
export const ILCOR_COSTR_2026: Fonte = {
  citacao: 'Bray JE, Djarv T, Drennan IR, et al. 2026 International Liaison Committee on Resuscitation Consensus on Science With Treatment Recommendations: Summary from the Basic Life Support; Advanced Life Support; Pediatric Life Support; Neonatal Life Support; Education, Implementation, and Teams; and First Aid Task Forces. Resuscitation. 2026:111328 (PMID 42988037). Lido na pré-publicação aberta do ILCOR (maio de 2026): ALS 3203, 3212, 3207/3518, 3305; BLS 2401, 2404, 2501, 2605.',
  url: 'https://doi.org/10.1016/j.resuscitation.2026.111328',
}

/** Recomendações do CoSTR 2026 (ILCOR) para o adulto, com a força e a certeza da evidência. */
export type ItemCostr2026 = { tema: string; recomendacao: string; forca: string; codigo: string; muda: string }

export const COSTR_2026_PCR: ItemCostr2026[] = [
  { tema: 'Trombolítico de rotina', recomendacao: 'Não fazer trombolítico de rotina durante a RCP. A recomendação própria para a PCR por TEP suspeito continua a mesma.', forca: 'forte, certeza moderada', codigo: 'ALS 3203', muda: 'confirma a de 2010 com revisão nova; aumento de hemorragia intracraniana em 1 ECR' },
  { tema: 'Volume durante a RCP', recomendacao: 'Não fazer volume de rotina durante a RCP na PCR não traumática sem causa definida; se havia hipovolemia antes da parada, volume pode ser razoável. Não usar amido (hidroxietilamido) durante a RCP nem depois do RCE.', forca: 'fraca, certeza muito baixa (volume); forte, certeza muito baixa (amido); boa prática (hipovolemia)', codigo: 'ALS 3207 e 3518', muda: 'nova: antes "evidência insuficiente" (2010)' },
  { tema: 'Adrenalina intramuscular', recomendacao: 'Evidência insuficiente para acrescentar adrenalina IM ao suporte avançado; não vale onde não há acesso IV ou IO.', forca: 'fraca, certeza muito baixa', codigo: 'ALS 3212', muda: 'nova' },
  { tema: 'Carregar o desfibrilador', recomendacao: 'Carregar o desfibrilador manual durante as compressões, antes ou depois da análise do ritmo, com equipe treinada.', forca: 'fraca, certeza muito baixa', codigo: 'BLS 2605 e ALS 3105', muda: 'nova' },
  { tema: 'Ventilação', recomendacao: '2 ventilações a cada 30 compressões, ou 10 por minuto (1 a cada 6 s) com compressão contínua, com ou sem via aérea avançada; volume que faça o tórax subir, sem hiper nem hipoventilar; bolsa de adulto padrão (1.500–1.600 mL).', forca: 'fraca, certeza muito baixa; boa prática (volume)', codigo: 'BLS 2401 e 2404', muda: 'nova revisão' },
  { tema: 'Oxigênio durante a RCP', recomendacao: 'A maior concentração de oxigênio possível.', forca: 'fraca, certeza muito baixa', codigo: 'ALS 3305', muda: 'igual à de 2020' },
  { tema: 'Compressões', recomendacao: '100–120 por minuto, cerca de 5 cm sem passar de 6 cm, sem apoiar no tórax entre as compressões.', forca: 'forte (frequência e profundidade); fraca (retorno do tórax)', codigo: 'BLS 2501', muda: 'igual à de 2015' },
]

const PAG_PCR = 'cap. 2 PCR no adulto, p. 48–51 (Tabela 2)'

export const fichaPcrAdulto: Ficha = {
  ...fichaAdulto('adulto-pcr', 'Drogas e desfibrilação na PCR — adulto', PAG_PCR),
  versao: '2026-11-13.1',
  fontes: [pagina(PAG_PCR), AHA_ALS_2025, IVIO_2025, PARAMEDIC3_2025, DOSE_VF_2022, BICARBONATO_PCR_IH_2026, ILCOR_COSTR_2026],
  revisadoEm: '13/11/2026 (CoSTR 2026 do ILCOR: trombolítico e volume de rotina, adrenalina IM, carga do desfibrilador, ventilação; lote 1 da revisão do HCFMUSP, sem mudança de dose); 06/11/2026 (notas de IVIO, PARAMEDIC-3, DOSE VF e bicarbonato na PCR intra-hospitalar; revisão PubMed, itens médios); 25/10/2026 (lacunas da Central, lote 3: AHA 2025 Part 9 lida no texto integral; manual mantido como base)',
}

export const CHOQUE_PCR = { monofasicoJ: 360, bifasicoJ: 200, pagina: 'p. 48' }

export const DROGAS_PCR: ItemManual[] = [
  { id: 'adrenalina', nome: 'Adrenalina', dose: '1 mg IV ou IO a cada 3 a 5 minutos', quando: 'todos os ritmos; após o 2º choque em FV/TV sem pulso; em AESP/assistolia o mais precocemente possível', pagina: 'p. 49' },
  { id: 'amiodarona', nome: 'Amiodarona', dose: '1ª dose 300 mg IV/IO; 2ª dose 150 mg IV/IO', quando: 'FV/TV sem pulso — 1ª dose após o 3º choque, 2ª após o 5º', pagina: 'p. 49' },
  { id: 'lidocaina', nome: 'Lidocaína', dose: '1–1,5 mg/kg', quando: 'FV/TV sem pulso, como alternativa à amiodarona', pagina: 'p. 49' },
  { id: 'magnesio', nome: 'Magnésio', dose: '1–2 g IV em bolus; manutenção 0,5 a 2 g/h', quando: 'torsades de pointes; hipomagnesemia', pagina: 'p. 49' },
  { id: 'bicarbonato', nome: 'Bicarbonato de sódio 8,4%', dose: '1–1,5 mEq/kg IV; adicional: metade da dose a cada 5–15 minutos', quando: 'intoxicação por tricíclicos, hipercalemia, acidose metabólica grave previamente conhecida', pagina: 'p. 50',
    nota: 'O livro dá a dose em mEq; o volume em mL não é calculado porque o capítulo não traz a concentração em mEq/mL.' },
  { id: 'calcio', nome: 'Gluconato de cálcio 10%', dose: '20–30 mL IV a cada 2–5 minutos', quando: 'hipercalemia', pagina: 'p. 50' },
  { id: 'kcl', nome: 'KCl 19,1%', dose: '2 mEq/min durante 10 minutos (20 mEq); manutenção "0,5–1 mEq por mais 10 minutos" se PCR mantida', quando: 'hipocalemia', pagina: 'p. 50',
    errata: 'Na manutenção falta a unidade de tempo ("0,5–1 mEq por mais 10 minutos"): não se sabe se é por minuto. A manutenção não é calculada.' },
  { id: 'alteplase', nome: 'Alteplase', dose: '50 mg IV em bolus, podendo ser repetido após 15 minutos; o consenso europeu orienta compressões por 60–90 min após', quando: 'TEP suspeito ou confirmado (não trombolisar IAM)', pagina: 'p. 50' },
  { id: 'emulsao', nome: 'Emulsão lipídica', dose: '1,5 mL/kg IV em 1 minuto e infusão de 0,25 mL/kg/min por 30–60 minutos', quando: 'intoxicação por anestésico local', pagina: 'p. 50' },
  { id: 'glicose-insulina', nome: 'Glicose + insulina', dose: '25 g de glicose + 10 U de insulina regular IV em bolus', quando: 'hipercalemia', pagina: 'p. 51' },
]

export type PcrPorPeso = {
  lidocainaMg: Faixa
  bicarbonatoMEq: Faixa
  bicarbonatoAdicionalMEq: Faixa
  emulsaoBolusMl: number
  emulsaoMlMin: number
  emulsaoMlH: number
  /** volume da infusão em 30 e em 60 minutos */
  emulsaoInfusaoMl: Faixa
}

/** Doses por peso da Tabela 2 (p. 49–50). */
export function calcularPcr(pesoKg: number): PcrPorPeso | null {
  if (!valido(pesoKg)) return null
  const bic = vezes([1, 1.5], pesoKg)
  const mlMin = 0.25 * pesoKg
  return {
    lidocainaMg: vezes([1, 1.5], pesoKg),
    bicarbonatoMEq: bic,
    bicarbonatoAdicionalMEq: [bic[0] / 2, bic[1] / 2],
    emulsaoBolusMl: 1.5 * pesoKg,
    emulsaoMlMin: mlMin,
    emulsaoMlH: mlMin * 60,
    emulsaoInfusaoMl: [mlMin * 30, mlMin * 60],
  }
}

/** KCl 19,1%: 2 mEq/min por 10 min (p. 50). */
export const KCL_ATAQUE_MEQ = 2 * 10

// ── AHA 2025, Part 9 (texto integral) ────────────────────────────────────────

/** Quadro da Figura 2 (Adult Cardiac Arrest Algorithm). */
export const AHA_2025_PCR = {
  bifasicoJ: [120, 200] as Faixa,
  monofasicoJ: 360,
  adrenalinaMg: 1,
  amiodaronaMg: [300, 150],
  lidocainaMgKg: { primeira: [1, 1.5] as Faixa, segunda: [0.5, 0.75] as Faixa },
  pagina: 'Part 9, Figura 2',
}

/** Segunda dose de lidocaína da Figura 2 (0,5–0,75 mg/kg); o manual traz só a primeira. */
export function lidocainaSegundaDoseMg(pesoKg: number): Faixa | null {
  return valido(pesoKg) ? vezes(AHA_2025_PCR.lidocainaMgKg.segunda, pesoKg) : null
}

/** `nota`: novidade ou divergência posterior à diretriz, com a fonte na ficha (revisão PubMed). */
export type ItemAls2025 = { tema: string; aha: string; onde: string; livro: string; nota?: string }

export const DIRETRIZ_ALS_2025: ItemAls2025[] = [
  { tema: 'Carga do choque', aha: 'Bifásico: a carga do fabricante (por exemplo, 120–200 J no 1º choque); se desconhecida, a máxima disponível. Choques seguintes equivalentes, e cargas maiores podem ser consideradas (2b). Monofásico: 360 J. Choque único em vez de choques empilhados (2a).', onde: 'seção 5; Figura 2', livro: '200 J no bifásico ou a do fabricante; 360 J no monofásico; choque único (p. 48)' },
  { tema: 'Adrenalina', aha: '1 mg a cada 3–5 min (2a). Ritmo não chocável: o mais cedo possível (2a). Ritmo chocável: depois que as primeiras tentativas de desfibrilação falharem (2a). Vasopressina, sozinha ou com adrenalina, e adrenalina em dose alta não têm benefício (3).', onde: 'seção 10; Figura 2', livro: '1 mg a cada 3–5 min; após o 2º choque em FV/TV; em AESP/assistolia o mais cedo possível (p. 49)' },
  { tema: 'Antiarrítmico', aha: 'Amiodarona ou lidocaína podem ser consideradas na FV/TV sem pulso que não responde ao choque (2b). Amiodarona 300 mg em bolo, depois 150 mg; lidocaína 1–1,5 mg/kg, depois 0,5–0,75 mg/kg. Betabloqueador, procainamida ou sotalol: benefício incerto (2b).', onde: 'seção 11; Figura 2', livro: 'amiodarona 300 mg, depois 150 mg; lidocaína 1–1,5 mg/kg, sem a segunda dose (p. 49)' },
  { tema: 'Cálcio, bicarbonato e magnésio', aha: 'Uso de rotina na PCR não é recomendado (3: sem benefício).', onde: 'seção 11', livro: 'indicações específicas: hipercalemia, tricíclicos, acidose grave conhecida, torsades, hipomagnesemia (p. 49–50)', nota: NOTA_PCR_BICARBONATO },
  { tema: 'Acesso vascular', aha: 'Tentar primeiro o acesso venoso (1); intraósseo se o venoso falhar ou não for viável (2a); central, por quem tem treino, se os dois falharem (2b).', onde: 'seção 9', livro: 'IV ou IO (p. 49)', nota: NOTA_PCR_ACESSO },
  { tema: 'Troca de vetor e dupla desfibrilação sequencial', aha: 'A utilidade não está estabelecida na FV/TV sem pulso que persiste após 3 ou mais choques consecutivos (2b).', onde: 'seção 7', livro: '—', nota: NOTA_PCR_TROCA_VETOR },
  { tema: 'EtCO2 e término da reanimação', aha: 'Intubado: EtCO2 que não passa de 10 mmHg após 20 min de suporte avançado pode compor uma decisão multimodal (2b). Não intubado: nenhum valor de EtCO2 deve, sozinho, indicar o fim da reanimação (3: dano). Subida abrupta de EtCO2 pode indicar retorno da circulação (2b).', onde: 'seções 12 e 13', livro: '—' },
  { tema: 'Outros adjuntos', aha: 'Marca-passo na PCR estabelecida não é recomendado de rotina (3: sem benefício). Ultrassom à beira-leito para causas reversíveis: não bem estabelecido, só sem interromper a RCP (2b). Oxigênio na maior concentração possível durante a RCP (2b).', onde: 'seções 8 e 12', livro: '—' },
]

// ── Bradiarritmias (cap. 15) ─────────────────────────────────────────────────

export const ERC_RCUK_2025_ALS: Fonte = {
  citacao: 'Resuscitation Council UK. 2025 Resuscitation Guidelines: Adult Advanced Life Support (Soar J, Yeung J, Couper K, et al.; texto aberto idêntico às ERC Guidelines 2025 Adult Advanced Life Support, Resuscitation 2025). Seção de bradicardia.',
  url: 'https://www.resus.org.uk/library/2025-resuscitation-guidelines/adult-advanced-life-support-guidelines',
}

// AHA 2025, Part 9, lida no texto integral em cpr.heart.org em 27/10/2026 (pendência do
// lote 3): seção 19 e o quadro "Doses/Details" da Figura 8.
export const AHA_ALS_2025_BRADI: Fonte = {
  citacao: 'Wigginton JG, et al. Part 9: advanced life support: 2025 American Heart Association Guidelines for Cardiopulmonary Resuscitation and Emergency Cardiovascular Care. Circulation. 2025;152(suppl 2):S538–S577. Seção 19 (Initial Management of Bradycardia), recomendação 2: atropina é razoável na bradicardia aguda com comprometimento hemodinâmico (classe 2a, B-NR); doses no quadro "Doses/Details" da Figura 8 (Adult Bradycardia With a Pulse Algorithm), lidas no texto integral em cpr.heart.org.',
  url: 'https://doi.org/10.1161/CIR.0000000000001376',
}

const PAG_BRADI = 'cap. 15 Bradiarritmias, p. 229; preparo da adrenalina: Anexo 1, p. 1487–1488'

export const fichaBradicardiaAdulto: Ficha = {
  ...fichaAdulto('adulto-bradicardia', 'Bradicardia sintomática — adulto', PAG_BRADI),
  versao: '2026-10-27.1',
  fontes: [pagina(PAG_BRADI), ERC_RCUK_2025_ALS, AHA_ALS_2025_BRADI],
  revisadoEm: '27/10/2026 (AHA 2025 lida no texto integral: seção 19 e Figura 8; ERC/RCUK 2025 no texto aberto; manual mantido como base)',
}

/**
 * ERC/RCUK 2025: atropina 500 µg IV, repetir a cada 3–5 min até 3 mg; segunda linha e marca-passo.
 * AHA 2025 (Figura 8): 1ª dose de 1 mg em bolo, repetir a cada 3–5 min, total máximo de 3 mg (2a, B-NR).
 */
export const BRADI_2025 = {
  atropina: { ug: 500, intervaloMin: [3, 5] as Faixa, maximoMg: 3 },
  aha: { mg: 1, intervaloMin: [3, 5] as Faixa, maximoMg: 3, classe: '2a, B-NR', onde: 'seção 19, recomendação 2; Figura 8' },
  resumo: 'ERC/RCUK 2025 e AHA 2025, lidas no texto: as duas repetem a atropina a cada 3–5 min até 3 mg; a dose de cada bolo difere (ERC 0,5 mg; AHA 1 mg).',
  segundaLinha: [
    { droga: 'Isoprenalina', dose: '5 µg/min como dose inicial' },
    { droga: 'Adrenalina', dose: '2–10 µg/min (confirma a unidade µg/min que o manual imprime errada)' },
    { droga: 'Aminofilina', dose: '100–200 mg IV lenta, no transplante cardíaco ou na lesão medular' },
    { droga: 'Glucagon', dose: 'se betabloqueador ou bloqueador de canal de cálcio forem a causa (dose não constante do trecho lido)' },
  ],
  marcaPasso: 'Transvenoso nos instáveis; transcutâneo como ponte',
}

export const DIFERENCAS_BRADI_2025: string[] = [
  'Atropina: o manual (p. 229) e a ERC/RCUK 2025 usam 0,5 mg (500 µg) até 3 mg; o intervalo passa de "a cada 3 min" para 3–5 min. A AHA 2025 (Figura 8) usa 1 mg em bolo, a cada 3–5 min, até 3 mg (2a, B-NR): no máximo 3 doses, em vez de 6.',
  'A AHA 2025 (Figura 8) traz dopamina 5–20 µg/kg/min e adrenalina 2–10 µg/min, os mesmos valores do manual com a errata da adrenalina.',
  'Adrenalina 2–10 µg/min e dopamina 5–20 µg/kg/min: a ERC 2025 confirma a adrenalina em µg/min (a errata da ferramenta está certa); a dopamina não aparece no trecho da ERC lido.',
  'A ERC 2025 acrescenta isoprenalina 5 µg/min e aminofilina 100–200 mg (transplante cardíaco ou lesão medular); o manual traz aminofilina 250 mg no BAV pós-IAM.',
]

export const ATROPINA = { doseMg: 0.5, intervaloMin: 3, maximoMg: 3, pagina: 'p. 229' }

/** Nº de doses de atropina até o máximo e minutos até a última (p. 229). */
export function esquemaAtropina() {
  const n = Math.round(ATROPINA.maximoMg / ATROPINA.doseMg)
  return { doses: n, minutosAteUltima: (n - 1) * ATROPINA.intervaloMin }
}

export const DOPAMINA_BRADI: Faixa = [5, 20] // µg/kg/min, p. 229

/** Dopamina 5–20 µg/kg/min em µg/min para o peso. O livro não traz preparo de dopamina. */
export function dopaminaUgMin(pesoKg: number): Faixa | null {
  return valido(pesoKg) ? vezes(DOPAMINA_BRADI, pesoKg) : null
}

/**
 * Adrenalina na bradicardia: o livro imprime 2–10 µg/kg/min (p. 229). A
 * unidade coerente é µg/min — é a unidade da adrenalina no Anexo 1 do mesmo
 * livro (faixa 1–20 µg/min, p. 1487–1488). A conta usa 2–10 µg/min e o
 * preparo do Anexo 1 (60 µg/mL).
 */
export const ADRENALINA_BRADI = {
  ugMin: [2, 10] as Faixa,
  pagina: 'p. 229',
  errata: 'O livro escreve "adrenalina 2-10 µg/kg/min". A unidade coerente é µg/min (Anexo 1 do mesmo livro: adrenalina 1–20 µg/min, p. 1487–1488). Em µg/kg/min, um adulto de 70 kg receberia 140–700 µg/min, 7 a 35 vezes o teto do anexo.',
}

const adrenalinaAnexo = () => INFUSOES_ADULTO.find((i) => i.id === 'adrenalina')!

/** mL/h da adrenalina 2–10 µg/min no preparo do Anexo 1 (60 µg/mL). */
export function adrenalinaBradiMlH(): Faixa {
  const c = concentracao(adrenalinaAnexo())
  return [(ADRENALINA_BRADI.ugMin[0] * 60) / c, (ADRENALINA_BRADI.ugMin[1] * 60) / c]
}

/** O que a unidade impressa (µg/kg/min) daria — só para mostrar o tamanho do erro. */
export function adrenalinaUnidadeImpressaUgMin(pesoKg: number): Faixa | null {
  return valido(pesoKg) ? vezes(ADRENALINA_BRADI.ugMin, pesoKg) : null
}

export const OUTRAS_BRADI: ItemManual[] = [
  { id: 'glucagon', nome: 'Glucagon', dose: 'bolus de 5–10 mg em alguns minutos, seguido de infusão contínua de 1 a 5 mg/h', quando: 'intoxicação por bloqueador de canal de cálcio ou betabloqueador', pagina: 'p. 229' },
  { id: 'aminofilina', nome: 'Aminofilina', dose: '250 mg EV em bolus', quando: 'IAM com BAV de 2º ou 3º grau, sem instabilidade ou sintomas graves', pagina: 'p. 229' },
]

// ── Outras taquiarritmias (cap. 18) ──────────────────────────────────────────

// Lote 2 da revisão do HCFMUSP, M2 (decisão do RT de 13/11/2026), cap. 18: as
// recomendações de taquicardia da AHA 2025 (Part 9) foram lidas em 14/11/2026 no
// texto integral da Circulation, pelo Chrome do RT. As tabelas de recomendação
// e a Figura 6 são imagens e foram lidas uma a uma. O manual (cap. 18,
// p. 262–266) foi conferido no PDF. Doses e contas do manual não mudam.
const PAG_TAQUI = 'cap. 18 Outras taquiarritmias, p. 265–266'

export const AHA_ALS_2025_TAQUI: Fonte = {
  citacao: 'Wigginton JG, et al. Part 9: Adult Advanced Life Support: 2025 American Heart Association Guidelines for Cardiopulmonary Resuscitation and Emergency Cardiovascular Care. Circulation. 2025;152(suppl 2):S538–S577 (PMID 41122884). Seções de taquicardia de QRS largo, TV polimórfica e taquicardia regular de QRS estreito, com classe (COR) e nível (LOE), e a Figura 6 (algoritmo de taquiarritmia com pulso e quadro de doses), lidas no texto integral da Circulation.',
  url: 'https://doi.org/10.1161/CIR.0000000000001376',
}

export const fichaTaquiarritmiaAdulto: Ficha = {
  ...fichaAdulto('adulto-taquiarritmias', 'Taquiarritmias — drogas EV do adulto', PAG_TAQUI),
  versao: '2026-11-14.1',
  fontes: [pagina(PAG_TAQUI), AHA_ALS_2025_TAQUI],
  revisadoEm: '14/11/2026 (AHA 2025, Part 9, seções de taquicardia lidas no texto integral, ao lado do manual; lote 2 da revisão do HCFMUSP; aguarda aprovação do RT); 27/09/2026 (conferido no livro, com errata anotada)',
}

const SEM_ITEM_TAQUI = 'sem item do manual na ferramenta'

/** AHA 2025 × manual nas taquicardias com pulso, um tema por linha. */
export const DIRETRIZ_TAQUI_2025: { tema: string; aha: string; classe: string; onde: string; livro: string }[] = [
  { tema: 'Instabilidade', aha: 'Taquiarritmia persistente com hipotensão, alteração aguda do estado mental, sinais de choque, dor torácica isquêmica ou IC aguda: cardioversão sincronizada, com sedação sempre que possível', classe: 'figura', onde: 'Figura 6', livro: 'dor torácica, alteração do nível de consciência, edema pulmonar ou PAS < 90 mmHg: cardioversão sincronizada com sedação (p. 262)' },
  { tema: 'QRS largo instável', aha: 'Cardioversão sincronizada', classe: '1, B-NR', onde: 'QRS largo, rec. 1', livro: 'cardioversão sincronizada (p. 262)' },
  { tema: 'QRS largo estável', aha: 'Cardioversão sincronizada quando manobra vagal e drogas falham ou são contraindicadas (1, B-NR). Amiodarona, procainamida ou sotalol IV podem ser considerados (2b, B-R)', classe: '1 e 2b', onde: 'QRS largo, rec. 2 e 3', livro: 'na TV monomórfica estável, cardioversão é a primeira linha; drogas se o paciente recusa ou não tolera a sedação; procainamida indisponível no Brasil (p. 264)' },
  { tema: 'Adenosina no QRS largo', aha: 'Pode ser considerada no QRS largo estável, regular e monomórfico, para tratar ou ajudar no diagnóstico (2b, B-NR). Não usar no instável, irregular ou polimórfico (3: dano, C-LD)', classe: '2b e 3: dano', onde: 'QRS largo, rec. 4 e 6', livro: SEM_ITEM_TAQUI },
  { tema: 'Verapamil e diltiazem no QRS largo', aha: 'Não usar', classe: '3: dano, B-NR', onde: 'QRS largo, rec. 5', livro: 'não usar na disfunção de VE nem na FA com Wolff-Parkinson-White (p. 266)' },
  { tema: 'Amiodarona IV', aha: '150 mg em 10 min, repetida se a TV voltar; depois 1 mg/min nas primeiras 6 h', classe: 'figura', onde: 'Figura 6, quadro de doses', livro: '150 mg em 10 min, 1 mg/min por 6 h e 0,5 mg/min por 18 h (p. 265)' },
  { tema: 'Procainamida IV', aha: '20–50 mg/min até suprimir a arritmia, hipotensão, alargar o QRS > 50% ou chegar a 17 mg/kg; manutenção de 1–4 mg/min; evitar com QT longo ou IC', classe: 'figura', onde: 'Figura 6, quadro de doses', livro: 'indisponível no Brasil (p. 264)' },
  { tema: 'TV polimórfica sustentada', aha: 'Choque não sincronizado imediato', classe: '1, B-NR', onde: 'TV polimórfica, rec. 1', livro: 'no torsades instável, desfibrilar (p. 262)' },
  { tema: 'Magnésio', aha: 'Pode ser considerado nas recorrências de TV polimórfica com QT longo, o torsades (2b, C-LD). Não usar de rotina na TV polimórfica com QT normal (3: sem benefício, C-LD)', classe: '2b e 3: sem benefício', onde: 'TV polimórfica, rec. 2 e 4', livro: 'sulfato de magnésio 2 g EV em 15 min no torsades estável, mesmo sem hipomagnesemia (p. 266)' },
  { tema: 'TV polimórfica com QT normal', aha: 'Lidocaína ou amiodarona IV e tratar a isquemia podem ser considerados nas recorrências', classe: '2b, C-LD', onde: 'TV polimórfica, rec. 3', livro: SEM_ITEM_TAQUI },
  { tema: 'QRS estreito regular: manobra vagal', aha: 'Recomendada como tratamento agudo', classe: '1, B-R', onde: 'QRS estreito, rec. 1', livro: 'manobra vagal modificada é a primeira tentativa (p. 265)' },
  { tema: 'QRS estreito regular: adenosina', aha: 'Recomendada (1, B-R). Dose da Figura 6: 6 mg em bolus rápido com flush de SF; 12 mg se necessário', classe: '1, B-R', onde: 'QRS estreito, rec. 2; Figura 6', livro: '6 mg; se não resolver em 2 min, 12 mg, que pode ser repetida uma vez; metade em acesso central (p. 265)' },
  { tema: 'TSV (QRS estreito regular): diltiazem ou verapamil IV', aha: 'Diltiazem ou verapamil IV podem ser eficazes no paciente estável', classe: '2a, B-R', onde: 'QRS estreito, rec. 5', livro: 'terceira linha; verapamil 1 mg/min até 20 mg e diltiazem 2,5 mg/min até 50 mg (p. 265–266)' },
  { tema: 'TSV (QRS estreito regular): betabloqueador IV', aha: 'Betabloqueador IV é razoável no paciente estável', classe: '2a, C-LD', onde: 'QRS estreito, rec. 6', livro: 'esmolol como terceira linha (p. 265)' },
  { tema: 'QRS estreito: cardioversão', aha: 'No instável (1, B-NR) e no estável quando manobra vagal e drogas falham ou são contraindicadas (1, B-NR)', classe: '1, B-NR', onde: 'QRS estreito, rec. 3 e 4', livro: 'na falha do tratamento medicamentoso, cardioversão sincronizada (p. 266)' },
  { tema: 'Energia da cardioversão', aha: 'Seguir a carga recomendada pelo fabricante do aparelho; se não souber, usar a carga máxima', classe: 'figura', onde: 'Figura 6, quadro de doses', livro: SEM_ITEM_TAQUI },
]

export const DIFERENCAS_TAQUI_2025: string[] = [
  'TV monomórfica estável: o manual põe a cardioversão como primeira linha; a AHA 2025 a recomenda quando manobra vagal e drogas falham ou são contraindicadas (1, B-NR), e as drogas são 2b.',
  'Adenosina no QRS largo: a AHA 2025 aceita no estável, regular e monomórfico (2b) e contraindica no instável, irregular ou polimórfico (3: dano).',
  'Verapamil e diltiazem no QRS largo: contraindicados pela AHA 2025 (3: dano). O manual os proíbe na disfunção de VE e na FA com WPW.',
  'Magnésio: a AHA 2025 o reserva ao torsades (2b) e diz que não ajuda na TV polimórfica com QT normal (3: sem benefício). O manual dá 2 g no torsades estável.',
  'Adenosina: a AHA 2025 traz 6 mg e depois 12 mg; o manual permite repetir os 12 mg uma vez e reduz à metade no acesso central.',
  'Amiodarona: o ataque e a primeira infusão são iguais; o manual acrescenta 0,5 mg/min por 18 h.',
]

/** Adenosina: 6 mg; se não resolver em 2 min, 12 mg, que pode ser repetida uma vez. Metade em acesso central de cava superior (p. 265). */
export function adenosina(acessoCentral: boolean): number[] {
  const doses = [6, 12, 12]
  return acessoCentral ? doses.map((d) => d / 2) : doses
}

/** Amiodarona na TV estável: 150 mg em 10 min, 1 mg/min por 6 h, 0,5 mg/min por 18 h (p. 265). */
export function esquemaAmiodarona() {
  const fases = [
    { fase: 'ataque', mg: 150, duracao: '10 min', mgMin: 15 },
    { fase: '1 mg/min por 6 h', mg: 1 * 60 * 6, duracao: '6 h', mgMin: 1 },
    { fase: '0,5 mg/min por 18 h', mg: 0.5 * 60 * 18, duracao: '18 h', mgMin: 0.5 },
  ]
  return { fases, total24hMg: fases.reduce((s, f) => s + f.mg, 0) }
}

export const LIDOCAINA_TV = {
  ataqueMgKg: [0.7, 1.4] as Faixa,
  velocidadeMgMin: 50,
  tetoMgHora: [200, 300] as Faixa,
  pagina: 'p. 265',
  errata: 'O livro escreve "1 a 4 mg/kg é a dose preconizada de infusão contínua": falta a unidade de tempo, e infusão de lidocaína não é dada em mg/kg. A infusão contínua não é calculada; o teto de 200–300 mg em 1 hora é mostrado como está.',
}

export type LidocainaTv = { ataqueMg: Faixa; minutos: Faixa; doisAtaquesMg: Faixa; doisAtaquesPassamDe200: boolean }

/** Ataque da lidocaína (repetível após 5 min) e tempo a 50 mg/min (p. 265). */
export function lidocainaTv(pesoKg: number): LidocainaTv | null {
  if (!valido(pesoKg)) return null
  const mg = vezes(LIDOCAINA_TV.ataqueMgKg, pesoKg)
  const dois = vezes(mg, 2)
  return { ataqueMg: mg, minutos: [mg[0] / 50, mg[1] / 50], doisAtaquesMg: dois, doisAtaquesPassamDe200: dois[1] > LIDOCAINA_TV.tetoMgHora[0] }
}

/** Bloqueadores de canal de cálcio EV (p. 266): velocidade e dose total → minutos até o total. */
export const BCC_EV = [
  { id: 'verapamil', nome: 'Verapamil', mgMin: 1, totalMg: 20, pagina: 'p. 266' },
  { id: 'diltiazem', nome: 'Diltiazem', mgMin: 2.5, totalMg: 50, pagina: 'p. 266' },
].map((d) => ({ ...d, minutosAteTotal: d.totalMg / d.mgMin }))

export const MAGNESIO_TORSADES = { g: 2, minutos: 15, pagina: 'p. 266' }
