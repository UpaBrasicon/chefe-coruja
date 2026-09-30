// Paciente da Central do Plantonista — o modo adulto/pediátrico que vem ANTES
// da ferramenta (P/index.html, "Adulto ou pediátrico?", 29/08). Cálculo puro.
//
// O corte é o da unidade (./idade.ts): pediatria vai até antes de completar
// 14 anos. O protótipo dividia 0–14 anos em quatro faixas (neonatal,
// lactente, criança, adolescente) e estimava peso pela idade (APLS/Luscombe)
// e avisava peso "fora do habitual" do adulto (30 a 250 kg); nada disso tem
// fonte no app, então não entra: a tela mostra a idade digitada, o lado do
// corte de 14 anos e o peso da balança, sem estimar nem julgar.

import { IDADE_ADULTO_ANOS } from './idade.ts'

export type ModoPaciente = 'adulto' | 'pediatrico'
export type UnidadeIdade = 'dias' | 'meses' | 'anos'

/** Texto do campo → número positivo (aceita vírgula). Vazio, zero ou lixo → null. */
export function lerPositivo(texto: string): number | null {
  const t = texto.trim().replace(',', '.')
  if (!t || !/^\d+(\.\d+)?$/.test(t)) return null
  const n = Number(t)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Idade inteira (dias, meses ou anos completos) → null se não for inteiro ≥ 0. */
export function lerIdade(texto: string): number | null {
  const t = texto.trim()
  if (!/^\d{1,4}$/.test(t)) return null
  return Number(t)
}

/** Anos completos a partir da idade na unidade em que o médico pensa. */
export function anosCompletos(valor: number, unidade: UnidadeIdade): number {
  if (unidade === 'anos') return valor
  if (unidade === 'meses') return Math.floor(valor / 12)
  // dias: ano civil médio; só importa perto do corte, que ninguém digita em dias
  return Math.floor(valor / 365.25)
}

/** Lado do corte de 14 anos. */
export function modoPelaIdade(valor: number, unidade: UnidadeIdade): ModoPaciente {
  return anosCompletos(valor, unidade) < IDADE_ADULTO_ANOS ? 'pediatrico' : 'adulto'
}

/** "12 dias", "1 mês", "4 anos". */
export function rotuloIdadeDigitada(valor: number, unidade: UnidadeIdade): string {
  if (unidade === 'dias') return `${valor} ${valor === 1 ? 'dia' : 'dias'}`
  if (unidade === 'meses') return `${valor} ${valor === 1 ? 'mês' : 'meses'}`
  return `${valor} ${valor === 1 ? 'ano' : 'anos'}`
}

export type EstadoPaciente = {
  modo: ModoPaciente | null
  peso: string
  gestante: boolean
  idade: string
  unidadeIdade: UnidadeIdade
}

export const PACIENTE_VAZIO: EstadoPaciente = { modo: null, peso: '', gestante: false, idade: '', unidadeIdade: 'anos' }

export type LeituraPaciente = {
  modo: ModoPaciente | null
  pesoKg: number | null
  /** Idade digitada (pediátrico); null se vazia ou inválida. */
  idade: number | null
  /** A idade digitada cai do lado adulto do corte: o modo pediátrico não vale. */
  idadeForaDaPediatria: boolean
  /** Tem o que as ferramentas pedem antes de calcular (peso; no pediátrico, também a idade). */
  completo: boolean
}

export function lerPaciente(p: EstadoPaciente): LeituraPaciente {
  const pesoKg = lerPositivo(p.peso)
  const idade = p.modo === 'pediatrico' ? lerIdade(p.idade) : null
  const idadeForaDaPediatria = idade !== null && modoPelaIdade(idade, p.unidadeIdade) === 'adulto'
  const completo = p.modo === 'adulto' ? pesoKg !== null : p.modo === 'pediatrico' ? pesoKg !== null && idade !== null && !idadeForaDaPediatria : false
  return { modo: p.modo, pesoKg, idade, idadeForaDaPediatria, completo }
}
