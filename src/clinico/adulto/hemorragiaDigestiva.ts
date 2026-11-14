import type { Ficha, Fonte } from '../ficha.ts'
import { completo, escolha, somar, type Escore } from '../escore.ts'
import { fichaAdulto } from './fonte.ts'

// Hemorragia digestiva alta e baixa — caps. 50 e 51 do Manual de Medicina de
// Emergência do HCFMUSP (3ª ed., 2022), p. 694–716. A ferramenta mostra as
// doses, metas e classificações que o livro traz e faz as contas de peso e de
// total diário. O livro não traz diluição de omeprazol, terlipressina,
// somatostatina nem octreotídeo: sem preparo, não há mL/h. A decisão é do
// médico (ADR 0007).
//
// Glasgow-Blatchford, Rockall e AIMS65 já existem em src/clinico/escores e
// não são duplicados; onde a versão do livro difere, a diferença fica listada
// abaixo (DIVERGENCIAS_ESCORES_HDA) para a tela e para o lote.

// Revisão PubMed, itens médios (decisão do RT de 06/11/2026): a diretriz ESGE
// 2026 de úlcera péptica sangrante entra como nota no bloco das metas da HDA.
// Reforça o livro no tempo da EDA; nenhuma dose muda.
export const ESGE_UGIH_2026: Fonte = {
  citacao: 'Gralnek IM, Morris J, Laursen SB, et al. Endoscopic diagnosis and management of peptic ulcer bleeding: European Society of Gastrointestinal Endoscopy (ESGE) Guideline – Update 2026. Endoscopy. 2026;58(8):899–924 (PMID 42127996). Errata: Endoscopy. 2026;58(8):C12 (PMID 42173116). Texto integral lido (40 recomendações, com força e qualidade da evidência).',
  url: 'https://doi.org/10.1055/a-2863-8314',
}

export const NOTA_ESGE_2026 =
  'ESGE 2026 (úlcera péptica sangrante, posterior ao livro): não recomenda EDA emergente (≤ 6 h) nem urgente (≤ 12 h), salvo instabilidade hemodinâmica que persiste apesar da ressuscitação adequada — reforça o livro. Sugere considerar IBP EV em dose alta antes da EDA, sem atrasá-la; metoclopramida EV antes da EDA em casos selecionados graves ou com sangramento ativo, se não houver eritromicina; e dieta oral em até 24 h após hemostasia durável. Doses não mudam.'

// Lote 3 da revisão do HCFMUSP, N2 (decisão do RT de 14/11/2026), cap. 50: a ESGE
// 2026 foi lida no texto integral no site da Thieme (40 recomendações, com força e
// qualidade da evidência) e o Baveno VIII no site do J Hepatol, Painéis 3, 4 e 5
// (com nível de evidência, NE). As duas entram ao lado do manual; doses e contas
// do manual não mudam.
export const BAVENO_VIII_2026: Fonte = {
  citacao: 'Baveno VIII – Advancing consensus in portal hypertension (Baveno Cooperation e VALDIG). J Hepatol. 2026;85(5):993–1018 (PMID 42624290). Texto integral lido: Painel 3 (prevenção da descompensação), Painel 4 (prevenção de nova descompensação) e Painel 5 (sangramento por hipertensão portal).',
  url: 'https://doi.org/10.1016/j.jhep.2026.07.030',
}

const SEM_ITEM_HDA = 'sem item do manual na ferramenta'

