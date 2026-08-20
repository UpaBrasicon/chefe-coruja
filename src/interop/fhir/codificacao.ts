// ─────────────────────────────────────────────────────────────────────────────
// Codificações FHIR (FASE 4A)
//
// System URIs oficiais usados na RNDS/FHIR R4:
//   Condition.coding  → urn:oid:2.16.840.1.113883.3.7200.99.11  (CID-10) — TODO: confirmar no IG oficial
//   Procedure.coding  → SIGTAP
//   Practitioner      → CBO
//   Organization      → CNES
//
// REGRA: não inventar system/URIs. Onde o IG oficial ainda não foi lido
// (docs/rnds/ vazio), marcamos TODO em vez de chutar o OID da RNDS.
// ─────────────────────────────────────────────────────────────────────────────

import type { Coding } from '@medplum/fhirtypes'

/** CID-10 — código da terminologia.cid10. System: TODO confirmar no IG (RNDS usa OID CID-10). */
export function codificarCid10(codigo: string, descricao: string | null): Coding {
  return {
    system: 'urn:oid:2.16.840.1.113883.6.3', // TODO: confirmar no IG oficial da RNDS
    code: codigo,
    display: descricao ?? codigo,
  }
}

/** SIGTAP — procedimento da terminologia.sigtap_procedimento. */
export function codificarSigtap(codigo: string, nome: string | null): Coding {
  return {
    system: 'http://www.saude.gov.br/fhir/r4/CodeSystem/sigtap', // TODO: confirmar no IG oficial
    code: codigo,
    display: nome ?? codigo,
  }
}

/** CBO — ocupação do profissional (terminologia.cbo). */
export function codificarCbo(codigo: string, titulo: string | null): Coding {
  return {
    system: 'http://www.saude.gov.br/fhir/r4/CodeSystem/cbo', // TODO: confirmar no IG oficial
    code: codigo,
    display: titulo ?? codigo,
  }
}

/** CNES — estabelecimento (unidades.cnes). */
export function codificarCnes(cnes: string, nome: string | null): Coding {
  return {
    system: 'http://www.saude.gov.br/fhir/r4/CodeSystem/cnes', // TODO: confirmar no IG oficial
    code: cnes,
    display: nome ?? cnes,
  }
}

/** LOINC — observação. `loinc` null = lacuna registrada (não inventar). */
export function codificarLoinc(loinc: string | null, nomeConceito: string): {
  coding: Coding[]
  lacunaLoinc: boolean
} {
  if (!loinc) {
    return {
      coding: [],
      lacunaLoinc: true, // TODO: registrar lacuna (conceito sem LOINC) — ver RESTRICOES/planilha de lacunas
    }
  }
  return {
    coding: [
      {
        system: 'http://loinc.org',
        code: loinc,
        display: nomeConceito,
      },
    ],
    lacunaLoinc: false,
  }
}
