// Perfil Gestor da secretaria, o que ficou de fora (pedido do RT, 24/11/2026):
// regras puras das telas de Indicadores e de Pessoas da unidade. O banco
// confere tudo de novo (migration 20270421000024).
import type { Papel } from '@/types/database'

// ── Indicadores ──────────────────────────────────────────────────────────

export type EscalaDoMes = { plantoes: number; faixas: number; cobertas: number; com_vaga: number; vagas: number }

export type IndicadorUnidade = {
  id: string
  nome: string
  tipo: string
  secretaria: string | null
  leitos: { total: number; ocupados: number | null; livres: number; higienizacao: number; reservados: number; bloqueados: number; taxa: number | null }
  pessoas: Partial<Record<Papel, number>>
  pessoas_total: number
  escala: EscalaDoMes
  atendimentos: number | null
  internacoes: number | null
}

export type Indicadores = { competencia: string; unidades: IndicadorUnidade[] }

/** Contagem de paciente de 1 a 4 volta vazia do banco (ADR 0002). */
export function contagem(n: number | null | undefined): string {
  return n === null || n === undefined ? '< 5' : String(n)
}

/** "72,5%"; sem taxa (unidade pequena ou sem leito), um traço. */
export function porcento(n: number | null | undefined): string {
  return n === null || n === undefined ? '—' : `${String(n).replace('.', ',')}%`
}

/** Parte das faixas do mês com alguém escalado e sem vaga aberta. */
export function cobertura(e: EscalaDoMes): number | null {
  const comPlantao = e.cobertas + e.com_vaga
  if (comPlantao === 0) return null
  return Math.round((1000 * e.cobertas) / comPlantao) / 10
}

/** Soma das unidades (a linha "Todas"). A ocupação some se alguma unidade veio suprimida. */
export function totalDaSecretaria(us: IndicadorUnidade[]): {
  leitos: number; ocupados: number | null; taxa: number | null; pessoas: number; plantoes: number; vagas: number
  atendimentos: number | null; internacoes: number | null
} {
  const soma = (f: (u: IndicadorUnidade) => number) => us.reduce((n, u) => n + f(u), 0)
  const somaSuprimida = (f: (u: IndicadorUnidade) => number | null) => {
    let n = 0
    for (const u of us) {
      const v = f(u)
      if (v === null) return null
      n += v
    }
    return n
  }
  const leitos = soma((u) => u.leitos.total)
  const ocupados = somaSuprimida((u) => (u.leitos.total === 0 ? 0 : u.leitos.ocupados))
  return {
    leitos,
    ocupados,
    taxa: ocupados !== null && leitos > 0 ? Math.round((1000 * ocupados) / leitos) / 10 : null,
    pessoas: soma((u) => u.pessoas_total),
    plantoes: soma((u) => u.escala.plantoes),
    vagas: soma((u) => u.escala.vagas),
    atendimentos: somaSuprimida((u) => u.atendimentos),
    internacoes: somaSuprimida((u) => u.internacoes),
  }
}

/** Os papéis com gente, do maior para o menor. */
export function papeisComGente(p: Partial<Record<Papel, number>>): [Papel, number][] {
  return (Object.entries(p) as [Papel, number][]).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
}

// ── Rede: a linha de cada unidade (SE1 e SE2, RT 24/11/2026) ─────────────

/** O que secretaria_estado_unidades devolve (migration 20270421000080). */
export type EstadoUnidade = {
  id: string
  leitos: number
  /** número exato desde a migration 20270422000095 (RT, 25/11/2026); vazio só no banco antigo */
  ocupados: number | null
  ocupacao: number | null
  hoje: { plantoes: number; cobertas: number; com_vaga: number; vagas: number }
  vagas_ate_fim_do_mes: number
  /** número exato desde a migration 20270422000095 (RT, 25/11/2026); vazio só no banco antigo */
  regulacoes_vencidas: number | null
  /** cada pessoa uma vez, não cada vínculo */
  pessoas: number
}

export type PedacoEstado = { texto: string; atencao?: boolean }

