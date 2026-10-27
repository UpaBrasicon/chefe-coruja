// Envio ao ERP (Fase 5C, tarefa 3, etapa 3.4): formatos das RPCs da tela, a
// situação de cada versão para quem confere, o resumo dos plantões por
// profissional e o arquivo CSV/JSON (o mesmo conteúdo que o ERP recebe pela
// API). Quem decide é o servidor; aqui só se escolhe o que mostrar.

import { gerarCsv, type ValorCsv } from './csv.ts'
import { data, dataHora } from './formato.ts'

export type Conciliacao = 'pendente' | 'conciliada' | 'divergente' | 'estornada'
export type RetornoErp = { erp_id: string | null; recebida_em: string; valor_lancado: number | null; em: string } | null

export type ItemErp = {
  origem: string; procedimento: string; nome: string | null; quantidade: number; realizado_em: string | null
  competencia: string | null; valor_unitario: number | null; valor_total: number | null; faturavel: boolean
}
export type MedicamentoErp = {
  medicamento: string; unidade_consumo: string | null; dispensado: number; devolvido: number; liquido: number; administrado: number; fora_da_conta: boolean
}
export type GlosaErp = { id: string; item: string; competencia: string; valor: number; motivo: string; situacao: string; valor_recuperado: number | null }

/** Versão da conta (erp_contas_da_unidade / API `VersaoConta`). */
export type VersaoConta = {
  id: string; conta_id: string; numero: string; tipo: 'ambulatorial' | 'internacao'; pagador: string
  unidade: { id: string; nome: string; cnes: string | null }; prontuario: string | null; conta_origem: string | null
  atendimento_inicio: string | null; atendimento_fim: string | null; fechada_em: string | null; faturada_em: string
  versao: number; situacao: 'vigente' | 'substituida'; total: number; total_referencia: number
  itens: ItemErp[]; medicamentos: MedicamentoErp[]; glosas: GlosaErp[]
  gerada_em: string; substituida_em: string | null; alterada_em: string; conciliacao: Conciliacao; retorno: RetornoErp
}

export type LinhaPlantao = {
  plantao_id: string; data: string; turno: string; setor: { id: string; nome: string }; inicio: string; duracao_min: number; fracionado: boolean
  profissional: { id: string; nome: string; cpf: string | null; conselho: string | null; registro: string | null; registro_uf: string | null; cbo: string | null }
  checkin_em: string | null; checkout_em: string | null; checkout_automatico: boolean; minutos_presentes: number | null
  situacao: 'realizado' | 'falta_justificada' | 'sem_presenca'; tipo_falta: string | null; valor_referencia: number | null; valor: number | null
}
export type TotaisPlantoes = {
  plantoes: number; realizados: number; faltas_justificadas: number; sem_presenca: number; realizados_sem_valor: number; sem_checkout: number
}
/** Versão dos plantões do mês (erp_baixar / API `VersaoPlantoes`). */
export type VersaoPlantoes = {
  id: string; unidade: { id: string; nome: string; cnes: string | null }; competencia: string; versao: number; situacao: 'vigente' | 'substituida'
  plantoes: LinhaPlantao[]; totais: TotaisPlantoes; total: number
  gerada_em: string; substituida_em: string | null; alterada_em: string; conciliacao: Conciliacao; retorno: RetornoErp
}
/** Prévia do mês (plantoes_erp_previa). */
export type PreviaPlantoes = {
  competencia: string; plantoes: LinhaPlantao[]; totais: TotaisPlantoes; total: number; mes_encerrado: boolean; fechado: boolean
  versoes: { versao: number; situacao: 'vigente' | 'substituida'; total: number; gerada_em: string; gerada_por: string | null
    substituida_em: string | null; substituida_por: string | null; motivo_reabertura: string | null; conciliacao: Conciliacao; valor_lancado: number | null }[]
}

