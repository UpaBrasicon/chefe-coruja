// Vocabulário do cadastro do paciente (identificação para o SUS).

/** Raça/cor pelas categorias do IBGE, como o SUS pede no laudo de AIH (99 = sem informação). */
export const RACAS_COR = [
  { valor: 'branca', rotulo: 'Branca' },
  { valor: 'preta', rotulo: 'Preta' },
  { valor: 'parda', rotulo: 'Parda' },
  { valor: 'amarela', rotulo: 'Amarela' },
  { valor: 'indigena', rotulo: 'Indígena' },
  { valor: 'sem_informacao', rotulo: 'Sem informação' },
] as const
export type RacaCor = (typeof RACAS_COR)[number]['valor']

export const CATEGORIAS = [
  { valor: 'sus', rotulo: 'SUS' },
  { valor: 'convenio', rotulo: 'Convênio' },
  { valor: 'particular', rotulo: 'Particular' },
] as const
export type Categoria = (typeof CATEGORIAS)[number]['valor']

export const ESTADOS_CIVIS = ['Solteiro(a)', 'Casado(a)', 'União estável', 'Separado(a) ou divorciado(a)', 'Viúvo(a)', 'Ignorado'] as const

export const SEXOS = [
  { valor: 'F', rotulo: 'Feminino' },
  { valor: 'M', rotulo: 'Masculino' },
] as const

type CadastroAih = {
  prontuario?: string | null
  cns?: string | null
  data_nascimento?: string | null
  sexo?: string | null
  raca_cor?: string | null
  nome_mae?: string | null
  endereco?: string | null
  municipio?: string | null
  uf?: string | null
}

/**
 * O que falta no cadastro para o laudo de AIH sair completo (protótipo:
 * aihCadastroFalta). "Sem informação" em raça/cor é resposta válida.
 */
export function faltasParaAih(p: CadastroAih): string[] {
  const campos: [keyof CadastroAih, string][] = [
    ['prontuario', 'prontuário'],
    ['cns', 'CNS'],
    ['data_nascimento', 'data de nascimento'],
    ['sexo', 'sexo'],
    ['raca_cor', 'raça/cor'],
    ['nome_mae', 'nome da mãe'],
    ['endereco', 'endereço'],
    ['municipio', 'município'],
    ['uf', 'UF'],
  ]
  return campos.filter(([k]) => !String(p[k] ?? '').trim()).map(([, r]) => r)
}
