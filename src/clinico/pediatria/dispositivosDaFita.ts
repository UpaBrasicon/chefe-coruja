import type { Ficha, Fonte } from '../ficha.ts'
import type { CorBroselow } from './fitaBroselow.ts'
import { OOMMEN_BROSELOW_2021 } from './fitaBroselow.ts'
import { LIVRO_PS_PED } from './fonte.ts'
import { COREIA_PALS_2025 } from './dosesDaFita.ts'

// Dispositivos por cor da fita no guia de parada da criança (G2; decisões do RT
// de 18/11/2026, DP1–DP6 = A). Diagnóstico e comparação das três fontes em
// docs/clinico/DISPOSITIVOS-FITA-DIAGNOSTICO.md; trechos e PMID em
// docs/clinico/DISPOSITIVOS-FITA-CONFERENCIA-PUBMED.md.
//
// - DP1: fonte aberta primeiro, depois o livro do ICr; o e-book Fita PED só
//   confere e nunca dá número sozinho (ele usa Miller 0 até 6 meses, tubo com
//   cuff no lugar do sem cuff no branco e no azul, Guedel de 60 mm de 1 a 11 anos).
// - DP2: tubo sem cuff pela cor (Borkar 2023, Subramanian 2018, Coreia 2025) e com
//   cuff pela fórmula da Coreia 2025 sobre a idade da cor (marcado "calculado");
//   profundidade 3 × diâmetro e, a partir de 2 anos, idade/2 + 12.
// - DP3: sonda gástrica, sonda vesical, dreno de tórax e acesso venoso pelo livro
//   do ICr (cap. 13, Tabelas 2 e 3, p. 150–151), linha da idade da cor; branco e
//   laranja caem em duas linhas e mostram as duas.
// - DP4: Guedel em mm pelo consenso polonês até o amarelo; depois, o livro.
// - DP5: lâmina pelo consenso polonês até o branco; do azul ao verde, o livro.
// - DP6: agulha intraóssea fica fora (só o e-book traz).

const pmc = (id: string) => `https://pmc.ncbi.nlm.nih.gov/articles/${id}/`

export const BORKAR_FITA_2023: Fonte = {
  citacao: 'Borkar N, Sharma C, Francis J, et al. Applicability of the Broselow Pediatric Emergency Tape to Predict the Size of Endotracheal Tube and Laryngeal Mask Airway. Cureus. 2023;15(1):e33327 (PMID 36741616, PMC9894818). Tabela 1 (tubo e máscara laríngea por cor).',
  url: pmc('PMC9894818'),
  pediatrica: true,
}

export const SUBRAMANIAN_FITA_2018: Fonte = {
  citacao: 'Subramanian S, Nishtala M, Ramavakoda CY, et al. Predicting endotracheal tube size from length: Evaluation of the Broselow tape in Indian children. J Anaesthesiol Clin Pharmacol. 2018;34(1):73–77 (PMID 29643627, PMC5885454). Métodos: as zonas da fita indicam tubo sem cuff.',
  url: pmc('PMC5885454'),
  pediatrica: true,
}

export const POLONIA_ANESTESIA_2025: Fonte = {
  citacao: 'Zielińska M, Bartkowska-Śniatkowska A, Mierzewska-Schmidt M, et al. Consensus statement of the Polish Society of Anaesthesiology and Intensive Therapy on anaesthesia in children under 3 years of age. Anaesthesiol Intensive Ther. 2025;57(1):276–303 (PMID 41133817, PMC12793997). Tabelas 8 (lâmina) e 11 (cânula orofaríngea).',
  url: pmc('PMC12793997'),
  pediatrica: true,
}

export const REN_MASCARA_2021: Fonte = {
  citacao: 'Ren Y, Cao C, Liang X, et al. Validation of manufacturers\' laryngeal mask airway size selection standard: a large retrospective study. Ann Transl Med. 2021;9(3):196 (PMID 33708823, PMC7940924). Tabela 1 (tamanho pelo peso).',
  url: pmc('PMC7940924'),
  pediatrica: true,
}

export const VOLSKO_PROFUNDIDADE_2022: Fonte = {
  citacao: 'Volsko TA, McNinch NL, Page-Goertz C. Development and internal validation of an equation using anthropometric measures to predict correct endotracheal tube insertion depth. Can J Respir Ther. 2022;58:9–14 (PMID 35224182, PMC8820258). Discussão: 3 × diâmetro com 15% a 25% de mau posicionamento.',
  url: pmc('PMC8820258'),
  pediatrica: true,
}