/** ESGE 2026 (úlcera péptica) e Baveno VIII (varizes) × manual, um tema por linha. */
export const DIRETRIZ_HDA: { tema: string; diretriz: string; grau: string; fonte: string; livro: string }[] = [
  { tema: 'Transfusão (úlcera)', diretriz: 'Estável sem doença cardiovascular: transfundir com Hb < 7 g/dL, alvo de 7–9. Com doença cardiovascular: transfundir com Hb ≤ 8, alvo ≥ 10', grau: 'forte; qualidade moderada (sem DCV) e baixa (com DCV)', fonte: 'ESGE 2026', livro: 'Hb entre 7–9 g/dL; > 9 em alto risco, como insuficiência coronariana instável (p. 697, 702)' },
  { tema: 'Glasgow-Blatchford', diretriz: 'Usar antes da EDA. Com escore ≤ 1, o paciente pode seguir ambulatorial, com EDA ambulatorial', grau: 'forte; qualidade moderada', fonte: 'ESGE 2026', livro: 'o texto aceita até 1 ponto (p. 698), mas também diz que um único fator já indica EDA precoce e que só o escore 0 vai ao ambulatório (p. 699)' },
  { tema: 'Eritromicina antes da EDA (úlcera)', diretriz: 'Eritromicina EV antes da EDA em casos graves ou com sangramento ativo; sem eritromicina, metoclopramida EV em casos selecionados', grau: 'forte, qualidade alta; metoclopramida condicional, qualidade baixa', fonte: 'ESGE 2026', livro: 'eritromicina 3 mg/kg de 20 a 120 min antes, se a visibilidade puder ser prejudicada (p. 697)' },
  { tema: 'IBP antes da EDA', diretriz: 'Considerar IBP EV em dose alta na chegada, sem atrasar a EDA', grau: 'condicional; qualidade baixa', fonte: 'ESGE 2026', livro: SEM_ITEM_HDA },
  { tema: 'Intubação antes da EDA (úlcera)', diretriz: 'Não intubar de rotina. Intubar só com hematêmese ativa, agitação ou encefalopatia sem proteção da via aérea', grau: 'forte; qualidade alta (rotina) e baixa (selecionados)', fonte: 'ESGE 2026', livro: SEM_ITEM_HDA },
  { tema: 'Tempo da EDA (úlcera)', diretriz: 'Depois da ressuscitação, EDA em até 24 h. Não fazer em até 6 h nem em até 12 h, salvo instabilidade que persiste apesar da ressuscitação', grau: 'forte; qualidade baixa (24 h) e moderada (6–12 h)', fonte: 'ESGE 2026', livro: 'em menos de 24 h, estabilizado; a EDA emergencial (< 12 h) teve piores desfechos (p. 697)' },
  { tema: 'Coágulo aderido (Forrest IIb)', diretriz: 'Remover o coágulo e fazer hemostasia se indicado, quando o endoscopista tem competência para isso', grau: 'condicional; qualidade muito baixa', fonte: 'ESGE 2026', livro: 'tentar deslocar o coágulo; com vaso visível ou sem deslocar, tratar como vaso visível (p. 701–702)' },
  { tema: 'IBP depois da hemostasia', diretriz: 'Dose alta: 80 mg EV em bolus e 8 mg/h por 72 h; bolus EV 2 vezes ao dia ou dose alta VO 2 vezes ao dia são alternativas', grau: 'forte; qualidade alta', fonte: 'ESGE 2026', livro: 'omeprazol 80 mg em bolus e 8 mg/h por 72 h nas classes I a IIa (p. 701)' },
  { tema: 'Anticoagulante (úlcera)', diretriz: 'Retomar assim que indicado pelo risco tromboembólico', grau: 'forte; qualidade baixa', fonte: 'ESGE 2026', livro: SEM_ITEM_HDA },
  { tema: 'Dieta e ferro (úlcera)', diretriz: 'Dieta oral em até 24 h depois de hemostasia durável; ferro antes da alta se houver anemia ou ferropenia', grau: 'condicional; qualidade baixa', fonte: 'ESGE 2026', livro: SEM_ITEM_HDA },
  { tema: 'Transfusão (varizes)', diretriz: 'Restritiva, com Hb alvo de 7–8 g/dL; individualizar por doença cardiovascular, idade, hemodinâmica e sangramento ativo', grau: 'forte; NE 2', fonte: 'Baveno VIII', livro: 'Hb entre 7–9 g/dL (p. 697, 702)' },
  { tema: 'Vasoativo (varizes)', diretriz: 'Terlipressina, somatostatina ou octreotídeo o quanto antes na suspeita, por 2–5 dias ou até o TIPS. Depois de hemostasia endoscópica, curso menor (até 24 h) se o betabloqueador não seletivo for iniciado. Na terlipressina, monitorar o sódio', grau: 'forte; NE 1 (2–5 dias) e NE 2 (curso curto, sódio)', fonte: 'Baveno VIII', livro: 'doses de terlipressina, somatostatina e octreotídeo; duração só da somatostatina, até 5 dias (p. 703)' },
  { tema: 'Antibiótico (varizes)', diretriz: 'Na chegada, em todo sangramento varicoso; cefalosporina de 3ª geração preferida, conforme a resistência local. No Child A, curso menor ou nenhum pode bastar', grau: 'forte; NE 1 e 2 (Child A: fraca)', fonte: 'Baveno VIII', livro: 'cirrótico com ascite e HDA: norfloxacino, ciprofloxacino ou ceftriaxona por 7 dias (p. 704)' },
  { tema: 'Tempo da EDA (varizes)', diretriz: 'Depois da ressuscitação, EDA em até 12 h da chegada; se instável, o quanto antes', grau: 'forte; NE 2 e 5', fonte: 'Baveno VIII', livro: 'em menos de 24 h, estabilizado (p. 697)' },
  { tema: 'Eritromicina (varizes)', diretriz: 'Sem QT longo: eritromicina 250 mg EV dose única, 30–90 min antes da EDA', grau: 'fraca; NE 2; nova', fonte: 'Baveno VIII', livro: 'eritromicina 3 mg/kg de 20 a 120 min antes (p. 697)' },
  { tema: 'Plasma, plaquetas e fibrinogênio (varizes)', diretriz: 'Plasma não é recomendado de rotina (não corrige a coagulopatia e piora a hipertensão portal). Plaquetas e fibrinogênio também não; considerar só na falha de controle do sangramento', grau: 'forte (plasma); fraca (plaquetas e fibrinogênio)', fonte: 'Baveno VIII', livro: 'plasma com INR > 1,5 e plaquetas abaixo de 50.000/mm³ no sangramento ativo (p. 697, 703)' },
  { tema: 'Fator VIIa e ácido tranexâmico (varizes)', diretriz: 'Não recomendados', grau: 'forte; NE 2', fonte: 'Baveno VIII', livro: 'fator VII sem benefício, "mas usualmente é indicada se INR > 2" (p. 697); ácido tranexâmico não recomendado de rotina (p. 702)' },
  { tema: 'Intubação (varizes)', diretriz: 'Intubar antes da EDA com rebaixamento de consciência ou hematêmese ativa; extubar o quanto antes depois', grau: 'forte; NE 5', fonte: 'Baveno VIII', livro: SEM_ITEM_HDA },
  { tema: 'IBP no sangramento varicoso', diretriz: 'IBP iniciado antes da EDA deve ser suspenso quando o sangramento por hipertensão portal é confirmado, salvo indicação forte', grau: 'forte; NE 5', fonte: 'Baveno VIII', livro: SEM_ITEM_HDA },
  { tema: 'Lactulose (varizes)', diretriz: 'Lactulose VO ou por enema para prevenir ou tratar a encefalopatia', grau: 'forte; NE 2', fonte: 'Baveno VIII', livro: SEM_ITEM_HDA },
  { tema: 'TIPS precoce', diretriz: 'TIPS com prótese recoberta em até 72 h (ideal < 24 h), em varizes de esôfago ou GOV1, se Child C 10–13, Child B > 7 com sangramento ativo na EDA ou GPVH ≥ 20 mmHg', grau: 'forte; NE 1', fonte: 'Baveno VIII', livro: 'TIPS só depois de falha do segundo procedimento endoscópico (p. 703)' },
  { tema: 'Sangramento refratário', diretriz: 'Prótese metálica autoexpansível preferida ao balão como ponte; falha de droga e endoscopia: TIPS de resgate', grau: 'forte; NE 4 (prótese) e 2 (TIPS)', fonte: 'Baveno VIII', livro: 'balão de Sengstaken-Blakemore ou Minnesota como ponte; TIPS depois da falha (p. 703)' },
  { tema: 'Profilaxia primária', diretriz: 'Cirrose compensada com hipertensão portal clinicamente significativa: betabloqueador não seletivo, de preferência carvedilol. Sem ela, não usar. Intolerância: EDA e ligadura se varizes grandes', grau: 'forte; NE 1–2', fonte: 'Baveno VIII', livro: 'por calibre e Child: betabloqueador opcional, recomendado, ou ligadura (p. 704)' },
  { tema: 'Profilaxia secundária', diretriz: 'Betabloqueador não seletivo e ligadura, com carvedilol preferido; reduzir ou suspender se PAS < 90 ou PAM < 65 mmHg ou na LRA-SHR', grau: 'forte; NE 1–2', fonte: 'Baveno VIII', livro: 'betabloqueador e nitrato, ou ligadura e betabloqueador (p. 704)' },
]

