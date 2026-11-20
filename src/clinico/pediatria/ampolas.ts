// Dose em mL pela ampola escolhida (pedido do RT de 19/11/2026; decisões
// ML1–ML11 = A em docs/clinico/DOSES-ML-PEDIATRIA-DIAGNOSTICO.md).
//
// As apresentações ficam aqui, fora das fichas de dose: as doses não mudam
// quando uma ampola entra. Este arquivo vira a ficha própria das ampolas no
// lote 1, quando entrar a primeira bula, e cada lote passa pela aprovação do
// RT (gate LG10).
//
import type { Ficha, Fonte } from '../ficha.ts'
import { LIVRO_PS_PED } from './fonte.ts'

// Regras do RT:
// - concentração do livro do ICr ou da bula do Bulário Eletrônico da ANVISA,
//   sempre com a fonte; as listas locais (data/*.csv) nunca são fonte (ML9);
// - cada concentração com registro ativo vira uma opção, por concentração e não
//   por marca (ML2); nenhuma vem marcada e sem ampola escolhida não há mL;
// - mL só com a dose e a concentração na mesma base, sal ou elemento (ML6);
// - nas que precisam de diluição, o mL é o volume a aspirar da ampola, com o
//   aviso fixo (ML5);
// - insulina nunca em mL do frasco de 100 UI/mL (ML7).

/** Base da dose e da concentração (cálcio e magnésio: sal ou elemento). */
export type BaseDose = 'sal' | 'elemento'

export type Apresentacao = {
  /** estável, para a escolha na tela (ex.: 'adenosina-3') */
  id: string
  /** o que a tela mostra no botão (ex.: 'Adenosina 3 mg/mL, ampola 2 mL') */
  rotulo: string
  /** concentração na unidade da dose, por mL */
  porMl: number
  /** só quando a dose pode estar em sal ou em elemento */
  base?: BaseDose
  /** precisa de diluição: o mL é o volume a aspirar, não o volume a infundir */
  diluir?: boolean
  /** página do livro ou bula: produto, empresa, expediente e data */
  fonte: string
  url?: string
}

/** Um item de dose que usa as ampolas de um princípio ativo. */
export type ItemComAmpola = {
  principio: string
  /** base da dose do item, quando o princípio tem ampolas em bases diferentes */
  base?: BaseDose
}

const BULARIO = (nome: string) => `https://consultas.anvisa.gov.br/#/bulario/q/?nomeProduto=${encodeURIComponent(nome)}`

