// Puericultura da UBS (5A, tarefa 7; K6 = A do RT em 05/11/2026: mesmas regras
// do pré-natal, tela na opção B, a linha do tempo). A régua é a nota
// metodológica C2 da SAPS/MS (junho de 2026), lida na fonte em 05/11/2026. O
// banco (puericultura_painel e puericultura_do_paciente, migration
// 20270224000001) traz as consultas com o problema "Puericultura" e os pesos
// com altura até os 2 anos; aqui fica o estado de cada boa prática e os pontos.
// Visitas do ACS (D) e vacinas (E) não existem no app (K3): o teto é 60 de 100.

export type RegistrosPuericultura = {
  primeira_consulta: string | null
  consultas: number
  datas_consultas: string[]
  peso_altura: number
  datas_peso_altura: string[]
  proxima_consulta: string | null
}

export type CriancaLinha = RegistrosPuericultura & {
  paciente_id: string
  nome: string
  nome_social: string | null
  data_nascimento: string
  nome_mae: string | null
}

export type DoPaciente =
  | { crianca: false }
  | (RegistrosPuericultura & { crianca: true; data_nascimento: string; saida: { motivo: string; em: string } | null })

/** (A) "até o 30º dia de vida", contando o dia do nascimento como o 1º: nascimento + 29 dias. */
export const PRIMEIRA_ATE_DIAS = 29
/** (B) e (C): pelo menos 9 até os 2 anos. */
export const META = 9

export type ItemPuericultura = 'primeira' | 'consultas' | 'peso_altura'
export type EstadoItem = 'feito' | 'no_prazo' | 'perdido'

/** Quadro 01 da nota C2: o que o app registra. */
export const ITENS: { item: ItemPuericultura; letra: string; rotulo: string; pontos: number }[] = [
  { item: 'primeira', letra: 'A', rotulo: '1ª consulta até o 30º dia', pontos: 20 },
  { item: 'consultas', letra: 'B', rotulo: 'Consultas', pontos: 20 },
  { item: 'peso_altura', letra: 'C', rotulo: 'Peso e altura', pontos: 20 },
]
export const FORA_DO_APP = [
  { letra: 'D', rotulo: '2 visitas do ACS (até 30 dias e até 6 meses)', pontos: 20 },
  { letra: 'E', rotulo: 'Vacinas com todas as doses', pontos: 20 },
]
export const TETO_NO_APP = ITENS.reduce((s, i) => s + i.pontos, 0)

const dia = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10))
/** Dias de a até b (datas AAAA-MM-DD). */
export const diasEntre = (a: string, b: string) => Math.round((dia(b) - dia(a)) / 86_400_000)
export const somarDias = (iso: string, n: number) => new Date(dia(iso) + n * 86_400_000).toISOString().slice(0, 10)
/** O dia em que a criança completa 2 anos (sai da régua). */
export function doisAnos(nasc: string) {
  const d = new Date(dia(nasc))
  d.setUTCFullYear(d.getUTCFullYear() + 2)
  return d.toISOString().slice(0, 10)
}

export type Fase = 'neonatal' | 'primeiro_ano' | 'segundo_ano'
export const ROTULO_FASE: Record<Fase, string> = { neonatal: 'Até 30 dias', primeiro_ano: '1º ano', segundo_ano: '2º ano' }

export function faseDa(nasc: string, hoje: string): Fase {
  const d = diasEntre(nasc, hoje)
  if (d <= PRIMEIRA_ATE_DIAS) return 'neonatal'
  const umAno = new Date(dia(nasc)); umAno.setUTCFullYear(umAno.getUTCFullYear() + 1)
  return hoje < umAno.toISOString().slice(0, 10) ? 'primeiro_ano' : 'segundo_ano'
}

