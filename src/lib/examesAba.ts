// Aba Exames do leito no modelo do RT (25/11/2026; EXM1 a EXM11). Só regras e
// montagens, sem tela: os testes rodam no node (examesAba.test.ts).
//
// - Cesta do pedido: um item por exame, com a observação do item (EXM4); a
//   indicação clínica e o CID valem para o pedido todo (EXM3). O servidor faz
//   um pedido por setor (pedir_exames_internacao), e cada item leva os campos.
// - "Já pedido": quantas vezes e a data do mais recente ("2× · 27/10").
// - Folha A4 (EXM6): folha única ou uma por setor, no formato que a folha de
//   pedido de exames (lib/folhas, pedidoExames) já lê. Médico e CRM vêm do
//   login, no servidor; aqui não há campo de médico.
// - Planilha (EXM10): analito × data da coleta, agrupada pelo exame. Unidade,
//   faixa e marca só quando vêm do laboratório; o app não calcula faixa, seta
//   nem "limítrofe" e não traz faixa fixa.
import { GRUPOS_EXAME, type GrupoExame, type Urgencia } from './exames.ts'

export const ROTULO_SETOR: Record<GrupoExame, string> = { laboratorio: 'LAB', imagem: 'IMG', grafico: 'ECG', citopatologia: 'CITO' }
export const NOME_SETOR = Object.fromEntries(GRUPOS_EXAME.map((g) => [g.id, g.rotulo])) as Record<GrupoExame, string>
const ORDEM_SETOR: GrupoExame[] = ['laboratorio', 'imagem', 'grafico', 'citopatologia']

// ── cesta ───────────────────────────────────────────────────────────────────

export type ItemCesta = { rotulo: string; procedimento: string | null; grupo: GrupoExame; obs: string }

export const mesmoExame = (a: { rotulo: string; procedimento: string | null }, b: { rotulo: string; procedimento: string | null }) =>
  a.procedimento || b.procedimento ? a.procedimento === b.procedimento : a.rotulo.trim().toLowerCase() === b.rotulo.trim().toLowerCase()

/** Põe na cesta o que ainda não está (combo, frequente ou busca); devolve a cesta nova e quantos entraram. */
export function porNaCesta(cesta: readonly ItemCesta[], novos: readonly Omit<ItemCesta, 'obs'>[]): { cesta: ItemCesta[]; entraram: number } {
  const saida = [...cesta]
  let entraram = 0
  for (const n of novos) {
    if (saida.some((m) => mesmoExame(m, n))) continue
    saida.push({ ...n, obs: '' })
    entraram++
  }
  return { cesta: saida, entraram }
}

/**
 * Setor sugerido para o exame avulso (texto livre), só para começar a escolha:
 * quem pede troca na hora (LAB, IMG ou ECG). Não é regra clínica, é o nome.
 */
export function setorSugerido(nome: string): GrupoExame {
  const t = nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  if (/\b(ecg|eletrocardiograma|holter)\b/.test(t)) return 'grafico'
  if (/\b(rx|raio|radiografia|tomografia|tc|ultrassom|ultrassonografia|usg|us|ressonancia|rm|ecocardiograma|doppler|mamografia)\b/.test(t)) return 'imagem'
  return 'laboratorio'
}

/** CID-10 do campo ("a41.9", "A419 — Sepse") no formato do banco, ou null se vazio; undefined se inválido. */
export function cidDoCampo(t: string): string | null | undefined {
  const v = t.trim().split(/\s/)[0].toUpperCase().replace('.', '')
  if (!v) return null
  if (!/^[A-Z]\d{2}[0-9A-Z]{0,2}$/.test(v)) return undefined
  return v.length > 3 ? `${v.slice(0, 3)}.${v.slice(3)}` : v
}

/** Os pedidos ao servidor: um por setor, cada item com a observação, a indicação e o CID. */
export function pedidosDaCesta(cesta: readonly ItemCesta[], extra: { indicacao: string; cid: string | null }): {
  grupo: GrupoExame; itens: Record<string, string>[]
}[] {
  const ind = extra.indicacao.trim()
  return ORDEM_SETOR.filter((g) => cesta.some((m) => m.grupo === g)).map((g) => ({
    grupo: g,
    itens: cesta.filter((m) => m.grupo === g).map((m) => ({
      ...(m.procedimento ? { procedimento: m.procedimento } : { nome: m.rotulo.trim() }),
      ...(m.obs.trim() ? { obs: m.obs.trim() } : {}),
      ...(ind ? { indicacao: ind } : {}),
      ...(extra.cid ? { cid: extra.cid } : {}),
    })),
  }))
}

// ── já pedido ───────────────────────────────────────────────────────────────

type PedidoLido = { exame: string; procedimento?: string | null; situacao: string; pedido_em?: string | null }

