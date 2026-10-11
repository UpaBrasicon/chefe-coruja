// Exportação estruturada (Fase 3, tarefa 9; decisões do RT de 10/10/2026).
//
// O banco devolve as linhas no formato do contrato da API v1 (JSON), página
// por página (migration 20261105000001_exportacao_estruturada.sql). Aqui:
// - o JSON sai como veio, com um cabeçalho de contexto;
// - o CSV achata cada linha nas colunas abaixo, com o padrão de csv.ts.
import { gerarCsv, type ValorCsv } from './csv.ts'

export type Conjunto = 'atendimentos' | 'internacoes' | 'leitos' | 'pacientes' | 'documentos'
export type Formato = 'csv' | 'json'
type Linha = Record<string, unknown>

type Coluna = [rotulo: string, valor: (l: Linha) => ValorCsv]

const pac = (l: Linha) => (l.paciente ?? {}) as { id?: string; nome?: string; cns?: string }
const txt = (v: unknown): ValorCsv => (v == null ? null : typeof v === 'number' || typeof v === 'boolean' ? v : String(v))

export const CONJUNTOS: Record<Conjunto, { rotulo: string; descricao: string; comPeriodo: boolean; colunas: Coluna[] }> = {
  atendimentos: {
    rotulo: 'Atendimentos',
    descricao: 'Chegada, classificação de risco, situação, CID principal e desfecho de cada atendimento da porta.',
    comPeriodo: true,
    colunas: [
      ['id', (l) => txt(l.id)],
      ['paciente_id', (l) => txt(pac(l).id)],
      ['paciente_nome', (l) => txt(pac(l).nome)],
      ['paciente_cns', (l) => txt(pac(l).cns)],
      ['setor', (l) => txt(l.setor)],
      ['chegada_em', (l) => txt(l.chegada_em)],
      ['situacao', (l) => txt(l.situacao)],
      ['cor', (l) => txt((l.classificacao as { cor?: string } | null)?.cor)],
      ['classificada_em', (l) => txt((l.classificacao as { classificada_em?: string } | null)?.classificada_em)],
      ['atendimento_medico_em', (l) => txt(l.atendimento_medico_em)],
      ['cid_principal', (l) => txt(l.cid_principal)],
      ['desfecho', (l) => txt(l.desfecho)],
      ['desfecho_em', (l) => txt(l.desfecho_em)],
    ],
  },
  internacoes: {
    rotulo: 'Internações',
    descricao: 'Internações abertas em algum momento do período: setor, leito, admissão, alta, permanência e CIDs.',
    comPeriodo: true,
    colunas: [
      ['id', (l) => txt(l.id)],
      ['paciente_id', (l) => txt(pac(l).id)],
      ['paciente_nome', (l) => txt(pac(l).nome)],
      ['paciente_cns', (l) => txt(pac(l).cns)],
      ['atendimento_id', (l) => txt(l.atendimento_id)],
      ['setor', (l) => txt(l.setor)],
      ['leito', (l) => txt(l.leito)],
      ['tipo', (l) => txt(l.tipo)],
      ['origem', (l) => txt(l.origem)],
      ['status', (l) => txt(l.status)],
      ['admissao_em', (l) => txt(l.admissao_em)],
      ['alta_em', (l) => txt(l.alta_em)],
      ['permanencia_dias', (l) => (l.permanencia_dias == null ? null : Number(l.permanencia_dias))],
      ['cid_principal', (l) => txt(l.cid_principal)],
      ['cid_alta', (l) => txt(l.cid_alta)],
      ['motivo_alta', (l) => txt(l.motivo_alta)],
    ],
  },
  leitos: {
    rotulo: 'Leitos (situação agora)',
    descricao: 'Cada leito ativo com setor, tipo e situação no momento da exportação. O paciente aparece só pelo código interno.',
    comPeriodo: false,
    colunas: [
      ['id', (l) => txt(l.id)],
      ['setor', (l) => txt(l.setor)],
      ['identificador', (l) => txt(l.identificador)],
      ['tipo', (l) => txt(l.tipo)],
      ['status', (l) => txt(l.status)],
      ['paciente_id', (l) => txt(l.paciente_id)],
      ['ocupado_desde', (l) => txt(l.ocupado_desde)],
    ],
  },
  pacientes: {
    rotulo: 'Cadastro de pacientes',
    descricao: 'Pacientes cadastrados ou atendidos no período: identificação, sexo e município. Sem endereço, telefone ou nome da mãe.',
    comPeriodo: true,
    colunas: [
      ['id', (l) => txt(l.id)],
      ['nome', (l) => txt(l.nome)],
      ['nome_social', (l) => txt(l.nome_social)],
      ['nascimento', (l) => txt(l.nascimento)],
      ['sexo', (l) => txt(l.sexo)],
      ['cns', (l) => txt(l.cns)],
      ['cpf', (l) => txt(l.cpf)],
      ['municipio_ibge', (l) => txt(l.municipio_ibge)],
      ['municipio', (l) => txt(l.municipio)],
      ['uf', (l) => txt(l.uf)],
    ],
  },
  documentos: {
    rotulo: 'Lista de documentos',
    descricao: 'Documentos emitidos no período: tipo, número, versão, situação, autor e datas. O texto clínico não sai.',
    comPeriodo: true,
    colunas: [
      ['id', (l) => txt(l.id)],
      ['paciente_id', (l) => txt(pac(l).id)],
      ['paciente_nome', (l) => txt(pac(l).nome)],
      ['paciente_cns', (l) => txt(pac(l).cns)],
      ['atendimento_id', (l) => txt(l.atendimento_id)],
      ['internacao_id', (l) => txt(l.internacao_id)],
      ['tipo', (l) => txt(l.tipo)],
      ['numero', (l) => txt(l.numero)],
      ['versao', (l) => (l.versao == null ? null : Number(l.versao))],
      ['estado', (l) => txt(l.estado)],
      ['autor', (l) => txt(l.autor)],
      ['emitido_em', (l) => txt(l.emitido_em)],
      ['assinado_em', (l) => txt(l.assinado_em)],
      ['cancelado_em', (l) => txt(l.cancelado_em)],
    ],
  },
}