// Lote 1 (RCP e arritmias), bulas do profissional baixadas do Bulário Eletrônico
// pelo RT e lidas em 19/11/2026; tabela aprovada pelo RT no mesmo dia. A
// atropina injetável não tem bula no Bulário e o livro não cita a ampola: fica
// sem mL. A lidocaína traqueal fica sem mL (preparo próprio; decisão do RT).
export const BULA_ADENOSINA: Fonte = {
  citacao: 'Bula do profissional, adenosina 3 mg/mL, Newcom Farmacêutica Ltda., expediente 0710158262, publicada em 17/07/2026 (Bulário Eletrônico da ANVISA, lida em 19/11/2026).',
  url: BULARIO('adenosina'),
}
export const BULA_AMIODARONA: Fonte = {
  citacao: 'Bulas do profissional, cloridrato de amiodarona 50 mg/mL injetável: Newcom Farmacêutica Ltda., expediente 0716157268, 20/07/2026; Hipolabor Farmacêutica Ltda., expediente 1466419245, 24/10/2024 (Bulário Eletrônico da ANVISA, lidas em 19/11/2026). As duas mandam diluir em glicose 5%, inclusive no bolo da PCR.',
  url: BULARIO('cloridrato de amiodarona'),
}
// Lote 2 (intubação, sedação e antídotos): bulas baixadas pelo RT e lidas em
// 20/11/2026; tabela aprovada pelo RT no mesmo dia. Succinilcolina (só pó para
// reconstituir) fica sem mL (ML3–ML5). Morfina fica sem mL até a bula do Dimorf
// (há 0,2, 1 e 10 mg/mL; erro de 10×). Escetamina: o RT confirmou que a dose do
// livro (Ketamin S®, p. 88) vale para as ampolas de escetamina 50 mg/mL.
export const BULA_FENTANILA: Fonte = {
  citacao: 'Bulas do profissional, citrato de fentanila 50 µg/mL: Hipolabor, expediente 0219492263, 05/03/2026; Teuto, expediente 0981354262, 21/09/2026; Newcom, expediente 0710253265, 17/07/2026 (Bulário Eletrônico da ANVISA, lidas em 20/11/2026).',
  url: BULARIO('citrato de fentanila'),
}
export const BULA_MIDAZOLAM: Fonte = {
  citacao: 'Bulas do profissional, midazolam 1 mg/mL e 5 mg/mL: Hipolabor (1 mg/mL), expediente 1147276269, 29/10/2026; União Química (5 mg/mL), expediente 4849915221, 21/10/2022; Teuto (1 e 5 mg/mL), expediente 1189771241, 29/08/2024 (Bulário Eletrônico da ANVISA, lidas em 20/11/2026).',
  url: BULARIO('midazolam'),
}
export const BULA_ESCETAMINA: Fonte = {
  citacao: 'Bulas do profissional, cloridrato de escetamina 50 mg/mL: União Química, expediente 0763401269, 30/07/2026; Hipolabor, expediente 0759890242, 06/06/2024; Santisa, expediente 0995211264, 23/09/2026 (Bulário Eletrônico da ANVISA, lidas em 20/11/2026).',
  url: BULARIO('cloridrato de escetamina'),
}
export const BULA_ETOMIDATO: Fonte = {
  citacao: 'Bulas do profissional, etomidato 2 mg/mL: Blau, expediente 1025663268, 30/09/2026; Cristália, expediente 0920059261, 04/09/2026 (Bulário Eletrônico da ANVISA, lidas em 20/11/2026).',
  url: BULARIO('etomidato'),
}
export const BULA_PROPOFOL: Fonte = {
  citacao: 'Bulas do profissional, propofol 10 mg/mL (1%) e 20 mg/mL (2%): Camber, expediente 1171258267, 05/11/2026; Teuto, expediente 1200670256, 10/09/2025; Fresenius Kabi (1% e 2%), expediente 0626793262, 25/06/2026; Blau, expediente 1179691253, 04/09/2025 (Bulário Eletrônico da ANVISA, lidas em 20/11/2026).',
  url: BULARIO('propofol'),
}
export const BULA_ROCURONIO: Fonte = {
  citacao: 'Bulas do profissional, brometo de rocurônio 10 mg/mL: Eurofarma, expediente 1064019242, 05/08/2024; Viatris (Mylan), expediente 2481128222, 20/04/2022 (Bulário Eletrônico da ANVISA, lidas em 20/11/2026).',
  url: BULARIO('brometo de rocurônio'),
}
export const BULA_DEXMEDETOMIDINA: Fonte = {
  citacao: 'Bulas do profissional, cloridrato de dexmedetomidina 100 µg/mL (solução para diluição): Antibióticos do Brasil, Cristália, Eugia, Eurofarma, Sanval e União Química (Bulário Eletrônico da ANVISA, lidas em 20/11/2026). Todas mandam diluir antes de administrar.',
  url: BULARIO('cloridrato de dexmedetomidina'),
}
export const BULA_NALOXONA: Fonte = {
  citacao: 'Bula do profissional, cloridrato de naloxona 0,4 mg/mL: Hipolabor, expediente 1567333249, 14/11/2024 (Bulário Eletrônico da ANVISA, lidas em 20/11/2026).',
  url: BULARIO('cloridrato de naloxona'),
}

// Lote 3 e conferência pela CMED (decisões do RT de 20/11/2026): a lista de
// preços da CMED passa a ser fonte da concentração, ao lado da bula ("CMED +
// bula"); entram só as apresentações à venda. Atropina sai da lista de "sem mL"
// (0,25 e 0,5 mg/mL na CMED); lidocaína ganha a de 1%; morfina continua sem mL.
// Levetiracetam, valproato e lorazepam: nenhum injetável à venda, ficam sem mL.
export const CMED_PMC_2026_11: Fonte = {
  citacao: 'Lista de preços de medicamentos da CMED (PMC), ANVISA, publicada em 09/11/2026 (substância, laboratório, registro e apresentação; conferida com scripts/anvisa/lista-cmed.mjs).',
  url: 'https://www.gov.br/anvisa/pt-br/assuntos/medicamentos/cmed/precos',
}
export const BULA_DIAZEPAM: Fonte = {
  citacao: 'Bulas do profissional, diazepam 5 mg/mL injetável: Hipolabor e Teuto (Bulário Eletrônico da ANVISA, lidas em 20/11/2026): "usado em bolus e sem diluição".',
  url: BULARIO('diazepam'),
}

