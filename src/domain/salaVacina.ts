// Percurso da UBS, U15, vacina, PR 4 (VC1, VC2 e VC4 = A): sala de vacina e
// caderneta. As regras são as do LEDI APS 8.7.0 (Ficha de Vacinação e Regras
// de vacinação); o banco confere de novo (migration 20270415000028).

export type Referencias = {
  imunobiologicos: { codigo: number; nome: string; sigla: string; tem_regra: boolean }[]
  estrategias: { codigo: number; nome: string }[]
  doses: { codigo: number; nome: string; sigla: string }[]
  regras: [number, number, number][]
  grupos: { codigo: number; nome: string }[]
  vias: { codigo: number; nome: string }[]
  locais: { codigo: number; nome: string }[]
  via_local: [number, number][]
  covid: number[]
}

export type RegistroVacina = {
  id: string; registro_anterior: boolean; data_aplicacao: string; imunobiologico: number
  imunobiologico_nome: string; sigla: string; estrategia: string | null; dose: string
  lote: string | null; fabricante: string | null; via: string; local: string
  aplicado_exterior: boolean | null; registrado_por: string | null; registrado_em: string
  cancelado: boolean; motivo_cancelamento: string | null; meu: boolean
}
export type Caderneta = {
  paciente: { id: string; nome: string; nome_social: string | null; sexo: string | null; data_nascimento: string | null }
  pode_registrar: boolean; hoje: string; registros: RegistroVacina[]
}

/** Grupo "Faixa etária" do LEDI: o mais comum, vem marcado (pode trocar). */
export const GRUPO_PADRAO = 121
/** BCG: pede "comunicante de hanseníase". */
export const BCG = 15
/** Estratégia especial: pede o CBO do prescritor e o CID-10 do motivo. */
export const ESTRATEGIA_ESPECIAL = 2
/** Pesquisa: a única estratégia aceita no registro anterior. */
export const ESTRATEGIA_PESQUISA = 11

export const CONDICAO_MATERNAL = [
  { codigo: 1, rotulo: 'Nenhuma' },
  { codigo: 2, rotulo: 'Gestante' },
  { codigo: 3, rotulo: 'Puérpera' },
] as const

/** O LEDI pede a condição maternal fora do sexo masculino. */
export const pedeCondicaoMaternal = (sexo: string | null) => sexo !== 'M'

const unicos = (xs: number[]) => [...new Set(xs)]

/** Estratégias aceitas para a vacina no atendimento do dia. */
export function estrategiasDe(r: Referencias, imuno: number): Referencias['estrategias'] {
  const ok = unicos(r.regras.filter(([i]) => i === imuno).map(([, e]) => e))
  return r.estrategias.filter((e) => ok.includes(e.codigo))
}

/** Doses aceitas para a vacina e a estratégia no atendimento do dia. */
export function dosesDe(r: Referencias, imuno: number, estrategia: number): Referencias['doses'] {
  const ok = unicos(r.regras.filter(([i, e]) => i === imuno && e === estrategia).map(([, , d]) => d))
  return r.doses.filter((d) => ok.includes(d.codigo))
}

/** No registro anterior a regra do LEDI não vale; mostra primeiro as doses que a vacina usa. */
export function dosesAnterior(r: Referencias, imuno: number): Referencias['doses'] {
  const usadas = unicos(r.regras.filter(([i]) => i === imuno).map(([, , d]) => d))
  return usadas.length ? r.doses.filter((d) => usadas.includes(d.codigo)) : r.doses
}

/** Locais de aplicação aceitos para a via. */
export function locaisDe(r: Referencias, via: number): Referencias['locais'] {
  const ok = r.via_local.filter(([v]) => v === via).map(([, l]) => l)
  return r.locais.filter((l) => ok.includes(l.codigo))
}

export type FormAplicacao = {
  imunobiologico: string; estrategia: string; dose: string; lote_id: string; grupo_atendimento: string
  via: string; local: string; condicao_maternal: string; viajante: boolean; comunicante_hanseniase: '' | 'sim' | 'nao'
  prescritor_cbo: string; cid10_motivo: string
}
export type FormAnterior = {
  imunobiologico: string; dose: string; data_aplicacao: string; via: string; local: string
  condicao_maternal: string; viajante: boolean; comunicante_hanseniase: '' | 'sim' | 'nao'; aplicado_exterior: '' | 'sim' | 'nao'
}

export const APLICACAO_VAZIA: FormAplicacao = {
  imunobiologico: '', estrategia: '', dose: '', lote_id: '', grupo_atendimento: String(GRUPO_PADRAO),
  via: '', local: '', condicao_maternal: '', viajante: false, comunicante_hanseniase: '', prescritor_cbo: '', cid10_motivo: '',
}
export const ANTERIOR_VAZIO: FormAnterior = {
  imunobiologico: '', dose: '', data_aplicacao: '', via: '', local: '', condicao_maternal: '', viajante: false,
  comunicante_hanseniase: '', aplicado_exterior: '',
}

