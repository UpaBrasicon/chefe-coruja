// Prontuário completo em linha do tempo (achado guardado, item 6; decisão do
// RT em 06/11/2026: A em P1 a P7, direção visual A). Formato de
// public.prontuario_leitura (migration 20270304000001) e o agrupamento que a
// tela mostra: cada atendimento reúne o que foi feito nele, do mais recente
// para o mais antigo; os sinais vitais viram uma linha por aferição.
//
// Nada aqui calcula, interpreta ou marca valor: a cor é a da enfermagem e os
// sinais vitais saem como foram gravados (regra clínica).

import { dataIso } from './formato.ts'
import { rotuloDesfechoFinal } from './historico.ts'

// ── formato da RPC ──────────────────────────────────────────────────────────

export type AtendimentoBruto = {
  id: string; paciente_id: string; unidade_id: string | null; setor_id: string | null
  etapa: string; queixa: string | null; chegada_em: string; encerrado_em: string | null
  desfecho: string | null; desfecho_em: string | null; cor_atual: string | null
  medico_id: string | null; cid_aps: string[] | null; cid_desfecho: string | null
}
export type InternacaoBruta = {
  id: string; episodio_id: string | null; status: string; tipo_internacao: string | null
  unidade_id: string | null; setor_id: string | null; leito_id: string | null
  data_admissao: string; internado_em: string | null; data_alta: string | null
  cid_principal: string | null; cid_alta: string | null; motivo_alta: string | null
}
export type ClassificacaoBruta = {
  id: string; episodio_id: string | null; cor: string; reclassificacao: boolean; criado_em: string
  discriminador: string | null; fluxograma_nome: string | null
}
export type RegistroBruto = {
  id: string; episodio_id: string | null; criado_em: string
  subjetivo: string | null; objetivo: string | null; avaliacao: string | null; cid: string | null; plano: string | null
  autor_id: string | null
}
export type ExameBruto = {
  id: string; episodio_id: string | null; internacao_id: string | null; exame: string; situacao: string
  urgencia: string | null; resultado: string | null; pedido_em: string; resolvido_em: string | null; pedido_por: string | null
}
export type DocumentoBruto = {
  id: string; documento_raiz_id: string; versao: number; tipo_documento: string; conteudo: string; estado: string
  created_at: string; episodio_id: string | null; internacao_id: string | null; autor_id: string | null
}
export type ItemPrescricao = { id: string; descricao: string; dose: string | null; posologia: string | null; via: string | null; suspenso_em: string | null }
export type PrescricaoBruta = {
  id: string; episodio_id: string | null; internacao_id: string | null; status: string; created_at: string
  assinada_em: string | null; medico_id: string | null; itens: ItemPrescricao[]
}
export type ObservacaoBruta = {
  id: string; episodio_id: string | null; internacao_id: string | null; aferido_em: string
  conceito: string | null; unidade_padrao: string | null; valor_num: number | null; valor_texto: string | null; unidade: string | null
}
/** Versão vigente do resultado, como o laboratório ou quem registrou mandou. */
export type ResultadoExame = {
  versao: number; texto: string | null; liberado_em: string
  itens: { analito: string; valor: string | null; valor_num: number | null; unidade: string | null; referencia: string | null }[]
}
export type ResumoProntuario = {
  atendimentos: number; internacoes: number; ultimo_em: string | null
  anos: { ano: number; atendimentos: number }[]
}
export type PaginaProntuario = {
  resumo: ResumoProntuario
  /** Há atendimentos mais antigos que os desta página. */
  mais: boolean
  /** Chegada do último atendimento da página: é o p_antes da próxima. */
  proximo_antes: string | null
  atendimentos: AtendimentoBruto[]; internacoes: InternacaoBruta[]; classificacoes: ClassificacaoBruta[]
  registros: RegistroBruto[]; exames: ExameBruto[]; documentos: DocumentoBruto[]
  prescricoes: PrescricaoBruta[]; observacoes: ObservacaoBruta[]
  /** Nome de unidade, setor, leito e profissional, pelo id. */
  nomes: Record<string, string>
  /** Resultado vigente, pelo id do exame. */
  resultados: Record<string, ResultadoExame>
}

// ── agrupamento ─────────────────────────────────────────────────────────────

