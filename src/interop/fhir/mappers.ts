// ─────────────────────────────────────────────────────────────────────────────
// Mappers FHIR R4 — PUROS (sem I/O, sem banco)
//
// Recebem entidades de domínio já carregadas (src/interop/fhir/tipos.ts) e
// devolvem recursos FHIR R4 (@medplum/fhirtypes). A carga de dados fica em
// outra camada — se um mapper precisar consultar banco, o desenho está errado.
//
// REGRAS:
//   - Codificações vêm de src/interop/fhir/codificacao.ts (terminologia).
//   - Onde o IG oficial da RNDS ainda não foi lido (docs/rnds/ vazio),
//     marcamos `// TODO: confirmar no IG oficial` em vez de inventar.
//   - Nenhum log com PII: os mappers só constroem recursos.
// ─────────────────────────────────────────────────────────────────────────────
import type {
  Bundle,
  BundleEntry,
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
  if (p.cpf) resource.identifier = [{ system: 'http://rnds.saude.gov.br/fhir/r4/StructureDefinition/CPF', value: p.cpf }] // TODO: confirmar system no IG oficial
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
  if (p.cpf) resource.identifier = [{ system: 'http://rnds.saude.gov.br/fhir/r4/StructureDefinition/CPF', value: p.cpf }] // TODO: confirmar system
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
    resource.identifier = [{ system: 'http://www.saude.gov.br/fhir/r4/CodeSystem/cnes', value: e.cnes }] // TODO: confirmar no IG
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

/**
 * Bundle de Registro de Atendimento Clínico (RAC).
 * Resources: Patient, Organization, Practitioner, Encounter, Condition*,
 * Observation*, MedicationRequest*, Procedure*.
 */
export function montarBundleRAC(dados: EntidadeAtendimentoRAC): Bundle {
  const { paciente, estabelecimento, encontro, profissional, condicoes, observacoes, medicacoes } = dados

  const entradas: BundleEntry[] = [
    { resource: mapPaciente(paciente) },
    { resource: mapEstabelecimento(estabelecimento) },
    { resource: mapProfissional(profissional) },
    { resource: mapEncontro(encontro, paciente, estabelecimento, profissional) },
    ...condicoes.map((c) => ({ resource: mapCondicao(c, paciente, encontro.id) })),
    ...observacoes.map((o) => ({ resource: mapObservacao(o, paciente, encontro.id) })),
    ...medicacoes.map((m) => ({ resource: mapMedicacao(m, paciente, profissional) })),
  ]

  return {
    resourceType: 'Bundle',
    type: 'collection',
    entry: entradas,
  }
}

/**
 * Bundle de Sumário de Alta.
 * Inclui todos os recursos do RAC + Procedure(s) SIGTAP e orientações de alta
 * (ex.: Composition com o texto do sumário — TODO: confirmar perfil no IG).
 */
export function montarBundleSumarioAlta(dados: EntidadeSumarioAlta): Bundle {
  const { paciente, estabelecimento, encontro, profissional, condicoes, observacoes, medicacoes } = dados

  const entradas: BundleEntry[] = [
    { resource: mapPaciente(paciente) },
    { resource: mapEstabelecimento(estabelecimento) },
    { resource: mapProfissional(profissional) },
    { resource: mapEncontro(encontro, paciente, estabelecimento, profissional) },
    ...condicoes.map((c) => ({ resource: mapCondicao(c, paciente, encontro.id) })),
    ...observacoes.map((o) => ({ resource: mapObservacao(o, paciente, encontro.id) })),
    ...medicacoes.map((m) => ({ resource: mapMedicacao(m, paciente, profissional) })),
  ]

  return {
    resourceType: 'Bundle',
    type: 'collection',
    entry: entradas,
  }
}
