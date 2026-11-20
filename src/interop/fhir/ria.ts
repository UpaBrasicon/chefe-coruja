// ─────────────────────────────────────────────────────────────────────────────
// RIA-R — Registro de Imunobiológico Administrado em Rotina (percurso da UBS,
// U15, vacina, PR 7) — PURO (sem I/O, sem banco).
//
// Recebe a carga de private.rnds_carga_ria (migration 20270415000031), já nos
// códigos da RNDS, e devolve o Bundle do documento.
//
// Fonte: Manual de Integração RIA-R v1.9 (DATASUS) e as definições do validador
// oficial (produto/docs/pesquisa/rnds-oficial/ria/):
//   - Composition BRRegistroImunobiologicoAdministradoRotina-2.0: sem category,
//     título fixo, uma seção com uma entrada;
//   - Immunization BRImunobiologicoAdministrado-3.0: extensões de grupo de
//     atendimento e condição maternal (obrigatórias) e contato com hanseníase;
//     sem recorded; performer.actor = "Practitioner/<CNS>" de quem aplicou ou
//     transcreveu; performer.function só com o CBO do prescritor (estratégia
//     especial); protocolApplied com a estratégia e a dose;
//   - transcrição de caderneta: primarySource false, reportOrigin 01 (ou 02, no
//     exterior) e o país (BRPais 10 = Brasil); lote e fabricante opcionais;
//   - Condition BRCID10Avaliado-1.0 com o motivo da indicação (especial).
//
// O que falta não é inventado: o mapper recusa com "retido: …".
// ─────────────────────────────────────────────────────────────────────────────
import type { Bundle, Composition, Condition, Extension, Immunization } from '@medplum/fhirtypes'

import { RNDS, codificarCbo, codificarCid10, codificarRnds } from './codificacao.ts'
import type { EntidadeEstabelecimento, EntidadePaciente, EntidadeProfissional, EnvioRnds } from './tipos.ts'

export type EntidadeRIA = {
  paciente: EntidadePaciente
  estabelecimento: EntidadeEstabelecimento
  profissional: EntidadeProfissional
  vacina: {
    id: string
    registro_anterior: boolean
    aplicado_exterior: boolean
    data_aplicacao: string
    registrado_em: string
    /** códigos da RNDS (BRImunobiologico, BRDose, BREstrategiaVacinacao, BRGrupoAtendimento, BRViaAdministracao, BRLocalAplicacao) */
    imunobiologico: string
    dose: string
    estrategia: string
    grupo_atendimento: string
    via: string | null
    local: string | null
    fabricante: string | null
    lote: string | null
    validade: string | null
    condicao_maternal: string | null
    comunicante_hanseniase: boolean | null
    prescritor_cbo: string | null
    cid10_motivo: string | null
  }
}

export const PERFIL_RIA_R = `${RNDS}/StructureDefinition/BRRegistroImunobiologicoAdministradoRotina-2.0`
export const PERFIL_IMUNIZACAO = `${RNDS}/StructureDefinition/BRImunobiologicoAdministrado-3.0`
const SD = `${RNDS}/StructureDefinition`
const CS = `${RNDS}/CodeSystem`
/** BCG: "contato com hanseníase" obrigatório. */
const BCG = '15'
/** BREstrategiaVacinacao 2 = Especial: CBO do prescritor e CID-10 do motivo. */
const ESPECIAL = '2'
/** BRPais 10 = Brasil. */
const BRASIL = '10'