export const fichaDispositivosDaFita: Ficha = {
  id: 'ped-dispositivos-fita',
  titulo: 'Dispositivos pela cor da fita (guia de parada da criança)',
  versao: '2026-11-18.1',
  publico: 'pediatrico',
  fontes: [BORKAR_FITA_2023, SUBRAMANIAN_FITA_2018, COREIA_PALS_2025, POLONIA_ANESTESIA_2025, REN_MASCARA_2021, VOLSKO_PROFUNDIDADE_2022, OOMMEN_BROSELOW_2021, LIVRO_PS_PED],
  revisadoEm: '18/11/2026 (fonte aberta conferida no PubMed, livro do ICr p. 150–151 e e-book Fita PED só para conferir; decisões DP1–DP6 do RT de 18/11/2026; aguarda aprovação do RT)',
}

/** Um valor da tela com a fonte de onde veio. */
export type ValorComFonte = { valor: string; fonte: string }

export type DispositivosDaCor = {
  cor: CorBroselow['id']
  tuboSemCuff: ValorComFonte
  tuboComCuff: ValorComFonte
  profundidade: ValorComFonte
  mascaraLaringea: ValorComFonte
  lamina: ValorComFonte
  guedel: ValorComFonte
  sondaGastrica: ValorComFonte
  sondaVesical: ValorComFonte
  drenoTorax: ValorComFonte
  acessoVenoso: ValorComFonte
}

const SEM = 'Borkar 2023, Tabela 1; Coreia 2025 (sem cuff: 3,5 mm < 1 ano; 4,0 de 1 a 2 anos; 4 + idade/4)'
const SEM_ZONA = 'Subramanian 2018 (zona da fita); Coreia 2025 (3,5 mm < 1 ano)'
const COM = 'calculado: Coreia 2025 (com cuff: 3,0 mm < 1 ano; 3,5 de 1 a 2 anos; 3,5 + idade/4) sobre a idade da cor'
const PROF = 'Coreia 2025: 3 × diâmetro do tubo'
const PROF2 = 'Coreia 2025: 3 × diâmetro do tubo; a partir de 2 anos, idade/2 + 12'
const ML = 'Ren 2021, Tabela 1 (fabricante, pelo peso)'
const POL_LAM = 'consenso polonês 2025, Tabela 8'
const POL_GUE = 'consenso polonês 2025, Tabela 11'
const ICR = 'livro do ICr, cap. 13, Tabelas 2 e 3, p. 150–151'
const v = (valor: string, fonte: string): ValorComFonte => ({ valor, fonte })

// Linhas do livro do ICr (as mesmas de viaAerea.ts, EQUIPAMENTO)
const ICR_0_6M = { sg: '10', sv: '5–8', dreno: '12–18', venoso: '22' }
const ICR_6_12M = { sg: '12', sv: '8', dreno: '14–20', venoso: '22' }
const ICR_1_3A = { sg: '12', sv: '10', dreno: '14–24', venoso: '22–20' }
const ICR_4_7A = { sg: '12', sv: '10–12', dreno: '20–28', venoso: '20' }
const ICR_8_10A = { sg: '14', sv: '12', dreno: '28–32', venoso: '20–18' }
const livro = (l: typeof ICR_0_6M) => ({
  sondaGastrica: v(`${l.sg} Fr`, ICR), sondaVesical: v(`${l.sv} Fr`, ICR), drenoTorax: v(`${l.dreno} Fr`, ICR), acessoVenoso: v(`${l.venoso} G`, ICR),
})
const duasLinhas = (a: typeof ICR_0_6M, ra: string, b: typeof ICR_0_6M, rb: string) => ({
  sondaGastrica: v(`${a.sg} Fr (${ra}) · ${b.sg} Fr (${rb})`, ICR),
  sondaVesical: v(`${a.sv} Fr (${ra}) · ${b.sv} Fr (${rb})`, ICR),
  drenoTorax: v(`${a.dreno} Fr (${ra}) · ${b.dreno} Fr (${rb})`, ICR),
  acessoVenoso: v(`${a.venoso} G (${ra}) · ${b.venoso} G (${rb})`, ICR),
})

