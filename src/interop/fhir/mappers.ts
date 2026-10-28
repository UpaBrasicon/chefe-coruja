// ─────────────────────────────────────────────────────────────────────────────
// Documentos RAC e Sumário de Alta — PUROS (sem I/O, sem banco)
//
// Recebem entidades de domínio já carregadas (src/interop/fhir/tipos.ts) e
// devolvem o Bundle do documento. A carga fica em outra camada (o serviço de
// envio, 5C-5.3): se um mapper precisar consultar banco, o desenho está errado.
//
// Perfis conferidos no validador local oficial da RNDS, com as definições de
// 07/2026 (5C-5.2, docs/rnds/VALIDADOR.md):
//   - BRRegistroAtendimentoClinico e BRSumarioAlta, base BRConjuntoMinimoDados-1.1;
//   - cada seção tem uma entrada e casa pelo perfil do recurso apontado;
//   - paciente, estabelecimento e profissional vão por identifier, nunca como
//     entradas do Bundle;
//   - os recursos ficam em entradas próprias, ligadas por urn:uuid.
//
// O que falta para um documento válido não é inventado: o mapper recusa com o
// motivo ("retido: …"), e o item fica na fila com esse erro.
// ─────────────────────────────────────────────────────────────────────────────
import type {
  Bundle,
  ClinicalImpression,
  Composition,
  CompositionSection,
  Condition,
  Encounter,
  EncounterDiagnosis,
  Identifier,
  Observation,
  Procedure,
} from '@medplum/fhirtypes'

import {
  LOINC_ACEITOS,
  RNDS,
  codificarCbo,
  codificarCid10,
  codificarLoinc,
  codificarRnds,
  codificarSigtap,
  unidadeUcum,
} from './codificacao.ts'
import type {
  EntidadeAtendimentoRAC,
  EntidadeCondicao,
  EntidadeObservacao,
  EntidadePaciente,
  EntidadeProcedimento,
  EntidadeProfissional,
  EntidadeSumarioAlta,
  EnvioRnds,
} from './tipos.ts'

export const PERFIL_RAC = `${RNDS}/StructureDefinition/BRRegistroAtendimentoClinico`
export const PERFIL_SA = `${RNDS}/StructureDefinition/BRSumarioAlta`
const SD = `${RNDS}/StructureDefinition`

type Ref = { identifier: Identifier }

/** CPF primeiro, CNS na falta (decisão de 10/10/2026). */
function paciente(p: EntidadePaciente): Ref {
  const valor = p.cpf ?? p.cns
  if (!valor) throw new Error('retido: paciente sem CPF e sem CNS')
  return { identifier: { system: `${SD}/BRIndividuo-1.0`, value: valor } }
}

function estabelecimento(cnes: string | null): Ref {
  if (!cnes) throw new Error('retido: unidade sem CNES')
  return { identifier: { system: `${SD}/BREstabelecimentoSaude-1.0`, value: cnes } }
}

/** Profissional por CPF (BRProfissional-1.0), com o CBO. Sem CBO, não vai em nome dele. */
function profissional(p: EntidadeProfissional): { ref: Ref; cbo: string } {
  if (!p.cpf) throw new Error('retido: profissional sem CPF')
  if (!p.cbo_codigo) throw new Error('retido: profissional sem CBO')
  return { ref: { identifier: { system: `${SD}/BRProfissional-1.0`, value: p.cpf } }, cbo: p.cbo_codigo }
}

// ══ recursos ═════════════════════════════════════════════════════════════════

function mapCondicao(c: EntidadeCondicao, sujeito: Ref): Condition {
  return {
    resourceType: 'Condition',
    meta: { profile: [`${SD}/BRProblemaDiagnostico`] },
    clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }] },
    category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-category', code: 'encounter-diagnosis' }] }],
    code: { coding: [codificarCid10(c.codigo_cid)] },
    subject: sujeito,
  }
}

