// ─────────────────────────────────────────────────────────────────────────────
// Fixtures de atendimento de UPA (FASE 4A) — 3 cenários obrigatórios:
//   1. atendimento com alta para casa
//   2. atendimento com internação
//   3. atendimento com evasão
// ─────────────────────────────────────────────────────────────────────────────
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

const PACIENTE_BASE: EntidadePaciente = {
  id: 'pac-0001',
  nome: 'Maria de Souza Oliveira',
  data_nascimento: '1985-04-12',
  sexo: 'F',
  cpf: '12345678901',
  telefone: '(11) 99999-0000',
  prontuario: 'PRT-2026-0001',
}

const ESTABELECIMENTO: EntidadeEstabelecimento = {
  id: 'uni-0001',
  nome: 'UPA Centro',
  cnes: '0000001',
  municipio: 'São Paulo',
  uf: 'SP',
  organizacao_id: 'org-0001',
}

const PROFISSIONAL: EntidadeProfissional = {
  id: 'prof-0001',
  nome_completo: 'Dr. João Pereira',
  cpf: '98765432100',
  crm: '123456',
  uf_crm: 'SP',
  cbo_codigo: '2251', // TODO: CBO real (terminologia.cbo) — fixture usa 2251 (médico clínico)
}

function encontroBase(over: Partial<EntidadeEncontro> = {}): EntidadeEncontro {
  return {
    id: 'enc-0001',
    paciente_id: PACIENTE_BASE.id,
    unidade_id: ESTABELECIMENTO.id,
    tipo_internacao: 'urgencia',
    origem_admissao: 'emergencia',
    status: 'alta_melhorada',
    leito_atual_id: null,
    setor_atual_id: 'setor-0001',
    data_admissao: '2026-08-10T09:00:00Z',
    data_entrada_setor: '2026-08-10T09:05:00Z',
    data_alta: '2026-08-10T15:30:00Z',
    cid_principal: 'J06',
    motivo_alta: 'Melhora clínica',
    ...over,
  }
}

function condicaoBase(over: Partial<EntidadeCondicao> = {}): EntidadeCondicao {
  return {
    id: 'cond-0001',
    paciente_id: PACIENTE_BASE.id,
    encontro_id: 'enc-0001',
    codigo_cid: 'J06',
    descricao: 'Infecção aguda das vias aéreas superiores não especificada',
    categoria: 'principal',
    verificado: true,
    data: '2026-08-10T09:10:00Z',
    ...over,
  }
}

function observacaoBase(over: Partial<EntidadeObservacao> = {}): EntidadeObservacao {
  return {
    id: 'obs-0001',
    conceito_id: 'conceito-fc',
    conceito_nome: 'frequencia-cardiaca',
    conceito_tipo: 'numerico',
    loinc_codigo: '8867-4', // Heart rate
    unidade_padrao: 'bpm',
    valor_num: 96,
    valor_texto: null,
    unidade: 'bpm',
    ref_min: 60,
    ref_max: 100,
    flag: 'N',
    aferido_em: '2026-08-10T09:15:00Z',
    origem: 'manual',
    registrado_por: PROFISSIONAL.id,
    ...over,
  }
}

function medicacaoBase(over: Partial<EntidadeMedicacao> = {}): EntidadeMedicacao {
  return {
    id: 'med-0001',
    prescricao_id: 'presc-0001',
    paciente_id: PACIENTE_BASE.id,
    medico_id: PROFISSIONAL.id,
    descricao: 'Dipirona 500 mg',
    dose: '500 mg',
    posologia: '8/8h se dor',
    status_prescricao: 'assinada',
    prescrito_em: '2026-08-10T09:20:00Z',
    ...over,
  }
}

/** Fixture 1 — atendimento de UPA com ALTA PARA CASA. */
export function fixtureAltaParaCasa(): EntidadeAtendimentoRAC {
  return {
    paciente: PACIENTE_BASE,
    estabelecimento: ESTABELECIMENTO,
    encontro: encontroBase({ status: 'alta_melhorada', data_alta: '2026-08-10T15:30:00Z' }),
    profissional: PROFISSIONAL,
    condicoes: [condicaoBase()],
    observacoes: [observacaoBase(), observacaoBase({ id: 'obs-0002', conceito_nome: 'temperatura', loinc_codigo: '8310-5', valor_num: 37.1, unidade: '°C', ref_min: 36, ref_max: 37.8 })],
    medicacoes: [medicacaoBase()],
  }
}

/** Fixture 2 — atendimento de UPA com INTERNAÇÃO (encontro aberto). */
export function fixtureComInternacao(): EntidadeAtendimentoRAC {
  return {
    paciente: PACIENTE_BASE,
    estabelecimento: ESTABELECIMENTO,
    encontro: encontroBase({
      id: 'enc-0002',
      status: 'internado',
      data_alta: null,
      cid_principal: 'N17',
      motivo_alta: null,
      tipo_internacao: 'internacao',
    }),
    profissional: PROFISSIONAL,
    condicoes: [condicaoBase({ id: 'cond-0002', codigo_cid: 'N17', descricao: 'Insuficiência renal aguda', encontro_id: 'enc-0002' })],
    observacoes: [
      observacaoBase({ id: 'obs-0003', conceito_nome: 'creatinina', loinc_codigo: '2160-0', valor_num: 1.8, unidade: 'mg/dL', ref_min: 0.6, ref_max: 1.3, flag: 'H', aferido_em: '2026-08-11T08:00:00Z' }),
      observacaoBase({ id: 'obs-0004', conceito_nome: 'ureia', loinc_codigo: '3094-0', valor_num: 62, unidade: 'mg/dL', ref_min: 15, ref_max: 40, flag: 'H', aferido_em: '2026-08-11T08:00:00Z' }),
    ],
    medicacoes: [medicacaoBase({ id: 'med-0002', prescricao_id: 'presc-0002', descricao: 'Solução fisiológica 0,9%', dose: '500 mL', posologia: '12/12h' })],
  }
}

/** Fixture 3 — atendimento de UPA com EVASÃO. */
export function fixtureComEvasao(): EntidadeAtendimentoRAC {
  return {
    paciente: PACIENTE_BASE,
    estabelecimento: ESTABELECIMENTO,
    encontro: encontroBase({
      id: 'enc-0003',
      status: 'alta_evasao',
      data_alta: '2026-08-10T11:00:00Z',
      motivo_alta: 'Evasão do paciente',
    }),
    profissional: PROFISSIONAL,
    condicoes: [condicaoBase({ id: 'cond-0003', codigo_cid: 'A09', descricao: 'Gastroenterite e colite de origem não especificada', encontro_id: 'enc-0003' })],
    observacoes: [observacaoBase({ id: 'obs-0005', aferido_em: '2026-08-10T10:00:00Z' })],
    medicacoes: [],
  }
}

/** Versão Sumário de Alta da fixture 1 (com orientações). */
export function fixtureSumarioAltaParaCasa(): EntidadeSumarioAlta {
  const base = fixtureAltaParaCasa()
  return {
    ...base,
    motivo_alta: base.encontro.motivo_alta,
    orientacoes: 'Retorno em 48h se piora. Manter hidratação. Dipirona 500 mg 8/8h se dor.',
  }
}