export const DISPOSITIVOS_DA_FITA: DispositivosDaCor[] = [
  { cor: 'cinza', tuboSemCuff: v('3,5 mm', SEM_ZONA), tuboComCuff: v('3,0 mm', COM), profundidade: v('10,5 cm', PROF),
    mascaraLaringea: v('1 (até 5 kg)', ML), lamina: v('Miller 1 (Miller 0 abaixo de 3 kg)', POL_LAM),
    guedel: v('40 mm até 1 mês; 50 mm de 1 a 4 meses', POL_GUE), ...livro(ICR_0_6M) },
  { cor: 'rosa', tuboSemCuff: v('3,5 mm', SEM), tuboComCuff: v('3,0 mm', COM), profundidade: v('10,5 cm', PROF),
    mascaraLaringea: v('1,5', ML), lamina: v('Miller 1', POL_LAM), guedel: v('50 mm', POL_GUE), ...livro(ICR_0_6M) },
  { cor: 'vermelho', tuboSemCuff: v('3,5 mm', SEM_ZONA), tuboComCuff: v('3,0 mm', COM), profundidade: v('10,5 cm', PROF),
    mascaraLaringea: v('1,5', ML), lamina: v('Miller 1 ou Macintosh 1', POL_LAM), guedel: v('60 mm', POL_GUE), ...livro(ICR_6_12M) },
  { cor: 'roxo', tuboSemCuff: v('4,0 mm', SEM), tuboComCuff: v('3,5 mm', COM), profundidade: v('12 cm', PROF),
    mascaraLaringea: v('2', ML), lamina: v('Macintosh 1', POL_LAM), guedel: v('60 mm', POL_GUE), ...livro(ICR_1_3A) },
  { cor: 'amarelo', tuboSemCuff: v('4,5 mm', SEM), tuboComCuff: v('4,0 mm', COM), profundidade: v('13,5 cm (3 × diâmetro) · 13 cm (idade/2 + 12)', PROF2),
    mascaraLaringea: v('2', ML), lamina: v('Macintosh 1 ou 2', POL_LAM), guedel: v('70 mm', POL_GUE), ...livro(ICR_1_3A) },
  { cor: 'branco', tuboSemCuff: v('5,0 mm', SEM), tuboComCuff: v('4,0 a 4,5 mm', COM), profundidade: v('15 cm (3 × diâmetro) · 13,5 a 14 cm (idade/2 + 12)', PROF2),
    mascaraLaringea: v('2', ML), lamina: v('Macintosh 1 ou 2', `${POL_LAM} (até 4 anos)`), guedel: v('Pequena (1–3 anos) · Média (4–7 anos)', ICR),
    ...duasLinhas(ICR_1_3A, '1–3 anos', ICR_4_7A, '4–7 anos') },
  { cor: 'azul', tuboSemCuff: v('5,5 mm', SEM), tuboComCuff: v('4,5 a 5,0 mm', COM), profundidade: v('16,5 cm (3 × diâmetro) · 14,5 a 15 cm (idade/2 + 12)', PROF2),
    mascaraLaringea: v('2 (até 20 kg) · 2,5 (acima de 20 kg)', ML), lamina: v('2, lâminas curvas', ICR), guedel: v('Média', ICR), ...livro(ICR_4_7A) },
  { cor: 'laranja', tuboSemCuff: v('6,0 mm', SEM), tuboComCuff: v('5,0 a 5,5 mm', COM), profundidade: v('18 cm (3 × diâmetro) · 15,5 a 16,5 cm (idade/2 + 12)', PROF2),
    mascaraLaringea: v('2,5', ML), lamina: v('2, curvas (4–7 anos) · 2–3, curvas (8–10 anos)', ICR), guedel: v('Média (4–7 anos) · Média/grande (8–10 anos)', ICR),
    ...duasLinhas(ICR_4_7A, '4–7 anos', ICR_8_10A, '8–10 anos') },
  { cor: 'verde', tuboSemCuff: v('6,5 mm', SEM), tuboComCuff: v('6,0 mm', COM), profundidade: v('19,5 cm (3 × diâmetro) · 17 a 17,5 cm (idade/2 + 12)', PROF2),
    mascaraLaringea: v('3', ML), lamina: v('2–3, lâminas curvas', ICR), guedel: v('Média/grande', ICR), ...livro(ICR_8_10A) },
]

export const ROTULOS_DISPOSITIVO: [keyof Omit<DispositivosDaCor, 'cor'>, string][] = [
  ['tuboSemCuff', 'Tubo sem cuff'],
  ['tuboComCuff', 'Tubo com cuff (calculado)'],
  ['profundidade', 'Profundidade no lábio'],
  ['lamina', 'Lâmina do laringoscópio'],
  ['mascaraLaringea', 'Máscara laríngea'],
  ['guedel', 'Cânula de Guedel'],
  ['sondaGastrica', 'Sonda gástrica'],
  ['sondaVesical', 'Sonda vesical'],
  ['drenoTorax', 'Dreno de tórax'],
  ['acessoVenoso', 'Acesso venoso'],
]

export const NOTAS_DISPOSITIVOS = [
  'Separe também o tubo 0,5 mm maior e o 0,5 mm menor (Coreia 2025).',
  'Confirme a posição do tubo pela clínica e pelo raio X; 3 × diâmetro erra a posição em 15% a 25% (Volsko 2022).',
  'Pressão do cuff até 20 a 25 cmH₂O (Coreia 2025).',
  'A máscara laríngea segue a tabela do fabricante da LMA; i-gel tem outras faixas de peso.',
  'Agulha intraóssea: sem fonte aberta; não entra (decisão DP6).',
]

export const dispositivosDaCor = (cor: CorBroselow['id']): DispositivosDaCor | undefined =>
  DISPOSITIVOS_DA_FITA.find((d) => d.cor === cor)
