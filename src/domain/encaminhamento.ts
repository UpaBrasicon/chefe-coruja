// Envio da UBS à UPA e acompanhamento (5A, tarefa 5; decisões H1 a H5 e
// opção C da tela "Encaminhados", RT em 03/11/2026). Tipos do retorno das RPCs
// encaminhamentos_upa_* (migration 20270216000001_encaminhamento_upa.sql), as
// etapas do rastreio e o atalho da regulação a partir da consulta.

export type SituacaoEnvio = 'enviado' | 'chegou' | 'nao_chegou' | 'cancelado'

export type EnvioUpa = {
  id: string
  numero: number
  situacao: SituacaoEnvio
  motivo: string
  resumo: {
    paciente: { nome: string; nome_social: string | null; data_nascimento: string | null; sexo: string | null; cns: string | null; cpf: string | null; nome_mae: string | null }
    queixa: string | null
    tipo_atendimento: string | null
    prioridades_legais: string[] | null
    cor_escuta: string | null
    soap: { subjetivo: string | null; objetivo: string | null; avaliacao: string | null; plano: string | null; cid: string | null; em: string } | null
    sinais: Record<string, number> | null
    sinais_em: string | null
  }
  unidade_origem_id: string
  unidade_origem: string
  unidade_destino_id: string
  unidade_destino: string
  episodio_origem_id: string
  paciente_id: string
  enviado_por: string | null
  enviado_em: string
  prazo_em: string
  chegada_por: string | null
  chegada_em: string | null
  episodio_destino_id: string | null
  observacao_chegada: string | null
  cancelado_em: string | null
  motivo_cancelamento: string | null
}

export const SITUACAO_ENVIO: Record<SituacaoEnvio, { rotulo: string; tom: 'ambar' | 'verde' | 'vermelho' | 'cinza' }> = {
  enviado: { rotulo: 'Enviado', tom: 'ambar' },
  chegou: { rotulo: 'Chegou', tom: 'verde' },
  nao_chegou: { rotulo: 'Não chegou', tom: 'vermelho' },
  cancelado: { rotulo: 'Cancelado', tom: 'cinza' },
}

export const nomeDoEnvio = (e: Pick<EnvioUpa, 'resumo'>) => e.resumo.paciente.nome_social || e.resumo.paciente.nome

export type Etapa = { titulo: string; detalhe: string; estado: 'feita' | 'atual' | 'falta' | 'falhou' }

/** As etapas do rastreio (opção C): enviado → aguardando a chegada → chegou
 *  (ou não chegou / cancelado). `fmt` formata data e hora para a tela. */
export function etapasDoEnvio(e: EnvioUpa, fmt: (iso: string) => string): Etapa[] {
  const enviado: Etapa = { titulo: 'Enviado', detalhe: `${fmt(e.enviado_em)}${e.enviado_por ? ` · ${e.enviado_por}` : ''} · a ${e.unidade_destino} foi avisada`, estado: 'feita' }
  if (e.situacao === 'cancelado') {
    return [enviado, { titulo: 'Cancelado', detalhe: `${e.cancelado_em ? fmt(e.cancelado_em) : ''} · ${e.motivo_cancelamento ?? ''}`, estado: 'falhou' }]
  }
  if (e.situacao === 'enviado') {
    return [enviado,
      { titulo: 'Aguardando a chegada', detalhe: `prazo até ${fmt(e.prazo_em)} (12 h)`, estado: 'atual' },
      { titulo: `Chegou à ${e.unidade_destino}`, detalhe: 'quando a recepção da UPA registrar a chegada', estado: 'falta' }]
  }
  if (e.situacao === 'chegou') {
    return [enviado, { titulo: 'Aguardando a chegada', detalhe: 'concluído', estado: 'feita' },
      { titulo: `Chegou à ${e.unidade_destino}`, detalhe: `${e.chegada_em ? fmt(e.chegada_em) : ''}${e.chegada_por ? ` · ${e.chegada_por}` : ''}${e.observacao_chegada ? ` · ${e.observacao_chegada}` : ''}`, estado: 'feita' }]
  }
  return [enviado, { titulo: 'Aguardando a chegada', detalhe: `prazo até ${fmt(e.prazo_em)} (12 h)`, estado: 'feita' },
    { titulo: `Não chegou à ${e.unidade_destino}`, detalhe: e.observacao_chegada ?? '', estado: 'falhou' }]
}

/** H2: a regulação aberta a partir da consulta, já com o paciente, o tipo, o
 *  CID e o quadro (o episódio aberto se liga sozinho no formulário). */
export function linkRegulacaoDaConsulta(p: { paciente: string; tipo: 'consulta' | 'exame' | 'leito'; cid?: string | null; quadro?: string | null; hipotese?: string | null }) {
  const q = new URLSearchParams({ paciente: p.paciente, tipo: p.tipo })
  if (p.cid) q.set('cid', p.cid)
  if (p.quadro) q.set('quadro', p.quadro)
  if (p.hipotese) q.set('hipotese', p.hipotese)
  return `/regulacao?${q}`
}