/** Quantas vezes o exame foi pedido nesta internação (sem os cancelados) e quando foi o último. */
export function resumoJaPedido(b: { rotulo: string; procedimento: string | null }, pedidos: readonly PedidoLido[]): { vezes: number; ultimo: string | null } | null {
  const iguais = pedidos.filter((x) => x.situacao !== 'cancelado' && mesmoExame(b, { rotulo: x.exame, procedimento: x.procedimento ?? null }))
  if (!iguais.length) return null
  const datas = iguais.map((x) => x.pedido_em).filter((d): d is string => !!d).sort()
  return { vezes: iguais.length, ultimo: datas[datas.length - 1] ?? null }
}

/** "2× · 27/10" ou "27/10" (a data vem formatada de fora: só lib/formato formata). */
export function textoJaPedido(r: { vezes: number } | null, data: string): string {
  if (!r) return ''
  return r.vezes > 1 ? `${r.vezes}× · ${data}` : data
}

// ── folha A4 ────────────────────────────────────────────────────────────────

export type ExameParaFolha = { exame: string; grupo: GrupoExame | null; obs?: string | null; urgencia?: Urgencia | string | null; indicacao?: string | null; cid?: string | null }
export type ModoFolha = 'unica' | 'setor'

const DOCUMENTO_SETOR: Record<GrupoExame, string> = {
  laboratorio: 'Solicitação de exames laboratoriais',
  imagem: 'Solicitação de exames de radiologia / imagem',
  grafico: 'Solicitação de métodos gráficos (ECG)',
  citopatologia: 'Solicitação de exame citopatológico',
}

const juntarDiferentes = (xs: (string | null | undefined)[]) => [...new Set(xs.map((x) => (x ?? '').trim()).filter(Boolean))].join('; ')

/**
 * Conteúdo do documento pedido_exames para a folha (lib/folhas, pedidoExames):
 * `folhas` com um grupo por setor (folha única) ou uma folha por setor. Sem
 * `texto`: o pedido já está gravado nos exames, e o documento emitido só imprime
 * (o gatilho que transforma o texto do documento em exames não repete nada).
 */
export function conteudoDaFolha(exames: readonly ExameParaFolha[], modo: ModoFolha, geral?: { indicacao?: string; cid?: string | null; urgente?: boolean }) {
  const setor = (e: ExameParaFolha): GrupoExame => e.grupo ?? 'laboratorio'
  const linha = (e: ExameParaFolha) => (e.obs?.trim() ? `${e.exame.trim()} (obs.: ${e.obs.trim()})` : e.exame.trim())
  const setores = ORDEM_SETOR.filter((g) => exames.some((e) => setor(e) === g))
  const grupoDe = (g: GrupoExame) => ({ nome: NOME_SETOR[g], itens: exames.filter((e) => setor(e) === g).map(linha) })
  const folhas = modo === 'setor'
    ? setores.map((g) => ({ titulo: NOME_SETOR[g], documento: DOCUMENTO_SETOR[g], grupos: [grupoDe(g)] }))
    : [{ titulo: '', documento: 'Solicitação de exames', grupos: setores.map(grupoDe) }]
  const urgente = geral?.urgente ?? exames.some((e) => e.urgencia === 'urgente')
  return {
    pedido: {
      folhas,
      carater: urgente ? 'Urgência' : 'Rotina',
      indicacao: geral?.indicacao?.trim() || juntarDiferentes(exames.map((e) => e.indicacao)),
      cid: geral?.cid ?? (juntarDiferentes(exames.map((e) => e.cid)).split('; ')[0] || ''),
      itens_n: exames.length,
    },
  }
}

// ── planilha ────────────────────────────────────────────────────────────────

export type ItemResultadoLido = {
  analito: string; valor: string | null; valor_num: number | null; unidade: string | null; referencia: string | null; marca: string | null; critico: boolean
}
export type ResultadoLido = {
  exame_id: string; exame: string; grupo: GrupoExame | null; tipo: string | null; resultado_id: string; versao: number
  origem: 'manual' | 'laboratorio' | 'imagem'; tem_arquivo: boolean; arquivo_nome: string | null; liberado_em: string
  coleta_em: string | null; critico: boolean; registrado_por: string | null; alterado_em: string | null; alterado_por: string | null
  itens: ItemResultadoLido[]
}

export type CelulaPlanilha = { valor: string; marca: string | null; critico: boolean; manual: boolean }
export type LinhaPlanilha = { analito: string; unidade: string | null; referencia: string | null; celulas: (CelulaPlanilha | null)[] }
export type GrupoPlanilha = { exame: string; linhas: LinhaPlanilha[] }
export type Planilha = { colunas: { quando: string; manual: boolean }[]; grupos: GrupoPlanilha[] }

const doLaboratorio = (r: ResultadoLido) => r.origem !== 'manual'
/** Coleta no mesmo minuto é a mesma coluna. */
const chaveMinuto = (iso: string) => new Date(Math.floor(Date.parse(iso) / 60_000) * 60_000).toISOString()

/**
 * Matriz analito × data da coleta (a coleta informada, senão a do pedido, senão
 * a liberação). Colunas da mais recente para a mais antiga; linhas agrupadas
 * pelo exame, na ordem dos analitos do laboratório. A unidade e a faixa da
 * linha vêm do resultado mais recente do laboratório que as trouxe; do
 * lançamento à mão não vêm (só nome e valor).
 */