export const BULA_LIDOCAINA: Fonte = {
  citacao: 'Bulas do profissional, cloridrato de lidocaína 20 mg/mL (2%) sem vasoconstritor: Blau Farmacêutica S.A., expediente 1609670256, 16/12/2025; Hypofarma, expediente 1609728254, 16/12/2025; Hipolabor Farmacêutica Ltda., expediente 1616391243, 26/11/2024 (Bulário Eletrônico da ANVISA, lidas em 19/11/2026).',
  url: BULARIO('cloridrato de lidocaína'),
}

/** Apresentações por princípio ativo. */
export const AMPOLAS: Record<string, Apresentacao[]> = {
  adenosina: [
    { id: 'adenosina-3', rotulo: 'Adenosina 3 mg/mL (ampola de 2 mL)', porMl: 3, fonte: 'bula Newcom, expediente 0710158262, 17/07/2026', url: BULA_ADENOSINA.url },
  ],
  amiodarona: [
    { id: 'amiodarona-50', rotulo: 'Amiodarona 50 mg/mL (ampola de 3 mL)', porMl: 50, diluir: true, fonte: 'bulas Newcom (0716157268, 20/07/2026) e Hipolabor (1466419245, 24/10/2024); diluir em glicose 5%', url: BULA_AMIODARONA.url },
  ],
  lidocaina: [
    { id: 'lidocaina-10', rotulo: 'Lidocaína 1% sem vasoconstritor, 10 mg/mL', porMl: 10, fonte: 'CMED 09/11/2026: Cristália (1029803570078) e Hypofarma (1038700390106), à venda', url: CMED_PMC_2026_11.url },
    { id: 'lidocaina-20', rotulo: 'Lidocaína 2% sem vasoconstritor, 20 mg/mL', porMl: 20, fonte: 'bulas Blau (1609670256), Hypofarma (1609728254) e Hipolabor (1616391243)', url: BULA_LIDOCAINA.url },
  ],
  // atropina: sem bula injetável no Bulário; concentrações da CMED (decisão do RT, 20/11/2026)
  atropina: [
    { id: 'atropina-025', rotulo: 'Atropina 0,25 mg/mL', porMl: 0.25, fonte: 'CMED 09/11/2026: Blau, Farmace e outros, à venda', url: CMED_PMC_2026_11.url },
    { id: 'atropina-05', rotulo: 'Atropina 0,5 mg/mL', porMl: 0.5, fonte: 'CMED 09/11/2026: Blau, à venda', url: CMED_PMC_2026_11.url },
  ],
  // lote 3: crise epiléptica
  diazepam: [
    { id: 'diazepam-5', rotulo: 'Diazepam 5 mg/mL (ampola de 2 mL)', porMl: 5, fonte: 'CMED 09/11/2026 e bulas Hipolabor e Teuto (bolus sem diluição)', url: BULA_DIAZEPAM.url },
  ],
  fenitoina: [
    { id: 'fenitoina-50', rotulo: 'Fenitoína 50 mg/mL', porMl: 50, diluir: true, fonte: 'CMED 09/11/2026: Hipolabor, Teuto e Cristália; diluir em SF, precipita em SG (livro do ICr, Apêndice)', url: CMED_PMC_2026_11.url },
  ],
  fenobarbital: [
    { id: 'fenobarbital-100', rotulo: 'Fenobarbital 100 mg/mL', porMl: 100, fonte: 'CMED 09/11/2026: Cristália, à venda (a de 200 mg/mL está sem venda)', url: CMED_PMC_2026_11.url },
  ],
  // dose em cálcio elementar (RCP): concentração elementar do livro (ML6)
  calcio: [
    { id: 'gluconato-10', rotulo: 'Gluconato de cálcio 10% (9 mg de cálcio elementar/mL)', porMl: 9, base: 'elemento', fonte: 'livro do ICr, Tabela 11, p. 558' },
    { id: 'cloreto-10', rotulo: 'Cloreto de cálcio 10% (27 mg de cálcio elementar/mL)', porMl: 27, base: 'elemento', fonte: 'livro do ICr, Tabela 11, p. 559' },
  ],
  // lote 2: intubação, sedação e antídotos
  fentanila: [
    { id: 'fentanila-50', rotulo: 'Fentanila 50 µg/mL', porMl: 50, fonte: 'bulas Hipolabor, Teuto e Newcom', url: BULA_FENTANILA.url },
  ],
  midazolam: [
    { id: 'midazolam-1', rotulo: 'Midazolam 1 mg/mL (ampola de 5 mL)', porMl: 1, fonte: 'bulas Hipolabor e Teuto', url: BULA_MIDAZOLAM.url },
    { id: 'midazolam-5', rotulo: 'Midazolam 5 mg/mL', porMl: 5, fonte: 'bulas União Química e Teuto', url: BULA_MIDAZOLAM.url },
  ],
  escetamina: [
    { id: 'escetamina-50', rotulo: 'Escetamina 50 mg/mL (Ketamin S® e genéricos)', porMl: 50, fonte: 'bulas União Química, Hipolabor e Santisa; livro do ICr, p. 88', url: BULA_ESCETAMINA.url },
  ],
  etomidato: [
    { id: 'etomidato-2', rotulo: 'Etomidato 2 mg/mL (ampola de 10 mL)', porMl: 2, fonte: 'bulas Blau e Cristália', url: BULA_ETOMIDATO.url },
  ],
  propofol: [
    { id: 'propofol-10', rotulo: 'Propofol 1% (10 mg/mL)', porMl: 10, fonte: 'bulas Camber, Teuto, Fresenius e Blau', url: BULA_PROPOFOL.url },
    { id: 'propofol-20', rotulo: 'Propofol 2% (20 mg/mL)', porMl: 20, fonte: 'bula Fresenius Kabi', url: BULA_PROPOFOL.url },
  ],
  rocuronio: [
    { id: 'rocuronio-10', rotulo: 'Rocurônio 10 mg/mL', porMl: 10, fonte: 'bulas Eurofarma e Viatris', url: BULA_ROCURONIO.url },
  ],
  dexmedetomidina: [
    { id: 'dexmedetomidina-100', rotulo: 'Dexmedetomidina 100 µg/mL (frasco de 2 mL)', porMl: 100, diluir: true, fonte: 'bulas de 6 fabricantes; todas mandam diluir', url: BULA_DEXMEDETOMIDINA.url },
  ],
  // a mesma ampola em mg (dose da intoxicação) e em µg (dose baixa)
  naloxona: [
    { id: 'naloxona-0-4', rotulo: 'Naloxona 0,4 mg/mL (ampola de 1 mL)', porMl: 0.4, fonte: 'bula Hipolabor', url: BULA_NALOXONA.url },
  ],
  'naloxona-ug': [
    { id: 'naloxona-400', rotulo: 'Naloxona 0,4 mg/mL = 400 µg/mL (ampola de 1 mL)', porMl: 400, fonte: 'bula Hipolabor', url: BULA_NALOXONA.url },
  ],
}

