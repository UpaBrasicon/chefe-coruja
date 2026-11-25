// Boletim bimestral do Gestor da secretaria (pedido do RT, 24/11/2026): regras
// puras da tela. O banco faz as contas (secretaria_boletim, migration
// 20270421000080); aqui ficam os meses, a variação, o catálogo de indicadores
// com meta do contrato e a avaliação "cumpriu / não cumpriu".

// ── o que o banco devolve ────────────────────────────────────────────────

export type ItemLista = { cid?: string; nome: string; n: number; destino?: string; origem?: string }
export type Causa = { causa: string; n: number }

export type Ala = {
  total: number
  novas: number
  anteriores: number
  leitos: number
  paciente_dia: number
  saidas: number
  ocupacao: number | null
  giro: number | null
  permanencia_media_dias: number | null
  diagnosticos: ItemLista[]
  origem: Partial<Record<'emergencia' | 'enfermaria' | 'estabilizacao' | 'outra_unidade', number>>
}

export type NomeAla = 'enfermaria_adulto' | 'enfermaria_pediatrica' | 'estabilizacao'

export type BoletimMes = {
  mes: string
  porta: {
    fichas: number
    atendidas: number
    nao_atendidas: number
    taxa_atendimento: number | null
    turnos: { adulto_diurno: number; adulto_noturno: number; pediatrico_diurno: number; pediatrico_noturno: number; sem_publico: number }
    espera_classificacao_min: number | null
    espera_medico_min: number | null
    no_alvo: { avaliados: number; dentro: number; pct: number | null; por_cor: Record<string, { avaliados: number; dentro: number }> | null }
    retorno_72h: { retornos: number; pct: number | null }
    permanencia_24h: { saidas: number; menos_24h: number; pct: number | null }
  }
  cids_porta: { adulto: ItemLista[]; pediatrico: ItemLista[] }
  internacao: Partial<Record<NomeAla, Ala>>
  saidas_internacao: number
  obitos: {
    total: number
    estabilizacao: number
    enfermaria: number
    porta: number
    ate_24h: number
    apos_24h: number
    taxa_mortalidade: number | null
    causas: { estabilizacao: Causa[]; enfermaria: Causa[]; porta: Causa[] }
  }
  encaminhamentos: {
    total: number
    por_tipo: { consulta: number; exame: number; leito: number; transferencia: number }
    especialidades: ItemLista[]
    exames: ItemLista[]
    apac: number
  }
  producao: { procedimentos: number; pequenos_procedimentos: number; exames_feitos: number; laboratorio: number; ecg: number; raio_x: number }
  notificacoes: { total: number; dengue: number; srag: number; covid: number }
  contrato: {
    pct_no_alvo: number | null
    retorno_72h: number | null
    permanencia_menor_24h: number | null
    transferencias: number
    taxa_transferencia: number | null
  }
}

export type MetaContrato = {
  id: string
  indicador: string
  meta: number
  sentido: Sentido
  peso: number | null
  vigente_de: string
  vigente_ate: string | null
}

export type Boletim = {
  rede: boolean
  unidades: { id: string; nome: string; tipo: string }[]
  alvos: Record<string, number> | null
  estabilizacao_marcada: boolean
  meses: [BoletimMes, BoletimMes]
  metas: MetaContrato[]
}

// ── meses ────────────────────────────────────────────────────────────────

/** "2026-10" a partir de uma data "2026-10-24" (ou do próprio mês). */
export function mesDe(dataIso: string): string {
  return dataIso.slice(0, 7)
}

/** O mês n meses depois (n negativo = antes). */
export function deslocarMes(mes: string, n: number): string {
  const [ano, m] = mes.split('-').map(Number)
  const total = ano * 12 + (m - 1) + n
  const a = Math.floor(total / 12)
  const mm = total - a * 12 + 1
  return `${a}-${String(mm).padStart(2, '0')}`
}

/** "2026-10-01": o primeiro dia, como o banco recebe o mês. */
export const primeiroDia = (mes: string) => `${mes}-01`

export type Modo = 'bimestral' | 'mensal'

/**
 * Meses que a tela abre: os dois últimos meses completos antes de hoje
 * (bimestral), ou o último mês completo com o anterior ao lado (mensal). Nos
 * dois, o primeiro é o mais antigo.
 */