function mapProcedimento(
  p: EntidadeProcedimento,
  sujeito: Ref,
  executante: { ref: Ref; cbo: string },
  unidade: Ref,
): Procedure {
  return {
    resourceType: 'Procedure',
    meta: { profile: [`${SD}/BRProcedimentoRealizado-1.0`] },
    extension: [{ url: `${SD}/BRQuantidade-1.0`, valuePositiveInt: p.quantidade }],
    status: 'completed',
    code: { coding: [codificarSigtap(p.codigo_sigtap)] },
    subject: sujeito,
    performedDateTime: p.realizado_em,
    performer: [{ function: { coding: [codificarCbo(executante.cbo)] }, actor: executante.ref, onBehalfOf: unidade }],
  }
}

/** Só as medidas do ValueSet BRTipoObservacao-1.0, com valor numérico. */
function mapObservacao(o: EntidadeObservacao, sujeito: Ref): Observation | null {
  if (!o.loinc_codigo || !LOINC_ACEITOS.has(o.loinc_codigo) || o.valor_num == null) return null
  const unidade = o.unidade ?? o.unidade_padrao
  return {
    resourceType: 'Observation',
    meta: { profile: [`${SD}/BRMedidaObservada`] },
    status: 'final',
    code: { coding: [codificarLoinc(o.loinc_codigo)] },
    subject: sujeito,
    valueQuantity: { value: o.valor_num, ...(unidade ? unidadeUcum(unidade) : {}) },
  }
}

// ══ documento ════════════════════════════════════════════════════════════════

type Dados = EntidadeAtendimentoRAC | EntidadeSumarioAlta

/**
 * Monta o Bundle do documento. RAC e SA compartilham o contato assistencial,
 * os diagnósticos e os procedimentos; o resto entra por `extras`.
 */
