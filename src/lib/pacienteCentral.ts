import { useSyncExternalStore } from 'react'

import { lerPaciente, PACIENTE_VAZIO, type EstadoPaciente } from '@/domain/pacienteCentral'
import { valeEmAdulto, valeEmCrianca, type PublicoFerramenta } from '@/content/publicoFerramentas'

// O paciente da Central vive na MEMÓRIA desta aba, e só nela: não vai ao
// banco nem ao armazenamento do aparelho. É um paciente sem nome (modo, idade,
// peso, gestante) que serve às ferramentas desta sessão; recarregar a página,
// sair ou "Trocar" zera tudo — como no protótipo, onde "trocar de paciente
// zera tudo" para que o peso de um não reapareça como dose de outro.

let estado: EstadoPaciente = PACIENTE_VAZIO
const ouvintes = new Set<() => void>()

function avisar() {
  for (const o of ouvintes) o()
}

function assinar(o: () => void) {
  ouvintes.add(o)
  return () => void ouvintes.delete(o)
}

/** Troca o modo e ZERA idade, peso e gestante (nunca carrega dado do paciente anterior). */
export function definirModo(modo: EstadoPaciente['modo']) {
  estado = { ...PACIENTE_VAZIO, modo }
  avisar()
}

export function alterarPaciente(patch: Partial<Omit<EstadoPaciente, 'modo'>>) {
  estado = { ...estado, ...patch }
  avisar()
}

/**
 * O paciente da Central agora, fora do React (estado inicial das ferramentas
 * do piloto das calculadoras: C5 = A, RT em 16/11/2026). Só devolve peso e
 * idade quando o modo é o esperado pela ferramenta; com outro modo, ou sem
 * modo, nada vem da Central.
 */
export function pacienteDaCentral(modoEsperado: 'adulto' | 'pediatrico') {
  const leitura = lerPaciente(estado)
  if (estado.modo !== modoEsperado) return { pesoKg: null, idade: null, unidadeIdade: estado.unidadeIdade }
  return { pesoKg: leitura.pesoKg, idade: leitura.idade, unidadeIdade: estado.unidadeIdade }
}

export function usePacienteCentral() {
  const p = useSyncExternalStore(assinar, () => estado, () => estado)
  return { ...p, leitura: lerPaciente(p) }
}

/**
 * Decide se a ferramenta calcula no modo em vigor. Devolve a faixa a mostrar e
 * se o conteúdo deve ser suprimido.
 */
export function useModoNaFerramenta(publico: PublicoFerramenta) {
  const p = usePacienteCentral()
  const bloqueiaPedi = p.modo === 'pediatrico' && !valeEmCrianca(publico)
  const bloqueiaAdulto = p.modo === 'adulto' && !valeEmAdulto(publico)
  return { paciente: p, suprimir: bloqueiaPedi || bloqueiaAdulto, bloqueiaPedi, bloqueiaAdulto }
}

