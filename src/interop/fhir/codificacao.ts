// ─────────────────────────────────────────────────────────────────────────────
// Codificações FHIR da RNDS (FASE 4A; revistas na 5C-5.2)
//
// Systems conferidos no validador local oficial (definições de 07/2026,
// produto/docs/pesquisa/rnds-oficial/sa/definicoes-validador-sa.zip). Os
// perfis proíbem `display` nas codificações (max 0): só system e code.
// ─────────────────────────────────────────────────────────────────────────────

import type { Coding } from '@medplum/fhirtypes'

export const RNDS = 'http://www.saude.gov.br/fhir/r4'
const CS = `${RNDS}/CodeSystem`

/** Código de um CodeSystem da RNDS (BRModalidadeAssistencial, BRProcedencia…). */
export function codificarRnds(codeSystem: string, codigo: string): Coding {
  return { system: `${CS}/${codeSystem}`, code: codigo }
}

/** CID-10 — sem o ponto (I21.9 vai como I219), como no BRCID10. */
export function codificarCid10(codigo: string): Coding {
  return codificarRnds('BRCID10', codigo.replace('.', '').toUpperCase())
}

/** SIGTAP — procedimento da terminologia.sigtap_procedimento (10 dígitos). */
export function codificarSigtap(codigo: string): Coding {
  return codificarRnds('BRTabelaSUS', codigo)
}

/** CBO — ocupação do profissional (6 dígitos). */
export function codificarCbo(codigo: string): Coding {
  return codificarRnds('BRCBO', codigo)
}

/**
 * LOINC das medidas que a RNDS aceita (ValueSet BRTipoObservacao-1.0, binding
 * required). Frequência cardíaca, temperatura, SpO2 e frequência respiratória
 * não estão nele: ficam fora do documento (decisão do RT, 5C-5.2).
 */
export const LOINC_ACEITOS = new Set([
  '8665-2', '56832-9', '11996-6', '63895-7', '29463-7', '8480-6', '8462-4',
  '8280-0', '9843-4', '8302-2', '11885-1', '11612-9', '48767-8',
])

/** LOINC no system que a RNDS usa (https://loinc.org/, não http://loinc.org). */
export function codificarLoinc(loinc: string): Coding {
  return { system: 'https://loinc.org/', code: loinc }
}

/** Unidade UCUM no system dos exemplos oficiais. */
export function unidadeUcum(unidade: string): { system: string; code: string } {
  const ucum: Record<string, string> = { mmHg: 'mm[Hg]', 'mm Hg': 'mm[Hg]' }
  return { system: 'https://www.hl7.org/fhir/valueset-ucum-common.html', code: ucum[unidade] ?? unidade }
}