export function mesesPadrao(hojeIso: string): { a: string; b: string } {
  const b = deslocarMes(mesDe(hojeIso), -1)
  return { a: deslocarMes(b, -1), b }
}

/** Os 24 meses que a escolha oferece, do mais recente (o mês corrente) para trás. */
export function mesesParaEscolher(hojeIso: string, quantos = 24): string[] {
  const atual = mesDe(hojeIso)
  return Array.from({ length: quantos }, (_, i) => deslocarMes(atual, -i))
}

// ── variação ─────────────────────────────────────────────────────────────

export type Variacao = { direcao: 'sobe' | 'desce' | 'igual'; diferenca: number; pct: number | null }

/**
 * De "antes" para "depois". Sem um dos dois, não há variação. A porcentagem
 * some quando "antes" é zero (não há base).
 */
export function variacao(antes: number | null | undefined, depois: number | null | undefined): Variacao | null {
  if (antes === null || antes === undefined || depois === null || depois === undefined) return null
  if (!Number.isFinite(antes) || !Number.isFinite(depois)) return null
  const diferenca = Math.round((depois - antes) * 10) / 10
  const direcao = diferenca > 0 ? 'sobe' : diferenca < 0 ? 'desce' : 'igual'
  const pct = antes === 0 ? null : Math.round((1000 * (depois - antes)) / Math.abs(antes)) / 10
  return { direcao, diferenca, pct }
}

/** Parte de um total, em porcentagem com uma casa (o banco faz igual). */
export function parte(n: number, total: number): number | null {
  return total > 0 ? Math.round((1000 * n) / total) / 10 : null
}

// ── metas do contrato ────────────────────────────────────────────────────

export type Sentido = 'maior' | 'menor'
export type Medida = 'pct' | 'min' | 'n' | 'dias'

export type IndicadorMeta = {
  chave: string
  rotulo: string
  medida: Medida
  /** Sentido que o cadastro sugere (o contrato pode dizer outro). */
  sentido: Sentido
  valor: (m: BoletimMes) => number | null
}

const ala = (m: BoletimMes, a: NomeAla) => m.internacao[a]

/** Indicadores do boletim que aceitam meta. A chave é a gravada em metas_contrato. */
export const INDICADORES_META: readonly IndicadorMeta[] = [
  { chave: 'fichas_atendidas', rotulo: 'Fichas atendidas', medida: 'n', sentido: 'maior', valor: (m) => m.porta.atendidas },
  { chave: 'taxa_atendimento', rotulo: 'Taxa de atendimento', medida: 'pct', sentido: 'maior', valor: (m) => m.porta.taxa_atendimento },
  { chave: 'espera_classificacao', rotulo: 'Tempo médio da ficha à classificação', medida: 'min', sentido: 'menor', valor: (m) => m.porta.espera_classificacao_min },
  { chave: 'espera_medico', rotulo: 'Tempo médio da classificação ao médico', medida: 'min', sentido: 'menor', valor: (m) => m.porta.espera_medico_min },
  { chave: 'pct_no_alvo', rotulo: 'Atendidos no tempo-alvo da cor', medida: 'pct', sentido: 'maior', valor: (m) => m.contrato.pct_no_alvo },
  { chave: 'retorno_72h', rotulo: 'Retorno à porta em 72 h', medida: 'pct', sentido: 'menor', valor: (m) => m.contrato.retorno_72h },
  { chave: 'permanencia_menor_24h', rotulo: 'Permanência na porta abaixo de 24 h', medida: 'pct', sentido: 'maior', valor: (m) => m.contrato.permanencia_menor_24h },
  { chave: 'taxa_transferencia', rotulo: 'Taxa de transferência', medida: 'pct', sentido: 'menor', valor: (m) => m.contrato.taxa_transferencia },
  { chave: 'ocupacao_enfermaria_adulto', rotulo: 'Ocupação da enfermaria adulto', medida: 'pct', sentido: 'maior', valor: (m) => ala(m, 'enfermaria_adulto')?.ocupacao ?? null },
  { chave: 'ocupacao_enfermaria_pediatrica', rotulo: 'Ocupação da enfermaria pediátrica', medida: 'pct', sentido: 'maior', valor: (m) => ala(m, 'enfermaria_pediatrica')?.ocupacao ?? null },
  { chave: 'ocupacao_estabilizacao', rotulo: 'Ocupação da estabilização', medida: 'pct', sentido: 'maior', valor: (m) => ala(m, 'estabilizacao')?.ocupacao ?? null },
  { chave: 'permanencia_media_enfermaria_adulto', rotulo: 'Permanência média na enfermaria adulto', medida: 'dias', sentido: 'menor', valor: (m) => ala(m, 'enfermaria_adulto')?.permanencia_media_dias ?? null },
  { chave: 'taxa_mortalidade', rotulo: 'Taxa de mortalidade (enfermaria e estabilização)', medida: 'pct', sentido: 'menor', valor: (m) => m.obitos.taxa_mortalidade },
  { chave: 'pequenos_procedimentos', rotulo: 'Pequenos procedimentos', medida: 'n', sentido: 'maior', valor: (m) => m.producao.pequenos_procedimentos },
  { chave: 'exames_laboratorio', rotulo: 'Exames de análises clínicas', medida: 'n', sentido: 'maior', valor: (m) => m.producao.laboratorio },
  { chave: 'ecg', rotulo: 'Eletrocardiogramas', medida: 'n', sentido: 'maior', valor: (m) => m.producao.ecg },
  { chave: 'raio_x', rotulo: 'Raios X', medida: 'n', sentido: 'maior', valor: (m) => m.producao.raio_x },
]

