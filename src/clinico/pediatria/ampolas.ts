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
  /** solução pronta para infusão (bolsa ou frasco): o mL é o volume a infundir (L6-2) */
  pronta?: boolean
  /** seringa preenchida: o mL é o volume a aplicar da seringa (lote 6b) */
  seringa?: boolean
  /** página do livro ou bula: produto, empresa, expediente e data */
  fonte: string
  url?: string
}

/** Um item de dose que usa as ampolas de um princípio ativo. */
export type ItemComAmpola = {
  principio: string
  /** base da dose do item, quando o princípio tem ampolas em bases diferentes */
  base?: BaseDose
  /**
   * o próprio item é infusão (o livro dá o tempo em horas): o mL é o volume a
   * aspirar, com o aviso de diluir, mesmo que a ampola não peça diluição (ML5)
   */
  diluir?: boolean
  /**
   * o item diz "IV ou VO" (ou VO, IM ou IV): o volume é da forma injetável, com o
   * aviso de que a forma oral tem outra concentração (lote 8, decisão do RT de 23/11/2026)
   */
  viaMista?: boolean
  /**
   * a dose do item está noutra unidade que a da ampola: multiplica a dose antes
   * da conta (ex.: mL de glicose 25% × 0,25 = g de glicose)
   */
  fatorDose?: number
  /** unidade da concentração da ampola, quando difere da unidade da dose do item */
  unidadeDaAmpola?: string
  /** aviso fixo do item, decidido pelo RT (ex.: escetamina no lugar da cetamina racêmica, A2-1) */
  aviso?: string
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

// Lote 7 (itens que esperavam bula; L7-1 a L7-7 = A do RT em 23/11/2026,
// docs/clinico/DOSES-ML-LOTE7-BULAS.md): bulas baixadas pelo RT no Bulário
// Eletrônico e lidas em 23/11/2026. A dose do livro é lida no mesmo rótulo da
// ampola: dexametasona em fosfato de dexametasona (L7-1), milrinona 1 mg/mL
// (L7-2), esmolol em cloridrato (L7-4), desmopressina em acetato (L7-5).
// Gentamicina: a bula da Fresenius (20 mg/mL) não está no Bulário; entra só a
// de 40 mg/mL, lida pelo rótulo (L7-3 = B do RT, 23/11/2026). Salbutamol
// injetável fica sem mL na criança: a única ampola à venda diz "uso adulto" (L7-6).
export const BULA_DIFENIDRAMINA: Fonte = {
  citacao: 'Bula do profissional, Difenidrin (cloridrato de difenidramina) 50 mg/mL, Cristália, única injetável à venda na CMED de 09/11/2026 (Bulário Eletrônico da ANVISA, lida em 23/11/2026): uso intramuscular ou intravenoso.',
  url: BULARIO('difenidrin'),
}
export const BULA_DEXAMETASONA: Fonte = {
  citacao: 'Bulas do profissional, fosfato dissódico de dexametasona 2 e 4 mg/mL: Eurofarma, Farmace e Hipolabor (Bulário Eletrônico da ANVISA, lidas em 23/11/2026): 4,37 mg do sal dissódico equivalem a 4 mg de fosfato de dexametasona; o rótulo da ampola é a base da dose (decisão L7-1 do RT).',
  url: BULARIO('fosfato dissódico de dexametasona'),
}
export const BULA_ACETILCISTEINA: Fonte = {
  citacao: 'Bula do profissional, Fluimucil (acetilcisteína) 100 mg/mL, solução injetável, ampola de 3 mL, Zambon (Bulário Eletrônico da ANVISA, lida em 23/11/2026): uso intravenoso por infusão.',
  url: BULARIO('fluimucil'),
}
export const BULA_ESMOLOL: Fonte = {
  citacao: 'Bulas do profissional, Brevibloc e Brevibloc Diluído (cloridrato de esmolol) 10 mg/mL e 250 mg/mL, Cristália (Bulário Eletrônico da ANVISA, lidas em 23/11/2026): o valor é do cloridrato (10 mg = 8,9 mg de esmolol base); a de 250 mg/mL é concentrada e deve ser diluída. Correção de 23/11/2026 (A4-1): a de 250 mg/mL para diluição (registro 1029802270046) está à venda na CMED de 09/11/2026; sem venda é só a outra apresentação de 250 mg/mL (1029802270011).',
  url: BULARIO('brevibloc'),
}
export const BULA_MILRINONA: Fonte = {
  citacao: 'Bula do profissional, Primacor IV (lactato de milrinona) 1 mg/mL, ampola de 10 mL, Sanofi Medley (Bulário Eletrônico da ANVISA, lida em 23/11/2026): "cada 1 mL contém 1 mg de milrinona (na forma de lactato)"; livro do ICr, p. 253 (decisão L7-2 do RT).',
  url: BULARIO('primacor'),
}
export const BULA_CLINDAMICINA: Fonte = {
  citacao: 'Bulas do profissional, fosfato de clindamicina 150 mg/mL de clindamicina base: Hipolabor e União Química (Bulário Eletrônico da ANVISA, lidas em 23/11/2026): na veia, sempre diluída (até 18 mg/mL, até 30 mg/min), nunca em bolo.',
  url: BULARIO('fosfato de clindamicina'),
}
export const BULA_AMICACINA: Fonte = {
  citacao: 'Bulas do profissional, sulfato de amicacina 50 e 250 mg/mL "equivalente a amicacina base": Teuto e Newcom (Bulário Eletrônico da ANVISA, lidas em 23/11/2026); na veia, infusão de 30 a 60 min.',
  url: BULARIO('sulfato de amicacina'),
}
export const BULA_GENTAMICINA: Fonte = {
  citacao: 'Bulas do profissional, sulfato de gentamicina 40 mg/mL: Santisa e Hipolabor (Bulário Eletrônico da ANVISA, lidas em 23/11/2026): IM e IV; na veia, diluída em SF ou glicose 5%. A bula não diz se os 40 mg são da base; o rótulo é a base da dose (decisão L7-3 do RT). A de 20 mg/mL (Fresenius) não tem bula no Bulário e fica fora.',
  url: BULARIO('sulfato de gentamicina'),
}
export const BULA_TOBRAMICINA: Fonte = {
  citacao: 'Bula do profissional, Tobramina (sulfato de tobramicina) 50 mg/mL de tobramicina, Antibióticos do Brasil (Bulário Eletrônico da ANVISA, lida em 23/11/2026): diluir em 50 a 100 mL de NaCl 0,9% ou glicose 5%.',
  url: BULARIO('tobramina'),
}
export const BULA_DESMOPRESSINA: Fonte = {
  citacao: 'Bula do profissional, DDAVP injetável (acetato de desmopressina) 4 µg/mL, ampola de 1 mL, Ferring (Bulário Eletrônico da ANVISA, lida em 23/11/2026): 4 µg de acetato equivalem a 3,56 µg de desmopressina; o rótulo é a base da dose (decisão L7-5 do RT).',
  url: 'https://consultas.anvisa.gov.br/#/bulario/q/?numeroRegistro=128760015',
}
export const BULA_VITAMINA_K: Fonte = {
  citacao: 'Bulas do profissional, fitomenadiona 10 mg/mL: Eskavit (Hipolabor) e Hyvit K (Hypofarma), uso intramuscular e subcutâneo; Kavit (Cristália), uso intramuscular (Bulário Eletrônico da ANVISA, lidas em 23/11/2026). As três contraindicam a via intravenosa (risco de choque anafilático).',
  url: BULARIO('fitomenadiona'),
}
export const BULA_SMX_TMP: Fonte = {
  citacao: 'Bula do profissional, Bac-Sulfitrin (sulfametoxazol + trimetoprima) 80 + 16 mg/mL, solução injetável, Brainfarma (Bulário Eletrônico da ANVISA, lida em 23/11/2026): as ampolas devem ser diluídas antes do uso.',
  url: BULARIO('bac-sulfitrin'),
}
export const BULA_KCL: Fonte = {
  citacao: 'Bulas do profissional, cloreto de potássio 10% (1,34 mEq/mL) e 19,1% (2,56 mEq/mL): Farmace e Equiplex (Bulário Eletrônico da ANVISA, lidas em 23/11/2026): "Soluções concentradas de potássio precisam ser diluídas. Se injetadas diretamente podem causar morte instantânea."',
  url: 'https://consultas.anvisa.gov.br/#/bulario/q/?numeroRegistro=110850015',
}
export const BULA_AMINOFILINA: Fonte = {
  citacao: 'Bula do profissional, aminofilina 24 mg/mL, ampola de 10 mL, Hipolabor (Bulário Eletrônico da ANVISA, lida em 23/11/2026): uso intravenoso, lento ou diluído, a até 25 mg/min.',
  url: 'https://consultas.anvisa.gov.br/#/bulario/q/?numeroRegistro=113430118',
}
export const BULA_HALOPERIDOL: Fonte = {
  citacao: 'Bula do profissional, Uni Haloper (haloperidol) 5 mg/mL, ampola de 1 mL, União Química (Bulário Eletrônico da ANVISA, lida em 23/11/2026): uso intramuscular; a bula pede ECG contínuo se o haloperidol for dado na veia.',
  url: 'https://consultas.anvisa.gov.br/#/bulario/q/?numeroRegistro=104970191',
}
export const BULA_TIAMINA: Fonte = {
  citacao: 'Bula do profissional, Acesyl (cloridrato de tiamina) 100 mg/mL, ampola de 1 mL, Vasconcelos (Bulário Eletrônico da ANVISA, aprovada em 27/12/2024, lida em 23/11/2026): IV ou IM; na veia, lentamente, em no mínimo 10 minutos.',
  url: 'https://consultas.anvisa.gov.br/#/bulario/q/?numeroRegistro=164000001',
}
export const BULA_TRAMADOL: Fonte = {
  citacao: 'Bula do profissional, Tramadon (cloridrato de tramadol) 50 mg/mL, Cristália (Bulário Eletrônico da ANVISA, lida em 23/11/2026): uso intravenoso, intramuscular ou subcutâneo.',
  url: 'https://consultas.anvisa.gov.br/#/bulario/q/?numeroRegistro=102980261',
}
export const BULA_PETIDINA: Fonte = {
  citacao: 'Bula do profissional, Dolosal (cloridrato de petidina) 50 mg/mL, ampola de 2 mL, Cristália (Bulário Eletrônico da ANVISA, lida em 23/11/2026): uso intramuscular, subcutâneo ou intravenoso.',
  url: 'https://consultas.anvisa.gov.br/#/bulario/q/?numeroRegistro=102980034',
}
export const BULA_MORFINA_NEUROEIXO: Fonte = {
  citacao: 'Bula do profissional, Dimorf (sulfato de morfina) 0,1 e 0,2 mg/mL, Cristália (Bulário Eletrônico da ANVISA, lida em 20/11/2026): "uso intravenoso, intratecal e epidural" (decisão L5-3 do RT).',
  url: BULARIO('dimorf'),
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
  // lote 4 (anafilaxia, asma e crupe; L4-1 a L4-5 = A do RT em 20/11/2026,
  // docs/clinico/DOSES-ML-LOTE4-ANAFILAXIA-ASMA.md). Magnésio: dose e
  // concentração no sal (MgSO₄), as duas à venda e nenhuma marcada (L4-3). A
  // diluição entra quando a bula for lida (L4-1).
  magnesio: [
    { id: 'magnesio-100', rotulo: 'Sulfato de magnésio 10% (100 mg/mL, ampola de 10 mL)', porMl: 100, base: 'sal', fonte: 'CMED 09/11/2026: Samtec (1559200050025) e Halex (1031101630013), à venda', url: CMED_PMC_2026_11.url },
    { id: 'magnesio-500', rotulo: 'Sulfato de magnésio 50% (500 mg/mL, ampola de 10 mL)', porMl: 500, base: 'sal', diluir: true, fonte: 'diluir: o livro dá concentração máxima de 20% (p. 908); livro do ICr, p. 32 (MgSO₄ 50% = 500 mg/mL); CMED 09/11/2026: Samtec (1559200050092) e Halex (1031101630021), à venda', url: CMED_PMC_2026_11.url },
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
  // lote 5 (antídotos, metabólico e cardio; L5-1 a L5-6 = A do RT em 20/11/2026,
  // docs/clinico/DOSES-ML-LOTE5-ANTIDOTOS-CARDIO.md), primeira parte: concentração
  // pela CMED (só à venda) ou pelo livro; a diluição entra quando a bula for lida.
  flumazenil: [
    { id: 'flumazenil-0-1', rotulo: 'Flumazenil 0,1 mg/mL (ampola de 5 mL)', porMl: 0.1, fonte: 'CMED 09/11/2026: Fresenius (1004102250012), Cristália (1029802870035), Teuto (1037006350032), União Química (1049713260015), Hipolabor (1134301960018) e Biopas (1897700020011), à venda', url: CMED_PMC_2026_11.url },
  ],
  hidralazina: [
    { id: 'hidralazina-20', rotulo: 'Hidralazina 20 mg/mL (ampola de 1 mL)', porMl: 20, fonte: 'CMED 09/11/2026: Cristália (1029800890037), à venda', url: CMED_PMC_2026_11.url },
  ],
  // dose em µg: 0,5 mg/mL = 500 µg/mL
  terbutalina: [
    { id: 'terbutalina-500', rotulo: 'Terbutalina 0,5 mg/mL = 500 µg/mL (ampola de 1 mL)', porMl: 500, fonte: 'CMED 09/11/2026: Fresenius (1004101740016), União Química (1049711760029) e Hipolabor (1134301760035), à venda', url: CMED_PMC_2026_11.url },
  ],
  ondansetrona: [
    { id: 'ondansetrona-2', rotulo: 'Ondansetrona 2 mg/mL (ampolas de 2 e 4 mL)', porMl: 2, fonte: 'CMED 09/11/2026: Fresenius, Cristália, Halex, Hypofarma, União Química, Aché, Hipolabor e Blau, à venda', url: CMED_PMC_2026_11.url },
  ],
  // dose em µg; três concentrações, nenhuma marcada (L5-4); o pó de depósito não é IV e fica fora
  octreotida: [
    { id: 'octreotida-50', rotulo: 'Octreotida 0,05 mg/mL = 50 µg/mL (ampola de 1 mL)', porMl: 50, fonte: 'CMED 09/11/2026: Novartis (1006800090017), à venda', url: CMED_PMC_2026_11.url },
    { id: 'octreotida-100', rotulo: 'Octreotida 0,1 mg/mL = 100 µg/mL (ampola de 1 mL)', porMl: 100, fonte: 'CMED 09/11/2026: Novartis (1006800090025) e Sun (1468200200046), à venda', url: CMED_PMC_2026_11.url },
    { id: 'octreotida-500', rotulo: 'Octreotida 0,5 mg/mL = 500 µg/mL (ampola de 1 mL)', porMl: 500, fonte: 'CMED 09/11/2026: Novartis (1006800090033), à venda', url: CMED_PMC_2026_11.url },
  ],
  neostigmina: [
    { id: 'neostigmina-0-5', rotulo: 'Neostigmina 0,5 mg/mL (ampola de 1 mL)', porMl: 0.5, fonte: 'CMED 09/11/2026: União Química (1049714060044) e Blau (1163701340029), à venda', url: CMED_PMC_2026_11.url },
  ],
  // L5-3: 1 e 10 mg/mL, nenhuma marcada (10×); 0,1 e 0,2 mg/mL só se a bula
  // permitir IV: a do Dimorf permite (lida em 20/11/2026), entram no lote 7
  morfina: [
    { id: 'morfina-0-1', rotulo: 'Morfina 0,1 mg/mL (Dimorf, sem conservante)', porMl: 0.1, fonte: 'bula Dimorf, Cristália (IV, intratecal e epidural)', url: BULA_MORFINA_NEUROEIXO.url },
    { id: 'morfina-0-2', rotulo: 'Morfina 0,2 mg/mL (sem conservante)', porMl: 0.2, fonte: 'bula Dimorf, Cristália (IV, intratecal e epidural); CMED 09/11/2026: Cristália e União Química (IV/EPI/IT)', url: BULA_MORFINA_NEUROEIXO.url },
    { id: 'morfina-1', rotulo: 'Morfina 1 mg/mL (ampola de 2 mL)', porMl: 1, fonte: 'CMED 09/11/2026: Cristália (1029800970131) e União Química (1049714550114, IV/EPI/IT/IM), à venda', url: CMED_PMC_2026_11.url },
    { id: 'morfina-10', rotulo: 'Morfina 10 mg/mL (ampola de 1 mL)', porMl: 10, fonte: 'CMED 09/11/2026: Cristália (1029800970032), Hipolabor (1134301630034, IM/IV/IT/EPI) e União Química (1049714550165), à venda', url: CMED_PMC_2026_11.url },
  ],
  // ML7 e L5-5: nunca o frasco de 100 UI/mL; só o preparo do livro
  'insulina-preparo': [
    { id: 'insulina-0-1', rotulo: 'Insulina regular 0,1 UI/mL: 50 UI em 500 mL de NaCl 0,9% (preparo do livro, p. 521); nunca o frasco de 100 UI/mL', porMl: 0.1, fonte: 'livro do ICr, p. 521 (preparo de 0,1 UI/mL)' },
  ],
  // lote 6a (pneumonia, ITU e crise álgica; L6-1 a L6-9 = A do RT em 20/11/2026,
  // docs/clinico/DOSES-ML-LOTE6-DEMAIS-CAPITULOS.md): soluções prontas (L6-2) e dipirona
  levofloxacino: [
    { id: 'levofloxacino-5', rotulo: 'Levofloxacino 5 mg/mL, solução pronta (bolsas de 100 e 150 mL)', porMl: 5, pronta: true, fonte: 'CMED 09/11/2026: Eurofarma (1004312620045) e Halex (1031101530027), à venda', url: CMED_PMC_2026_11.url },
  ],
  metronidazol: [
    { id: 'metronidazol-5', rotulo: 'Metronidazol 5 mg/mL, solução pronta (100 mL)', porMl: 5, pronta: true, fonte: 'CMED 09/11/2026: Fresenius (1004101290029), B. Braun (1008501070045), Halex (1031101190064), Beker (1034600200043), JP (1049100640026), Baxter (1068301150022), Farmace (1108500140038) e Sanofi Medley (1832603770031), à venda', url: CMED_PMC_2026_11.url },
  ],
  linezolida: [
    { id: 'linezolida-2', rotulo: 'Linezolida 2 mg/mL, solução pronta (bolsa de 300 mL)', porMl: 2, pronta: true, fonte: 'CMED 09/11/2026: Eurofarma (1004311680036) e Beker (1034600190013), à venda', url: CMED_PMC_2026_11.url },
  ],
  ciprofloxacino: [
    { id: 'ciprofloxacino-2', rotulo: 'Ciprofloxacino 2 mg/mL, solução pronta (100 e 200 mL)', porMl: 2, pronta: true, fonte: 'CMED 09/11/2026: Fresenius (1004199401411) e Hypofarma (1038700420048), à venda', url: CMED_PMC_2026_11.url },
  ],
  dipirona: [
    { id: 'dipirona-500', rotulo: 'Dipirona 500 mg/mL (ampolas de 2 e 5 mL)', porMl: 500, fonte: 'CMED 09/11/2026: Santisa (1018600360022), Teuto (1037004700052), Hypofarma (1038700180012), Farmace (1108500180048) e Hipolabor (1134301200021, IM/IV), à venda', url: CMED_PMC_2026_11.url },
  ],
  // lote 6b (renal, hemostasia e emergências oncológicas, CMED 09/11/2026): uma
  // concentração à venda de cada; nenhuma marcada (ML2)
  furosemida: [
    { id: 'furosemida-10', rotulo: 'Furosemida 10 mg/mL (ampola de 2 mL)', porMl: 10, fonte: 'CMED 09/11/2026: Santisa (1018600320012), Teuto (1037002770037), Hypofarma (1038700380011), Hipolabor (1134301350015) e Sanofi Medley (1832603560029), à venda', url: CMED_PMC_2026_11.url },
  ],
  'acido-tranexamico': [
    { id: 'acido-tranexamico-50', rotulo: 'Ácido tranexâmico 50 mg/mL (ampola de 5 mL)', porMl: 50, fonte: 'CMED 09/11/2026: Fresenius (1004102310015), Hipolabor (1134301860021), Blau (1163700990011) e Zydus Nikkho (1565100450026), à venda; a de 100 mg/mL das listas locais não está na lista', url: CMED_PMC_2026_11.url },
  ],
  enoxaparina: [
    { id: 'enoxaparina-100', rotulo: 'Enoxaparina 100 mg/mL (seringas preenchidas de 20 a 100 mg, 0,2 a 1 mL)', porMl: 100, seringa: true, fonte: 'CMED 09/11/2026: seringas de 100 mg/mL de Aché, Biomm, Blau, Cristália, Eurofarma, Sanofi Medley e Viatris à venda (ex.: Eurofarma 1004310160081, Blau 1163700710086, Aché 1057307640018); nenhuma outra concentração', url: CMED_PMC_2026_11.url },
  ],
  manitol: [
    { id: 'manitol-20', rotulo: 'Manitol 20% = 0,2 g/mL, solução pronta (250 e 500 mL)', porMl: 0.2, pronta: true, fonte: 'livro do ICr, p. 720 e p. 179 (manitol 20% = 0,2 g/mL); CMED 09/11/2026: B. Braun (1008500420077), Cristália (1029805340029), Halex (1031100710072), Beker (1034600110044), JP (1049100120091), Baxter (1068300900036), Farmace (1108500370017) e Equiplex (1177200080032), à venda', url: CMED_PMC_2026_11.url },
  ],
  // lote 6c (eletrólitos; L6-6 e L6-7 = A do RT em 20/11/2026). Bicarbonato:
  // 8,4% e 10% à venda, nenhum marcado; o 3% é preparo e fica sem mL (L6-6).
  bicarbonato: [
    { id: 'bicarbonato-8-4', rotulo: 'Bicarbonato de sódio 8,4% (1 mEq/mL)', porMl: 1, fonte: 'livro do ICr, p. 32 (8,4%: 1 mL = 1 mEq); CMED 09/11/2026: Farmace (1108500230010) e Samtec (1559200030059), ampolas de 10 mL, e Fresenius (1004101300024), Hypofarma (1038700560087) e JP (1049100710016), frascos de 250 mL, à venda', url: CMED_PMC_2026_11.url },
    { id: 'bicarbonato-10', rotulo: 'Bicarbonato de sódio 10% (1,19 mEq/mL)', porMl: 100 / 84, fonte: 'CMED 09/11/2026: Farmace (1108500230037), 100 mg/mL, ampola de 10 mL, à venda; 1,19 mEq/mL pela conta do sal (100 mg/mL ÷ 84 mg/mEq, L6-6)', url: CMED_PMC_2026_11.url },
  ],
  // Cálcio com a dose em mg do sal (L6-7): um princípio por sal, para a dose de
  // cloreto nunca ganhar o volume do gluconato. A base é o sal quando o livro dá,
  // para a mesma dose, o volume da solução a 10% (p. 549 e 583). Nenhum dos dois
  // aparece à venda na CMED de 09/11/2026 (a ampola de cloreto da Vasconcelos
  // está sem venda); a concentração vem do livro.
  'gluconato-de-calcio': [
    { id: 'gluconato-sal-10', rotulo: 'Gluconato de cálcio 10% (100 mg do sal/mL)', porMl: 100, base: 'sal', fonte: 'livro do ICr, Tabela 11, p. 558 (gluconato de cálcio 10%) e Tabela 8, p. 583 (50 a 100 mg/kg = 0,5 a 1 mL/kg)' },
  ],
  'cloreto-de-calcio': [
    { id: 'cloreto-sal-10', rotulo: 'Cloreto de cálcio 10% (100 mg do sal/mL)', porMl: 100, base: 'sal', fonte: 'livro do ICr, Tabela 11, p. 559 (cloreto de cálcio 10%) e p. 549 (20 mg/kg = 0,2 mL/kg da solução a 10%)' },
  ],
  // a mesma ampola em mg (dose da intoxicação) e em µg (dose baixa)
  naloxona: [
    { id: 'naloxona-0-4', rotulo: 'Naloxona 0,4 mg/mL (ampola de 1 mL)', porMl: 0.4, fonte: 'bula Hipolabor', url: BULA_NALOXONA.url },
  ],
  'naloxona-ug': [
    { id: 'naloxona-400', rotulo: 'Naloxona 0,4 mg/mL = 400 µg/mL (ampola de 1 mL)', porMl: 400, fonte: 'bula Hipolabor', url: BULA_NALOXONA.url },
  ],
  // lote 7: bulas lidas em 23/11/2026 (L7-1 a L7-7 = A do RT)
  difenidramina: [
    { id: 'difenidramina-50', rotulo: 'Difenidramina 50 mg/mL (ampola de 1 mL)', porMl: 50, fonte: 'bula Difenidrin, Cristália (IM ou IV); única à venda na CMED 09/11/2026 (1029801700020)', url: BULA_DIFENIDRAMINA.url },
  ],
  dexametasona: [
    { id: 'dexametasona-2', rotulo: 'Dexametasona 2 mg/mL (fosfato dissódico, ampola de 1 mL)', porMl: 2, fonte: 'bulas Farmace e Hipolabor (2 mg/mL = 2 mg de fosfato de dexametasona; L7-1)', url: BULA_DEXAMETASONA.url },
    { id: 'dexametasona-4', rotulo: 'Dexametasona 4 mg/mL (fosfato dissódico, ampolas de 1 e 2,5 mL)', porMl: 4, fonte: 'bulas Eurofarma, Farmace e Hipolabor (4 mg/mL = 4 mg de fosfato de dexametasona; L7-1)', url: BULA_DEXAMETASONA.url },
  ],
  acetilcisteina: [
    { id: 'acetilcisteina-100', rotulo: 'Acetilcisteína 100 mg/mL (ampola de 3 mL)', porMl: 100, diluir: true, fonte: 'bula Fluimucil, Zambon (IV por infusão); CMED 09/11/2026: Zambon (100840075) e União Química (104971317), à venda', url: BULA_ACETILCISTEINA.url },
  ],
  // dose em µg: 10 mg/mL = 10.000 µg/mL, do cloridrato (L7-4)
  esmolol: [
    { id: 'esmolol-10000', rotulo: 'Esmolol 10 mg/mL = 10.000 µg/mL (frasco-ampola de 10 mL)', porMl: 10000, fonte: 'bula Brevibloc, Cristália (cloridrato de esmolol; 10 mg/mL pronto para uso); CMED 09/11/2026: 1029802270054, à venda', url: BULA_ESMOLOL.url },
    // A4-1 (RT, 23/11/2026): a de 250 mg/mL está à venda e entra, sempre a aspirar e diluir
    { id: 'esmolol-250000', rotulo: 'Esmolol 250 mg/mL = 250.000 µg/mL (ampola de 10 mL, para diluir)', porMl: 250000, diluir: true, fonte: 'bula Brevibloc, Cristália (concentrada, deve ser diluída); CMED 09/11/2026: 1029802270046, à venda', url: BULA_ESMOLOL.url },
  ],
  // dose em µg: 1 mg/mL = 1.000 µg/mL (L7-2)
  milrinona: [
    { id: 'milrinona-1000', rotulo: 'Milrinona 1 mg/mL = 1.000 µg/mL (ampola de 10 mL)', porMl: 1000, fonte: 'bula Primacor IV, Sanofi Medley; livro do ICr, p. 253; CMED 09/11/2026, única à venda', url: BULA_MILRINONA.url },
  ],
  clindamicina: [
    { id: 'clindamicina-150', rotulo: 'Clindamicina 150 mg/mL (ampola de 4 mL)', porMl: 150, diluir: true, fonte: 'bulas Hipolabor e União Química (clindamicina base; IV sempre diluída, até 18 mg/mL e 30 mg/min)', url: BULA_CLINDAMICINA.url },
  ],
  // 5× entre as duas, nenhuma marcada (L6-4); na veia, infusão de 30 a 60 min
  amicacina: [
    { id: 'amicacina-50', rotulo: 'Amicacina 50 mg/mL (ampola de 2 mL)', porMl: 50, diluir: true, fonte: 'bula Teuto (amicacina base); CMED 09/11/2026: Teuto (103700297), à venda', url: BULA_AMICACINA.url },
    { id: 'amicacina-250', rotulo: 'Amicacina 250 mg/mL (ampola de 2 mL)', porMl: 250, diluir: true, fonte: 'bulas Teuto e Newcom (amicacina base); CMED 09/11/2026: Fresenius (1004102170) e Teuto (103700297), à venda', url: BULA_AMICACINA.url },
  ],
  gentamicina: [
    { id: 'gentamicina-40', rotulo: 'Gentamicina 40 mg/mL (ampolas de 1 e 2 mL)', porMl: 40, diluir: true, fonte: 'bulas Santisa e Hipolabor (IM e IV; na veia, diluída); CMED 09/11/2026: Santisa (101860034) e Hipolabor (113430119), à venda; L7-3 = B (rótulo)', url: BULA_GENTAMICINA.url },
  ],
  tobramicina: [
    { id: 'tobramicina-50', rotulo: 'Tobramicina 50 mg/mL', porMl: 50, diluir: true, fonte: 'bula Tobramina, Antibióticos do Brasil (diluir em 50 a 100 mL)', url: BULA_TOBRAMICINA.url },
  ],
  // dose em µg do acetato, como o rótulo (L7-5)
  // só a via SC do item (a IV fica sem mL: as três bulas contraindicam a veia, L5-2)
  'vitamina-k-sc': [
    { id: 'vitamina-k-10', rotulo: 'Vitamina K (fitomenadiona) 10 mg/mL, ampola de 1 mL (IM ou SC; não usar na veia)', porMl: 10, fonte: 'bulas Eskavit (Hipolabor) e Hyvit K (Hypofarma): IM e SC; CMED 09/11/2026: Hipolabor (113430129) e Hypofarma (103870075), à venda', url: BULA_VITAMINA_K.url },
  ],
  // lote 8 (pendências do RT, 23/11/2026): glicose de 5% a 50%, nenhuma marcada;
  // a de 75% fica fora (decisão do RT). Dose em g de glicose.
  glicose: [
    { id: 'glicose-5', rotulo: 'Glicose 5% (0,05 g/mL), frasco', porMl: 0.05, pronta: true, fonte: 'CMED 09/11/2026: Fresenius (100410107), B. Braun (100850024) e Farmarin (116880033), frascos, à venda', url: CMED_PMC_2026_11.url },
    { id: 'glicose-10', rotulo: 'Glicose 10% (0,1 g/mL), frasco', porMl: 0.1, pronta: true, fonte: 'CMED 09/11/2026: Fresenius (100410107), B. Braun (100850024) e Farmarin (116880033), frascos, à venda', url: CMED_PMC_2026_11.url },
    { id: 'glicose-25', rotulo: 'Glicose 25% (0,25 g/mL), ampola de 10 mL', porMl: 0.25, fonte: 'livro do ICr, p. 32; CMED 09/11/2026: Halex (103110167), Farmace (110850009), Equiplex (117720004) e Samtec (155920006), à venda', url: CMED_PMC_2026_11.url },
    { id: 'glicose-50', rotulo: 'Glicose 50% (0,5 g/mL), ampola de 10 ou 20 mL', porMl: 0.5, fonte: 'CMED 09/11/2026: Fresenius (100410107), Halex (103110167) e Samtec (155920006), à venda; incluída a pedido do RT (23/11/2026)', url: CMED_PMC_2026_11.url },
  ],
  // SMX-TMP: as doses do livro estão em trimetoprima (L6-5): 16 mg/mL de TMP
  'smx-tmp': [
    { id: 'smx-tmp-16', rotulo: 'Sulfametoxazol + trimetoprima 80 + 16 mg/mL (16 mg/mL de trimetoprima)', porMl: 16, diluir: true, fonte: 'bula Bac-Sulfitrin, Brainfarma (as ampolas devem ser diluídas); dose em trimetoprima (Apêndice, p. 908)', url: BULA_SMX_TMP.url },
  ],
  // A0 (adulto, MA1 = A): magnésio com a dose em g (PCR, torsades); a mesma
  // concentração do princípio em mg do sal, noutra unidade
  'magnesio-g': [
    { id: 'magnesio-g-10', rotulo: 'Sulfato de magnésio 10% (0,1 g/mL, ampola de 10 mL)', porMl: 0.1, fonte: 'CMED 09/11/2026: Samtec (1559200050025) e Halex (1031101630013), à venda; bula Vasconcelos (IV direto ou diluído, lida em 23/11/2026)', url: CMED_PMC_2026_11.url },
    { id: 'magnesio-g-50', rotulo: 'Sulfato de magnésio 50% (0,5 g/mL, ampola de 10 mL)', porMl: 0.5, fonte: 'CMED 09/11/2026: Samtec (1559200050092) e Halex (1031101630021), à venda; bula Vasconcelos (IV direto ou diluído, lida em 23/11/2026)', url: CMED_PMC_2026_11.url },
  ],
  // adulto, lote A1 (bulas lidas em 23/11/2026, A1-2 e A1-3 = A): KCl em mEq, sempre diluído
  'kcl-meq': [
    { id: 'kcl-10', rotulo: 'Cloreto de potássio 10% (1,34 mEq/mL, ampola de 10 mL)', porMl: 1.34, diluir: true, fonte: 'bulas Farmace e Equiplex (1.340 mEq/L; injeção direta pode causar morte instantânea); CMED 09/11/2026: Farmace (110850015), à venda', url: BULA_KCL.url },
    { id: 'kcl-19-1', rotulo: 'Cloreto de potássio 19,1% (2,56 mEq/mL, ampola de 10 mL)', porMl: 2.56, diluir: true, fonte: 'bulas Farmace e Equiplex (2.560 mEq/L; injeção direta pode causar morte instantânea); CMED 09/11/2026: Halex (103110160) e Equiplex (117720007), à venda', url: BULA_KCL.url },
  ],
  aminofilina: [
    { id: 'aminofilina-24', rotulo: 'Aminofilina 24 mg/mL (ampola de 10 mL)', porMl: 24, fonte: 'bula Hipolabor (IV lento ou diluído, até 25 mg/min); CMED 09/11/2026: Teuto (103700286), Farmace (110850024) e Hipolabor (113430118), à venda', url: BULA_AMINOFILINA.url },
  ],
  // adulto, lote A2 (bulas lidas em 23/11/2026); o decanoato de haloperidol (depósito) nunca entra
  haloperidol: [
    { id: 'haloperidol-5', rotulo: 'Haloperidol 5 mg/mL (ampola de 1 mL)', porMl: 5, fonte: 'bula Uni Haloper, União Química (uso IM); CMED 09/11/2026: Fresenius (100410223), Cristália (102980020) e União Química (104970191), à venda', url: BULA_HALOPERIDOL.url },
  ],
  tiamina: [
    { id: 'tiamina-100', rotulo: 'Tiamina 100 mg/mL (ampola de 1 mL)', porMl: 100, fonte: 'bula Acesyl, Vasconcelos (IV lenta em 10 min ou IM); única à venda na CMED 09/11/2026', url: BULA_TIAMINA.url },
  ],
  tramadol: [
    { id: 'tramadol-50', rotulo: 'Tramadol 50 mg/mL (ampolas de 1 e 2 mL)', porMl: 50, fonte: 'bula Tramadon, Cristália (IV, IM ou SC); CMED 09/11/2026: Cristália, Halex, Teuto e outros, à venda', url: BULA_TRAMADOL.url },
  ],
  petidina: [
    { id: 'petidina-50', rotulo: 'Petidina (meperidina) 50 mg/mL (ampola de 2 mL)', porMl: 50, fonte: 'bula Dolosal, Cristália (IM, SC ou IV); CMED 09/11/2026: Cristália (102980034) e União Química (104971339), à venda', url: BULA_PETIDINA.url },
  ],
  // adulto (A4): esmolol com a dose em mg, as mesmas duas ampolas
  'esmolol-mg': [
    { id: 'esmolol-mg-10', rotulo: 'Esmolol 10 mg/mL (frasco-ampola de 10 mL)', porMl: 10, fonte: 'bula Brevibloc, Cristália (pronto para uso); CMED 09/11/2026: 1029802270054, à venda', url: BULA_ESMOLOL.url },
    { id: 'esmolol-mg-250', rotulo: 'Esmolol 250 mg/mL (ampola de 10 mL, para diluir)', porMl: 250, diluir: true, fonte: 'bula Brevibloc, Cristália (concentrada, deve ser diluída); CMED 09/11/2026: 1029802270046, à venda', url: BULA_ESMOLOL.url },
  ],
  desmopressina: [
    { id: 'desmopressina-4', rotulo: 'Desmopressina 4 µg/mL (acetato, ampola de 1 mL)', porMl: 4, diluir: true, fonte: 'bula DDAVP injetável, Ferring; o livro manda em 50 mL de SF (p. 679, 682)', url: BULA_DESMOPRESSINA.url },
  ],
}

export const fichaAmpolas: Ficha = {
  id: 'ped-ampolas',
  titulo: 'Ampolas para a dose em mL (criança)',
  versao: '2026-11-23.8',
  publico: 'pediatrico',
  fontes: [{ ...LIVRO_PS_PED, citacao: `${LIVRO_PS_PED.citacao} Tabela 11, p. 558–559 (cálcio elementar por mL); p. 88 (Ketamin S® 50 mg/mL); p. 32 (MgSO₄ 50% = 500 mg/mL; NaHCO₃ 8,4% = 1 mEq/mL); p. 549 e 583 (cálcio 10% = 100 mg do sal/mL); p. 521 (insulina regular 0,1 UI/mL: 50 UI em 500 mL de NaCl 0,9%); p. 720 e p. 179 (manitol 20% = 0,2 g/mL).` }, BULA_ADENOSINA, BULA_AMIODARONA, BULA_LIDOCAINA,
    BULA_FENTANILA, BULA_MIDAZOLAM, BULA_ESCETAMINA, BULA_ETOMIDATO, BULA_PROPOFOL, BULA_ROCURONIO, BULA_DEXMEDETOMIDINA, BULA_NALOXONA,
    CMED_PMC_2026_11, BULA_DIAZEPAM, BULA_DIFENIDRAMINA, BULA_DEXAMETASONA, BULA_ACETILCISTEINA, BULA_ESMOLOL, BULA_MILRINONA,
    BULA_CLINDAMICINA, BULA_AMICACINA, BULA_GENTAMICINA, BULA_TOBRAMICINA, BULA_DESMOPRESSINA, BULA_MORFINA_NEUROEIXO, BULA_VITAMINA_K, BULA_SMX_TMP, BULA_KCL, BULA_AMINOFILINA, BULA_HALOPERIDOL, BULA_TIAMINA, BULA_TRAMADOL, BULA_PETIDINA],
  revisadoEm: '23/11/2026 (lote A4 da dose em mL, adulto, primeira parte: esmolol 250 mg/mL à venda (correção do "sem venda" dos lotes 5 e 7, A4-1) entra ao lado da 10 mg/mL, a aspirar e diluir, na criança e no adulto; esmolol, amiodarona e magnésio (IV, A4-2) na fibrilação atrial; esmolol e hidralazina na emergência hipertensiva; ácido tranexâmico no AVC; aguarda aprovação do RT); 23/11/2026 (lote A3 da dose em mL, adulto: acetilcisteína nas 3 fases, flumazenil, naloxona nos 3 cenários, atropina no betabloqueador e no organofosforado e tiamina do etilenoglicol, com ampolas já cadastradas; sem princípio novo; aguarda aprovação do RT); 23/11/2026 (lote A2 da dose em mL, adulto, segunda parte: haloperidol 5 mg/mL (IM; nos itens com IV, aviso de via mista e da bula, A2-2), tiamina 100 mg/mL, tramadol 50 mg/mL (via mista) e petidina 50 mg/mL pelas bulas lidas; escetamina na quetamina da agitação com o aviso da cetamina racêmica (A2-1); midazolam, diazepam, fentanila e morfina já cadastrados; aguarda aprovação do RT); 23/11/2026 (lote A2 da dose em mL, adulto, primeira parte: difenidramina 50 mg/mL e magnésio em g (a aspirar e diluir) na anafilaxia; lidocaína, midazolam, fentanila, flumazenil e naloxona na sedação para procedimento; ampolas já cadastradas, sem princípio novo; aguarda aprovação do RT); 23/11/2026 (lote A1, bulas do KCl e da aminofilina: KCl 10% (1,34 mEq/mL) e 19,1% (2,56 mEq/mL) na PCR, nenhum marcado, sempre a aspirar e diluir; aminofilina 24 mg/mL na bradicardia, IV lenta até 25 mg/min; aguarda aprovação do RT); 23/11/2026 (lote A1 da dose em mL, adulto: cadastro único (MA1); atropina 0,25 e 0,5 mg/mL na bradicardia; adenosina 3 mg/mL, amiodarona 50 mg/mL a aspirar e diluir, lidocaína 1% e 2% e magnésio 10% e 50% em g (infusão de 15 min, a aspirar e diluir) nas taquiarritmias; glicose de 5% a 50% na hipercalemia da PCR; KCl e aminofilina esperam a bula; aguarda aprovação do RT); 23/11/2026 (lote 8 da dose em mL, pendências decididas pelo RT: aviso de via mista nos itens IV ou VO (linezolida, metronidazol, levofloxacino, dipirona, dexametasona da asma e do crupe, tranexâmico da DVW, SMX-TMP em trimetoprima 16 mg/mL a aspirar e diluir); fenitoína profilática IV; glicose 5%, 10%, 25% e 50% nenhuma marcada, sem a de 75% (decisão do RT), nos itens em g e nos itens em mL de glicose 25% convertidos para g; enoxaparina do lactente mantém o volume com o aviso abaixo de 0,1 mL; aguarda aprovação do RT); 23/11/2026 (lote 7 da dose em mL: bulas baixadas pelo RT e lidas; difenidramina 50 mg/mL, dexametasona 2 e 4 mg/mL no rótulo do fosfato (L7-1, só nos itens EV ou IV: meningite e oncologia), acetilcisteína 100 mg/mL a aspirar e diluir, esmolol 10 mg/mL do cloridrato (L7-4), milrinona 1 mg/mL (L7-2), clindamicina 150 mg/mL a aspirar e diluir, amicacina 50 e 250 mg/mL nenhuma marcada, tobramicina 50 mg/mL e desmopressina 4 µg/mL do acetato (L7-5) a aspirar e diluir, morfina 0,1 e 0,2 mg/mL do Dimorf (L5-3); gentamicina 40 mg/mL pelo rótulo, a aspirar e diluir, só na pneumonia EV (L7-3 = B; a de 20 mg/mL não tem bula no Bulário); salbutamol injetável sem mL (uso adulto, L7-6); vitamina K 10 mg/mL só na via SC da intoxicação (Eskavit e Hyvit K; a IV fica sem mL, as bulas contraindicam); aguarda aprovação do RT); 20/11/2026 (lote 6d da dose em mL: capítulos com princípio já cadastrado — furosemida EV da síndrome nefrótica, da SHU e da diurese forçada, bicarbonato da diurese alcalina com o aviso de diluir no próprio item (infusão de 3 a 4 h), atropina e midazolam, bolus de octreotida, linezolida e metronidazol IV do choque tóxico e da pele; sem princípio novo; item sem via escrita e lista só oral (insuficiência cardíaca) ficam sem mL; aguarda aprovação do RT); 20/11/2026 (lote 6c da dose em mL: eletrólitos; bicarbonato 8,4% e 10% (L6-6), nenhum marcado; gluconato e cloreto de cálcio 10% em mg do sal pelo livro (L6-7), um princípio por sal; magnésio grave dos eletrólitos pela escolha de 10% e 50% (lote 4), sem o 10% fixo; furosemida e insulina; cálcio, bicarbonato da injúria renal e gluconato da oncologia ligados; glicose espera decisão do RT; fósforo e KCl seguem com o mL do livro; aguarda aprovação do RT); 20/11/2026 (lote 6b da dose em mL: injúria renal, hemostasia e emergências oncológicas; furosemida 10 mg/mL, ácido tranexâmico 50 mg/mL, enoxaparina 100 mg/mL em seringa preenchida e manitol 20% como solução pronta, pela CMED e pelo livro; insulina da hipercalemia pelo preparo de 0,1 UI/mL (L5-5); midazolam, fenitoína e antibióticos de solução pronta já cadastrados; item sem via escrita fica sem mL; só a dose por tomada; aguarda aprovação do RT); 20/11/2026 (lote 6a da dose em mL: pneumonia, ITU e crise álgica; levofloxacino, metronidazol, linezolida e ciprofloxacino como solução pronta, com o volume a infundir; dipirona 500 mg/mL; morfina da crise álgica pelas ampolas do lote 5; só a dose por tomada; decisões L6-1 a L6-9 do RT; aguarda aprovação do RT); 20/11/2026 (lote 5 da dose em mL, primeira parte: flumazenil, hidralazina, terbutalina, ondansetrona IV, octreotida (3 concentrações), neostigmina e morfina 1 e 10 mg/mL pela CMED, nenhuma marcada; insulina só pelo preparo de 0,1 UI/mL do livro, p. 521; decisões L5-1 a L5-6 do RT; diluição, vitamina K, acetilcisteína, esmolol, milrinona e morfina 0,1 e 0,2 mg/mL esperam a bula; aguarda aprovação do RT); 20/11/2026 (lote 4 da dose em mL, primeira parte: magnésio 10% e 50% pela CMED na asma e na torsades, nenhuma marcada; aviso de volume abaixo de 0,1 mL; decisões L4-1 a L4-5 do RT; diluição do magnésio e difenidramina, dexametasona e azul de metileno esperam a bula; aguarda aprovação do RT); 20/11/2026 (lote 3 da dose em mL: crise epiléptica; CMED como fonte ao lado da bula; atropina e lidocaína 1% pela CMED; tabela aprovada pelo RT; aguarda aprovação do RT); 20/11/2026 (lote 2 da dose em mL: intubação, sedação e antídotos; bulas lidas e tabela aprovada pelo RT; aguarda aprovação do RT); 19/11/2026 (lote 1 da dose em mL: RCP e arritmias; bulas do Bulário Eletrônico lidas e tabela aprovada pelo RT; decisões ML1–ML11; aguarda aprovação do RT)',
}

/**
 * Itens de dose que mostram a escolha da ampola, pela chave "lista:id":
 * 'bolus:<id>' (bolus.ts), 'rcp:<id>' (rcp.ts), 'sri:<id>' (viaAerea.ts),
 * 'fita:<id>' (dosesDaFita.ts, guia de parada da criança), 'crise:<id>'
 * (criseEpileptica.ts), 'asma:<id>' (asma.ts), 'anafilaxia:<id>' (anafilaxia.ts),
 * 'pneumonia:<id>' (pneumoniaPed.ts), 'itu:<id>' (ituPed.ts), 'falciforme:<id>'
 * (falciformePed.ts), 'renal:<id>' (injuriaRenalPed.ts), 'hemostasia:<id>'
 * (hemostasiaTromboPed.ts), 'oncologia:<id>' (oncologiaPed.ts), 'eletrolitos:<id>'
 * (eletrolitosPed.ts), 'glomerulo:<id>' (glomerulopatiasPed.ts), 'intoxicacao:<id>'
 * (intoxicacaoPed.ts), 'coma:<id>' (comaHicPed.ts), 'hda:<id>' (digestivoHepaticoPed.ts)
 *, 'pele:<id>' (choqueToxicoPartesMolesPed.ts)
 * e 'meningite:<id>' (meningitePed.ts). Nos capítulos (DoseLivro), o mL sai só da dose por tomada (L6-1).
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
  // lote 4: magnésio na asma e na torsades (L4-3), em mg do sal
  'asma:magnesio-tabela': { principio: 'magnesio', base: 'sal' },
  'asma:magnesio-texto': { principio: 'magnesio', base: 'sal' },
  'bolus:magnesio-asma': { principio: 'magnesio', base: 'sal' },
  'bolus:magnesio-torsades': { principio: 'magnesio', base: 'sal' },
  'fita:fita-magnesio-asma': { principio: 'magnesio', base: 'sal' },
  'fita:fita-magnesio-torsades': { principio: 'magnesio', base: 'sal' },
  // lote 5, primeira parte
  'bolus:flumazenil': { principio: 'flumazenil' },
  'bolus:hidralazina': { principio: 'hidralazina' },
  'bolus:terbutalina-ataque': { principio: 'terbutalina' },
  'fita:fita-ondansetrona-iv': { principio: 'ondansetrona' },
  'bolus:octreotida-ataque': { principio: 'octreotida' },
  'bolus:neostigmina-0a2': { principio: 'neostigmina' },
  'bolus:neostigmina-maior2': { principio: 'neostigmina' },
  'bolus:morfina-menor6m': { principio: 'morfina' },
  'bolus:morfina-maior6m': { principio: 'morfina' },
  'fita:fita-morfina-iv': { principio: 'morfina' },
  'bolus:polarizante-insulina': { principio: 'insulina-preparo' },
  // lote 6a: só a dose por tomada (L6-1)
  'pneumonia:sbp-linez': { principio: 'linezolida' },
  'pneumonia:sbp-levo-menor5': { principio: 'levofloxacino' },
  'pneumonia:sbp-levo-maior5': { principio: 'levofloxacino' },
  'pneumonia:sbp-metro': { principio: 'metronidazol' },
  'itu:cipro-iv': { principio: 'ciprofloxacino' },
  'falciforme:dipirona': { principio: 'dipirona', viaMista: true },
  'falciforme:morfina-figura': { principio: 'morfina' },
  'falciforme:morfina-texto': { principio: 'morfina' },
  // lote 6b: só a dose por tomada (L6-1); item sem via escrita (atx-dvw,
  // fenitoina-prof) fica sem mL
  'renal:furosemida': { principio: 'furosemida' },
  'renal:furo-k': { principio: 'furosemida' },
  'renal:insulina': { principio: 'insulina-preparo' },
  'hemostasia:atx-iv': { principio: 'acido-tranexamico' },
  'oncologia:insulina': { principio: 'insulina-preparo' },
  'oncologia:furo': { principio: 'furosemida' },
  'oncologia:linezolida': { principio: 'linezolida', viaMista: true },
  'oncologia:metronidazol': { principio: 'metronidazol', viaMista: true },
  'oncologia:cipro-iv': { principio: 'ciprofloxacino' },
  'oncologia:levo': { principio: 'levofloxacino', viaMista: true },
  'oncologia:enoxa-svcs': { principio: 'enoxaparina' },
  'oncologia:manitol': { principio: 'manitol' },
  'oncologia:fenitoina-ataque': { principio: 'fenitoina' },
  'oncologia:fenitoina-man': { principio: 'fenitoina' },
  'oncologia:midaz-iv': { principio: 'midazolam' },
  'oncologia:midaz-im': { principio: 'midazolam' },
  'oncologia:midaz-in': { principio: 'midazolam' },
  // lote 6c: eletrólitos (só a dose por tomada; glicose espera decisão do RT)
  'eletrolitos:bic': { principio: 'bicarbonato' },
  'eletrolitos:insulina': { principio: 'insulina-preparo' },
  'eletrolitos:furosemida-k': { principio: 'furosemida' },
  // furosemida-ca saiu na revisão de 23/11/2026: o item não escreve a via (regra do lote 6, item sem via fica sem mL)
  'eletrolitos:mg-grave': { principio: 'magnesio', base: 'sal' },
  'eletrolitos:cloreto-ca-mg': { principio: 'cloreto-de-calcio', base: 'sal' },
  'eletrolitos:gluconato-ca-mg': { principio: 'gluconato-de-calcio', base: 'sal' },
  'renal:bic': { principio: 'bicarbonato' },
  'renal:cacl': { principio: 'cloreto-de-calcio', base: 'sal' },
  'renal:gluconato': { principio: 'gluconato-de-calcio', base: 'sal' },
  'renal:gluconato-assint': { principio: 'gluconato-de-calcio', base: 'sal' },
  'oncologia:gluconato': { principio: 'gluconato-de-calcio', base: 'sal' },
  // lote 6d: capítulos com princípio já cadastrado (só a dose por tomada)
  'glomerulo:furo-albumina': { principio: 'furosemida' },
  'glomerulo:furo-hiper': { principio: 'furosemida' },
  'glomerulo:furo-shu': { principio: 'furosemida' },
  'intoxicacao:furosemida-iv': { principio: 'furosemida' },
  'intoxicacao:atropina-cap': { principio: 'atropina' },
  // diurese alcalina: infusão de 3 a 4 h (p. 205), volume a aspirar com o aviso de diluir
  'intoxicacao:bicarbonato-alcalina': { principio: 'bicarbonato', diluir: true },
  'coma:midazolam': { principio: 'midazolam' },
  'hda:octreotida-bolus': { principio: 'octreotida' },
  'pele:linezolida': { principio: 'linezolida', viaMista: true },
  'pele:metronidazol': { principio: 'metronidazol' },
  // lote 7: bulas lidas em 23/11/2026 (só a dose por tomada). Ficam sem mL: itu:amicacina e
  // itu:gentamicina (IV ou IM; o aviso de diluir só vale na veia), salbutamol injetável (bula "uso adulto", L7-6), vitamina K IV (as bulas
  // contraindicam a veia, L5-2), dexametasona VO/IM/IV da asma e do crupe (via mista) e sem via escrita (coma:dexa-hic), SMX-TMP
  // e clindamicina sem via só IV escrita.
  'anafilaxia:difenidramina-tabela': { principio: 'difenidramina' },
  'anafilaxia:difenidramina-texto': { principio: 'difenidramina' },
  'bolus:difenidramina': { principio: 'difenidramina' },
  'fita:fita-difenidramina': { principio: 'difenidramina' },
  'meningite:dexametasona': { principio: 'dexametasona' },
  'oncologia:dexa-sms': { principio: 'dexametasona' },
  'oncologia:dexa-cce-ataque': { principio: 'dexametasona' },
  'oncologia:dexa-cce-man': { principio: 'dexametasona' },
  'oncologia:dexa-hic-ataque': { principio: 'dexametasona' },
  'oncologia:dexa-hic-man': { principio: 'dexametasona' },
  'bolus:acetilcisteina-1': { principio: 'acetilcisteina' },
  'bolus:acetilcisteina-2': { principio: 'acetilcisteina' },
  'bolus:acetilcisteina-3': { principio: 'acetilcisteina' },
  'bolus:esmolol-bolus': { principio: 'esmolol' },
  'bolus:milrinona-ataque': { principio: 'milrinona' },
  'pele:clinda-iv': { principio: 'clindamicina' },
  'pneumonia:amicacina': { principio: 'amicacina' },
  'oncologia:amicacina': { principio: 'amicacina' },
  'pneumonia:genta': { principio: 'gentamicina' },
  'itu:tobramicina': { principio: 'tobramicina' },
  'hemostasia:ddavp': { principio: 'desmopressina' },
  'intoxicacao:vitk-sc': { principio: 'vitamina-k-sc' },
  // lote 8 (pendências decididas pelo RT em 23/11/2026): via mista com aviso
  // (a forma oral tem outra concentração); tranexâmico da DVW "IV ou VO" e
  // fenitoína profilática IV pelo livro (p. 682 e 720); glicose de 5% a 50% (a RCP
  // já mostra o volume da glicose 25% e fica sem a escolha: sem dois volumes na mesma dose).
  'asma:dexametasona': { principio: 'dexametasona', viaMista: true },
  'bolus:dexametasona-crupe': { principio: 'dexametasona', viaMista: true },
  'fita:fita-dexametasona-crupe': { principio: 'dexametasona', viaMista: true },
  'hemostasia:atx-dvw': { principio: 'acido-tranexamico', viaMista: true },
  'oncologia:fenitoina-prof': { principio: 'fenitoina' },
  'pele:smxtmp': { principio: 'smx-tmp', viaMista: true },
  'oncologia:tmp': { principio: 'smx-tmp', viaMista: true },
  'renal:glicose': { principio: 'glicose' },
  'eletrolitos:glicose-polarizante': { principio: 'glicose' },
  'bolus:glicose-25': { principio: 'glicose', fatorDose: 0.25, unidadeDaAmpola: 'g' },
  'crise:glicose25': { principio: 'glicose', fatorDose: 0.25, unidadeDaAmpola: 'g' },
  'coma:glicose25': { principio: 'glicose', fatorDose: 0.25, unidadeDaAmpola: 'g' },
  'oncologia:glicose25': { principio: 'glicose', fatorDose: 0.25, unidadeDaAmpola: 'g' },
  // Adulto, lote A1 (PCR e arritmias; A1-1 a A1-4 = A do RT em 23/11/2026,
  // docs/clinico/DOSES-ML-ADULTO-A0-A1.md). KCl e aminofilina pelas bulas lidas em 23/11/2026.
  'adulto-bradi:atropina': { principio: 'atropina' },
  'adulto-taqui:adenosina': { principio: 'adenosina' },
  'adulto-taqui:amiodarona': { principio: 'amiodarona' },
  'adulto-taqui:lidocaina': { principio: 'lidocaina' },
  // 2 g em 15 min: infusão, volume a aspirar com o aviso de diluir
  'adulto-taqui:magnesio': { principio: 'magnesio-g', diluir: true },
  'adulto-pcr:glicose-insulina': { principio: 'glicose' },
  'adulto-pcr:kcl': { principio: 'kcl-meq' },
  'adulto-bradi:aminofilina': { principio: 'aminofilina' },
  // Adulto, lote A2 (A2-1 a A2-4 do RT em 23/11/2026, docs/clinico/DOSES-ML-ADULTO-A2.md),
  // primeira parte: anafilaxia e sedação para procedimento, com ampolas de bula já lida
  'adulto-anafilaxia:difenidramina': { principio: 'difenidramina' },
  'adulto-anafilaxia:magnesio': { principio: 'magnesio-g', diluir: true },
  'adulto-sedacao:fentanil-teto': { principio: 'fentanila' },
  'adulto-sedacao:lidocaina': { principio: 'lidocaina' },
  'adulto-sedacao:lidocaina-diluida': { principio: 'lidocaina' },
  'adulto-sedacao:midazolam-premed': { principio: 'midazolam' },
  'adulto-sedacao:midazolam-emersao': { principio: 'midazolam' },
  'adulto-sedacao:midazolam-mioclonia': { principio: 'midazolam' },
  'adulto-sedacao:flumazenil': { principio: 'flumazenil' },
  'adulto-sedacao:naloxona': { principio: 'naloxona' },
  // segunda parte do A2 (bulas do haloperidol, tiamina, tramadol e petidina lidas em 23/11/2026)
  'adulto-sedacao:haloperidol-premed': { principio: 'haloperidol' },
  'adulto-agitacao:midazolam-moderada': { principio: 'midazolam' },
  'adulto-agitacao:haloperidol-moderada': { principio: 'haloperidol' },
  'adulto-agitacao:midazolam-grave': { principio: 'midazolam' },
  'adulto-agitacao:haloperidol-grave': { principio: 'haloperidol' },
  'adulto-agitacao:quetamina': { principio: 'escetamina', aviso: 'A dose do manual é da cetamina racêmica; à venda só há escetamina, com cerca do dobro da potência (decisão A2-1 do RT).' },
  'adulto-agitacao:haloperidol-delirium': { principio: 'haloperidol', viaMista: true, aviso: 'A bula do haloperidol 5 mg/mL registra só o uso IM; na veia, ECG contínuo (decisão A2-2 do RT).' },
  'adulto-abstinencia:diazepam-ev': { principio: 'diazepam' },
  'adulto-abstinencia:haloperidol': { principio: 'haloperidol' },
  'adulto-abstinencia:tiamina-im': { principio: 'tiamina' },
  'adulto-analgesia:tramadol': { principio: 'tramadol', viaMista: true },
  'adulto-analgesia:fentanil': { principio: 'fentanila' },
  'adulto-analgesia:meperidina': { principio: 'petidina' },
  // Adulto, lote A3 (intoxicações e antídotos, 23/11/2026): só ampolas de bula já lida;
  // sem injetável à venda: fisostigmina, fomepizol, piridoxina, ácido fólico e pralidoxima;
  // pó: glucagon, hidroxocobalamina e anticorpo antidigoxina; insulina só pelo preparo (ML7)
  'adulto-intox:nac-ev': { principio: 'acetilcisteina' },
  'adulto-intox:flumazenil': { principio: 'flumazenil' },
  'adulto-intox:naloxona': { principio: 'naloxona' },
  'adulto-intox:atropina-bb': { principio: 'atropina' },
  'adulto-intox:atropina-of': { principio: 'atropina' },
  'adulto-intox:tiamina': { principio: 'tiamina' },
  // Adulto, lote A4 (A4-1 a A4-4 = A do RT em 23/11/2026, docs/clinico/DOSES-ML-ADULTO-A4.md),
  // primeira parte: ampolas de bula já lida; metoprolol e protamina esperam a bula
  'adulto-fa:esmolol': { principio: 'esmolol-mg' },
  'adulto-fa:amiodarona': { principio: 'amiodarona' },
  'adulto-fa:magnesio': { principio: 'magnesio-g' },
  'adulto-has:esmolol': { principio: 'esmolol-mg' },
  'adulto-has:hidralazina': { principio: 'hidralazina' },
  'adulto-avc:tranexamico': { principio: 'acido-tranexamico' },
}

export const AVISO_DILUIR = 'Volume a aspirar da ampola. Diluir antes de administrar.'
/** Lote 8 (RT, 23/11/2026): item "IV ou VO"; o volume é só da forma injetável. */
export const AVISO_VIA_MISTA = 'Volume da forma injetável. Por via oral a concentração é outra: não use este volume.'
export const PECA_A_AMPOLA = 'Escolha a ampola para ver o volume em mL.'
/** L6-2: quando todas as opções são soluções prontas (bolsa ou frasco). */
export const PECA_A_SOLUCAO = 'Escolha a solução para ver o volume a infundir em mL.'
/** L4-5 = A (RT, 20/11/2026): volume pequeno demais para medir sem seringa de 1 mL. */
export const AVISO_VOLUME_PEQUENO = 'Volume abaixo de 0,1 mL: use seringa de 1 mL.'

/** Algum volume da faixa fica abaixo de 0,1 mL (L4-5). */
export function volumeAbaixoDe01(ml: readonly number[] | null | undefined): boolean {
  // folga de ponto flutuante: 0,1 mL exato não avisa
  return !!ml && ml.some((x) => Number.isFinite(x) && x > 0 && x < 0.1 - 1e-9)
}

/** As ampolas que valem para o item (mesma base da dose), ou lista vazia. */
export function ampolasDoItem(chave: string): Apresentacao[] {
  const item = ITENS_COM_AMPOLA[chave]
  if (!item) return []
  return (AMPOLAS[item.principio] ?? []).filter((a) => !a.base || !item.base || a.base === item.base)
}

export type VolumeDaAmpola = { ml: [number, number]; aspirar: boolean }

/** Dose do item na unidade da ampola (fator do lote 8; sem fator, a própria dose). */
export function doseNaUnidadeDaAmpola(dose: [number, number], chave?: string): [number, number] {
  const f = chave ? ITENS_COM_AMPOLA[chave]?.fatorDose : undefined
  return f ? [dose[0] * f, dose[1] * f] : dose
}

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
      if (a.pronta && a.diluir) p.push(`${principio}/${a.id}: solução pronta não se dilui (L6-2)`)
      if (a.seringa && (a.pronta || a.diluir)) p.push(`${principio}/${a.id}: seringa preenchida não é solução pronta nem se dilui`)
    }
    const porMl = lista.map((a) => `${a.base ?? ''}${a.porMl}`)
    if (new Set(porMl).size !== porMl.length) p.push(`${principio}: concentração repetida (agrupar por concentração, ML2)`)
  }
  for (const [chave, item] of Object.entries(itens)) {
    if (!/^(bolus|rcp|sri|fita|crise|asma|anafilaxia|pneumonia|itu|falciforme|renal|hemostasia|oncologia|eletrolitos|glomerulo|intoxicacao|coma|hda|pele|meningite|adulto-pcr|adulto-bradi|adulto-taqui|adulto-anafilaxia|adulto-sedacao|adulto-agitacao|adulto-abstinencia|adulto-analgesia|adulto-intox|adulto-fa|adulto-has|adulto-avc|adulto-endocrino|adulto-ic|adulto-anticoag|adulto-reversao):[a-z0-9-]+$/.test(chave)) p.push(`${chave}: chave fora do padrão lista:id`)
    if (!ampolas[item.principio]?.length) p.push(`${chave}: princípio ${item.principio} sem ampola`)
    const bases = new Set((ampolas[item.principio] ?? []).map((a) => a.base).filter(Boolean))
    if (bases.size > 1 && !item.base) p.push(`${chave}: ${item.principio} tem sal e elemento; o item precisa dizer a base (ML6)`)
    if (item.diluir && (ampolas[item.principio] ?? []).some((a) => a.pronta || a.seringa)) p.push(`${chave}: item para diluir com solução pronta ou seringa preenchida`)
    if (item.fatorDose !== undefined && (!(item.fatorDose > 0) || !item.unidadeDaAmpola)) p.push(`${chave}: fator da dose sem unidade da ampola`)
  }
  return p
}
