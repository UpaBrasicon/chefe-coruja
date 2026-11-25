// Internação do NIR pelo modelo do RT (25/11/2026), NIR1 a NIR5: as contas da
// tela. Filtros da lista (Ação NIR, Cobrar médico, Vaga / remoção, Sem
// regulação), o sinal principal de cada linha, a navegação J/K, os
// indicadores das abas Pendências com médicos e Mapa de leitos e os textos
// copiados para o WhatsApp / plantão — estes SEM o nome do paciente (LGPD):
// leito, nº do pedido, setor e a pendência.
// Tipos das RPCs regulacao_pendencias_da_unidade, nir_medicos_do_setor e
// nir_mapa_leitos (migration 20270425000030).
// node --experimental-strip-types --test src/lib/nirPainel.test.ts

import { STATUS, TRANSPORTES, type StatusRegulacao } from './regulacao.ts'
import { esperaAOrigem, rotuloAguardando, separarParaNir, type PacienteRegulacao, type PedidoResumo } from './regulacaoPaciente.ts'
import { tempoSemEvolucao } from './tempoSemEvolucao.ts'

export type MotivoPendencia = 'evolucao' | 'exame' | 'isolamento' | 'duvida' | 'outro'
export type StatusPendencia = 'pendente' | 'medico_avisado' | 'resolvida'
export type Pessoa = { id: string; nome: string }

export type PendenciaUnidade = {
  id: string; solicitacao_id: string; numero: number; pedido_status: StatusRegulacao
  paciente: { id: string; nome: string; nascimento: string | null }
  setor: { id: string; nome: string } | null; leito: string | null
  dono: 'medico' | 'nir'; motivo: MotivoPendencia; titulo: string; urgencia: 'alta' | 'normal'; status: StatusPendencia
  responsaveis: Pessoa[]; criada_em: string; criada_por: string | null
  avisado_em: string | null; avisos: number
  resolvida_em: string | null; resolvida_por: string | null; resolucao: string | null
}

export type LeitoMapa = { id: string; identificador: string; tipo: string; status: string; paciente_id: string | null }
export type SetorMapa = { id: string; nome: string; medicos: Pessoa[]; leitos: LeitoMapa[] }
export type MapaLeitos = { setores: SetorMapa[]; internados: { paciente_id: string; sexo: string | null; isolamento: string[] }[] }

/** Motivos de 1 clique do "Avisar médico" (NIR2): o texto pronto e o rótulo do botão. */
export const MOTIVOS: Record<Exclude<MotivoPendencia, 'outro'>, { botao: string; texto: string }> = {
  evolucao: { botao: 'Atualizar evolução', texto: 'Atualizar a evolução clínica do pedido de regulação' },
  exame: { botao: 'Exame pendente', texto: 'Solicitar ou liberar o exame pendente pedido pela central' },
  isolamento: { botao: 'Reavaliar isolamento', texto: 'Reavaliar o critério de isolamento do paciente' },
  duvida: { botao: 'Responder dúvida da central', texto: 'Responder a dúvida clínica da central de regulação' },
}

export const STATUS_PENDENCIA: Record<StatusPendencia, string> = {
  pendente: 'Pendente', medico_avisado: 'Médico avisado', resolvida: 'Resolvida',
}

/** Mensagens prontas da conversa com a central (1 clique; o NIR revisa antes de enviar). */
export const MENSAGENS_PRONTAS = [
  { rotulo: 'Exame anexado', texto: 'Exame solicitado anexado ao pedido de regulação.' },
  { rotulo: 'Médico acionado', texto: 'Médico de plantão acionado pelo NIR para responder à central.' },
  { rotulo: 'Estável aguardando transporte', texto: 'Paciente estável na unidade, aguardando o transporte para o destino.' },
] as const

/** Vaga com destino: o paciente vai sair (ou já saiu). */
export const STATUS_VAGA: readonly StatusRegulacao[] = ['autorizada', 'agendada', 'em_transito']