function montarDocumento(
  tipo: 'RAC' | 'SA',
  d: Dados,
  envio: EnvioRnds,
  extras: (sujeito: Ref) => (Observation | ClinicalImpression)[],
): Bundle {
  const uuid = envio.uuid ?? (() => crypto.randomUUID())
  const url = () => `urn:uuid:${uuid()}`
  const sujeito = paciente(d.paciente)
  const unidade = estabelecimento(d.estabelecimento.cnes)
  const executante = profissional(d.profissional)
  const { encontro, contato } = d
  if (!encontro.data_alta) throw new Error('retido: atendimento sem data de fim')
  if (!d.procedimentos.length) throw new Error('retido: sem procedimento SIGTAP registrado no atendimento')
  if (tipo === 'RAC' && !d.condicoes.length) throw new Error('retido: RAC sem diagnóstico (CID-10)')

  const condicoes = d.condicoes.map((c) => ({ url: url(), recurso: mapCondicao(c, sujeito), principal: c.categoria === 'principal' }))
  const procedimentos = d.procedimentos.map((p) => ({ url: url(), recurso: mapProcedimento(p, sujeito, executante, unidade), financiamento: p.financiamento }))

  const diagnosticos: EncounterDiagnosis[] = [
    ...condicoes.map((c) => ({ condition: { reference: c.url }, ...(c.principal ? { rank: 1 } : {}) })),
    ...procedimentos.map((p) => ({
      condition: {
        extension: [{ url: `${SD}/BRFinanciamento-1.0`, valueCodeableConcept: { coding: [codificarRnds('BRFinanciamento', p.financiamento)] } }],
        reference: p.url,
      },
    })),
  ]
  const contatoAssistencial: Encounter = {
    resourceType: 'Encounter',
    meta: { profile: [`${SD}/BRContatoAssistencial-1.0`] },
    status: 'finished',
    class: codificarRnds('BRModalidadeAssistencial', contato.modalidade),
    priority: { coding: [codificarRnds('BRCaraterAtendimento', contato.carater)] },
    subject: sujeito,
    participant: [{ extension: [{ url: `${SD}/BROcupacao-1.0`, valueCodeableConcept: { coding: [codificarCbo(executante.cbo)] } }], individual: executante.ref }],
    period: { start: encontro.data_admissao, end: encontro.data_alta },
    diagnosis: diagnosticos,
    hospitalization: {
      admitSource: { coding: [codificarRnds('BRProcedencia', contato.procedencia)] },
      dischargeDisposition: { coding: [codificarRnds('BRMotivoDesfecho', contato.desfecho)] },
    },
    serviceProvider: unidade,
  }
  const urlContato = url()
  const outros = extras(sujeito).map((recurso) => ({ recurso, url: url() }))

  // sem título: a base BRConjuntoMinimoDados-1.1 o proíbe nas seções (o validador
  // recusa os títulos fixos do perfil SA), e os exemplos oficiais não o mandam
  const secao = (entrada: string): CompositionSection => ({ entry: [{ reference: entrada }] })

  const urlComposicao = url()
  const composicao: Composition = {
    resourceType: 'Composition',
    meta: { profile: [tipo === 'RAC' ? PERFIL_RAC : PERFIL_SA] },
    status: 'final',
    type: { coding: [codificarRnds('BRTipoDocumento', tipo)] },
    category: [{ coding: [codificarRnds('BRModalidadeAssistencial', contato.modalidade)] }],
    subject: sujeito,
    date: envio.agora,
    author: [unidade],
    title: tipo === 'RAC' ? 'Registro de Atendimento Clínico' : 'Sumário de Alta',
    section: [
      secao(urlContato),
      ...condicoes.map((c) => secao(c.url)),
      ...procedimentos.map((p) => secao(p.url)),
      ...outros.map((o) => secao(o.url)),
    ],
  }
  if (envio.idRndsAnterior) {
    composicao.relatesTo = [{ code: 'replaces', targetReference: { reference: `Composition/${envio.idRndsAnterior}` } }]
  }

  const bundle: Bundle = {
    resourceType: 'Bundle',
    type: 'document',
    timestamp: envio.agora,
    entry: [
      { fullUrl: urlComposicao, resource: composicao },
      { fullUrl: urlContato, resource: contatoAssistencial },
      ...condicoes.map((c) => ({ fullUrl: c.url, resource: c.recurso })),
      ...procedimentos.map((p) => ({ fullUrl: p.url, resource: p.recurso })),
      ...outros.map((o) => ({ fullUrl: o.url, resource: o.recurso })),
    ],
  }
  if (envio.identificadorSolicitante) {
    // o mesmo id local em todas as versões: a RNDS liga a substituição por ele
    bundle.identifier = { system: `${RNDS}/NamingSystem/BRRNDS-${envio.identificadorSolicitante}`, value: `${tipo.toLowerCase()}-${encontro.id}` }
  }
  return bundle
}

/**
 * Registro de Atendimento Clínico: contato assistencial, ao menos um
 * diagnóstico e um procedimento, e as medidas que a RNDS aceita.
 */
export function montarBundleRAC(dados: EntidadeAtendimentoRAC, envio: EnvioRnds): Bundle {
  return montarDocumento('RAC', dados, envio, (sujeito) =>
    dados.observacoes.flatMap((o) => {
      const recurso = mapObservacao(o, sujeito)
      return recurso ? [recurso] : []
    }),
  )
}

/**
 * Sumário de Alta: contato assistencial, procedimentos e o resumo da evolução
 * clínica (obrigatório). A prescrição da alta, que é outro documento (RPM),
 * fica fora (decisão do RT, 5C-5.2).
 */
export function montarBundleSumarioAlta(dados: EntidadeSumarioAlta, envio: EnvioRnds): Bundle {
  const resumo = dados.resumo_evolucao?.trim()
  if (!resumo) throw new Error('retido: Sumário de Alta sem resumo da evolução clínica')
  return montarDocumento('SA', dados, envio, (sujeito) => [
    {
      resourceType: 'ClinicalImpression',
      meta: { profile: [`${SD}/BRResumoEvolucaoClinica`] },
      status: 'completed',
      subject: sujeito,
      summary: resumo,
    },
  ])
}