export const fichaAmpolas: Ficha = {
  id: 'ped-ampolas',
  titulo: 'Ampolas para a dose em mL (criança)',
  versao: '2026-11-20.2',
  publico: 'pediatrico',
  fontes: [{ ...LIVRO_PS_PED, citacao: `${LIVRO_PS_PED.citacao} Tabela 11, p. 558–559 (cálcio elementar por mL); p. 88 (Ketamin S® 50 mg/mL).` }, BULA_ADENOSINA, BULA_AMIODARONA, BULA_LIDOCAINA,
    BULA_FENTANILA, BULA_MIDAZOLAM, BULA_ESCETAMINA, BULA_ETOMIDATO, BULA_PROPOFOL, BULA_ROCURONIO, BULA_DEXMEDETOMIDINA, BULA_NALOXONA,
    CMED_PMC_2026_11, BULA_DIAZEPAM],
  revisadoEm: '20/11/2026 (lote 3 da dose em mL: crise epiléptica; CMED como fonte ao lado da bula; atropina e lidocaína 1% pela CMED; tabela aprovada pelo RT; aguarda aprovação do RT); 20/11/2026 (lote 2 da dose em mL: intubação, sedação e antídotos; bulas lidas e tabela aprovada pelo RT; aguarda aprovação do RT); 19/11/2026 (lote 1 da dose em mL: RCP e arritmias; bulas do Bulário Eletrônico lidas e tabela aprovada pelo RT; decisões ML1–ML11; aguarda aprovação do RT)',
}

