// Evoluir hoje (EV2, revisão da Internação aprovada pelo RT em 24/11/2026):
// o que poupa digitação sem tirar a revisão do médico.
//
// - Sinais vitais da última aferição da enfermagem entram como foram
//   registrados (texto cru, sem arredondar), com a hora; o médico edita.
// - "Copiar da evolução anterior" é por bloco, e o bloco copiado fica marcado
//   até o médico editar ou confirmar: a evolução não é registrada com bloco
//   copiado sem revisão (risco de copiar sem rever).
// - "Sem alterações" por sistema do exame físico é um atalho explícito; o
//   aviso de termo vago não conta esse texto exato.
// Sem dependência de tela: os testes rodam no node.

export type BlocoCopiavel = 's' | 'exame_fisico' | 'outros_achados' | 'exames' | 'a' | 'p'

export const BLOCOS_COPIAVEIS: { k: BlocoCopiavel; rotulo: string }[] = [
  { k: 's', rotulo: 'Subjetivo' },
  { k: 'exame_fisico', rotulo: 'Exame físico' },
  { k: 'outros_achados', rotulo: 'Outros achados' },
  { k: 'exames', rotulo: 'Exames complementares' },
  { k: 'a', rotulo: 'Avaliação' },
  { k: 'p', rotulo: 'Conduta / plano' },
]

/** O texto do atalho "sem alterações" de um sistema do exame físico. */
export const SEM_ALTERACOES = 'Sem alterações ao exame.'

type ExameFisico = Record<string, string>
type ComBlocos = { s: string; exame_fisico: ExameFisico; outros_achados: string; exames: string; a: string; p: string }
type Anterior = Partial<{ s: string; exame_fisico: Partial<ExameFisico>; outros_achados: string; exames: string; a: string; p: string }>

/** A evolução anterior tem texto neste bloco? (o botão de copiar só aparece quando tem) */
export function temNoAnterior(anterior: Anterior | null | undefined, bloco: BlocoCopiavel): boolean {
  if (!anterior) return false
  if (bloco === 'exame_fisico') return Object.values(anterior.exame_fisico ?? {}).some((v) => !!v?.trim())
  return !!anterior[bloco]?.trim()
}

/** Copia um bloco da evolução anterior para o formulário (o resto fica como está). */
export function copiarBloco<F extends ComBlocos>(f: F, anterior: Anterior, bloco: BlocoCopiavel): F {
  if (bloco === 'exame_fisico') {
    const ef = { ...f.exame_fisico }
    for (const [k, v] of Object.entries(anterior.exame_fisico ?? {})) if (v?.trim()) ef[k] = v
    return { ...f, exame_fisico: ef }
  }
  return { ...f, [bloco]: anterior[bloco] ?? '' }
}

/** O bloco a que um campo do formulário pertence ("exame_fisico.acv" → exame_fisico). */
export function blocoDoCampo(campo: string): BlocoCopiavel | null {
  const raiz = campo.split('.')[0]
  return BLOCOS_COPIAVEIS.some((b) => b.k === raiz) ? (raiz as BlocoCopiavel) : null
}

/** Rótulos dos blocos copiados que ainda esperam revisão, na ordem do formulário. */
export function copiadosSemRevisao(copiados: ReadonlySet<BlocoCopiavel>): string[] {
  return BLOCOS_COPIAVEIS.filter((b) => copiados.has(b.k)).map((b) => b.rotulo)
}

export type SvEnfermagemCru = {
  pa: string | null; fc: string | null; fr: string | null; temp: string | null; spo2: string | null; glic: string | null
  condicao: 'ar' | 'o2' | null
}

/**
 * Os sinais vitais da enfermagem como foram gravados (texto cru), só nos
 * campos vazios do formulário: o que o médico já escreveu não é trocado.
 */
export function vitaisDaEnfermagem<S extends Record<string, string>>(sv: S, cond: '' | 'ar' | 'o2', enf: SvEnfermagemCru):
  { sv: S; sv_condicao: '' | 'ar' | 'o2'; trouxe: string[] } {
  const novo: Record<string, string> = { ...sv }
  const trouxe: string[] = []
  for (const k of ['pa', 'fc', 'fr', 'temp', 'spo2', 'glic'] as const) {
    const v = enf[k]
    if (v != null && String(v).trim() !== '' && !(novo[k] ?? '').trim()) { novo[k] = String(v); trouxe.push(k) }
  }
  return { sv: novo as S, sv_condicao: cond || enf.condicao || '', trouxe }
}

/** Termos vagos (o aviso de antes), sem contar o atalho "sem alterações" exato do exame físico. */
export function temTermoVago(textos: string[], exameFisico: string[]): boolean {
  const ef = exameFisico.filter((t) => t.trim() !== SEM_ALTERACOES)
  const txt = [...textos, ...ef].join(' ')
  return [/paciente bem/i, /quadro est[aá]vel/i, /sem altera[cç][oõ]es/i, /\bBEG\b/].some((r) => r.test(txt))
}
