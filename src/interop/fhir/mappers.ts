// ─────────────────────────────────────────────────────────────────────────────
// Mappers FHIR R4 — PUROS (sem I/O, sem banco)
//
// Recebem entidades de domínio já carregadas (src/interop/fhir/tipos.ts) e
// devolvem recursos FHIR R4 (@medplum/fhirtypes). A carga de dados fica em
// outra camada — se um mapper precisar consultar banco, o desenho está errado.
//
// REGRAS:
//   - Codificações vêm de src/interop/fhir/codificacao.ts (terminologia).
//   - Perfis e sistemas da RNDS lidos em 29/09/2026 no Simplifier (RAC 2.1 e
//     SA 1.0, ambos draft): produto/docs/pesquisa/rnds-rac-sumario-alta.md.
//     O manual atual fica no portfólio do DATASUS e ainda não foi lido: o
//     que depende dele segue marcado com TODO.
//   - Nenhum log com PII: os mappers só constroem recursos.
// ─────────────────────────────────────────────────────────────────────────────
import type {
  Bundle,
  BundleEntry,
  Composition,
  CompositionSection,
  Condition,
  Encounter,
  MedicationRequest,
  Observation,
  Organization,
  Patient,
  Practitioner,
  Procedure,
  Reference,
} from '@medplum/fhirtypes'

import {
  codificarCbo,
  codificarCid10,
  codificarCnes,
  codificarLoinc,
  codificarSigtap,
} from './codificacao.ts'
import type {
  EntidadeAtendimentoRAC,
  EntidadeCondicao,
  EntidadeEncontro,
  EntidadeEstabelecimento,
  EntidadeMedicacao,
  EntidadeObservacao,
  EntidadePaciente,
  EntidadeProfissional,
  EntidadeSumarioAlta,
} from './tipos.ts'

// ══ utilitários internos (não exportados) ════════════════════════════════════

const RNDS = 'http://www.saude.gov.br/fhir/r4'
/** Perfis dos documentos (RAC 2.1 e SA 1.0, draft no Simplifier). */
export const PERFIL_RAC = `${RNDS}/StructureDefinition/BRRegistroAtendimentoClinico`
export const PERFIL_SA = `${RNDS}/StructureDefinition/BRSumarioAlta`

/** Nome do paciente em HumanName (evita PII em log — só no recurso). */
function humanName(nome: string): { use: 'official'; text: string } {
  return { use: 'official', text: nome }
}

function refPaciente(p: EntidadePaciente): Reference<Patient> {
  return { reference: `Patient/${p.id}` }
}

function refEncontro(e: EntidadeEncontro): Reference<Encounter> {
  return { reference: `Encounter/${e.id}` }
}

function refEstabelecimento(e: EntidadeEstabelecimento): Reference<Organization> {
  return { reference: `Organization/${e.id}` }
}

function refProfissional(p: EntidadeProfissional): Reference<Practitioner> {
  return { reference: `Practitioner/${p.id}` }
}

// ══ 1. Patient ═══════════════════════════════════════════════════════════════

export function mapPaciente(p: EntidadePaciente): Patient {
  const resource: Patient = {
    resourceType: 'Patient',
    id: p.id,
    name: [humanName(p.nome)],
    gender: mapearSexo(p.sexo),
  }
  if (p.data_nascimento) resource.birthDate = p.data_nascimento.slice(0, 10)
  if (p.cpf) resource.identifier = [{ system: `${RNDS}/StructureDefinition/BRIndividuo-1.0`, value: p.cpf }] // RNDS: sistema = perfil do ator
  if (p.telefone) resource.telecom = [{ system: 'phone', value: p.telefone }]
  return resource
}

function mapearSexo(sexo: string | null): Patient['gender'] {
  switch ((sexo ?? '').toLowerCase()) {
    case 'm':
    case 'masculino':
      return 'male'
    case 'f':
    case 'feminino':
      return 'female'
    default:
      return 'unknown'
  }
}

// ══ 2. Practitioner ══════════════════════════════════════════════════════════

export function mapProfissional(p: EntidadeProfissional): Practitioner {
  const resource: Practitioner = {
    resourceType: 'Practitioner',
    id: p.id,
    name: [humanName(p.nome_completo)],
  }
  if (p.cpf) resource.identifier = [{ system: `${RNDS}/StructureDefinition/BRProfissional-1.0`, value: p.cpf }] // RNDS: sistema = perfil do ator
  if (p.crm && p.uf_crm) {
    resource.qualification = [
      {
        identifier: [{ system: `urn:oid:2.16.840.1.113883.3.7200.${p.uf_crm}`, value: p.crm }], // TODO: confirmar no IG oficial
        code: { text: 'Médico' },
      },
    ]
  }
  // CBO (terminologia.cbo) quando conhecido; null = lacuna (não inventar)
  if (p.cbo_codigo) {
    resource.qualification = [
      ...(resource.qualification ?? []),
      {
        code: codificarCbo(p.cbo_codigo, null),
      },
    ]
  }
  return resource
}