export type FiltroNir = 'todos' | 'acao_nir' | 'cobrar_medico' | 'vaga_remocao' | 'sem_regulacao'
export const FILTROS: readonly (readonly [FiltroNir, string])[] = [
  ['todos', 'Todos'], ['acao_nir', 'Ação NIR'], ['cobrar_medico', 'Cobrar médico'],
  ['vaga_remocao', 'Vaga / remoção'], ['sem_regulacao', 'Sem regulação'],
]

export const pedidosAbertos = (l: Pick<PacienteRegulacao, 'pedidos'>) => l.pedidos.filter((p) => p.em_aberto)
/** O pedido que a linha mostra: o primeiro em aberto. */
export const pedidoPrincipal = (l: Pick<PacienteRegulacao, 'pedidos'>): PedidoResumo | null => pedidosAbertos(l)[0] ?? null

/** Pendências abertas (não resolvidas) dos pedidos do paciente. */
export function pendenciasAbertas(l: Pick<PacienteRegulacao, 'pedidos'>, pend: readonly PendenciaUnidade[]): PendenciaUnidade[] {
  const ids = new Set(l.pedidos.map((p) => p.id))
  return pend.filter((x) => x.status !== 'resolvida' && ids.has(x.solicitacao_id))
}

/** Horas desde a última evolução do pedido (o relógio da central), ou null. */
export function horasSemEvolucao(p: Pick<PedidoResumo, 'sla'>, agora: number): number | null {
  const ult = p.sla?.evolucao?.ultima_em
  if (!ult) return null
  return Math.max(0, Math.floor((agora - Date.parse(ult)) / 3_600_000))
}

/** A central espera a unidade (pergunta, devolução, mensagem sem resposta) ou há pendência aberta do NIR. */
export function precisaAcaoNir(l: PacienteRegulacao, pend: readonly PendenciaUnidade[]): boolean {
  return pedidosAbertos(l).some(esperaAOrigem) || pendenciasAbertas(l, pend).some((x) => x.dono === 'nir')
}

/** Evolução vencida (fora da vaga já autorizada) ou pendência aberta com o médico. */
export function precisaCobrarMedico(l: PacienteRegulacao, pend: readonly PendenciaUnidade[]): boolean {
  return pedidosAbertos(l).some((p) => !STATUS_VAGA.includes(p.status) && !!p.sla?.evolucao?.atrasada)
    || pendenciasAbertas(l, pend).some((x) => x.dono === 'medico')
}

export const temVaga = (l: Pick<PacienteRegulacao, 'pedidos'>) => pedidosAbertos(l).some((p) => STATUS_VAGA.includes(p.status))
export const semRegulacao = (l: Pick<PacienteRegulacao, 'pedidos'>) => pedidosAbertos(l).length === 0
/** Algum pedido em aberto com risco de cancelamento por falta de evolução (72 h). */
export const emRisco72h = (l: Pick<PacienteRegulacao, 'pedidos'>) => pedidosAbertos(l).some((p) => !!p.sla?.evolucao?.risco_cancelamento)

export function passaNoFiltro(l: PacienteRegulacao, pend: readonly PendenciaUnidade[], f: FiltroNir): boolean {
  switch (f) {
    case 'acao_nir': return precisaAcaoNir(l, pend)
    case 'cobrar_medico': return precisaCobrarMedico(l, pend)
    case 'vaga_remocao': return temVaga(l)
    case 'sem_regulacao': return semRegulacao(l)
    default: return true
  }
}