type Base = { id: string; em: string; autor: string | null }
export type RegistroLinha =
  | (Base & { tipo: 'atendimento'; registro: RegistroBruto })
  | (Base & { tipo: 'documento'; documento: DocumentoBruto })
  | (Base & { tipo: 'prescricao'; prescricao: PrescricaoBruta })
  | (Base & { tipo: 'exame'; exame: ExameBruto; resultado: ResultadoExame | null })
  | (Base & { tipo: 'internacao'; internacao: InternacaoNomeada })

export type InternacaoNomeada = InternacaoBruta & { setor: string | null; leito: string | null }

/** Uma aferição: tudo o que foi gravado no mesmo horário, em colunas fixas. */
export type LinhaAfericao = {
  em: string
  pa: string | null; fc: string | null; fr: string | null; temp: string | null
  spo2: string | null; glicemia: string | null; dor: string | null
  outras: { nome: string; valor: string }[]
}

export type Situacao = { emCurso: boolean; rotulo: string }

export type GrupoAtendimento = {
  chave: string
  /** sem_atendimento: registro sem episódio; fora_da_lista: o atendimento dele não veio para quem lê. */
  tipo: 'atendimento' | 'sem_atendimento' | 'fora_da_lista'
  titulo: string | null
  atendimento: AtendimentoBruto | null
  /** Dia da chegada em Brasília (AAAA-MM-DD). */
  dia: string | null
  ano: number | null
  unidade: string | null; setor: string | null; medico: string | null
  /** A primeira classificação; as seguintes, em ordem, são as reclassificações. */
  classificacao: ClassificacaoBruta | null
  reclassificacoes: ClassificacaoBruta[]
  cid: string | null
  situacao: Situacao
  internacoes: InternacaoNomeada[]
  /** Do mais recente para o mais antigo, como os sinais vitais (ajuste do polish, 06/11/2026). */
  registros: RegistroLinha[]
  /** A mais recente primeiro. */
  afericoes: LinhaAfericao[]
}

const INTERNACAO_EM_CURSO = new Set(['admitido', 'em_observacao', 'internado'])

/** Junta as páginas já carregadas ("Ver mais atendimentos"). */
export function juntarPaginas(paginas: PaginaProntuario[]): PaginaProntuario {
  const ultima = paginas[paginas.length - 1]
  const unir = <T extends { id: string }>(k: (p: PaginaProntuario) => T[]) => {
    const vistos = new Map<string, T>()
    for (const p of paginas) for (const x of k(p)) if (!vistos.has(x.id)) vistos.set(x.id, x)
    return [...vistos.values()]
  }
  return {
    resumo: paginas[0].resumo,
    mais: ultima.mais,
    proximo_antes: ultima.proximo_antes,
    atendimentos: unir((p) => p.atendimentos), internacoes: unir((p) => p.internacoes),
    classificacoes: unir((p) => p.classificacoes), registros: unir((p) => p.registros), exames: unir((p) => p.exames),
    documentos: unir((p) => p.documentos), prescricoes: unir((p) => p.prescricoes), observacoes: unir((p) => p.observacoes),
    nomes: Object.assign({}, ...paginas.map((p) => p.nomes)),
    resultados: Object.assign({}, ...paginas.map((p) => p.resultados)),
  }
}

const crescente = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)
/** Instantes pelo relógio, não pelo texto (o banco pode mandar com ou sem fração de segundo). */
const antes = (a: string, b: string) => Date.parse(a) - Date.parse(b) || 0
const texto = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null)