// ══ 3. Organization (estabelecimento — CNES) ═════════════════════════════════

export function mapEstabelecimento(e: EntidadeEstabelecimento): Organization {
  const resource: Organization = {
    resourceType: 'Organization',
    id: e.id,
    name: e.nome,
  }
  if (e.cnes) {
    resource.identifier = [{ system: `${RNDS}/StructureDefinition/BREstabelecimentoSaude-1.0`, value: e.cnes }] // RNDS: sistema = perfil do ator
    resource.type = [{ coding: [codificarCnes(e.cnes, e.nome)] }]
  }
  if (e.municipio || e.uf) {
    resource.address = [
      {
        city: e.municipio ?? undefined,
        state: e.uf ?? undefined,
        use: 'work',
      },
    ]
  }
  return resource
}

// ══ 4. Encounter (encontro/atendimento — internacao) ═════════════════════════

export function mapEncontro(
  enc: EntidadeEncontro,
  paciente: EntidadePaciente,
  estabelecimento: EntidadeEstabelecimento,
  profissional: EntidadeProfissional
): Encounter {
  const resource: Encounter = {
    resourceType: 'Encounter',
    id: enc.id,
    status: mapearStatusEncontro(enc.status),
    class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'IMP', display: 'inpatient encounter' },
    subject: refPaciente(paciente),
    serviceProvider: refEstabelecimento(estabelecimento),
    period: {
      start: enc.data_admissao,
      ...(enc.data_alta ? { end: enc.data_alta } : {}),
    },
  }
  // tipo do encontro
  if (enc.tipo_internacao) {
    resource.type = [
      {
        text: mapearTipoEncontro(enc.tipo_internacao),
      },
    ]
  }
  // participante: profissional responsável
  resource.participant = [
    {
      individual: refProfissional(profissional),
    },
  ]
  // diagnóstico no encontro (CID-10 principal)
  if (enc.cid_principal) {
    resource.reasonCode = [
      {
        coding: [codificarCid10(enc.cid_principal, null)],
        text: `CID-10 ${enc.cid_principal}`,
      },
    ]
  }
  return resource
}

function mapearStatusEncontro(status: string): Encounter['status'] {
  switch (status) {
    case 'admitido':
    case 'em_observacao':
    case 'internado':
      return 'in-progress'
    case 'alta_melhorada':
    case 'alta_pedido':
    case 'alta_evasao':
    case 'transferencia_externa':
    case 'obito':
      return 'finished'
    default:
      return 'unknown'
  }
}

function mapearTipoEncontro(tipo: string): string {
  switch (tipo) {
    case 'urgencia':
      return 'Atendimento de urgência'
    case 'emergencia':
      return 'Atendimento de emergência'
    case 'eletiva':
      return 'Internação eletiva'
    case 'observacao':
      return 'Observação'
    default:
      return tipo
  }
}

// ══ 5. Condition (diagnóstico — CID-10 via terminologia) ═════════════════════

export function mapCondicao(
  c: EntidadeCondicao,
  paciente: EntidadePaciente,
  encontroId: string | null
): Condition {
  const resource: Condition = {
    resourceType: 'Condition',
    id: c.id,
    clinicalStatus: {
      coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: c.verificado ? 'active' : 'active' }], // TODO: ajustar conforme verificação
    },
    verificationStatus: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
          code: c.verificado ? 'confirmed' : 'unconfirmed',
        },
      ],
    },
    code: {
      coding: [codificarCid10(c.codigo_cid, c.descricao)],
      text: c.descricao ?? `CID-10 ${c.codigo_cid}`,
    },
    subject: refPaciente(paciente),
  }
  if (encontroId) resource.encounter = { reference: `Encounter/${encontroId}` }
  if (c.data) resource.recordedDate = c.data
  return resource
}

// ══ 6. Observation (observacao — LOINC via conceito) ═════════════════════════