// ── situação para quem confere ──────────────────────────────────────────────
export type SituacaoErp = 'aguardando' | 'divergente' | 'estornar' | 'conciliada' | 'estornada' | 'substituida'

/** O que a versão pede: a substituída que o ERP já lançou precisa ser estornada lá. */
export function situacaoErp(v: { situacao: 'vigente' | 'substituida'; conciliacao: Conciliacao; retorno: RetornoErp }): SituacaoErp {
  if (v.situacao === 'substituida') {
    if (v.conciliacao === 'estornada') return 'estornada'
    return v.retorno && (v.conciliacao === 'conciliada' || v.conciliacao === 'divergente') ? 'estornar' : 'substituida'
  }
  return v.conciliacao === 'pendente' ? 'aguardando' : v.conciliacao === 'divergente' ? 'divergente' : 'conciliada'
}
export const ROTULO_SITUACAO: Record<SituacaoErp, string> = {
  aguardando: 'Aguardando o ERP', divergente: 'Divergente', estornar: 'Estornar no ERP',
  conciliada: 'Conciliada', estornada: 'Estornada', substituida: 'Substituída',
}
export const VARIANTE_SITUACAO: Record<SituacaoErp, 'secondary' | 'destructive' | 'warning' | 'success' | 'outline'> = {
  aguardando: 'secondary', divergente: 'destructive', estornar: 'warning', conciliada: 'success', estornada: 'outline', substituida: 'outline',
}
/** Ordem dos filtros: primeiro o que pede ação. */
export const FILTROS_SITUACAO: SituacaoErp[] = ['aguardando', 'divergente', 'estornar', 'conciliada']
export const ROTULO_FILTRO: Partial<Record<SituacaoErp, string>> = {
  aguardando: 'aguardando o ERP', divergente: 'divergente', estornar: 'estornar no ERP', conciliada: 'conciliada',
}

/** "1 plantão sem presença vai" / "2 plantões sem presença vão". */
export const plantoesSemPresenca = (n: number) => (n === 1 ? '1 plantão sem presença vai' : `${n} plantões sem presença vão`)

export const contarSituacoes = (vs: VersaoConta[]) =>
  vs.reduce((n, v) => { const s = situacaoErp(v); n[s] = (n[s] ?? 0) + 1; return n }, {} as Partial<Record<SituacaoErp, number>>)

/** "09/2026": a competência dos itens (a do primeiro faturável), senão o mês do faturamento. */
export function competenciaDaVersao(v: Pick<VersaoConta, 'itens' | 'faturada_em'>): string {
  const c = v.itens.find((i) => i.faturavel && i.competencia)?.competencia ?? v.itens.find((i) => i.competencia)?.competencia
  if (c) return `${c.slice(4, 6)}/${c.slice(0, 4)}`
  return data(v.faturada_em).slice(3)
}
export const competenciaRotulo = (c: string) => `${c.slice(4, 6)}/${c.slice(0, 4)}`

// ── plantões por profissional ───────────────────────────────────────────────
export type ResumoProfissional = {
  id: string; nome: string; conselho: string | null; plantoes: number; realizados: number; faltas: number
  semPresenca: number; semCheckout: number; minutos: number; valor: number; semValor: number
}