export function contagens(lista: PacienteRegulacao[], pend: readonly PendenciaUnidade[]): Record<FiltroNir, number> {
  return Object.fromEntries(FILTROS.map(([f]) => [f, lista.filter((l) => passaNoFiltro(l, pend, f)).length])) as Record<FiltroNir, number>
}

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Busca por leito, paciente, nº do pedido, CID, setor ou médico (os nomes de médicos vêm do mapa). */
export function casaBusca(l: PacienteRegulacao, busca: string, medicos: readonly string[] = []): boolean {
  const q = semAcento(busca.trim().replace(/^(n[ºo°]?|#)\s*(?=\d)/i, ''))
  if (!q) return true
  const campos = [l.leito, l.paciente.nome, l.setor?.nome, ...medicos,
    ...l.pedidos.flatMap((p) => [String(p.numero), p.cid])]
  return campos.some((c) => !!c && semAcento(c).includes(q))
}

export type OpcoesLista = { busca: string; setor: string; filtro: FiltroNir; medicosPorSetor?: Record<string, string[]> }

/** A lista da coluna da esquerda, na ordem do NIR: em regulação (prazo vencido no topo) e, no fim, sem regulação. */
export function listaNir(lista: PacienteRegulacao[], pend: readonly PendenciaUnidade[], o: OpcoesLista): { comRegulacao: PacienteRegulacao[]; semRegulacao: PacienteRegulacao[] } {
  const filtrada = lista.filter((l) => (!o.setor || l.setor?.id === o.setor) && passaNoFiltro(l, pend, o.filtro)
    && casaBusca(l, o.busca, (l.setor && o.medicosPorSetor?.[l.setor.id]) || []))
  const { emRegulacao, semRegulacao: sem } = separarParaNir(filtrada)
  return { comRegulacao: emRegulacao, semRegulacao: sem }
}

/** Ids na ordem da tela (J/K e setas); sem regulação só quando o grupo está aberto. */
export function idsNavegaveis(g: ReturnType<typeof listaNir>, semRegAberto: boolean): string[] {
  return [...g.comRegulacao, ...(semRegAberto ? g.semRegulacao : [])].map((l) => l.paciente.id)
}

/** O próximo (delta 1) ou o anterior (delta -1); sem seleção, o primeiro. */
export function vizinho(ids: readonly string[], atual: string | null, delta: 1 | -1): string | null {
  if (ids.length === 0) return null
  const i = atual ? ids.indexOf(atual) : -1
  if (i < 0) return ids[0]
  return ids[Math.min(ids.length - 1, Math.max(0, i + delta))]
}

export type Tom = 'sucesso' | 'info' | 'critico' | 'atencao' | 'neutro'
export type Sinal = { texto: string; tom: Tom }

/** O sinal principal da linha: destino e transporte, o que a central pediu, as horas sem evolução. */
export function sinalPrincipal(l: PacienteRegulacao, pend: readonly PendenciaUnidade[], agora: number): Sinal {
  const p = pedidoPrincipal(l)
  if (!p) return { texto: 'Sem regulação', tom: 'neutro' }
  const vaga = pedidosAbertos(l).find((x) => STATUS_VAGA.includes(x.status))
  if (vaga) {
    const transporte = vaga.transporte ? TRANSPORTES[vaga.transporte] ?? vaga.transporte : 'transporte a acionar'
    const destino = vaga.destino ?? 'destino a confirmar'
    return { texto: vaga.status === 'em_transito' ? `${destino} · paciente saiu` : `${destino} · ${transporte}`, tom: 'sucesso' }
  }
  const espera = pedidosAbertos(l).find(esperaAOrigem)
  if (espera) {
    const a = espera.conversa.aguardando[espera.conversa.aguardando.length - 1]
    const texto = espera.status === 'pendencia' && espera.pendencia_pergunta ? `Pergunta da central: ${espera.pendencia_pergunta}`
      : espera.status === 'devolvida' ? `Devolvido para correção${espera.motivo_devolucao ? `: ${espera.motivo_devolucao}` : ''}`
        : a ? `${rotuloAguardando(a)}: ${a.texto}` : 'A central espera a unidade'
    return { texto, tom: 'info' }
  }
  const nir = pendenciasAbertas(l, pend).find((x) => x.dono === 'nir')
  if (nir) return { texto: nir.titulo, tom: 'info' }
  const h = horasSemEvolucao(p, agora)
  if (p.sla?.evolucao?.risco_cancelamento) return { texto: `${tempoSemEvolucao(h)} sem evolução · risco de cancelamento`, tom: 'critico' }
  if (p.sla?.evolucao?.atrasada) return { texto: `${tempoSemEvolucao(h)} sem evolução (vencida)`, tom: 'atencao' }
  return { texto: STATUS[p.status], tom: 'neutro' }
}

/** Gravidade da linha (a faixa da esquerda). */
export function gravidade(l: PacienteRegulacao, pend: readonly PendenciaUnidade[], agora: number): Tom {
  return sinalPrincipal(l, pend, agora).tom
}

// ── textos copiados (LGPD: sem o nome do paciente) ──────────────────────────

export type DadosCopia = { leito: string | null; numero: number | null; setor: string | null; pendencia: string; medico?: string | null }

/** "[NIR] Leito OBS-01 (Observação) · Regulação nº 12 — Para: Dr. X — Atualizar evolução." Sem o nome do paciente. */
export function textoParaWhatsApp(d: DadosCopia): string {
  const onde = [d.leito ? `Leito ${d.leito}` : 'Sem leito', d.setor ? `(${d.setor})` : null].filter(Boolean).join(' ')
  const pedido = d.numero != null ? ` · Regulação nº ${d.numero}` : ''
  const para = d.medico?.trim() ? ` — Para: ${d.medico.trim()}` : ''
  const pend = d.pendencia.trim().replace(/[.;\s]+$/, '')
  return `[NIR] ${onde}${pedido}${para} — ${pend}.`
}

/** Resumo do plantão: uma linha por pendência aberta com o médico, sem o nome do paciente. */
export function resumoDoPlantao(pend: readonly PendenciaUnidade[], quando: string): string {
  const abertas = pend.filter((x) => x.status !== 'resolvida' && x.dono === 'medico')
  if (abertas.length === 0) return ''
  return [
    `NIR — pendências com médicos (${quando})`,
    ...abertas.map((x) => `• ${x.leito ?? 'Sem leito'}${x.setor ? ` (${x.setor.nome})` : ''} | Reg. nº ${x.numero} | `
      + `${x.responsaveis.map((r) => r.nome).join(', ') || 'Médico de plantão'}: ${x.titulo} [${STATUS_PENDENCIA[x.status]}]`),
  ].join('\n')
}

// ── indicadores ─────────────────────────────────────────────────────────────

/**
 * NI4 (revisão unslop, RT 25/11/2026): a janela das resolvidas é a mesma no
 * número e no filtro, a da RPC regulacao_pendencias_da_unidade (24 h).
 */
export const HORAS_RESOLVIDAS = 24

export function indicadoresPendencias(pend: readonly PendenciaUnidade[], lista: PacienteRegulacao[], agora: number) {
  const doMedico = pend.filter((x) => x.dono === 'medico')
  return {
    abertas: doMedico.filter((x) => x.status !== 'resolvida').length,
    avisados: doMedico.filter((x) => x.status === 'medico_avisado').length,
    risco72h: lista.filter(emRisco72h).length,
    resolvidas: doMedico.filter((x) => x.status === 'resolvida' && !!x.resolvida_em
      && agora - Date.parse(x.resolvida_em) <= HORAS_RESOLVIDAS * 3_600_000).length,
  }
}

/**
 * NI4: tempo desde um instante no mesmo formato da tela inteira: "42 min",
 * "4 h 42 min", "2 d 3 h" (no lugar de "há 4h42").
 */
export function tempoDesde(desde: string, agora: number): string {
  const min = Math.max(0, Math.floor((agora - Date.parse(desde)) / 60_000))
  if (!Number.isFinite(min)) return '—'
  if (min < 1) return 'menos de 1 min'
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  if (h < 48) return min % 60 ? `${h} h ${min % 60} min` : `${h} h`
  return tempoSemEvolucao(h)
}

export type LinhaMapa = { setor: SetorMapa; leito: LeitoMapa; paciente: PacienteRegulacao | null }

/** Leito ocupado: tem internado ou está marcado como ocupado. */
export const leitoOcupado = (x: Pick<LinhaMapa, 'leito' | 'paciente'>) => !!x.paciente || !!x.leito.paciente_id || x.leito.status === 'ocupado'

/** Os leitos do mapa com o paciente da lista da regulação (pelo id do internado). */
export function linhasDoMapa(mapa: MapaLeitos, lista: PacienteRegulacao[]): LinhaMapa[] {
  const porId = new Map(lista.map((l) => [l.paciente.id, l]))
  return mapa.setores.flatMap((setor) => setor.leitos.map((leito) => ({
    setor, leito, paciente: leito.paciente_id ? porId.get(leito.paciente_id) ?? null : null,
  })))
}

/**
 * Indicadores do mapa. NI5 (revisão unslop, RT 25/11/2026): "em regulação" e
 * "sem regulação" contam PACIENTES, os mesmos do painel: os dos leitos e os
 * internados sem leito (internação ativa sem leito_atual_id: o painel lista,
 * o mapa não tem onde pôr; eram 2 na UPA Homologação em 25/11). `semLeito`
 * diz quantos são. Leito marcado como ocupado sem internado conta na
 * ocupação, não como paciente.
 */
export function indicadoresMapa(linhas: LinhaMapa[], lista: readonly PacienteRegulacao[] = []) {
  const ocupados = linhas.filter(leitoOcupado)
  const livres = linhas.filter((x) => !leitoOcupado(x) && x.leito.status === 'livre').length
  const noLeito = new Set(linhas.flatMap((x) => (x.paciente ? [x.paciente.paciente.id] : [])))
  const pacientes = [...linhas.flatMap((x) => (x.paciente ? [x.paciente] : [])), ...lista.filter((l) => !noLeito.has(l.paciente.id))]
  const emReg = pacientes.filter((l) => !semRegulacao(l)).length
  return {
    total: linhas.length, ocupados: ocupados.length, livres,
    ocupacao: linhas.length ? Math.round((ocupados.length / linhas.length) * 100) : 0,
    emRegulacao: emReg, semRegulacao: pacientes.length - emReg,
    comVaga: pacientes.filter(temVaga).length,
    semLeito: pacientes.length - noLeito.size,
  }
}

/** NI5: o estado do leito, na coluna Leito do mapa (Ocupado, Higienização, Livre, Bloqueado…). */
export function estadoDoLeito(x: Pick<LinhaMapa, 'leito' | 'paciente'>): string {
  if (leitoOcupado(x)) return 'Ocupado'
  return ROTULO_LEITO[x.leito.status] ?? x.leito.status
}

/** O que o mapa diz do leito do paciente: médicos de plantão no setor, isolamento ativo e sexo. */
export type ContextoLeito = { medicos: Pessoa[]; isolamento: string[]; sexo: string | null }
export function contextoDoLeito(mapa: MapaLeitos | undefined, l: Pick<PacienteRegulacao, 'paciente' | 'setor'>): ContextoLeito {
  const setor = mapa?.setores.find((s) => s.id === l.setor?.id)
  const i = mapa?.internados.find((x) => x.paciente_id === l.paciente.id)
  return { medicos: setor?.medicos ?? [], isolamento: i?.isolamento ?? [], sexo: i?.sexo ?? null }
}

export const ROTULO_LEITO: Record<string, string> = {
  livre: 'Livre', ocupado: 'Ocupado', bloqueado: 'Bloqueado', higienizacao: 'Higienização', reservado: 'Reservado',
}

/** "Contato e aerossol" a partir dos tipos ativos. */
export function rotuloIsolamento(tipos: readonly string[] | null | undefined): string | null {
  if (!tipos || tipos.length === 0) return null
  const nomes = tipos.map((t) => (t === 'goticula' ? 'gotícula' : t))
  const txt = nomes.length === 1 ? nomes[0] : `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`
  return `Isolamento: ${txt}`
}

/** Etiqueta curta da lista, em caixa de frase (NI1): "Isolamento: contato", "Isolamento: aerossol + gotícula". */
export function etiquetaIsolamento(tipos: readonly string[] | null | undefined): string | null {
  if (!tipos || tipos.length === 0) return null
  return `Isolamento: ${tipos.map((t) => (t === 'goticula' ? 'gotícula' : t)).join(' + ')}`
}

/** Rótulo da evolução do pedido: "Evolução (versão 3) — atualizada pelo NIR, Fulana". */
export function rotuloEvolucao(versao: number, papel: string | null | undefined, autor: string | null): string {
  const quem = papel === 'nir' ? 'pelo NIR' : papel === 'gestor' ? 'pelo gestor' : papel === 'medico' ? 'pelo médico' : null
  return `Evolução (versão ${versao})${quem ? ` — atualizada ${quem}, ${autor ?? '—'}` : autor ? ` — ${autor}` : ''}`
}
