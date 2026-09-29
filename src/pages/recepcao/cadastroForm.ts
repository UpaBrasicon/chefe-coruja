import { erroCns, erroCpf, erroNascimento, soDigitos } from '@/lib/documentos'
import { idadeEm } from '@/domain/idade'

// Modelo do formulário de cadastro (Recepção e porta).

export const CADASTRO_VAZIO = {
  nome: '', nome_social: '', data_nascimento: '', sexo: '', raca_cor: '', nome_mae: '', cpf: '', cns: '',
  estado_civil: '', categoria: '', convenio: '', telefone: '', endereco: '', municipio: '', uf: '',
  responsavel_nome: '', responsavel_parentesco: '', responsavel_documento: '', responsavel_telefone: '',
}
export type Cadastro = typeof CADASTRO_VAZIO
export type CampoCadastro = keyof Cadastro

/** Campos que identificam a pessoa: a Recepção não troca pela ficha de um cadastro existente. */
export const IDENTIDADE: CampoCadastro[] = ['nome', 'nome_social', 'data_nascimento', 'sexo', 'nome_mae']

export const hojeSP = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })

/** Erros de digitação que impedem gravar (os mesmos que o servidor recusa). */
export function errosCadastro(c: Partial<Cadastro>, hoje = hojeSP()): Partial<Record<CampoCadastro, string>> {
  const e: Partial<Record<CampoCadastro, string>> = {}
  const cpf = erroCpf(c.cpf ?? '')
  const cns = erroCns(c.cns ?? '')
  const nasc = erroNascimento(c.data_nascimento ?? '', hoje)
  if (cpf) e.cpf = cpf
  if (cns) e.cns = cns
  if (nasc) e.data_nascimento = nasc
  return e
}

/** Documentos só com dígitos, UF em maiúsculas, convênio só na categoria convênio. */
export function normalizarCadastro<T extends Partial<Cadastro>>(c: T): T {
  const s = { ...c }
  if (s.cpf !== undefined) s.cpf = soDigitos(s.cpf)
  if (s.cns !== undefined) s.cns = soDigitos(s.cns)
  if (s.uf !== undefined) s.uf = s.uf.toUpperCase()
  if (s.convenio !== undefined && s.categoria !== undefined && s.categoria !== 'convenio') s.convenio = ''
  return s
}

/** "34 anos", "5 meses", "12 dias". */
export function idadeLegivel(nascimento: string, hoje = hojeSP()): string {
  const i = nascimento ? idadeEm(nascimento, hoje) : null
  if (!i) return ''
  if (i.anos >= 2) return `${i.anos} anos`
  const meses = i.anos * 12 + i.meses
  if (meses >= 1) return meses === 1 ? '1 mês' : `${meses} meses`
  return i.totalDias === 1 ? '1 dia' : `${i.totalDias} dias`
}
