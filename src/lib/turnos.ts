/**
 * Turnos da escala por unidade (pedido do RT, 24/11/2026; migration
 * 20270421000050_turnos_unidade). Cada unidade começa com manhã 07–13, tarde
 * 13–19 e noite 19–07 (códigos 'manha', 'tarde', 'noite', horário fixo) e
 * cadastra os seus: Diurno 07–19, Diarista 08–17, sobreaviso... O turno novo
 * tem código próprio ('t' + 10 letras) e as grades usam a lista da unidade.
 * Puro, para teste (src/lib/turnos.test.ts).
 */

export type CobreTurno = 'todos' | 'medico' | 'enfermagem'

export type Turno = {
  id?: string
  codigo: string
  nome: string
  /** 'HH:MM' ou 'HH:MM:SS' (o banco devolve com segundos) */
  inicio: string
  fim: string
  duracao_min: number
  cobre: CobreTurno
  sobreaviso: boolean
  padrao: boolean
  ordem: number
  ativo: boolean
}

/** Os três de sempre: o que a unidade tem antes de cadastrar qualquer turno. */
export const TURNOS_PADRAO: Turno[] = [
  { codigo: 'manha', nome: 'Manhã', inicio: '07:00', fim: '13:00', duracao_min: 360, cobre: 'todos', sobreaviso: false, padrao: true, ordem: 10, ativo: true },
  { codigo: 'tarde', nome: 'Tarde', inicio: '13:00', fim: '19:00', duracao_min: 360, cobre: 'todos', sobreaviso: false, padrao: true, ordem: 20, ativo: true },
  { codigo: 'noite', nome: 'Noite', inicio: '19:00', fim: '07:00', duracao_min: 720, cobre: 'todos', sobreaviso: false, padrao: true, ordem: 30, ativo: true },
]

/** Nome dos códigos antigos (madrugada não está no cadastro, mas existe em plantão antigo). */
const NOME_ANTIGO: Record<string, string> = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite', madrugada: 'Madrugada' }
const INICIO_ANTIGO: Record<string, string> = { manha: '07:00', tarde: '13:00', noite: '19:00', madrugada: '01:00' }

export const COBRE_TURNO: { valor: CobreTurno; rotulo: string }[] = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'medico', rotulo: 'Médico' },
  { valor: 'enfermagem', rotulo: 'Enfermagem' },
]

/** '07:00:00' → '07:00' */
export const hhmm = (t: string) => t.slice(0, 5)

/** '07:00' → '07h'; '07:30' → '07h30' */
export function horaCurta(t: string): string {
  const [h, m] = hhmm(t).split(':')
  return m === '00' ? `${h}h` : `${h}h${m}`
}

/** '07h–19h' */
export const horarioDoTurno = (t: Pick<Turno, 'inicio' | 'fim'>) => `${horaCurta(t.inicio)}–${horaCurta(t.fim)}`

/** Minutos entre início e fim, passando da meia-noite; início = fim vale 24 h (igual a private.minutos_do_turno). */
export function minutosDoTurno(inicio: string, fim: string): number {
  const min = (t: string) => {
    const [h, m] = hhmm(t).split(':').map(Number)
    return h * 60 + m
  }
  return ((min(fim) - min(inicio) + 1439) % 1440 + 1440) % 1440 + 1
}

/** 720 → '12 h'; 570 → '9 h 30' */
export function rotuloHoras(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`
}

/** Ativos, na ordem do cadastro; sem cadastro, os três de sempre. */
export function turnosAtivos(turnos: Turno[] | undefined | null): Turno[] {
  const lista = (turnos ?? []).filter((t) => t.ativo).sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome))
  return turnos && turnos.length > 0 ? lista : TURNOS_PADRAO
}

/** Nome do turno pelo código: o do cadastro da unidade, o de sempre ou o próprio código. */
export function rotuloTurno(codigo: string | null | undefined, turnos?: Turno[] | null): string {
  if (!codigo) return ''
  return turnos?.find((t) => t.codigo === codigo)?.nome ?? NOME_ANTIGO[codigo] ?? codigo
}

/** Hora de início ('HH:MM') do turno: do cadastro, ou a dos códigos de sempre. */
export function inicioDoCodigo(codigo: string, turnos?: Turno[] | null): string | undefined {
  const t = turnos?.find((x) => x.codigo === codigo)
  return t ? hhmm(t.inicio) : INICIO_ANTIGO[codigo]
}

/** Confere o formulário antes de mandar ao banco (as mesmas regras de salvar_turno_unidade). */
export function validarTurno(t: { nome: string; inicio: string; fim: string }): string | null {
  const nome = t.nome.trim()
  if (nome.length < 1 || nome.length > 40) return 'Dê um nome ao turno, com até 40 letras.'
  if (!/^\d{2}:\d{2}/.test(t.inicio) || !/^\d{2}:\d{2}/.test(t.fim)) return 'Informe o início e o fim do turno.'
  if (minutosDoTurno(t.inicio, t.fim) < 60) return 'O turno precisa ter pelo menos 1 hora.'
  return null
}