/** A linha da unidade na Rede: ocupação, escala de hoje, vagas do mês e regulações vencidas. */
export function resumoEstado(e: EstadoUnidade): PedacoEstado[] {
  const p: PedacoEstado[] = []
  if (e.leitos === 0) p.push({ texto: 'sem leito' })
  else if (e.ocupacao === null) p.push({ texto: `menos de 5 de ${e.leitos} leitos ocupados` })
  else p.push({ texto: `ocupação ${porcento(e.ocupacao)} (${e.ocupados} de ${e.leitos})` })

  const turnos = e.hoje.cobertas + e.hoje.com_vaga
  if (turnos === 0) p.push({ texto: 'sem escala hoje' })
  else p.push({ texto: `escala de hoje ${e.hoje.cobertas} de ${turnos} ${turnos === 1 ? 'turno coberto' : 'turnos cobertos'}`, atencao: e.hoje.com_vaga > 0 })

  const v = e.vagas_ate_fim_do_mes
  p.push(v === 0 ? { texto: 'sem vaga aberta no mês' } : { texto: `${v} ${v === 1 ? 'vaga aberta' : 'vagas abertas'} no mês`, atencao: true })

  const r = e.regulacoes_vencidas
  if (r === null) p.push({ texto: 'menos de 5 regulações vencidas', atencao: true })
  else if (r === 0) p.push({ texto: 'nenhuma regulação vencida' })
  else p.push({ texto: `${r} ${r === 1 ? 'regulação vencida' : 'regulações vencidas'}`, atencao: true })
  return p
}

/** Pessoas da unidade: a conta da secretaria (pessoa uma vez) quando há; senão, a da árvore. */
export function pessoasDaUnidade(estado: Pick<EstadoUnidade, 'pessoas'> | undefined, daArvore: number): number {
  return estado ? estado.pessoas : daArvore
}

// ── Pessoas da unidade ───────────────────────────────────────────────────

export type QuemMuda = 'gestor' | 'secretaria' | 'admin'

/** Papéis da unidade que a tela oferece. Rede, administrador e o perfil da secretaria ficam fora (o banco recusa). */
const PAPEIS_DA_UNIDADE: readonly Papel[] = [
  'plantonista', 'enfermeiro', 'tecnico_enfermagem', 'recepcao', 'farmaceutico', 'telemedicina',
  'regulador', 'faturamento', 'nir',
]

export function papeisOferecidos(quem: QuemMuda): Papel[] {
  return quem === 'gestor' ? [...PAPEIS_DA_UNIDADE] : ['gestor', ...PAPEIS_DA_UNIDADE]
}

const CONSELHO_DO_PAPEL: Partial<Record<Papel, string>> = {
  plantonista: 'CRM', telemedicina: 'CRM', enfermeiro: 'COREN', tecnico_enfermagem: 'COREN', farmaceutico: 'CRF',
}

/** Aviso antes de salvar: papel que atende paciente pede o registro do conselho certo. */
export function avisoDeRegistro(papel: Papel, conselho: string | null): string | null {
  const precisa = CONSELHO_DO_PAPEL[papel]
  if (!precisa) return null
  if (!conselho) return 'Sem registro profissional no cadastro: este papel entra pelo convite, onde a pessoa informa o registro.'
  if (conselho !== precisa) return `O registro da pessoa é ${conselho}; este papel pede ${precisa}.`
  return null
}

/** O gestor da unidade não mexe em outro gestor nem no administrador (o banco confere). */
export function podeMexer(quem: QuemMuda, papeisDaPessoa: readonly string[]): boolean {
  if (quem !== 'gestor') return !papeisDaPessoa.includes('admin') || quem === 'admin'
  return !papeisDaPessoa.includes('gestor') && !papeisDaPessoa.includes('admin')
}

/** O que muda entre a lista atual e a nova, para a frase de confirmação. */
export function diferenca(atuais: readonly string[], novos: readonly string[]): { entram: string[]; saem: string[] } {
  return {
    entram: novos.filter((p) => !atuais.includes(p)),
    saem: atuais.filter((p) => !novos.includes(p)),
  }
}