export function mapObservacao(
  o: EntidadeObservacao,
  paciente: EntidadePaciente,
  encontroId: string | null
): Observation {
  const { coding, lacunaLoinc } = codificarLoinc(o.loinc_codigo, o.conceito_nome)

  const resource: Observation = {
    resourceType: 'Observation',
    id: o.id,
    status: 'final',
    code: {
      coding,
      // sem LOINC: codificação local + lacuna registrada (não inventar código)
      text: lacunaLoinc ? `Conceito local: ${o.conceito_nome} (sem LOINC)` : o.conceito_nome,
    },
    subject: refPaciente(paciente),
  }
  if (encontroId) resource.encounter = refEncontro({ id: encontroId } as EntidadeEncontro)
  resource.effectiveDateTime = o.aferido_em

  // valor coerente com o tipo do conceito
  if (o.valor_num != null) {
    resource.valueQuantity = {
      value: o.valor_num,
      ...(o.unidade ?? o.unidade_padrao ? { unit: o.unidade ?? o.unidade_padrao ?? undefined } : {}),
    }
  } else if (o.valor_texto != null) {
    resource.valueString = o.valor_texto
  }

  // faixa de referência
  if (o.ref_min != null || o.ref_max != null) {
    resource.referenceRange = [
      {
        low: o.ref_min != null ? { value: o.ref_min } : undefined,
        high: o.ref_max != null ? { value: o.ref_max } : undefined,
      },
    ]
  }

  // lacuna LOINC fica registrada para a planilha de lacunas (não bloqueia o recurso)
  if (lacunaLoinc) {
    resource.meta = {
      ...(resource.meta ?? {}),
      tag: [
        {
          system: 'http://chefecoruja.local/fhir/CodeSystem/lacunas', // TODO: definir system oficial
          code: 'sem-loinc',
          display: 'Conceito sem código LOINC',
        },
      ],
    }
  }
  return resource
}

// ══ 7. MedicationRequest (medicação prescrita) ═══════════════════════════════

export function mapMedicacao(
  m: EntidadeMedicacao,
  paciente: EntidadePaciente,
  profissional: EntidadeProfissional
): MedicationRequest {
  const resource: MedicationRequest = {
    resourceType: 'MedicationRequest',
    id: m.id,
    status: m.status_prescricao === 'assinada' ? 'active' : 'draft', // TODO: confirmar mapeamento de status
    intent: 'order',
    medicationCodeableConcept: {
      text: m.descricao,
    },
    subject: refPaciente(paciente),
    authoredOn: m.prescrito_em,
    requester: refProfissional(profissional),
  }
  if (m.dose) {
    resource.dosageInstruction = [
      {
        doseAndRate: [
          {
            doseQuantity: {
              value: Number(m.dose.replace(',', '.').replace(/[^0-9.-]/g, '')) || undefined,
              unit: m.dose.replace(/[0-9.,\s]/g, '') || undefined,
            },
          },
        ],
        text: m.posologia ?? m.dose,
      },
    ]
  } else if (m.posologia) {
    resource.dosageInstruction = [{ text: m.posologia }]
  }
  return resource
}

// ══ 8. Procedure (SIGTAP) ════════════════════════════════════════════════════

/** Procedimento SIGTAP (ex.: usado no Sumário de Alta — lista de procedimentos). */
export function mapProcedimento(input: {
  id: string
  codigo_sigtap: string
  nome: string | null
  paciente: EntidadePaciente
  encontroId: string | null
  realizado_em: string | null
}): Procedure {
  const resource: Procedure = {
    resourceType: 'Procedure',
    id: input.id,
    status: input.realizado_em ? 'completed' : 'preparation', // TODO: confirmar no IG
    code: {
      coding: [codificarSigtap(input.codigo_sigtap, input.nome)],
      text: input.nome ?? `SIGTAP ${input.codigo_sigtap}`,
    },
    subject: refPaciente(input.paciente),
  }
  if (input.encontroId) resource.encounter = refEncontro({ id: input.encontroId } as EntidadeEncontro)
  if (input.realizado_em) resource.performedDateTime = input.realizado_em
  return resource
}

// ══ 9. Bundles ═══════════════════════════════════════════════════════════════
// RNDS: Bundle do tipo "document", com a Composition na primeira entrada
// (padrão dos exemplos oficiais de REL/RIA/RIRA; para RAC e SA é inferência
// forte, sem exemplo oficial público). As seções se distinguem pelo perfil do
// recurso referenciado. `identificadorSolicitante` é o do credenciamento no
// DATASUS; sem ele, o Bundle fica sem identifier (ainda não se envia).

