// Hiperdia (5A, tarefa 7; decisões J1 a J5 e opção A da tela, RT em
// 03/11/2026): a régua das notas metodológicas C5 (hipertensão) e C4 (diabetes)
// da SAPS/MS, assinadas em junho de 2026. O banco (hiperdia_painel e
// hiperdia_do_paciente, migration 20270218000001) traz as datas; aqui fica a
// regra de "em dia" e dos pontos. A visita do ACS não existe no app: o item
// aparece como "não registrado" e não pontua, então o teto no app é 75 na
// hipertensão e 80 no diabetes (com a avaliação dos pés).

export type Programa = 'hipertensao' | 'diabetes'

export type HiperdiaRegistros = {
  ultima_consulta: string | null
  ultima_pa: string | null
  ultimo_peso_altura: string | null
  ultima_hba1c: string | null
  ultima_avaliacao_pes: string | null
  pes_com_alteracao: boolean | null
  proxima_consulta: string | null
}

export type ProgramaAtivo = { id: string; programa: Programa; origem: 'consulta' | 'manual'; entrada_em: string }

export type HiperdiaLinha = HiperdiaRegistros & {
  paciente_id: string
  nome: string
  nome_social: string | null
  data_nascimento: string | null
  programas: ProgramaAtivo[]
  desde: string
}

export type ItemHiperdia = 'consulta' | 'pa' | 'peso_altura' | 'hba1c' | 'pes' | 'acs'
export type EstadoItem = 'em_dia' | 'atrasado' | 'sem_registro' | 'nao_se_aplica' | 'fora_do_app'

export const ITENS: { item: ItemHiperdia; rotulo: string; meses: number; campo: keyof HiperdiaRegistros | null }[] = [
  { item: 'consulta', rotulo: 'Consulta', meses: 6, campo: 'ultima_consulta' },
  { item: 'pa', rotulo: 'Pressão', meses: 6, campo: 'ultima_pa' },
  { item: 'peso_altura', rotulo: 'Peso e altura', meses: 12, campo: 'ultimo_peso_altura' },
  { item: 'hba1c', rotulo: 'HbA1c', meses: 12, campo: 'ultima_hba1c' },
  { item: 'pes', rotulo: 'Pés', meses: 12, campo: 'ultima_avaliacao_pes' },
  { item: 'acs', rotulo: 'Visitas do ACS', meses: 12, campo: null },
]

/** Pontos de cada boa prática por programa (Quadro 01 das notas C5 e C4). */
export const PONTOS: Record<Programa, Partial<Record<ItemHiperdia, number>>> = {
  hipertensao: { consulta: 25, pa: 25, peso_altura: 25, acs: 25 },
  diabetes: { consulta: 20, pa: 15, peso_altura: 15, acs: 20, hba1c: 15, pes: 15 },
}
/** O máximo que o app consegue registrar (sem a visita do ACS). */
export const TETO_NO_APP: Record<Programa, number> = { hipertensao: 75, diabetes: 80 }

export const ROTULO_PROGRAMA: Record<Programa, string> = { hipertensao: 'Hipertensão', diabetes: 'Diabetes' }

/** Data mais o número de meses (a validade da boa prática). */
export function somarMeses(iso: string, meses: number) {
  const d = new Date(iso)
  d.setMonth(d.getMonth() + meses)
  return d
}

/** O estado de um item para o paciente, olhando os programas em que ele está. */
export function estadoDoItem(l: HiperdiaRegistros & { programas: Pick<ProgramaAtivo, 'programa'>[] }, item: ItemHiperdia, agora: number): EstadoItem {
  const programas = l.programas.map((p) => p.programa)
  if (!programas.some((p) => PONTOS[p][item] !== undefined)) return 'nao_se_aplica'
  const def = ITENS.find((i) => i.item === item)!
  if (!def.campo) return 'fora_do_app'
  const data = l[def.campo] as string | null
  if (!data) return 'sem_registro'
  return somarMeses(data, def.meses).getTime() >= agora ? 'em_dia' : 'atrasado'
}

/** Pontos do paciente em cada programa ativo, pela regra da nota. */
export function pontosDoPaciente(l: HiperdiaRegistros & { programas: Pick<ProgramaAtivo, 'programa'>[] }, agora: number) {
  const out: Partial<Record<Programa, number>> = {}
  for (const { programa } of l.programas) {
    out[programa] = Object.entries(PONTOS[programa])
      .reduce((s, [item, pts]) => s + (estadoDoItem(l, item as ItemHiperdia, agora) === 'em_dia' ? pts! : 0), 0)
  }
  return out
}

/** Algo que o app registra está atrasado ou sem registro (a busca ativa). */
export function temPendencia(l: HiperdiaLinha, agora: number) {
  return ITENS.some(({ item }) => {
    const e = estadoDoItem(l, item, agora)
    return e === 'atrasado' || e === 'sem_registro'
  })
}

/** Os números do topo do painel. */
export function resumoHiperdia(linhas: HiperdiaLinha[], agora: number) {
  const media = (p: Programa) => {
    const v = linhas.filter((l) => l.programas.some((x) => x.programa === p)).map((l) => pontosDoPaciente(l, agora)[p]!)
    return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null
  }
  const pendentes = linhas.filter((l) => temPendencia(l, agora)).length
  return {
    total: linhas.length,
    hipertensao: linhas.filter((l) => l.programas.some((p) => p.programa === 'hipertensao')).length,
    diabetes: linhas.filter((l) => l.programas.some((p) => p.programa === 'diabetes')).length,
    emDia: linhas.length - pendentes,
    pendentes,
    semConsultaMarcada: linhas.filter((l) => !l.proxima_consulta).length,
    mediaHipertensao: media('hipertensao'),
    mediaDiabetes: media('diabetes'),
  }
}