/** Idade curta para o painel: 20 dias, 5 meses, 1 ano e 3 meses. */
export function rotuloIdadeCurta(nasc: string, hoje: string) {
  const d = diasEntre(nasc, hoje)
  if (d < 60) return `${d} ${d === 1 ? 'dia' : 'dias'}`
  const [an, mn, dn] = [+nasc.slice(0, 4), +nasc.slice(5, 7), +nasc.slice(8, 10)]
  const [ah, mh, dh] = [+hoje.slice(0, 4), +hoje.slice(5, 7), +hoje.slice(8, 10)]
  let meses = (ah - an) * 12 + (mh - mn) - (dh < dn ? 1 : 0)
  const anos = Math.floor(meses / 12); meses %= 12
  if (!anos) return `${meses} meses`
  return `${anos} ano${anos > 1 ? 's' : ''}${meses ? ` e ${meses} ${meses === 1 ? 'mês' : 'meses'}` : ''}`
}

export function estadoDoItem(c: RegistrosPuericultura & { data_nascimento: string }, item: ItemPuericultura, hoje: string): EstadoItem {
  const nasc = c.data_nascimento
  if (item === 'primeira') {
    if (c.primeira_consulta) return diasEntre(nasc, c.primeira_consulta) <= PRIMEIRA_ATE_DIAS ? 'feito' : 'perdido'
    return diasEntre(nasc, hoje) <= PRIMEIRA_ATE_DIAS ? 'no_prazo' : 'perdido'
  }
  return (c[item] ?? 0) >= META ? 'feito' : hoje < doisAnos(nasc) ? 'no_prazo' : 'perdido'
}

export const pontosDa = (c: RegistrosPuericultura & { data_nascimento: string }, hoje: string) =>
  ITENS.reduce((s, i) => s + (estadoDoItem(c, i.item, hoje) === 'feito' ? i.pontos : 0), 0)

export const temAtraso = (c: RegistrosPuericultura & { data_nascimento: string }, hoje: string) =>
  ITENS.some((i) => estadoDoItem(c, i.item, hoje) === 'perdido')

const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

/** As frases sob a linha do tempo. */
export function frasesDa(c: RegistrosPuericultura & { data_nascimento: string }, hoje: string): { perdido: string[]; aFazer: string[] } {
  const perdido: string[] = []
  const aFazer: string[] = []
  const e = estadoDoItem(c, 'primeira', hoje)
  if (e === 'perdido') {
    perdido.push(c.primeira_consulta ? `1ª consulta com ${diasEntre(c.data_nascimento, c.primeira_consulta)} dias` : 'sem consulta até o 30º dia')
  } else if (e === 'no_prazo') aFazer.push(`1ª consulta até ${ddmm(somarDias(c.data_nascimento, PRIMEIRA_ATE_DIAS))}`)
  return { perdido, aFazer }
}

/** A linha do tempo vai do nascimento aos 2 anos. */
export const posicao = (nasc: string, iso: string) =>
  Math.max(0, Math.min(100, (diasEntre(nasc, iso) / diasEntre(nasc, doisAnos(nasc))) * 100))

export type Marca = { tipo: 'consulta' | 'perdido'; pos: number; titulo: string }

export function marcasDa(c: RegistrosPuericultura & { data_nascimento: string }): Marca[] {
  const nasc = c.data_nascimento
  return (c.datas_consultas ?? []).map((d, i) => {
    const tarde = i === 0 && diasEntre(nasc, d) > PRIMEIRA_ATE_DIAS
    return { tipo: tarde ? 'perdido' : 'consulta', pos: posicao(nasc, d), titulo: `${i === 0 ? '1ª consulta' : 'Consulta'} em ${ddmm(d)}${tarde ? ', depois do 30º dia' : ''}` }
  })
}

/** Os números do topo do painel e as contagens dos filtros. */
export function resumoPuericultura(linhas: CriancaLinha[], hoje: string) {
  const fase = (f: Fase) => linhas.filter((l) => faseDa(l.data_nascimento, hoje) === f).length
  const decididas = linhas.filter((l) => estadoDoItem(l, 'primeira', hoje) !== 'no_prazo')
  return {
    total: linhas.length,
    neonatal: fase('neonatal'), primeiroAno: fase('primeiro_ano'), segundoAno: fase('segundo_ano'),
    captacao: { feitas: decididas.filter((l) => estadoDoItem(l, 'primeira', hoje) === 'feito').length, de: decididas.length },
    comAtraso: linhas.filter((l) => temAtraso(l, hoje)).length,
    semConsultaMarcada: linhas.filter((l) => !l.proxima_consulta).length,
  }
}