export function montarLinhaTempo(d: PaginaProntuario): { grupos: GrupoAtendimento[] } {
  const nome = (id: string | null | undefined) => (id ? d.nomes[id] ?? null : null)
  const episodios = new Set(d.atendimentos.map((a) => a.id))
  const internacoes = new Map(d.internacoes.map((i) => [i.id, { ...i, setor: nome(i.setor_id), leito: nome(i.leito_id) }]))

  // onde o registro mora: o atendimento dele, direto ou pela internação
  const SEM = '\u0000sem'
  const FORA = '\u0000fora'
  const lugar = (episodio_id: string | null, internacao_id: string | null): string => {
    if (episodio_id) return episodios.has(episodio_id) ? episodio_id : FORA
    if (internacao_id) {
      const ep = internacoes.get(internacao_id)?.episodio_id
      if (ep) return episodios.has(ep) ? ep : FORA
      return internacoes.has(internacao_id) ? SEM : FORA
    }
    return SEM
  }

  const registros = new Map<string, RegistroLinha[]>()
  const obs = new Map<string, ObservacaoBruta[]>()
  const por = <T>(m: Map<string, T[]>, k: string, x: T) => { const l = m.get(k); if (l) l.push(x); else m.set(k, [x]) }

  for (const r of d.registros) {
    por(registros, lugar(r.episodio_id, null), { tipo: 'atendimento', id: r.id, em: r.criado_em, autor: nome(r.autor_id), registro: r })
  }
  for (const i of internacoes.values()) {
    por(registros, i.episodio_id ? (episodios.has(i.episodio_id) ? i.episodio_id : FORA) : SEM,
      { tipo: 'internacao', id: i.id, em: i.data_admissao, autor: null, internacao: i })
  }
  for (const p of d.prescricoes) {
    por(registros, lugar(p.episodio_id, p.internacao_id), { tipo: 'prescricao', id: p.id, em: p.created_at, autor: nome(p.medico_id), prescricao: p })
  }
  for (const x of d.exames) {
    por(registros, lugar(x.episodio_id, x.internacao_id),
      { tipo: 'exame', id: x.id, em: x.pedido_em, autor: nome(x.pedido_por), exame: x, resultado: d.resultados[x.id] ?? null })
  }
  // só a versão mais recente de cada documento (como antes)
  const ultimaVersao = new Map<string, DocumentoBruto>()
  for (const doc of d.documentos) {
    const atual = ultimaVersao.get(doc.documento_raiz_id)
    if (!atual || doc.versao > atual.versao) ultimaVersao.set(doc.documento_raiz_id, doc)
  }
  for (const doc of ultimaVersao.values()) {
    por(registros, lugar(doc.episodio_id, doc.internacao_id), { tipo: 'documento', id: doc.id, em: doc.created_at, autor: nome(doc.autor_id), documento: doc })
  }
  for (const o of d.observacoes) por(obs, lugar(o.episodio_id, o.internacao_id), o)

  const classif = new Map<string, ClassificacaoBruta[]>()
  for (const c of d.classificacoes) if (c.episodio_id) por(classif, c.episodio_id, c)

  // do mais recente para o mais antigo
  const ordenar = (l: RegistroLinha[] | undefined) => (l ?? []).sort((a, b) => antes(b.em, a.em) || crescente(a.id, b.id))

  const grupos: GrupoAtendimento[] = [...d.atendimentos]
    .sort((a, b) => antes(b.chegada_em, a.chegada_em) || crescente(b.id, a.id))
    .map((a) => {
      const cls = (classif.get(a.id) ?? []).sort((x, y) => antes(x.criado_em, y.criado_em))
      const primeira = cls[0] ?? (a.cor_atual
        ? { id: 'cor-' + a.id, episodio_id: a.id, cor: a.cor_atual, reclassificacao: false, criado_em: a.chegada_em, discriminador: null, fluxograma_nome: null }
        : null)
      const ints = [...internacoes.values()].filter((i) => i.episodio_id === a.id).sort((x, y) => antes(x.data_admissao, y.data_admissao))
      const regs = ordenar(registros.get(a.id))
      const dia = dataIso(a.chegada_em)
      return {
        chave: a.id, tipo: 'atendimento' as const, titulo: null, atendimento: a, dia, ano: Number(dia.slice(0, 4)),
        unidade: nome(a.unidade_id), setor: nome(a.setor_id), medico: nome(a.medico_id),
        classificacao: primeira, reclassificacoes: cls.slice(1),
        cid: cidDoAtendimento(a, ints, regs), situacao: situacaoDoAtendimento(a, ints),
        internacoes: ints, registros: regs, afericoes: agruparAfericoes(obs.get(a.id) ?? []),
      }
    })

  const avulso = (chave: string, tipo: 'sem_atendimento' | 'fora_da_lista', titulo: string): GrupoAtendimento | null => {
    const regs = ordenar(registros.get(chave))
    const af = agruparAfericoes(obs.get(chave) ?? [])
    if (!regs.length && !af.length) return null
    return {
      chave: tipo, tipo, titulo, atendimento: null, dia: null, ano: null, unidade: null, setor: null, medico: null,
      classificacao: null, reclassificacoes: [], cid: null, situacao: { emCurso: false, rotulo: '' },
      internacoes: [], registros: regs, afericoes: af,
    }
  }
  for (const g of [avulso(FORA, 'fora_da_lista', 'Registros de outros atendimentos'), avulso(SEM, 'sem_atendimento', 'Sem atendimento ligado')]) {
    if (g) grupos.push(g)
  }
  return { grupos }
}