export const DIFERENCAS_HDA: string[] = [
  'Hb: na úlcera, a ESGE usa alvo de 7–9 sem doença cardiovascular e ≥ 10 com ela (gatilho ≤ 8); nas varizes, o Baveno VIII usa 7–8. O manual dá 7–9 para todos.',
  'Tempo da EDA: na suspeita de varizes, o Baveno VIII pede até 12 h; na úlcera, a ESGE pede até 24 h e não antes de 12 h, salvo instabilidade. O manual dá < 24 h para todos.',
  'Coagulopatia nas varizes: o Baveno VIII não recomenda plasma, plaquetas, fibrinogênio nem fator VIIa de rotina; o manual indica plasma com INR > 1,5, plaquetas abaixo de 50.000 e cita fator VII com INR > 2.',
  'Eritromicina: o Baveno VIII dá 250 mg EV dose única, 30–90 min antes (fraca); o manual dá 3 mg/kg, 20–120 min antes. A ESGE recomenda eritromicina nos casos graves ou com sangramento ativo.',
  'Antibiótico: o Baveno VIII dá a todo sangramento varicoso na chegada, com cefalosporina de 3ª geração preferida; o manual fala do cirrótico com ascite, com três opções.',
  'TIPS: o Baveno VIII indica TIPS precoce (até 72 h) nos de alto risco; o manual usa TIPS depois da falha da endoscopia.',
  'Profilaxia: o Baveno VIII prefere carvedilol e, na secundária, betabloqueador com ligadura; o manual cita também betabloqueador com nitrato.',
]