const POR_CHAVE = new Map(INDICADORES_META.map((i) => [i.chave, i]))
export const indicadorMeta = (chave: string) => POR_CHAVE.get(chave)

export const SUFIXO: Record<Medida, string> = { pct: '%', min: ' min', n: '', dias: ' dias' }

/** A meta vigente no mês (YYYY-MM) para o indicador; a mais recente se houver mais de uma. */
export function metaDoMes(metas: readonly MetaContrato[], indicador: string, mes: string): MetaContrato | null {
  const ini = primeiroDia(mes)
  const fim = `${deslocarMes(mes, 1)}-01`
  const vigentes = metas.filter((m) => m.indicador === indicador && m.vigente_de < fim && (m.vigente_ate === null || m.vigente_ate >= ini))
  vigentes.sort((x, y) => y.vigente_de.localeCompare(x.vigente_de))
  return vigentes[0] ?? null
}

export type Avaliacao = 'cumpriu' | 'nao_cumpriu' | 'sem_dado'

/** "maior": cumpre na meta ou acima; "menor": na meta ou abaixo. */
export function avaliarMeta(realizado: number | null | undefined, meta: number, sentido: Sentido): Avaliacao {
  if (realizado === null || realizado === undefined || !Number.isFinite(realizado)) return 'sem_dado'
  return (sentido === 'maior' ? realizado >= meta : realizado <= meta) ? 'cumpriu' : 'nao_cumpriu'
}

/** Mês sem meta vigente, sem dado ou fora da vigência: nada a avaliar. */
export function avaliarNoMes(m: BoletimMes, metas: readonly MetaContrato[], chave: string): { meta: MetaContrato; realizado: number | null; avaliacao: Avaliacao } | null {
  const ind = indicadorMeta(chave)
  const meta = metaDoMes(metas, chave, mesDe(m.mes))
  if (!ind || !meta) return null
  const realizado = ind.valor(m)
  return { meta, realizado, avaliacao: avaliarMeta(realizado, meta.meta, meta.sentido) }
}

/** Valida o formulário de meta antes de mandar ao banco. Devolve a mensagem do primeiro problema. */
export function conferirMeta(f: { indicador: string; meta: string; peso: string; vigente_de: string; vigente_ate: string }): string | null {
  if (!indicadorMeta(f.indicador)) return 'Escolha o indicador.'
  const meta = Number(f.meta.replace(',', '.'))
  if (f.meta.trim() === '' || !Number.isFinite(meta) || meta < 0) return 'A meta é um número de zero para cima.'
  const ind = indicadorMeta(f.indicador)!
  if (ind.medida === 'pct' && meta > 100) return 'Porcentagem vai até 100.'
  if (f.peso.trim() !== '') {
    const peso = Number(f.peso.replace(',', '.'))
    if (!Number.isFinite(peso) || peso < 0 || peso > 100) return 'O peso vai de 0 a 100.'
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.vigente_de)) return 'Informe o início da vigência.'
  if (f.vigente_ate && f.vigente_ate < f.vigente_de) return 'O fim da vigência vem depois do início.'
  return null
}