/**
 * Itens de dose que mostram a escolha da ampola, pela chave "lista:id":
 * 'bolus:<id>' (bolus.ts), 'rcp:<id>' (rcp.ts), 'sri:<id>' (viaAerea.ts),
 * 'fita:<id>' (dosesDaFita.ts, guia de parada da criança).
 */
export const ITENS_COM_AMPOLA: Record<string, ItemComAmpola> = {
  // lote 1: RCP e arritmias
  'rcp:adenosina-1': { principio: 'adenosina' },
  'rcp:adenosina-2': { principio: 'adenosina' },
  'rcp:amiodarona': { principio: 'amiodarona' },
  'rcp:lidocaina-iv': { principio: 'lidocaina' },
  'rcp:calcio': { principio: 'calcio', base: 'elemento' },
  'bolus:adenosina-1': { principio: 'adenosina' },
  'bolus:adenosina-2': { principio: 'adenosina' },
  'bolus:adenosina-50-1': { principio: 'adenosina' },
  'bolus:adenosina-50-2': { principio: 'adenosina' },
  'bolus:amiodarona-fvtv': { principio: 'amiodarona' },
  'bolus:amiodarona-iv': { principio: 'amiodarona' },
  'bolus:lidocaina-iv': { principio: 'lidocaina' },
  // guia de parada da criança (o cálcio da fita já mostra mL em sal, 100 mg/mL)
  'fita:fita-amiodarona': { principio: 'amiodarona' },
  'fita:fita-lidocaina': { principio: 'lidocaina' },
  'fita:fita-adenosina-1': { principio: 'adenosina' },
  'fita:fita-adenosina-2': { principio: 'adenosina' },
  // lote 2: intubação, sedação e antídotos
  'sri:fentanil': { principio: 'fentanila' },
  'sri:quetamina': { principio: 'escetamina' },
  'sri:midazolam': { principio: 'midazolam' },
  'sri:etomidato': { principio: 'etomidato' },
  'sri:propofol': { principio: 'propofol' },
  'sri:rocuronio': { principio: 'rocuronio' },
  'bolus:fentanil': { principio: 'fentanila' },
  'bolus:dexmedetomidina-proc': { principio: 'dexmedetomidina' },
  'bolus:etomidato': { principio: 'etomidato' },
  'bolus:midazolam-im': { principio: 'midazolam' },
  'bolus:midazolam-iv-menor5': { principio: 'midazolam' },
  'bolus:midazolam-iv-maior5': { principio: 'midazolam' },
  'bolus:midazolam-in': { principio: 'midazolam' },
  'bolus:propofol': { principio: 'propofol' },
  'bolus:rocuronio': { principio: 'rocuronio' },
  'bolus:naloxona-menor': { principio: 'naloxona' },
  'bolus:naloxona-maior': { principio: 'naloxona' },
  'bolus:dose-baixa-naloxona': { principio: 'naloxona-ug' },
  'fita:fita-etomidato': { principio: 'etomidato' },
  'fita:fita-propofol': { principio: 'propofol' },
  'fita:fita-rocuronio': { principio: 'rocuronio' },
  'fita:fita-fentanil-menor6': { principio: 'fentanila' },
  'fita:fita-fentanil-maior6': { principio: 'fentanila' },
  'fita:fita-naloxona': { principio: 'naloxona' },
  'fita:fita-naloxona-maior': { principio: 'naloxona' },
  'fita:fita-naloxona-baixa': { principio: 'naloxona-ug' },
  // atropina (CMED) e lote 3 (crise epiléptica)
  'rcp:atropina': { principio: 'atropina' },
  'sri:atropina': { principio: 'atropina' },
  'bolus:atropina-bradicardia': { principio: 'atropina' },
  'bolus:atropina-pre': { principio: 'atropina' },
  'bolus:atropina-organofosforado': { principio: 'atropina' },
  'fita:fita-atropina': { principio: 'atropina' },
  'fita:fita-atropina-iot': { principio: 'atropina' },
  'crise:diazepam-iv': { principio: 'diazepam' },
  'crise:midazolam-iv': { principio: 'midazolam' },
  'crise:midazolam-im': { principio: 'midazolam' },
  'crise:midazolam-in': { principio: 'midazolam' },
  'crise:fenitoina': { principio: 'fenitoina' },
  'crise:fenitoina-cronico': { principio: 'fenitoina' },
  'crise:fenobarbital': { principio: 'fenobarbital' },
  'bolus:diazepam-iv-menor5': { principio: 'diazepam' },
  'bolus:diazepam-iv-maior5': { principio: 'diazepam' },
  'bolus:fenitoina': { principio: 'fenitoina' },
  'bolus:fenobarbital': { principio: 'fenobarbital' },
  'sri:diazepam': { principio: 'diazepam' },
  'fita:fita-diazepam-iv': { principio: 'diazepam' },
}

