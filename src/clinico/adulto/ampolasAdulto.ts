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
import { AMPOLAS, BULA_AMIODARONA, BULA_LIDOCAINA, type Apresentacao } from '../pediatria/ampolas.ts'
import { LIVRO_PS_PED } from '../pediatria/fonte.ts'
import { fichaAdulto } from './fonte.ts'

/** Concentração da ampola de adrenalina: a apresentação comercial que o livro do ICr cita. Não é dose. */
const LIVRO_ADRENALINA: Fonte = { citacao: `${LIVRO_PS_PED.citacao} p. 87 e 895 (Adrenalina® 1 mg/mL; só a concentração da ampola, não a dose).` }

const base = fichaAdulto('adulto-ampolas', 'Ampolas para a dose em mL (adulto)', 'p. 938 (NaHCO3 8,4%: 50 mEq em 50 mL = 1 mEq/mL)')

export const fichaAmpolasAdulto: Ficha = {
  ...base,
  versao: '2026-11-19.1',
  fontes: [...base.fontes, LIVRO_ADRENALINA, BULA_AMIODARONA, BULA_LIDOCAINA],
  revisadoEm: '19/11/2026 (dose em mL na PCR do adulto: amiodarona e lidocaína pelas bulas do lote 1; bicarbonato pelo manual, p. 938; adrenalina pela apresentação citada no livro do ICr; aguarda aprovação do RT)',
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
  ],
}

/** Doses fixas da Tabela 2 para o volume (as que dependem do peso vêm de calcularPcr). */
export const DOSES_FIXAS_PCR_ADULTO = {
  adrenalinaMg: 1,
  amiodaronaMg: { primeira: 300, segunda: 150 },
}
