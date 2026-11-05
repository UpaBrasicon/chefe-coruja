// Pré-natal da UBS (5A, tarefa 7; decisões K1 a K6 = A e opção B da tela, RT
// em 05/11/2026). A régua é a nota metodológica C3 da SAPS/MS (junho de 2026),
// e os trimestres seguem o Caderno de Atenção Básica nº 32, que a nota cita.
// O banco (pre_natal_painel e pre_natal_do_paciente, migrations 20270222000001
// e 20270223000001) conta o que o app registra na janela de cada boa prática.
// Aqui fica o estado de cada uma (feito, no prazo, perdido), os pontos e a
// linha do tempo. Visita do ACS, vacina dTpa e saúde bucal não existem no app
// (K3): não pontuam, então o teto no app é 64 de 100.

export type Agravo = 'sifilis' | 'hiv' | 'hepatite_b' | 'hepatite_c'

export type Gestacao = {
  id: string
  origem: 'consulta' | 'manual'
  entrada_em: string
  dum: string | null
  dpp: string | null
  fim_gestacao: string | null
  puerperio_ate: string | null
  desfecho: 'parto' | 'aborto' | null
  desfecho_em: string | null
  proxima_consulta: string | null
  // só com a DUM (sem ela não há janela)
  primeira_consulta?: string | null
  consultas?: number
  datas_consultas?: string[]
  pa?: number
  peso_altura?: number
  testes_1tri?: Partial<Record<Agravo, string>>
  testes_3tri?: Partial<Record<'sifilis' | 'hiv', string>>
  consulta_puerperio?: string | null
}

export type PreNatalLinha = Gestacao & { paciente_id: string; nome: string; nome_social: string | null; data_nascimento: string | null }

/** Janelas em dias a partir da DUM (nota C3, itens 5 e 17; CAB 32). */
export const JANELA = {
  /** (A) 1ª consulta até a 12ª semana: 12s6d */
  primeiraAte: 90,
  /** 1º trimestre até a 13ª semana: 13s6d */
  t1Ate: 97,
  /** 3º trimestre a partir de 28s0d */
  t3Desde: 196,
  /** sem desfecho, a gestação termina com 42 semanas */
  fim: 294,
  /** puerpério: 42 dias depois do fim */
  puerperio: 42,
} as const

/** Pelo menos 7 consultas, pressões e pesos com altura na gestação (B, C, D). */
export const META = 7

export type ItemPreNatal = 'primeira' | 'consultas' | 'pa' | 'peso_altura' | 'testes_1tri' | 'testes_3tri' | 'puerperio'
export type EstadoItem = 'feito' | 'no_prazo' | 'perdido' | 'ainda_nao'

/** Quadro 01 da nota C3: os itens que o app registra. */
export const ITENS: { item: ItemPreNatal; letra: string; rotulo: string; pontos: number }[] = [
  { item: 'primeira', letra: 'A', rotulo: '1ª consulta até 12 semanas', pontos: 10 },
  { item: 'consultas', letra: 'B', rotulo: 'Consultas', pontos: 9 },
  { item: 'pa', letra: 'C', rotulo: 'Pressão', pontos: 9 },
  { item: 'peso_altura', letra: 'D', rotulo: 'Peso e altura', pontos: 9 },
  { item: 'testes_1tri', letra: 'G', rotulo: 'Testes do 1º trimestre', pontos: 9 },
  { item: 'testes_3tri', letra: 'H', rotulo: 'Testes do 3º trimestre', pontos: 9 },
  { item: 'puerperio', letra: 'I', rotulo: 'Consulta no puerpério', pontos: 9 },
]
/** E, F, J e K (visitas do ACS, dTpa, saúde bucal): fora do app. */
export const FORA_DO_APP = [
  { letra: 'E', rotulo: '3 visitas do ACS', pontos: 9 },
  { letra: 'F', rotulo: 'Vacina dTpa a partir de 20 semanas', pontos: 9 },
  { letra: 'J', rotulo: 'Visita do ACS no puerpério', pontos: 9 },
  { letra: 'K', rotulo: 'Atividade de saúde bucal', pontos: 9 },
]
export const TETO_NO_APP = ITENS.reduce((s, i) => s + i.pontos, 0)