export function porProfissional(linhas: LinhaPlantao[]): ResumoProfissional[] {
  const m = new Map<string, ResumoProfissional>()
  for (const l of linhas) {
    const p = l.profissional
    const r = m.get(p.id) ?? {
      id: p.id, nome: p.nome,
      conselho: p.conselho && p.registro ? `${p.conselho} ${p.registro}${p.registro_uf ? '/' + p.registro_uf : ''}` : null,
      plantoes: 0, realizados: 0, faltas: 0, semPresenca: 0, semCheckout: 0, minutos: 0, valor: 0, semValor: 0,
    }
    r.plantoes++
    if (l.situacao === 'realizado') {
      r.realizados++
      if (!l.checkout_em) r.semCheckout++
      r.minutos += l.minutos_presentes ?? 0
      if (l.valor_referencia == null) r.semValor++
    } else if (l.situacao === 'falta_justificada') r.faltas++
    else r.semPresenca++
    r.valor += l.valor ?? 0
    m.set(p.id, r)
  }
  return [...m.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

/** "72 h" ou "71 h 30 min". */
export function horas(minutos: number): string {
  const h = Math.floor(minutos / 60)
  const min = Math.round(minutos % 60)
  return min ? `${h} h ${min} min` : `${h} h`
}

// ── arquivo ─────────────────────────────────────────────────────────────────
export type Formato = 'csv' | 'json'
const dh = (v: string | null | undefined) => (v ? dataHora(v) : null)

/** Uma linha por procedimento e uma por medicamento de cada versão. */
export function csvContas(vs: VersaoConta[], unidade: string, geradoEm: string): string {
  const linhas: ValorCsv[][] = []
  for (const v of vs) {
    const base: ValorCsv[] = [v.numero, v.tipo === 'internacao' ? 'internação' : 'porta', v.prontuario, v.versao, v.situacao, v.conciliacao,
      v.total, v.retorno?.valor_lancado ?? null, v.retorno?.erp_id ?? null, dh(v.faturada_em)]
    for (const i of v.itens) {
      linhas.push([...base, 'procedimento', i.competencia, i.procedimento, i.nome, i.quantidade, i.valor_unitario, i.valor_total, i.faturavel])
    }
    for (const m of v.medicamentos) {
      linhas.push([...base, 'medicamento', null, null, m.medicamento, m.liquido, null, null, !m.fora_da_conta])
    }
  }
  return gerarCsv(
    ['conta', 'tipo', 'prontuario', 'versao', 'situacao', 'conciliacao', 'total_versao', 'lancado_erp', 'erp_id', 'faturada_em',
      'linha', 'competencia', 'procedimento', 'nome', 'quantidade', 'valor_unitario', 'valor_total', 'faturavel'],
    linhas, { contexto: [['Unidade', unidade], ['Conteúdo', 'versões das contas para o ERP'], ['Gerado em', geradoEm]] })
}

/** Uma linha por plantão de cada versão do mês. */
export function csvPlantoes(vs: VersaoPlantoes[], unidade: string, geradoEm: string): string {
  const linhas: ValorCsv[][] = []
  for (const v of vs) {
    for (const l of v.plantoes) {
      const p = l.profissional
      linhas.push([v.competencia, v.versao, v.situacao, v.conciliacao, p.nome, p.cpf, p.conselho, p.registro, p.registro_uf, p.cbo,
        data(l.data + 'T12:00:00Z'), l.turno, l.setor.nome, dh(l.inicio), l.duracao_min, l.fracionado, dh(l.checkin_em), dh(l.checkout_em),
        l.minutos_presentes, l.situacao, l.tipo_falta, l.valor_referencia, l.valor])
    }
  }
  return gerarCsv(
    ['competencia', 'versao', 'situacao_versao', 'conciliacao', 'profissional', 'cpf', 'conselho', 'registro', 'registro_uf', 'cbo',
      'data', 'turno', 'setor', 'inicio', 'duracao_min', 'fracionado', 'entrada', 'saida', 'minutos_presentes', 'situacao', 'tipo_falta',
      'valor_referencia', 'valor'],
    linhas, { contexto: [['Unidade', unidade], ['Conteúdo', 'plantões do mês para o ERP'], ['Gerado em', geradoEm]] })
}

export function nomeArquivoErp(conjunto: 'contas' | 'plantoes', formato: Formato, dia: string, competencia?: string): string {
  return `erp_${conjunto}${competencia ? '_' + competencia : ''}_${dia}.${formato}`
}

export function baixarArquivo(nome: string, conteudo: string, formato: Formato): void {
  const tipo = formato === 'csv' ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8'
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }))
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  a.click()
  URL.revokeObjectURL(url)
}