const fichaHdLivro = fichaAdulto(
  'adulto-hemorragia-digestiva',
  'Hemorragia digestiva alta e baixa — adulto',
  'cap. 50 Hemorragia digestiva alta, p. 694–705; cap. 51 Hemorragia digestiva baixa, p. 707–716; cap. 57, p. 786',
)
export const fichaHemorragiaDigestiva: Ficha = {
  ...fichaHdLivro,
  versao: '2026-11-14.1',
  fontes: [...fichaHdLivro.fontes, ESGE_UGIH_2026, BAVENO_VIII_2026],
  revisadoEm: '14/11/2026 (ESGE 2026 e Baveno VIII lidos no texto integral, ao lado do manual; lote 3 da revisão do HCFMUSP; aguarda aprovação do RT); 06/11/2026 (nota da ESGE 2026 na úlcera péptica; revisão PubMed, itens médios)',
}

export type Faixa = [number, number]
export type Referencia = { texto: string; pagina: string; errata?: string }

const valido = (x: number) => Number.isFinite(x) && x > 0

// ── Metas e gatilhos (p. 696–697, 702–703, 713) ─────────────────────────────

export const METAS_HDA: Referencia[] = [
  { texto: 'Queda da PAS > 10 mmHg ou aumento do pulso > 10 bpm do decúbito para a ortostase indica perda de pelo menos 1.000 mL de sangue', pagina: 'cap. 50, p. 696' },
  { texto: 'Reposição volêmica conservadora; objetivo de PAS de 100 mmHg e FC < 100 bpm', pagina: 'cap. 50, p. 696' },
  { texto: 'Alvo de Hb entre 7–9 g/dL; valores > 9 g/dL podem ser considerados em alto risco, como insuficiência coronariana instável', pagina: 'cap. 50, p. 697 e 702' },
  { texto: 'Sangramento ativo com INR > 1,5: plasma fresco congelado; plaquetas < 50.000/mm³: plaquetas', pagina: 'cap. 50, p. 697 e 703' },
  { texto: 'Fator VII recombinante: sem benefício significativo, "mas usualmente é indicada se INR > 2"', pagina: 'cap. 50, p. 697' },
  { texto: 'EDA em menos de 24 h, com o paciente estabilizado; endoscopia emergencial (< 12 h) associada a piores desfechos; repetir em 24 h se visualização prejudicada', pagina: 'cap. 50, p. 697' },
]

