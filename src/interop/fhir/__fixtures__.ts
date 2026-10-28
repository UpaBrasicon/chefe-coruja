// ─────────────────────────────────────────────────────────────────────────────
// Fixtures de atendimento de UPA (FASE 4A; revistas na 5C-5.2). Dados de teste,
// nenhum paciente real. CPFs válidos só no dígito; CNES de teste.
//   1. RAC: atendimento na porta com alta para casa
//   2. RAC: atendimento na porta com evasão
//   3. SA: observação com alta para casa
//   4. SA: observação com transferência
// ─────────────────────────────────────────────────────────────────────────────
import type {
  ContatoRnds,
  EntidadeAtendimentoRAC,
  EntidadeCondicao,
  EntidadeEncontro,
  EntidadeEstabelecimento,
  EntidadeObservacao,
  EntidadePaciente,
  EntidadeProcedimento,
  EntidadeProfissional,
  EntidadeSumarioAlta,
} from './tipos.ts'

const PACIENTE_BASE: EntidadePaciente = {
  id: 'pac-0001',
  nome: 'Maria de Souza Oliveira',
  data_nascimento: '1985-04-12',
  sexo: 'F',
  cpf: '52998224725',
  cns: null,
  telefone: '(11) 99999-0000',
  prontuario: 'PRT-2026-0001',
}

const ESTABELECIMENTO: EntidadeEstabelecimento = {
  id: 'uni-0001',
  nome: 'UPA Centro',
  cnes: '9999995',
  municipio: 'São Paulo',
  uf: 'SP',
  organizacao_id: 'org-0001',
}

const PROFISSIONAL: EntidadeProfissional = {
  id: 'prof-0001',
  nome_completo: 'Dr. João Pereira',
  cpf: '11144477735',
  crm: '123456',
  uf_crm: 'SP',
  cbo_codigo: '225125', // médico clínico
}

/** Porta da UPA: urgência, demanda espontânea, alta clínica. */
const CONTATO_PORTA: ContatoRnds = { modalidade: '06', carater: '02', procedencia: '09', desfecho: '01' }

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

function procedimentoBase(over: Partial<EntidadeProcedimento> = {}): EntidadeProcedimento {
  return {
    id: 'proc-0001',
    codigo_sigtap: '0301060096', // atendimento médico em unidade de pronto atendimento
    realizado_em: '2026-08-10T09:10:00Z',
    quantidade: 1,
    financiamento: '01',
    ...over,
  }
}

function observacaoBase(over: Partial<EntidadeObservacao> = {}): EntidadeObservacao {
  return {
    id: 'obs-0001',
    conceito_id: 'conceito-fc',
    conceito_nome: 'frequencia-cardiaca',
    conceito_tipo: 'numerico',
    loinc_codigo: '8867-4', // Heart rate: fora do BRTipoObservacao-1.0
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

/** Fixture 1 — porta da UPA com ALTA PARA CASA. */
export function fixtureAltaParaCasa(): EntidadeAtendimentoRAC {
  return {
    paciente: PACIENTE_BASE,
    estabelecimento: ESTABELECIMENTO,
    encontro: encontroBase(),
    contato: CONTATO_PORTA,
    profissional: PROFISSIONAL,
    condicoes: [condicaoBase()],
    procedimentos: [procedimentoBase()],
    observacoes: [
      observacaoBase({ id: 'obs-pas', conceito_nome: 'pressao-sistolica', loinc_codigo: '8480-6', valor_num: 128, unidade: 'mmHg', ref_min: 90, ref_max: 139 }),
      observacaoBase({ id: 'obs-pad', conceito_nome: 'pressao-diastolica', loinc_codigo: '8462-4', valor_num: 82, unidade: 'mmHg', ref_min: 60, ref_max: 89 }),
      // fora da lista da RNDS: não entram no documento
      observacaoBase(),
      observacaoBase({ id: 'obs-temp', conceito_nome: 'temperatura', loinc_codigo: '8310-5', valor_num: 37.1, unidade: '°C', ref_min: 36, ref_max: 37.8 }),
    ],
  }
}

/** Fixture 2 — porta da UPA com EVASÃO. */
export function fixtureComEvasao(): EntidadeAtendimentoRAC {
  return {
    paciente: PACIENTE_BASE,
    estabelecimento: ESTABELECIMENTO,
    encontro: encontroBase({ id: 'enc-0003', status: 'alta_evasao', data_alta: '2026-08-10T11:00:00Z', motivo_alta: 'Evasão do paciente' }),
    contato: { ...CONTATO_PORTA, desfecho: '04' },
    profissional: PROFISSIONAL,
    condicoes: [condicaoBase({ id: 'cond-0003', codigo_cid: 'A09', descricao: 'Gastroenterite e colite de origem não especificada', encontro_id: 'enc-0003' })],
    procedimentos: [procedimentoBase({ id: 'proc-0003', realizado_em: '2026-08-10T09:30:00Z' })],
    observacoes: [observacaoBase({ id: 'obs-0005', aferido_em: '2026-08-10T10:00:00Z' })],
  }
}

/** Fixture 3 — observação na UPA com alta para casa (Sumário de Alta). */
export function fixtureSumarioAltaParaCasa(): EntidadeSumarioAlta {
  return {
    paciente: PACIENTE_BASE,
    estabelecimento: ESTABELECIMENTO,
    encontro: encontroBase({ tipo_internacao: 'observacao' }),
    contato: CONTATO_PORTA,
    profissional: PROFISSIONAL,
    condicoes: [condicaoBase()],
    procedimentos: [procedimentoBase({ codigo_sigtap: '0301060029' })], // urgência com observação até 24 h
    resumo_evolucao: 'Observação por 6 h com sintomáticos. Melhora clínica. Retorno em 48 h se piora; manter hidratação.',
  }
}

/** Fixture 4 — observação na UPA com TRANSFERÊNCIA (Sumário de Alta). */
export function fixtureSumarioAltaTransferencia(): EntidadeSumarioAlta {
  return {
    paciente: PACIENTE_BASE,
    estabelecimento: ESTABELECIMENTO,
    encontro: encontroBase({
      id: 'enc-0002',
      status: 'transferencia_externa',
      tipo_internacao: 'observacao',
      data_alta: '2026-08-11T10:00:00Z',
      cid_principal: 'N17',
      motivo_alta: 'Transferência para hospital de referência',
    }),
    contato: { ...CONTATO_PORTA, desfecho: '09' },
    profissional: PROFISSIONAL,
    condicoes: [condicaoBase({ id: 'cond-0002', codigo_cid: 'N17', descricao: 'Insuficiência renal aguda', encontro_id: 'enc-0002' })],
    procedimentos: [procedimentoBase({ id: 'proc-0002', codigo_sigtap: '0301060029' })],
    resumo_evolucao: 'Creatinina em ascensão em 24 h de observação. Transferido para hospital de referência pela regulação.',
  }
}
