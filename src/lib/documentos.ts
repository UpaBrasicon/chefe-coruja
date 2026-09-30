// Conferência de digitação no cadastro do paciente: CPF, Cartão Nacional de
// Saúde (CNS) e data de nascimento. São limites do que é possível digitar,
// não regra clínica. O servidor repete a conferência de CPF e CNS
// (private.cpf_valido / private.cns_valido) em toda gravação nova ou alterada.

/** Só os dígitos do texto. */
export const soDigitos = (t: string | null | undefined) => String(t ?? '').replace(/\D/g, '')

/** CPF: 11 dígitos, não todos iguais, e os dois dígitos verificadores conferem. */
export function cpfValido(cpf: string | null | undefined): boolean {
  const d = soDigitos(cpf)
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false
  for (let t = 9; t < 11; t++) {
    let soma = 0
    for (let i = 0; i < t; i++) soma += Number(d[i]) * (t + 1 - i)
    if (((soma * 10) % 11) % 10 !== Number(d[t])) return false
  }
  return true
}

/**
 * CNS pelo algoritmo do Ministério da Saúde (DATASUS):
 * - definitivo (começa com 1 ou 2): os 11 primeiros dígitos (PIS) geram o
 *   número inteiro; o resto tem de ser "000" + DV ou, quando o DV daria 10,
 *   "001" + DV recalculado;
 * - provisório (começa com 7, 8 ou 9): a soma ponderada (pesos 15 a 1) dos
 *   15 dígitos é múltipla de 11.
 */
export function cnsValido(cns: string | null | undefined): boolean {
  const d = soDigitos(cns)
  if (d.length !== 15) return false
  const ponderada = (s: string, n: number) => {
    let soma = 0
    for (let i = 0; i < n; i++) soma += Number(s[i]) * (15 - i)
    return soma
  }
  if (d[0] === '1' || d[0] === '2') {
    const pis = d.slice(0, 11)
    let soma = ponderada(pis, 11)
    let dv = 11 - (soma % 11)
    if (dv === 11) dv = 0
    let esperado: string
    if (dv === 10) {
      soma += 2
      dv = 11 - (soma % 11)
      esperado = `${pis}001${dv}`
    } else {
      esperado = `${pis}000${dv}`
    }
    return d === esperado
  }
  if (d[0] === '7' || d[0] === '8' || d[0] === '9') return ponderada(d, 15) % 11 === 0
  return false
}

/** Mensagem de erro do CPF, ou '' se vazio/válido. Só reclama com 11 dígitos ou ao terminar de digitar. */
export function erroCpf(cpf: string, terminou = true): string {
  const d = soDigitos(cpf)
  if (!d) return ''
  if (d.length < 11 && !terminou) return ''
  if (d.length !== 11) return 'CPF tem 11 dígitos.'
  return cpfValido(d) ? '' : 'CPF inválido: os dígitos verificadores não conferem.'
}

/** Mensagem de erro do CNS, ou '' se vazio/válido. */
export function erroCns(cns: string, terminou = true): string {
  const d = soDigitos(cns)
  if (!d) return ''
  if (d.length < 15 && !terminou) return ''
  if (d.length !== 15) return 'Cartão SUS tem 15 dígitos.'
  if (!/^[12789]/.test(d)) return 'Cartão SUS começa com 1 ou 2 (definitivo) ou 7, 8 ou 9 (provisório).'
  return cnsValido(d) ? '' : 'Cartão SUS inválido: o número não confere.'
}

/** Nascimento 'AAAA-MM-DD': existe, não está no futuro, no máximo 130 anos. */
export function erroNascimento(nascimento: string, hoje: string): string {
  if (!nascimento) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(nascimento)
  if (!m) return 'Data de nascimento inválida.'
  const [a, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const data = new Date(Date.UTC(a, mes - 1, dia))
  if (data.getUTCFullYear() !== a || data.getUTCMonth() !== mes - 1 || data.getUTCDate() !== dia) return 'Data de nascimento inválida.'
  if (nascimento > hoje) return 'A data de nascimento está no futuro.'
  const anoHoje = Number(hoje.slice(0, 4))
  const anos = anoHoje - a - (hoje.slice(5) < nascimento.slice(5) ? 1 : 0)
  if (anos > 130) return 'Data de nascimento com mais de 130 anos. Confira o ano.'
  return ''
}

/** 000.000.000-00 enquanto digita. */
export function formatarCpf(t: string): string {
  const d = soDigitos(t).slice(0, 11)
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2')
}

/** 000 0000 0000 0000 enquanto digita. */
export function formatarCns(t: string): string {
  const d = soDigitos(t).slice(0, 15)
  return [d.slice(0, 3), d.slice(3, 7), d.slice(7, 11), d.slice(11)].filter(Boolean).join(' ')
}