export const METAS_HDB: Referencia[] = [
  { texto: 'Taquicardia indica hipovolemia leve a moderada; hipotensão ortostática, perda de pelo menos 15%; hipotensão ou choque, perda de 40%', pagina: 'cap. 51, p. 709',
    errata: 'O livro escreve "15% da hipovolemia"; o sentido é 15% da volemia. Sem efeito em conta.' },
  { texto: 'Queda do hematócrito > 8 pontos e transfusão de mais de 2 concentrados de hemácias indicam HDB maciça', pagina: 'cap. 51, p. 710–711' },
  { texto: 'Manter pressão sistólica acima de 80 mmHg', pagina: 'cap. 51, p. 713' },
  { texto: 'INR > 1,5: plasma fresco congelado; plaquetas < 50.000/µL: plaquetas; Hb < 7 g/dL: concentrado de hemácias', pagina: 'cap. 51, p. 713' },
  { texto: 'Instáveis (índice de choque > 1) que não podem aguardar a endoscopia: angiotomografia é uma opção', pagina: 'cap. 51, p. 714' },
]

/** Teste ortostático (p. 696): variação > 10 mmHg de PAS ou > 10 bpm de FC. */
export function testeOrtostatico(pasDeitado: number, pasEmPe: number, fcDeitado: number, fcEmPe: number) {
  if (![pasDeitado, pasEmPe, fcDeitado, fcEmPe].every(valido)) return null
  const quedaPas = pasDeitado - pasEmPe
  const aumentoFc = fcEmPe - fcDeitado
  return { quedaPas, aumentoFc, positivo: quedaPas > 10 || aumentoFc > 10 }
}

/** Índice de choque = FC / PAS; > 1 = instável (cap. 51, p. 714). */
export function indiceDeChoque(fc: number, pas: number): { indice: number; acimaDe1: boolean } | null {
  if (!valido(fc) || !valido(pas)) return null
  const indice = fc / pas
  return { indice, acimaDe1: indice > 1 }
}

/** HDB maciça (p. 710–711): queda de Ht > 8 pontos e/ou > 2 CH transfundidos. O livro une com "e". */
export function hdbMacica(quedaHtPontos: number | undefined, chTransfundidos: number | undefined) {
  const ht = quedaHtPontos !== undefined && quedaHtPontos > 8
  const ch = chTransfundidos !== undefined && chTransfundidos > 2
  return { quedaHt: ht, transfusao: ch }
}

export const NOTA_HDB_MACICA = 'A p. 710–711 escreve "queda do hematócrito maior que 8 pontos e transfusão de mais de 2 concentrados de hemácias". Não fica claro se basta um dos dois; a ferramenta mostra cada critério separado.'

// ── Eritromicina antes da EDA (p. 697) ──────────────────────────────────────

export const ERITROMICINA_EDA = { mgKg: 3, janelaMin: [20, 120] as Faixa, pagina: 'cap. 50, p. 697',
  texto: 'Visibilidade presumidamente prejudicada (p. ex., gastroparesia): eritromicina 3 mg/kg de 20 a 120 minutos antes do procedimento' }

export function eritromicinaMg(pesoKg: number): number | null {
  return valido(pesoKg) ? ERITROMICINA_EDA.mgKg * pesoKg : null
}

// ── Forrest (Tabela 5, p. 701) ──────────────────────────────────────────────

export type ClasseForrest = 'Ia' | 'Ib' | 'IIa' | 'IIb' | 'IIc' | 'III'

export const FORREST: { classe: ClasseForrest; grupo: string; achado: string }[] = [
  { classe: 'Ia', grupo: 'I. Sangramento ativo', achado: 'sangue esguichando' },
  { classe: 'Ib', grupo: 'I. Sangramento ativo', achado: 'sangue babando' },
  { classe: 'IIa', grupo: 'II. Estigmas de sangramento', achado: 'vaso visível' },
  { classe: 'IIb', grupo: 'II. Estigmas de sangramento', achado: 'coágulo aderido na base da úlcera' },
  { classe: 'IIc', grupo: 'II. Estigmas de sangramento', achado: 'mancha pigmentada plana' },
  { classe: 'III', grupo: 'III', achado: 'úlcera com base limpa sem sinais de sangramento' },
]