export type Contexto = {
  unidade: string
  conjunto: Conjunto
  desde: string | null
  ate: string | null
  mascarado: boolean
  geradoEm: string
  /** fuso das datas no CSV (IANA); o JSON fica em ISO 8601, como a API */
  fuso?: string
}

const ISO_DATA_HORA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/
const ISO_DATA = /^(\d{4})-(\d{2})-(\d{2})$/

/** No CSV, data e hora no formato do Excel pt-BR (dd/mm/aaaa hh:mm:ss) e no fuso pedido. */
export function dataParaCsv(v: ValorCsv, fuso: string): ValorCsv {
  if (typeof v !== 'string') return v
  const d = ISO_DATA.exec(v)
  if (d) return `${d[3]}/${d[2]}/${d[1]}`
  if (!ISO_DATA_HORA.test(v)) return v
  const t = new Date(v)
  if (Number.isNaN(t.getTime())) return v
  return t.toLocaleString('pt-BR', { timeZone: fuso, day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).replace(',', '')
}

/** Conteúdo do arquivo, no formato pedido. */
export function montarArquivo(formato: Formato, ctx: Contexto, linhas: Linha[]): string {
  const c = CONJUNTOS[ctx.conjunto]
  if (formato === 'json') {
    return JSON.stringify({
      unidade: ctx.unidade, conjunto: ctx.conjunto, periodo: c.comPeriodo ? { desde: ctx.desde, ate: ctx.ate } : null,
      mascarado: ctx.mascarado, gerado_em: ctx.geradoEm, linhas: linhas.length, dados: linhas,
    }, null, 2)
  }
  const fuso = ctx.fuso ?? 'America/Sao_Paulo'
  const periodo = c.comPeriodo ? `${dataParaCsv(ctx.desde, fuso)} a ${dataParaCsv(ctx.ate, fuso)}` : 'situação no momento da exportação'
  return gerarCsv(c.colunas.map(([r]) => r), linhas.map((l) => c.colunas.map(([, f]) => dataParaCsv(f(l), fuso))), {
    contexto: [
      ['Unidade', ctx.unidade],
      ['Conjunto', c.rotulo],
      ['Período', periodo],
      ['Dados do paciente', ctx.mascarado ? 'mascarados' : 'completos'],
      ['Gerado em', dataParaCsv(ctx.geradoEm, fuso)],
      ['Fuso das datas', fuso],
      ['Linhas', linhas.length],
    ],
  })
}

/** Nome do arquivo: conjunto_unidade_periodo.ext, sem acento. */
export function nomeArquivo(formato: Formato, ctx: Contexto): string {
  const base = [ctx.conjunto, ctx.unidade, CONJUNTOS[ctx.conjunto].comPeriodo ? `${ctx.desde}_a_${ctx.ate}` : ctx.geradoEm.slice(0, 10),
    ctx.mascarado ? '' : 'completo']
    .filter(Boolean).join('_')
  const limpo = base.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  return `${limpo}.${formato}`
}

/** Período válido: fim ≥ início e até 12 meses (o banco confere de novo). */
export function erroPeriodo(desde: string, ate: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(ate)) return 'Informe o início e o fim.'
  if (ate < desde) return 'O fim vem antes do início.'
  const [a, m, d] = desde.split('-').map(Number)
  const limite = new Date(Date.UTC(a, m - 1 + 12, d)).toISOString().slice(0, 10)
  if (ate >= limite) return 'O período vai até 12 meses.'
  return null
}