export function montarBundleRIA(d: EntidadeRIA, envio: EnvioRnds): Bundle {
  const v = d.vacina
  const valorPaciente = d.paciente.cpf ?? d.paciente.cns
  if (!valorPaciente) throw new Error('retido: paciente sem CPF e sem CNS')
  if (!d.estabelecimento.cnes) throw new Error('retido: unidade sem CNES')
  if (!d.profissional.cns) throw new Error('retido: profissional sem CNS (o RIA identifica quem aplicou pelo CNS)')
  if (!v.via || !v.local) throw new Error('retido: vacina sem via ou local de aplicação')
  if (!v.condicao_maternal) throw new Error('retido: vacina sem condição maternal')
  if (v.imunobiologico === BCG && v.comunicante_hanseniase == null) throw new Error('retido: BCG sem contato com hanseníase')
  if (!v.registro_anterior && (!v.lote || !v.fabricante)) throw new Error('retido: vacina aplicada sem lote ou fabricante')
  const especial = v.estrategia === ESPECIAL
  if (especial && (!v.prescritor_cbo || !v.cid10_motivo)) throw new Error('retido: estratégia especial sem CBO do prescritor ou CID-10')

  const uuid = envio.uuid ?? (() => crypto.randomUUID())
  const url = () => `urn:uuid:${uuid()}`
  const sujeito = { identifier: { system: `${SD}/BRIndividuo-1.0`, value: valorPaciente } }
  const urlComposicao = url()
  const urlImunizacao = url()
  const urlMotivo = especial ? url() : null

  const extensoes: Extension[] = [
    { url: `${SD}/BRGrupoAtendimento`, valueCodeableConcept: { coding: [codificarRnds('BRGrupoAtendimento', v.grupo_atendimento)] } },
    { url: `${SD}/BRCondicaoMaternal`, valueCodeableConcept: { coding: [codificarRnds('BRCondicaoMaternal', v.condicao_maternal)] } },
    ...(v.comunicante_hanseniase != null ? [{ url: `${SD}/BRContatoHanseniase`, valueBoolean: v.comunicante_hanseniase }] : []),
  ]

  const imunizacao: Immunization = {
    resourceType: 'Immunization',
    meta: { profile: [PERFIL_IMUNIZACAO] },
    extension: extensoes,
    status: 'completed',
    vaccineCode: { coding: [codificarRnds('BRImunobiologico', v.imunobiologico)] },
    patient: sujeito,
    occurrenceDateTime: v.data_aplicacao,
    primarySource: !v.registro_anterior,
    ...(v.registro_anterior
      ? {
          reportOrigin: { coding: [codificarRnds('BRRegistroOrigem', v.aplicado_exterior ? '02' : '01')] },
          ...(v.aplicado_exterior ? {} : { location: { identifier: { system: `${CS}/BRPais`, value: BRASIL } } }),
        }
      : {}),
    ...(v.fabricante ? { manufacturer: { identifier: { system: `${CS}/BRFabricantePNI`, value: v.fabricante } } } : {}),
    ...(v.lote ? { lotNumber: v.lote.trim() } : {}),
    ...(v.validade ? { expirationDate: v.validade } : {}),
    site: { coding: [codificarRnds('BRLocalAplicacao', v.local)] },
    route: { coding: [codificarRnds('BRViaAdministracao', v.via)] },
    performer: [{
      ...(especial ? { function: { coding: [codificarCbo(v.prescritor_cbo!)] } } : {}),
      actor: { reference: `Practitioner/${d.profissional.cns}` },
    }],
    ...(urlMotivo ? { reasonReference: [{ reference: urlMotivo }] } : {}),
    protocolApplied: [{
      extension: [{ url: `${SD}/BREstrategiaVacinacao-1.0`, valueCodeableConcept: { coding: [codificarRnds('BREstrategiaVacinacao', v.estrategia)] } }],
      doseNumberString: v.dose,
    }],
  }

  const composicao: Composition = {
    resourceType: 'Composition',
    meta: { profile: [PERFIL_RIA_R] },
    status: 'final',
    type: { coding: [codificarRnds('BRTipoDocumento', 'RIA')] },
    subject: sujeito,
    date: envio.agora,
    author: [{ identifier: { system: `${SD}/BREstabelecimentoSaude-1.0`, value: d.estabelecimento.cnes } }],
    title: 'Registro de Imunobiologico Administrado na Rotina',
    section: [{ entry: [{ reference: urlImunizacao }] }],
  }
  if (envio.idRndsAnterior) {
    composicao.relatesTo = [{ code: 'replaces', targetReference: { reference: `Composition/${envio.idRndsAnterior}` } }]
  }

  const entradas: NonNullable<Bundle['entry']> = [
    { fullUrl: urlComposicao, resource: composicao },
    { fullUrl: urlImunizacao, resource: imunizacao },
  ]
  if (urlMotivo) {
    const motivo: Condition = {
      resourceType: 'Condition',
      meta: { profile: [`${SD}/BRCID10Avaliado-1.0`] },
      clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }] },
      category: [{ coding: [{ system: `${CS}/BRCategoriaDiagnostico`, code: '01' }] }],
      code: { coding: [codificarCid10(v.cid10_motivo!)] },
      subject: sujeito,
    }
    entradas.push({ fullUrl: urlMotivo, resource: motivo })
  }

  const bundle: Bundle = { resourceType: 'Bundle', type: 'document', timestamp: envio.agora, entry: entradas }
  if (envio.identificadorSolicitante) {
    // o mesmo id local em todas as versões: a RNDS liga a substituição por ele
    bundle.identifier = { system: `${RNDS}/NamingSystem/BRRNDS-${envio.identificadorSolicitante}`, value: `ria-${v.id}` }
  }
  return bundle
}