export function montarPlanilha(resultados: readonly ResultadoLido[]): Planilha {
  const comItens = resultados.filter((r) => r.itens.length > 0)
  const quando = (r: ResultadoLido) => chaveMinuto(r.coleta_em ?? r.liberado_em)
  const chaves = [...new Set(comItens.map(quando))].sort((a, b) => Date.parse(b) - Date.parse(a))
  const colunas = chaves.map((k) => ({ quando: k, manual: comItens.filter((r) => quando(r) === k).every((r) => !doLaboratorio(r)) }))
  const nomeGrupo = (r: ResultadoLido) => r.exame.trim()
  const grupos: GrupoPlanilha[] = []
  for (const nome of [...new Set(comItens.map(nomeGrupo))].sort((a, b) => a.localeCompare(b, 'pt-BR'))) {
    const doExame = comItens.filter((r) => nomeGrupo(r) === nome).sort((a, b) => Date.parse(quando(b)) - Date.parse(quando(a)))
    const analitos: string[] = []
    for (const r of [...doExame].reverse()) for (const i of r.itens) if (!analitos.some((a) => a.toLowerCase() === i.analito.trim().toLowerCase())) analitos.push(i.analito.trim())
    const linhas = analitos.map((analito): LinhaPlanilha => {
      const doAnalito = (r: ResultadoLido) => r.itens.find((i) => i.analito.trim().toLowerCase() === analito.toLowerCase()) ?? null
      const lab = doExame.filter(doLaboratorio).map(doAnalito).filter((i): i is ItemResultadoLido => !!i)
      const celulas = chaves.map((k): CelulaPlanilha | null => {
        const r = doExame.find((x) => quando(x) === k && doAnalito(x))
        const i = r ? doAnalito(r) : null
        if (!r || !i || i.valor == null || i.valor.trim() === '') return null
        const manual = !doLaboratorio(r)
        return { valor: i.valor.trim(), marca: manual ? null : i.marca?.trim() || null, critico: !manual && i.critico, manual }
      })
      return {
        analito,
        unidade: lab.find((i) => i.unidade?.trim())?.unidade?.trim() ?? null,
        referencia: lab.find((i) => i.referencia?.trim())?.referencia?.trim() ?? null,
        celulas,
      }
    })
    grupos.push({ exame: nome, linhas })
  }
  return { colunas, grupos }
}

/** Nomes de parâmetros já vistos neste paciente, para sugerir no lançamento à mão (nada de lista fixa). */
export function analitosConhecidos(resultados: readonly ResultadoLido[], exame?: string): string[] {
  const doExame = exame ? resultados.filter((r) => r.exame.trim().toLowerCase() === exame.trim().toLowerCase()) : resultados
  const vistos: string[] = []
  for (const r of doExame) for (const i of r.itens) if (!vistos.some((v) => v.toLowerCase() === i.analito.trim().toLowerCase())) vistos.push(i.analito.trim())
  return vistos
}

/** Lançamento à mão: linhas preenchidas (nome e valor), sem repetir o parâmetro. */
export function itensDoLancamento(linhas: readonly { analito: string; valor: string }[]): { itens: { analito: string; valor: string }[]; erro: string | null } {
  const itens: { analito: string; valor: string }[] = []
  for (const l of linhas) {
    const analito = l.analito.trim()
    const valor = l.valor.trim()
    if (!analito && !valor) continue
    if (!analito) return { itens: [], erro: `Falta o nome do parâmetro do valor ${valor}.` }
    if (!valor) return { itens: [], erro: `Falta o valor de ${analito}.` }
    if (itens.some((x) => x.analito.toLowerCase() === analito.toLowerCase())) return { itens: [], erro: `${analito} aparece duas vezes.` }
    itens.push({ analito, valor })
  }
  if (!itens.length) return { itens, erro: 'Informe ao menos um valor.' }
  return { itens, erro: null }
}

/** Campo datetime-local (hora de Brasília, sem fuso) → instante ISO. Brasília não tem horário de verão desde 2019. */
export function instanteDoCampo(v: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) return null
  const d = new Date(`${v.slice(0, 16)}:00-03:00`)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

// ── anexar ──────────────────────────────────────────────────────────────────

/**
 * Um arquivo para vários exames pendentes: o servidor aceita o mesmo arquivo em
 * exames do mesmo setor (registrar_laudo_grupo). Exames de setores diferentes
 * recebem cada setor a sua cópia do arquivo.
 */
export function envioPorSetor<T extends { id: string; grupo: GrupoExame | null }>(exames: readonly T[]): { grupo: GrupoExame | null; ids: string[] }[] {
  const chaves = [...new Set(exames.map((e) => e.grupo))]
  return chaves.map((g) => ({ grupo: g, ids: exames.filter((e) => e.grupo === g).map((e) => e.id) }))
}