function conferirComum(r: Referencias, f: { via: string; local: string; condicao_maternal: string; comunicante_hanseniase: string; imunobiologico: string },
  sexo: string | null): string | null {
  if (!f.via) return 'Escolha a via de administração.'
  if (!f.local || !locaisDe(r, Number(f.via)).some((l) => l.codigo === Number(f.local))) return 'Escolha o local de aplicação.'
  if (pedeCondicaoMaternal(sexo) && !f.condicao_maternal) return 'Informe a condição maternal.'
  if (Number(f.imunobiologico) === BCG && !f.comunicante_hanseniase) return 'Na BCG, informe se é comunicante de hanseníase.'
  return null
}

/** O que falta na aplicação do dia (null = pode registrar). */
export function conferirAplicacao(r: Referencias, f: FormAplicacao, sexo: string | null): string | null {
  if (!f.imunobiologico) return 'Escolha a vacina.'
  if (!f.estrategia) return 'Escolha a estratégia.'
  if (!f.dose || !dosesDe(r, Number(f.imunobiologico), Number(f.estrategia)).some((d) => d.codigo === Number(f.dose))) return 'Escolha a dose.'
  if (!f.lote_id) return 'Escolha o lote.'
  if (!f.grupo_atendimento) return 'Escolha o grupo de atendimento.'
  const comum = conferirComum(r, f, sexo)
  if (comum) return comum
  if (Number(f.estrategia) === ESTRATEGIA_ESPECIAL) {
    if (!/^[0-9A-Za-z]{6}$/.test(f.prescritor_cbo.trim())) return 'Estratégia especial: informe o CBO de quem prescreveu (6 caracteres).'
    if (!/^[A-Za-z]\d{2}(\.?\d)?$/.test(f.cid10_motivo.trim())) return 'Estratégia especial: informe o CID-10 do motivo.'
  }
  return null
}

/** O que falta na transcrição da caderneta (null = pode registrar). */
export function conferirAnterior(r: Referencias, f: FormAnterior, sexo: string | null, nascimento: string | null, hoje: string): string | null {
  if (!f.imunobiologico) return 'Escolha a vacina.'
  if (!f.dose) return 'Escolha a dose.'
  if (!nascimento) return 'Complete a data de nascimento do paciente antes da caderneta.'
  if (!f.data_aplicacao) return 'Informe a data da vacina.'
  if (f.data_aplicacao > hoje || f.data_aplicacao < nascimento) return 'A data da vacina vai do nascimento até hoje.'
  const comum = conferirComum(r, f, sexo)
  if (comum) return comum
  if (r.covid.includes(Number(f.imunobiologico)) && !f.aplicado_exterior) return 'Vacina de COVID-19: informe se foi aplicada no exterior.'
  return null
}

const simNao = (v: '' | 'sim' | 'nao') => (v === '' ? undefined : v === 'sim')

/** Dados para vacina_aplicar. */
export function dadosAplicacao(f: FormAplicacao, sexo: string | null): Record<string, unknown> {
  const especial = Number(f.estrategia) === ESTRATEGIA_ESPECIAL
  return {
    imunobiologico: Number(f.imunobiologico), estrategia: Number(f.estrategia), dose: Number(f.dose), lote_id: f.lote_id,
    grupo_atendimento: Number(f.grupo_atendimento), via: Number(f.via), local: Number(f.local), viajante: f.viajante,
    ...(pedeCondicaoMaternal(sexo) ? { condicao_maternal: Number(f.condicao_maternal) } : {}),
    ...(Number(f.imunobiologico) === BCG ? { comunicante_hanseniase: simNao(f.comunicante_hanseniase) } : {}),
    ...(especial ? { prescritor_cbo: f.prescritor_cbo.trim().toUpperCase(), cid10_motivo: f.cid10_motivo.trim().toUpperCase() } : {}),
  }
}

/** Dados para vacina_registrar_anterior. */
export function dadosAnterior(r: Referencias, f: FormAnterior, sexo: string | null): Record<string, unknown> {
  return {
    imunobiologico: Number(f.imunobiologico), dose: Number(f.dose), data_aplicacao: f.data_aplicacao,
    via: Number(f.via), local: Number(f.local), viajante: f.viajante,
    ...(pedeCondicaoMaternal(sexo) ? { condicao_maternal: Number(f.condicao_maternal) } : {}),
    ...(Number(f.imunobiologico) === BCG ? { comunicante_hanseniase: simNao(f.comunicante_hanseniase) } : {}),
    ...(r.covid.includes(Number(f.imunobiologico)) ? { aplicado_exterior: simNao(f.aplicado_exterior) } : {}),
  }
}