/** Em curso enquanto a porta ou a internação/observação que veio dela não terminou. */
function situacaoDoAtendimento(a: AtendimentoBruto, ints: InternacaoBruta[]): Situacao {
  const ultima = ints[ints.length - 1]
  if (ultima && INTERNACAO_EM_CURSO.has(ultima.status)) return { emCurso: true, rotulo: 'Em curso' }
  if (ultima) return { emCurso: false, rotulo: rotuloDesfechoFinal(ultima.status) }
  if (a.etapa !== 'encerrado') return { emCurso: true, rotulo: 'Em curso' }
  return { emCurso: false, rotulo: rotuloDesfechoFinal(a.desfecho) }
}

/** O CID gravado: o da alta, o do desfecho, o da internação, o do último registro, o da APS. */
function cidDoAtendimento(a: AtendimentoBruto, ints: InternacaoBruta[], regs: RegistroLinha[]): string | null {
  const ultima = ints[ints.length - 1]
  // regs vem do mais recente para o mais antigo
  const ultimoRegistro = regs.find((r) => r.tipo === 'atendimento' && texto(r.registro.cid))
  return texto(ultima?.cid_alta) ?? texto(a.cid_desfecho) ?? texto(ultima?.cid_principal)
    ?? (ultimoRegistro?.tipo === 'atendimento' ? texto(ultimoRegistro.registro.cid) : null)
    ?? (a.cid_aps?.length ? a.cid_aps.join(', ') : null)
}

// ── sinais vitais ───────────────────────────────────────────────────────────

type Coluna = 'fc' | 'fr' | 'temp' | 'spo2' | 'glicemia' | 'dor'
const COLUNA: Record<string, Coluna> = {
  'frequencia-cardiaca': 'fc', 'frequencia-respiratoria': 'fr', temperatura: 'temp',
  'saturacao-o2': 'spo2', 'glicemia-capilar': 'glicemia', 'escala-dor': 'dor',
}
const SISTOLICA = 'pressao-arterial-sistolica'
const DIASTOLICA = 'pressao-arterial-diastolica'

/** Valor como foi gravado; só troca o ponto decimal pela vírgula. */
const valorCru = (o: ObservacaoBruta) => (o.valor_num != null ? String(o.valor_num).replace('.', ',') : texto(o.valor_texto))

/** Uma linha por horário de aferição (mesmo aferido_em), a mais recente primeiro. Não calcula nada. */
export function agruparAfericoes(lista: ObservacaoBruta[]): LinhaAfericao[] {
  const porHorario = new Map<string, ObservacaoBruta[]>()
  for (const o of lista) { const l = porHorario.get(o.aferido_em); if (l) l.push(o); else porHorario.set(o.aferido_em, [o]) }
  return [...porHorario.entries()]
    .sort(([a], [b]) => antes(b, a))
    .map(([em, obs]) => {
      const linha: LinhaAfericao = { em, pa: null, fc: null, fr: null, temp: null, spo2: null, glicemia: null, dor: null, outras: [] }
      let sis: string | null = null
      let dia: string | null = null
      for (const o of [...obs].sort((a, b) => crescente(a.id, b.id))) {
        const v = valorCru(o)
        if (v == null) continue
        if (o.conceito === SISTOLICA) sis ??= v
        else if (o.conceito === DIASTOLICA) dia ??= v
        else if (o.conceito && COLUNA[o.conceito]) linha[COLUNA[o.conceito]] ??= v
        else {
          const unidade = o.unidade ?? o.unidade_padrao
          linha.outras.push({ nome: (o.conceito ?? 'medida').replace(/-/g, ' '), valor: unidade ? `${v} ${unidade}` : v })
        }
      }
      if (sis != null || dia != null) linha.pa = `${sis ?? '—'}/${dia ?? '—'}`
      return linha
    })
}

// ── registros principais ────────────────────────────────────────────────────

/** Exame com resultado liberado: a versão vigente do resultado ou o texto gravado no pedido. */
const temResultado = (r: RegistroLinha) => r.tipo === 'exame' && (r.resultado != null || texto(r.exame.resultado) != null)