export const AVISO_DILUIR = 'Volume a aspirar da ampola. Diluir antes de administrar.'
export const PECA_A_AMPOLA = 'Escolha a ampola para ver o volume em mL.'

/** As ampolas que valem para o item (mesma base da dose), ou lista vazia. */
export function ampolasDoItem(chave: string): Apresentacao[] {
  const item = ITENS_COM_AMPOLA[chave]
  if (!item) return []
  return (AMPOLAS[item.principio] ?? []).filter((a) => !a.base || !item.base || a.base === item.base)
}

export type VolumeDaAmpola = { ml: [number, number]; aspirar: boolean }

/** Volume da dose na ampola escolhida; sem ampola, ou com bases diferentes, não há volume. */
export function volumeDaAmpola(dose: [number, number], ampola: Apresentacao | undefined, baseDaDose?: BaseDose): VolumeDaAmpola | null {
  if (!ampola || !(ampola.porMl > 0)) return null
  if (ampola.base && baseDaDose && ampola.base !== baseDaDose) return null
  if (!dose.every((x) => Number.isFinite(x) && x >= 0)) return null
  return { ml: [dose[0] / ampola.porMl, dose[1] / ampola.porMl], aspirar: ampola.diluir === true }
}

/** Problemas de cadastro (os testes e o CI cobram lista vazia). */
export function problemasDasAmpolas(ampolas: Record<string, Apresentacao[]> = AMPOLAS, itens: Record<string, ItemComAmpola> = ITENS_COM_AMPOLA): string[] {
  const p: string[] = []
  for (const [principio, lista] of Object.entries(ampolas)) {
    const ids = new Set<string>()
    for (const a of lista) {
      if (ids.has(a.id)) p.push(`${principio}: id repetido ${a.id}`)
      ids.add(a.id)
      if (!(a.porMl > 0)) p.push(`${principio}/${a.id}: concentração inválida`)
      if (!a.fonte.trim()) p.push(`${principio}/${a.id}: sem fonte`)
      if (/data\/|padroniza|HU-UFGD|diluicao\.csv/i.test(a.fonte)) p.push(`${principio}/${a.id}: lista local não é fonte (ML9)`)
      if (/insulina/i.test(principio) && a.porMl >= 100) p.push(`${principio}/${a.id}: insulina do frasco não entra (ML7)`)
    }
    const porMl = lista.map((a) => `${a.base ?? ''}${a.porMl}`)
    if (new Set(porMl).size !== porMl.length) p.push(`${principio}: concentração repetida (agrupar por concentração, ML2)`)
  }
  for (const [chave, item] of Object.entries(itens)) {
    if (!/^(bolus|rcp|sri|fita|crise):[a-z0-9-]+$/.test(chave)) p.push(`${chave}: chave fora do padrão lista:id`)
    if (!ampolas[item.principio]?.length) p.push(`${chave}: princípio ${item.principio} sem ampola`)
    const bases = new Set((ampolas[item.principio] ?? []).map((a) => a.base).filter(Boolean))
    if (bases.size > 1 && !item.base) p.push(`${chave}: ${item.principio} tem sal e elemento; o item precisa dizer a base (ML6)`)
  }
  return p
}