function secao(titulo: string, refs: Reference[], texto?: string): CompositionSection {
  const s: CompositionSection = { title: titulo }
  if (refs.length) s.entry = refs
  if (texto) s.text = { status: 'generated', div: `<div xmlns="http://www.w3.org/1999/xhtml">${escaparXhtml(texto)}</div>` }
  if (!refs.length && !texto) {
    s.emptyReason = { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/list-empty-reason', code: 'unavailable' }] }
  }
  return s
}

function escaparXhtml(t: string) {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function montarDocumento(
  tipo: 'RAC' | 'SA',
  dados: EntidadeAtendimentoRAC,
  extras: { secoes: CompositionSection[]; identificadorSolicitante?: string },
): Bundle {
  const { paciente, estabelecimento, encontro, profissional, condicoes, observacoes, medicacoes } = dados
  const condicoesR = condicoes.map((c) => mapCondicao(c, paciente, encontro.id))
  const observacoesR = observacoes.map((o) => mapObservacao(o, paciente, encontro.id))
  const medicacoesR = medicacoes.map((m) => mapMedicacao(m, paciente, profissional))
  const composicao: Composition = {
    resourceType: 'Composition',
    id: `${tipo.toLowerCase()}-${encontro.id}`,
    meta: { profile: [tipo === 'RAC' ? PERFIL_RAC : PERFIL_SA] },
    status: 'final',
    type: { coding: [{ system: `${RNDS}/CodeSystem/BRTipoDocumento`, code: tipo }] },
    subject: refPaciente(paciente),
    encounter: refEncontro(encontro),
    date: encontro.data_alta ?? encontro.data_admissao,
    author: [refProfissional(profissional), refEstabelecimento(estabelecimento)],
    title: tipo === 'RAC' ? 'Registro de Atendimento Clínico' : 'Sumário de Alta',
    section: [
      secao('Contato assistencial', [refEncontro(encontro)]),
      ...(tipo === 'RAC'
        ? [secao('Problemas e diagnósticos', condicoesR.map((c) => ({ reference: `Condition/${c.id}` })))]
        : []),
      ...extras.secoes,
      ...(observacoesR.length ? [secao('Observações', observacoesR.map((o) => ({ reference: `Observation/${o.id}` })))] : []),
      ...(medicacoesR.length ? [secao('Prescrição', medicacoesR.map((m) => ({ reference: `MedicationRequest/${m.id}` })))] : []),
    ],
  }
  const entradas: BundleEntry[] = [
    { resource: composicao },
    { resource: mapPaciente(paciente) },
    { resource: mapEstabelecimento(estabelecimento) },
    { resource: mapProfissional(profissional) },
    { resource: mapEncontro(encontro, paciente, estabelecimento, profissional) },
    ...condicoesR.map((resource) => ({ resource })),
    ...observacoesR.map((resource) => ({ resource })),
    ...medicacoesR.map((resource) => ({ resource })),
  ]
  const bundle: Bundle = {
    resourceType: 'Bundle',
    type: 'document',
    timestamp: encontro.data_alta ?? encontro.data_admissao,
    entry: entradas,
  }
  if (extras.identificadorSolicitante) {
    bundle.identifier = { system: `${RNDS}/NamingSystem/BRRNDS-${extras.identificadorSolicitante}`, value: composicao.id }
  }
  return bundle
}

/**
 * Registro de Atendimento Clínico (RAC 2.1). Seções obrigatórias: contato
 * assistencial, problemas/diagnósticos e procedimentos. Procedimento ainda não
 * vem do atendimento da porta: a seção sai vazia com emptyReason (TODO: SIGTAP
 * do atendimento, quando o faturamento da porta existir).
 */
export function montarBundleRAC(dados: EntidadeAtendimentoRAC, identificadorSolicitante?: string): Bundle {
  return montarDocumento('RAC', dados, { secoes: [secao('Procedimentos', [])], identificadorSolicitante })
}

/**
 * Sumário de Alta (SA 1.0). Seções obrigatórias: contato assistencial,
 * procedimentos e resumo da evolução clínica (texto do sumário/orientações).
 */
export function montarBundleSumarioAlta(dados: EntidadeSumarioAlta, identificadorSolicitante?: string): Bundle {
  const resumo = [dados.motivo_alta ? `Motivo da alta: ${dados.motivo_alta}` : null, dados.orientacoes].filter(Boolean).join('\n\n')
  return montarDocumento('SA', dados, {
    secoes: [
      secao('Procedimentos', []),
      secao('Resumo da evolução clínica', [], resumo || undefined),
    ],
    identificadorSolicitante,
  })
}