export const AGRAVOS_1TRI: Agravo[] = ['sifilis', 'hiv', 'hepatite_b', 'hepatite_c']
export const AGRAVOS_3TRI: ('sifilis' | 'hiv')[] = ['sifilis', 'hiv']
export const ROTULO_AGRAVO: Record<Agravo, string> = { sifilis: 'sífilis', hiv: 'HIV', hepatite_b: 'hepatite B', hepatite_c: 'hepatite C' }

const dia = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10))
/** Dias de a até b (datas AAAA-MM-DD). */
export const diasEntre = (a: string, b: string) => Math.round((dia(b) - dia(a)) / 86_400_000)
/** A data AAAA-MM-DD mais n dias. */
export const somarDias = (iso: string, n: number) => new Date(dia(iso) + n * 86_400_000).toISOString().slice(0, 10)
/** Idade gestacional no formato 9s2d. */
export const rotuloIG = (dias: number) => `${Math.floor(dias / 7)}s${dias % 7}d`

/** Fim da gestação: o desfecho ou DUM + 294 dias. */
export const fimDaGestacao = (g: Pick<Gestacao, 'dum' | 'desfecho_em'>) =>
  g.desfecho_em ?? (g.dum ? somarDias(g.dum, JANELA.fim) : null)

export type Fase = 'sem_dum' | 't1' | 't2' | 't3' | 'puerperio'
export const ROTULO_FASE: Record<Fase, string> = {
  sem_dum: 'Sem DUM', t1: '1º trimestre', t2: '2º trimestre', t3: '3º trimestre', puerperio: 'Puerpério',
}

/** Em que ponto está a gestação hoje. */
export function faseDa(g: Pick<Gestacao, 'dum' | 'desfecho' | 'desfecho_em'>, hoje: string): Fase {
  const fim = fimDaGestacao(g)
  if (g.desfecho === 'parto' || (fim && hoje > fim)) return 'puerperio'
  if (!g.dum) return 'sem_dum'
  const ig = diasEntre(g.dum, hoje)
  return ig <= JANELA.t1Ate ? 't1' : ig < JANELA.t3Desde ? 't2' : 't3'
}

/** Dia do puerpério (1 a 42), ou null fora dele. */
export function diaDoPuerperio(g: Pick<Gestacao, 'dum' | 'desfecho_em'>, hoje: string) {
  const fim = fimDaGestacao(g)
  if (!fim || hoje <= fim) return null
  return diasEntre(fim, hoje)
}

/** O estado de cada boa prática hoje; null sem a DUM (não há janela). */
export function estadoDoItem(g: Gestacao, item: ItemPreNatal, hoje: string): EstadoItem | null {
  if (!g.dum) return null
  const fim = fimDaGestacao(g)!
  const emGestacao = hoje <= fim
  const ig = diasEntre(g.dum, hoje)
  switch (item) {
    case 'primeira':
      if (g.primeira_consulta) return diasEntre(g.dum, g.primeira_consulta) <= JANELA.primeiraAte ? 'feito' : 'perdido'
      return emGestacao && ig <= JANELA.primeiraAte ? 'no_prazo' : 'perdido'
    case 'consultas': case 'pa': case 'peso_altura':
      return (g[item] ?? 0) >= META ? 'feito' : emGestacao ? 'no_prazo' : 'perdido'
    case 'testes_1tri':
      return faltaTestes(g, 1).length === 0 ? 'feito' : emGestacao && ig <= JANELA.t1Ate ? 'no_prazo' : 'perdido'
    case 'testes_3tri':
      if (faltaTestes(g, 3).length === 0) return 'feito'
      if (!emGestacao) return 'perdido'
      return ig < JANELA.t3Desde ? 'ainda_nao' : 'no_prazo'
    case 'puerperio':
      if (g.consulta_puerperio) return 'feito'
      if (emGestacao) return 'ainda_nao'
      return diasEntre(fim, hoje) <= JANELA.puerperio ? 'no_prazo' : 'perdido'
  }
}