export const NOTA_FORRESTER = 'O livro chama a classificação de "Forrester" (p. 701); é a classificação endoscópica de Forrest.'

/** O que o livro associa a cada classe (p. 701–702). Referência, não conduta. */
export function referenciaForrest(classe: ClasseForrest): Referencia {
  if (classe === 'Ia' || classe === 'Ib' || classe === 'IIa') {
    return { texto: 'Classes I a IIa: o livro associa terapia endoscópica hemostásica (dois métodos) e IBP EV em dose alta', pagina: 'cap. 50, p. 701–702' }
  }
  if (classe === 'IIb') {
    return { texto: 'IIb: o livro descreve tentar deslocar o coágulo; havendo vaso visível, ou sem conseguir deslocar, trata-se como vaso visível (IBP em dose alta)', pagina: 'cap. 50, p. 701–702' }
  }
  return { texto: 'Sem os achados I a IIa: o livro cita IBP em dose convencional (omeprazol 80 mg EV ao dia)', pagina: 'cap. 50, p. 701' }
}

// ── Omeprazol (p. 701) ──────────────────────────────────────────────────────

export const OMEPRAZOL_HDA = {
  bolusMg: 80,
  infusaoMgH: 8,
  horas: 72,
  convencionalMgDia: 80,
  pagina: 'cap. 50, p. 701',
  texto: 'Dose usual de omeprazol: 80 mg EV em bolus seguidos de 8 mg/hora em infusão contínua por 72 horas (classes I a IIa); sem esses achados, doses convencionais, como 80 mg de omeprazol EV ao dia',
  semPreparo: 'O capítulo não traz diluição do omeprazol: a infusão sai em mg/h, sem mL/h.',
}

/** Total de omeprazol no esquema de dose alta: bolus + 8 mg/h × 72 h. */
export function omeprazolAltaDose() {
  const infusaoTotal = OMEPRAZOL_HDA.infusaoMgH * OMEPRAZOL_HDA.horas
  return { bolusMg: OMEPRAZOL_HDA.bolusMg, mgDiaInfusao: OMEPRAZOL_HDA.infusaoMgH * 24, infusaoTotalMg: infusaoTotal, totalMg: OMEPRAZOL_HDA.bolusMg + infusaoTotal }
}

// ── Vasoativos no sangramento varicoso (p. 702–703) ─────────────────────────

export const VASOATIVOS_VARIZES = {
  terlipressina: { ataqueMg: [2, 4] as Faixa, manutencaoMg: [1, 2] as Faixa, intervaloH: 4, pagina: 'cap. 50, p. 703',
    texto: 'Primeira escolha, por não necessitar de bomba de infusão: 2 a 4 mg IV seguida de 1 a 2 mg a cada 4 horas' },
  somatostatina: { bolusUg: 250, infusaoUgH: [250, 500] as Faixa, diasMax: 5, pagina: 'cap. 50, p. 703',
    texto: 'Dose inicial de 250 µg seguida de infusão contínua de 250 a 500 µg/h; pode ser mantida por até 5 dias' },
  octreotideo: { bolusUg: 50, infusaoUgH: 50, pagina: 'cap. 50, p. 703',
    texto: '50 µg em bolus, seguidos de 50 µg EV a cada hora em bomba de infusão contínua' },
  semPreparo: 'O capítulo não traz diluição de terlipressina, somatostatina ou octreotídeo: as doses saem em mg ou µg, sem mL/h.',
  semDuracao: 'O capítulo não dá a duração da terlipressina nem do octreotídeo no sangramento varicoso.',
}

/** Totais por 24 h de manutenção (multiplicação simples do que o livro dá). */
export function vasoativosTotais24h() {
  const t = VASOATIVOS_VARIZES
  const dosesDia = 24 / t.terlipressina.intervaloH
  return {
    terlipressinaMgDia: [t.terlipressina.manutencaoMg[0] * dosesDia, t.terlipressina.manutencaoMg[1] * dosesDia] as Faixa,
    somatostatinaUgDia: [t.somatostatina.infusaoUgH[0] * 24, t.somatostatina.infusaoUgH[1] * 24] as Faixa,
    octreotideoUgDia: t.octreotideo.infusaoUgH * 24,
  }
}

