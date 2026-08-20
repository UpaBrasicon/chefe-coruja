// ─────────────────────────────────────────────────────────────────────────────
// Pacote FHIR — interop (FASE 4A)
//
// Exporta tipos, mappers puros e montadores de Bundle para a RNDS.
// A carga de dados (query no banco) fica FORA deste pacote — os mappers
// recebem entidades já carregadas (src/interop/fhir/tipos.ts).
// ─────────────────────────────────────────────────────────────────────────────

export * from './tipos.ts'
export * from './codificacao.ts'
export * from './mappers.ts'
