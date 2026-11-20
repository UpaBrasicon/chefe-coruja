// Dose em mL na PCR do adulto (pedido do RT de 19/11/2026: "calculadora de
// reanimação, tanto pediátrica quanto adulta"). Mesmas regras ML1–ML11 da
// pediatria (docs/clinico/DOSES-ML-PEDIATRIA-DIAGNOSTICO.md): concentração com
// fonte, nenhuma ampola marcada, mL só na mesma base, "aspirar e diluir" quando
// a bula manda diluir. As fichas de dose do adulto não mudam; o volume vem
// desta ficha, que passa pela aprovação do RT (gate LG10).
//
// Fica sem mL, até haver bula lida: magnésio (há ampolas de 10%, 20% e 50%; o
// erro entre elas é de até 5×), atropina (sem bula injetável no Bulário) e as
// drogas cuja dose já está em mL (cálcio, emulsão lipídica) ou em infusão.
import type { Ficha, Fonte } from '../ficha.ts'
import { AMPOLAS, BULA_AMIODARONA, BULA_LIDOCAINA, CMED_PMC_2026_11, type Apresentacao } from '../pediatria/ampolas.ts'
import { LIVRO_PS_PED } from '../pediatria/fonte.ts'
import { fichaAdulto } from './fonte.ts'

/** Concentração da ampola de adrenalina: a apresentação comercial que o livro do ICr cita. Não é dose. */
const LIVRO_ADRENALINA: Fonte = { citacao: `${LIVRO_PS_PED.citacao} p. 87 e 895 (Adrenalina® 1 mg/mL; só a concentração da ampola, não a dose).` }

const base = fichaAdulto('adulto-ampolas', 'Ampolas para a dose em mL (adulto)', 'p. 938 (NaHCO3 8,4%: 50 mEq em 50 mL = 1 mEq/mL)')

export const fichaAmpolasAdulto: Ficha = {
  ...base,
  versao: '2026-11-20.1',
  fontes: [...base.fontes, LIVRO_ADRENALINA, BULA_AMIODARONA, BULA_LIDOCAINA, CMED_PMC_2026_11],
  revisadoEm: '20/11/2026 (conferência pela CMED, decisões do RT: lidocaína 1% e bicarbonato 10% entram; magnésio 10% e 50% entram; epinefrina 0,1 mg/mL fica fora por estar sem venda; aguarda aprovação do RT); 19/11/2026 (dose em mL na PCR do adulto: amiodarona e lidocaína pelas bulas do lote 1; bicarbonato pelo manual, p. 938; adrenalina pela apresentação citada no livro do ICr; aguarda aprovação do RT)',
}

/** Ampolas por item da Tabela 2 da PCR (id de DROGAS_PCR). */
export const AMPOLAS_PCR_ADULTO: Record<string, Apresentacao[]> = {
  adrenalina: [
    { id: 'adrenalina-1', rotulo: 'Adrenalina 1 mg/mL (ampola de 1 mL)', porMl: 1, fonte: 'apresentação citada no livro do ICr, p. 87 e 895 (Adrenalina® 1 mg/mL)' },
  ],
  amiodarona: AMPOLAS.amiodarona,
  lidocaina: AMPOLAS.lidocaina,
  bicarbonato: [
    { id: 'bicarbonato-84', rotulo: 'Bicarbonato de sódio 8,4% (1 mEq/mL)', porMl: 1, fonte: 'manual do HCFMUSP, p. 938 (50 mEq em 50 mL)' },
    // 10% = 100 mg/mL; 8,4% (84 mg/mL) = 1 mEq/mL pelo manual, logo 100/84 = 1,19 mEq/mL
    { id: 'bicarbonato-10', rotulo: 'Bicarbonato de sódio 10% (1,19 mEq/mL)', porMl: 1.19, fonte: 'CMED 09/11/2026: Farmace, à venda; mEq pela proporção do manual (8,4% = 1 mEq/mL, p. 938)', url: CMED_PMC_2026_11.url },
  ],
  // dose do magnésio em g (Tabela 2: 1–2 g); 10% = 0,1 g/mL e 50% = 0,5 g/mL (CMED)
  magnesio: [
    { id: 'magnesio-10', rotulo: 'Sulfato de magnésio 10% (0,1 g/mL)', porMl: 0.1, fonte: 'CMED 09/11/2026: Samtec e Halex, à venda', url: CMED_PMC_2026_11.url },
    { id: 'magnesio-50', rotulo: 'Sulfato de magnésio 50% (0,5 g/mL)', porMl: 0.5, fonte: 'CMED 09/11/2026: Samtec e Halex, à venda', url: CMED_PMC_2026_11.url },
  ],
}

/** Doses fixas da Tabela 2 para o volume (as que dependem do peso vêm de calcularPcr). */
export const DOSES_FIXAS_PCR_ADULTO = {
  adrenalinaMg: 1,
  amiodaronaMg: { primeira: 300, segunda: 150 },
  /** Tabela 2: magnésio 1–2 g IV em bolus */
  magnesioG: [1, 2] as [number, number],
}