// ── Antibiótico profilático no cirrótico com HDA (p. 704; p. 786) ───────────

export const ATB_CIRROTICO_HDA: (Referencia & { droga: string })[] = [
  { droga: 'Norfloxacina', texto: '400 mg VO a cada 12 horas por 7 dias', pagina: 'cap. 50, p. 704; cap. 57, p. 786' },
  { droga: 'Ciprofloxacina', texto: 'p. 704: "500 EV a cada 12 horas por 7 dias"; p. 786: "200 12/12 horas EV por 7 dias"', pagina: 'cap. 50, p. 704; cap. 57, p. 786',
    errata: 'As duas páginas escrevem a dose sem unidade e com números diferentes (500 x 200). Nenhuma das duas é convertida nem escolhida pela ferramenta.' },
  { droga: 'Ceftriaxona', texto: '1–2 g EV (1 x/dia na p. 786) por 7 dias', pagina: 'cap. 50, p. 704; cap. 57, p. 786' },
]

export const INDICACAO_ATB_CIRROTICO = { texto: 'Todos os pacientes cirróticos com ascite e HDA devem receber antibioticoterapia para prevenir infecções e PBE', pagina: 'cap. 50, p. 704' }

// ── Profilaxia de sangramento varicoso (p. 704) ─────────────────────────────

export const PROFILAXIA_VARIZES: Referencia[] = [
  { texto: 'Varizes de fino calibre (< 5 mm), sem marcas vermelhas, Child A: betabloqueador não seletivo considerado opcional', pagina: 'cap. 50, p. 704' },
  { texto: 'Fino calibre com alto risco (marcas vermelhas, Child B ou C): betabloqueador não seletivo recomendado', pagina: 'cap. 50, p. 704' },
  { texto: 'Médio ou grosso calibre (> 5 mm): betabloqueador não seletivo ou ligadura endoscópica; escleroterapia não', pagina: 'cap. 50, p. 704' },
  { texto: 'Profilaxia secundária: betabloqueador + nitrato, ou ligadura + betabloqueador', pagina: 'cap. 50, p. 704' },
]

export const NOTA_CALIBRE_5MM = 'O livro separa "< 5 mm" e "> 5 mm"; exatamente 5 mm fica sem classe.'

// ── Oakland (Tabela 6, p. 715–716) ──────────────────────────────────────────

export const fichaOakland = fichaAdulto('adulto-oakland', 'Escore de Oakland — hemorragia digestiva baixa (adulto)', 'cap. 51, p. 714–716')

const op = (rotulo: string, valor: number) => ({ rotulo: `${rotulo} — ${valor} ${valor === 1 ? 'ponto' : 'pontos'}`, valor })

export const ERRATA_OAKLAND = 'Corte inconsistente no livro: o texto diz "< 8" ambulatorial e "> 8" internação (p. 714–715); a tabela diz "≤ 8: sangramento menor, pode ter alta" (p. 716). Com 8 pontos a ferramenta mostra as duas leituras.'