const TIPO_ESCONDIDO = (r: RegistroLinha) =>
  r.tipo === 'exame' ? 'exames'
    : r.tipo === 'documento' ? (r.documento.tipo_documento === 'evolucao' ? 'evolução' : 'documentos')
      : r.tipo === 'prescricao' ? 'prescrições'
        : r.tipo === 'internacao' ? 'internação' : 'registros do atendimento'

/**
 * O que o atendimento aberto mostra antes do "+N registros" (ajuste do polish,
 * RT em 06/11/2026, muda o detalhe da P4): o último de cada tipo — o SOAP mais
 * recente, a última evolução, a prescrição vigente (a mais recente) —, os
 * exames com resultado liberado e a internação. Sem nenhum deles, os três mais
 * recentes. O resto fica atrás do botão, com os tipos. `regs` vem do mais
 * recente para o mais antigo, e a ordem se mantém.
 */
export function principais(regs: RegistroLinha[]): { mostrados: RegistroLinha[]; escondidos: number; tipos: string[] } {
  const ficam = new Set<string>()
  const primeiro = (f: (r: RegistroLinha) => boolean) => { const r = regs.find(f); if (r) ficam.add(r.tipo + r.id) }
  primeiro((r) => r.tipo === 'atendimento')
  primeiro((r) => r.tipo === 'documento' && r.documento.tipo_documento === 'evolucao')
  primeiro((r) => r.tipo === 'prescricao')
  for (const r of regs) if (r.tipo === 'internacao' || temResultado(r)) ficam.add(r.tipo + r.id)
  if (!ficam.size) for (const r of regs.slice(0, 3)) ficam.add(r.tipo + r.id)
  const mostrados = regs.filter((r) => ficam.has(r.tipo + r.id))
  const resto = regs.filter((r) => !ficam.has(r.tipo + r.id))
  return { mostrados, escondidos: resto.length, tipos: [...new Set(resto.map(TIPO_ESCONDIDO))] }
}

// ── textos do cartão ────────────────────────────────────────────────────────

/** "leito 12A", sem repetir a palavra quando o nome do leito já é "Leito 4". */
export const rotuloLeito = (nome: string | null | undefined): string | null => {
  const n = texto(nome)
  return n ? (/^leito\b/i.test(n) ? n : `leito ${n}`) : null
}

const compacto = (s: string) => s.toLowerCase().replace(/\s+/g, '')

/** Item da prescrição numa linha; a dose sai rotulada, e não sai quando a descrição já a traz. */
export function textoItemPrescricao(i: ItemPrescricao): string {
  const dose = texto(i.dose)
  const repete = dose != null && compacto(i.descricao).includes(compacto(dose))
  return [i.descricao, dose && !repete ? `dose ${dose}` : null, texto(i.via), texto(i.posologia)].filter(Boolean).join(' · ')
}

const DIA_MS = 86_400_000

/**
 * Resumo da internação do atendimento fechado: "internação · 6 dias" (ou
 * "observação", quando todas foram observação), da primeira entrada à última
 * alta, contando o dia pela data de Brasília. Sem alta gravada, só o tipo.
 */
export function resumoInternacao(ints: InternacaoBruta[]): string | null {
  if (!ints.length) return null
  const tipo = ints.every((i) => i.tipo_internacao === 'observacao') ? 'observação' : 'internação'
  const entrada = ints.map((i) => i.data_admissao).sort(antes)[0]
  const altas = ints.map((i) => i.data_alta)
  if (altas.some((a) => !a)) return tipo
  const saida = (altas as string[]).sort(antes)[altas.length - 1]
  const dias = Math.round((Date.parse(dataIso(saida)) - Date.parse(dataIso(entrada))) / DIA_MS)
  return `${tipo} · ${dias < 1 ? 'menos de 1 dia' : dias === 1 ? '1 dia' : `${dias} dias`}`
}

/** Id do botão do cabeçalho do atendimento: o foco vai para ele depois de "Ver mais atendimentos". */
export const idCabecalho = (chave: string) => `atendimento-${chave}`

/** Âncora do ano na linha do tempo. */
export const ancoraDoAno = (ano: number) => `ano-${ano}`

/**
 * O ano já veio inteiro: há um atendimento de ano anterior na lista ou não há
 * mais páginas. A navegação por ano carrega até isso, não só até o primeiro do ano.
 */
export const anoCarregado = (chegadas: string[], ano: number, mais: boolean) =>
  !mais || chegadas.some((c) => Number(dataIso(c).slice(0, 4)) < ano)