/** Os testes que faltam no 1º ou no 3º trimestre. */
export function faltaTestes(g: Gestacao, tri: 1 | 3): Agravo[] {
  return tri === 1 ? AGRAVOS_1TRI.filter((a) => !g.testes_1tri?.[a]) : AGRAVOS_3TRI.filter((a) => !g.testes_3tri?.[a])
}

/** Até quando vale cada boa prática (para "até 22/11"). */
export function prazoDoItem(g: Gestacao, item: ItemPreNatal): string | null {
  if (!g.dum) return null
  const fim = fimDaGestacao(g)!
  switch (item) {
    case 'primeira': return somarDias(g.dum, JANELA.primeiraAte)
    case 'testes_1tri': return somarDias(g.dum, JANELA.t1Ate)
    case 'puerperio': return somarDias(fim, JANELA.puerperio)
    default: return fim
  }
}

/** Pontos da gestação pela nota (só o que o app registra). */
export const pontosDa = (g: Gestacao, hoje: string) =>
  ITENS.reduce((s, i) => s + (estadoDoItem(g, i.item, hoje) === 'feito' ? i.pontos : 0), 0)

/** Alguma boa prática com o prazo perdido (a busca ativa). */
export const temAtraso = (g: Gestacao, hoje: string) => ITENS.some((i) => estadoDoItem(g, i.item, hoje) === 'perdido')