export const oakland: Escore = {
  ficha: fichaOakland,
  descricao: 'Soma de idade, sexo, HDB prévia, FC, PAS e Hb da Tabela 6 do manual do HC (p. 715–716), com o corte do sangramento menor.',
  itens: [
    { tipo: 'escolha', id: 'idade', rotulo: 'Idade', opcoes: [op('< 40 anos', 0), op('40 a 69 anos', 1), op('≥ 70 anos', 2)] },
    { tipo: 'escolha', id: 'sexo', rotulo: 'Sexo', opcoes: [op('Feminino', 0), op('Masculino', 1)] },
    { tipo: 'escolha', id: 'previa', rotulo: 'HDB prévia', opcoes: [op('Sem HDB prévia', 0), op('HDB prévia', 1)] },
    { tipo: 'escolha', id: 'fc', rotulo: 'Frequência cardíaca', opcoes: [op('< 70 bpm', 0), op('70–89 bpm', 1), op('90–109 bpm', 2), op('≥ 110 bpm', 3)] },
    { tipo: 'escolha', id: 'pas', rotulo: 'Pressão arterial sistólica', opcoes: [op('< 90 mmHg', 5), op('90–119 mmHg', 4), op('120–129 mmHg', 3), op('130–159 mmHg', 2), op('≥ 160 mmHg', 0)] },
    { tipo: 'escolha', id: 'hb', rotulo: 'Hemoglobina', ajuda: 'Linhas como impressas: 12,9–13,0 e 15,9–16,0 g/dL ficam entre duas linhas; "> 16,0" não inclui 16,0.', opcoes: [
      op('< 7 g/dL', 22), op('7–8,9 g/dL', 17), op('9,0–10,9 g/dL', 13), op('11,0–12,9 g/dL', 8), op('13,0–15,9 g/dL', 4), op('> 16,0 g/dL', 0),
    ] },
  ],
  calcular(r) {
    if (!completo(oakland, r)) return null
    const total = somar(oakland, r)
    const oito = total === 8
    return {
      rotulo: 'Oakland',
      valor: String(total),
      unidade: 'de 34',
      nota: oito
        ? '8 pontos: a tabela põe em "≤ 8, sangramento menor"; o texto põe o corte em < 8 (ver errata)'
        : total < 8 ? '≤ 8: sangramento menor (Tabela 6, p. 716)' : '> 8: faixa em que as diretrizes citadas recomendam internação para colonoscopia (p. 714–715)',
      estado: total > 8 ? 2 : oito ? 1 : 0,
      derivados: [['Hemoglobina', escolha(oakland, r, 'hb')!.rotulo]],
      alerta: oito ? ERRATA_OAKLAND : undefined,
      cuidados: [
        'O livro não traz a variável "sangue ao toque retal"; a soma usa só o que está na Tabela 6.',
        'Escore de estratificação: não define conduta.',
        'Sem referência pediátrica declarada.',
      ],
    }
  },
}

// ── Diferenças do livro em relação aos escores que já existem ────────────────

export const DIVERGENCIAS_ESCORES_HDA: Referencia[] = [
  { texto: 'Glasgow-Blatchford "simplificado" (Tabela 2, p. 698–699): PAS < 90 = 6 pontos (a ferramenta existente usa 3); Hb 10,0–10,9 = 1 só em mulheres (a faixa 11,0–11,9 feminina fica sem ponto); melena ou síncope juntas = 1; doença hepática ou cardíaca juntas = 2; ureia com um corte só (> 30 mg/dL = 1). A faixa masculina aparece impressa "12,12,9".', pagina: 'cap. 50, p. 698–699',
    errata: 'O livro também se contradiz no corte: "até 1 ponto sem indicar o exame" (p. 698) x "a presença de um único fator já é indicativa de EDA precoce" (p. 699). A tela de Glasgow-Blatchford existente não foi alterada.' },
  { texto: 'Rockall (Tabela 3, p. 699–700): FC > 100 bpm com PAS ≥ 100 = 1; "IC ou comorbidade grave" = 2; "CA metastático, IRA ou insuficiência hepática" = 3; após a EDA, sangue, coágulo ou vaso sangrante/visível = 2. Tabela 4 (p. 700) de ressangramento por escore: 0 = 0,2%, 1 = 2,4%, 2 = 5,6%, 3 = 11%, 4 = 24,6%, 5 = 39,6%, 6 = 48,9%, 7 = 50%. Soma > 8: mortalidade > 40%; 0–2: < 0,2%.', pagina: 'cap. 50, p. 699–700',
    errata: 'A Tabela 4 não diz se é o escore pré ou pós-EDA. A ferramenta Rockall existente não mostra essa tabela; não foi alterada.' },
]

export const FORA_HDA = [
  'Diluição e mL/h de omeprazol, terlipressina, somatostatina e octreotídeo: o capítulo não traz preparo.',
  'Duração da terlipressina e do octreotídeo no sangramento varicoso: não informada.',
  'Dose de betabloqueador não seletivo e de nitrato na profilaxia de varizes: não informada.',
  'Ácido tranexâmico: "não recomendado rotineiramente" (p. 702), sem dose.',
  'Rockall e Glasgow-Blatchford do livro não viram escore novo: já existem no produto (ver divergências).',
]