const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const lista = (xs: string[]) => xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}`

/** As frases sob a linha do tempo: o que perdeu o prazo e o que está a fazer. */
export function frasesDa(g: Gestacao, hoje: string): { perdido: string[]; aFazer: string[] } {
  const perdido: string[] = []
  const aFazer: string[] = []
  if (!g.dum) return { perdido, aFazer }
  const e = (i: ItemPreNatal) => estadoDoItem(g, i, hoje)
  if (e('primeira') === 'perdido') {
    perdido.push(g.primeira_consulta ? `1ª consulta com ${Math.floor(diasEntre(g.dum, g.primeira_consulta) / 7)} semanas` : '1ª consulta não foi até 12 semanas')
  } else if (e('primeira') === 'no_prazo') aFazer.push(`1ª consulta até ${ddmm(prazoDoItem(g, 'primeira')!)}`)
  const t1 = faltaTestes(g, 1).map((a) => ROTULO_AGRAVO[a])
  if (e('testes_1tri') === 'perdido') perdido.push(`testes do 1º trimestre sem ${lista(t1)}`)
  else if (e('testes_1tri') === 'no_prazo') aFazer.push(`${lista(t1)} até ${ddmm(prazoDoItem(g, 'testes_1tri')!)}`)
  const t3 = faltaTestes(g, 3).map((a) => ROTULO_AGRAVO[a])
  if (e('testes_3tri') === 'perdido') perdido.push(`testes do 3º trimestre sem ${lista(t3)}`)
  else if (e('testes_3tri') === 'no_prazo') aFazer.push(`${lista(t3)} do 3º trimestre até ${ddmm(prazoDoItem(g, 'testes_3tri')!)}`)
  const contas = (['consultas', 'pa', 'peso_altura'] as const).filter((i) => e(i) === 'perdido')
  if (contas.length) perdido.push(contas.map((i) => `${ITENS.find((x) => x.item === i)!.rotulo.toLowerCase()} ${g[i] ?? 0}/${META}`).join(' · '))
  if (e('puerperio') === 'perdido') perdido.push('sem consulta no puerpério')
  else if (e('puerperio') === 'no_prazo') aFazer.push(`consulta do puerpério até ${ddmm(prazoDoItem(g, 'puerperio')!)}`)
  return { perdido, aFazer }
}

/** A linha do tempo: 294 dias de gestação mais os 42 do puerpério. */
export const ESCALA_DIAS = JANELA.fim + JANELA.puerperio
/** Posição (0 a 100) de uma data na linha do tempo. */
export const posicao = (dum: string, iso: string) =>
  Math.max(0, Math.min(100, (diasEntre(dum, iso) / ESCALA_DIAS) * 100))

export type Marca = { tipo: 'consulta' | 'teste' | 'perdido'; pos: number; titulo: string }

/** As marcas da linha do tempo: consultas, testes e a 1ª consulta tardia. */
export function marcasDa(g: Gestacao): Marca[] {
  if (!g.dum) return []
  const dum = g.dum
  const out: Marca[] = []
  const consultas = g.datas_consultas ?? (g.primeira_consulta ? [g.primeira_consulta] : [])
  consultas.forEach((d, i) => {
    const tarde = i === 0 && diasEntre(dum, d) > JANELA.primeiraAte
    out.push({ tipo: tarde ? 'perdido' : 'consulta', pos: posicao(dum, d), titulo: `${i === 0 ? '1ª consulta' : 'Consulta'} em ${ddmm(d)}${tarde ? ', depois de 12 semanas' : ''}` })
  })
  const testes = new Map<string, string[]>()
  for (const [a, d] of [...Object.entries(g.testes_1tri ?? {}), ...Object.entries(g.testes_3tri ?? {})]) {
    if (d) testes.set(d, [...(testes.get(d) ?? []), ROTULO_AGRAVO[a as Agravo]])
  }
  for (const [d, nomes] of testes) out.push({ tipo: 'teste', pos: posicao(dum, d), titulo: `Teste de ${lista(nomes)} em ${ddmm(d)}` })
  if (g.consulta_puerperio) out.push({ tipo: 'consulta', pos: posicao(dum, g.consulta_puerperio), titulo: `Consulta do puerpério em ${ddmm(g.consulta_puerperio)}` })
  return out
}

/** Os números do topo do painel e as contagens dos filtros. */
export function resumoPreNatal(linhas: PreNatalLinha[], hoje: string) {
  const fase = (f: Fase) => linhas.filter((l) => faseDa(l, hoje) === f).length
  const comDum = linhas.filter((l) => l.dum && faseDa(l, hoje) !== 'puerperio')
  const primeiraDecidida = comDum.filter((l) => estadoDoItem(l, 'primeira', hoje) !== 'no_prazo')
  return {
    total: linhas.length,
    puerperas: fase('puerperio'),
    gestantes: linhas.length - fase('puerperio'),
    t1: fase('t1'), t2: fase('t2'), t3: fase('t3'), semDum: fase('sem_dum'),
    captacao: { feitas: primeiraDecidida.filter((l) => estadoDoItem(l, 'primeira', hoje) === 'feito').length, de: primeiraDecidida.length },
    comAtraso: linhas.filter((l) => temAtraso(l, hoje)).length,
    semConsultaMarcada: linhas.filter((l) => !l.proxima_consulta).length,
  }
}

// Nota C3, item 24-f: problema "pré-natal" da ficha, CIAP-2 e CID-10 de
// gestação (os mesmos de private.pre_natal_gestacao_na_consulta). CID de 3
// caracteres pega a categoria; de 4, só a subcategoria.
export const CIAP_GESTACAO = ['W03', 'W78', 'W79', 'W81', 'W84', 'W85']
export const CID_GESTACAO = [
  'O10', 'O11', 'O12', 'O13', 'O14', 'O15', 'O16', 'O20', 'O21', 'O22', 'O23', 'O24', 'O25', 'O26', 'O28', 'O29',
  'O30', 'O31', 'O32', 'O33', 'O34', 'O35', 'O36', 'O40', 'O41', 'O43', 'O44', 'O46', 'O47', 'O48', 'O752', 'O753', 'O98',
  'O990', 'O991', 'O992', 'O993', 'O994', 'O995', 'O996', 'O997', 'Z321', 'Z33', 'Z34', 'Z35', 'Z36', 'Z640',
]

/** A consulta marca a gestação: a gestante entra no pré-natal quando ela encerrar. */
export function consultaIndicaGestacao(problemas: string[], cids: string[], ciaps: string[]) {
  return problemas.includes('pre_natal')
    || ciaps.some((c) => CIAP_GESTACAO.includes(c.toUpperCase()))
    || cids.some((c) => { const n = c.replace('.', '').toUpperCase().trim(); return CID_GESTACAO.some((l) => n.startsWith(l)) })
}
