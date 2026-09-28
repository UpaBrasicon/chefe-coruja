import { DIAS_ANO, DIAS_MES, fichaP2 } from './fonteP2.ts'

// Sinais vitais por idade — tabelas de referência do livro do ICr, cada uma com
// a sua página e o seu propósito (o livro não tem uma tabela única). A tela só
// mostra a referência da idade; não marca valor como alterado (a análise é da
// enfermagem/médico — CLAUDE.md).
//
// Faixas: o limite de baixo entra na faixa, o de cima não ("≥ 1–3 meses" =
// de 1 mês completo até antes de 3 meses). No Quadro 1 do cap. 2 o
// "recém-nascido" vai até antes de 1 semana, porque a linha seguinte começa em
// "1 semana". Onde o livro escreve faixas em anos completos que se sucedem
// ("1 a 5 anos", "6 a 8 anos"; "1 a 10", "11 a 17"), a faixa vai até antes do
// ano seguinte ao último citado.

export const fichaSinaisVitais = fichaP2(
  'ped-sinais-vitais-icr',
  'Sinais vitais por idade — referências do livro',
  'cap. 2, p. 40 (Quadro 1); cap. 5, p. 87 (Tabela 1); cap. 6, p. 97–98 (Quadro 3); cap. 8, p. 114 (Tabela 1)',
)

const M = DIAS_MES
const A = DIAS_ANO

export type Linha<T> = { rotulo: string; de: number; ate: number; valor: T }

const achar = <T>(linhas: Linha<T>[], dias: number) => linhas.find((l) => dias >= l.de && dias < l.ate)

// ── cap. 2, Quadro 1 (p. 40): FC normal, acordado e dormindo ──
export type FcNormal = { acordado: [number, number]; sono: [number, number] }
export const FC_NORMAL: Linha<FcNormal>[] = [
  { rotulo: 'Recém-nascido', de: 0, ate: 7, valor: { acordado: [100, 180], sono: [80, 160] } },
  { rotulo: '1 semana a 3 meses', de: 7, ate: 3 * M, valor: { acordado: [100, 220], sono: [80, 200] } },
  { rotulo: '3 meses a 2 anos', de: 3 * M, ate: 2 * A, valor: { acordado: [80, 170], sono: [70, 120] } },
  { rotulo: '2 a 10 anos', de: 2 * A, ate: 10 * A, valor: { acordado: [70, 110], sono: [60, 90] } },
  { rotulo: 'Acima de 10 anos', de: 10 * A, ate: Infinity, valor: { acordado: [55, 90], sono: [50, 90] } },
]

// ── cap. 5, Tabela 1 (p. 87): valores considerados anormais (choque séptico) ──
export type Anormal = { fcAcima: number; frAcima: number; pasAbaixo: number | 'formula'; temperatura: string }
export const ANORMAIS_CHOQUE: Linha<Anormal>[] = [
  { rotulo: '0 dia–1 mês', de: 0, ate: 1 * M, valor: { fcAcima: 205, frAcima: 60, pasAbaixo: 60, temperatura: '< 36 ou > 38' } },
  { rotulo: '≥ 1–3 meses', de: 1 * M, ate: 3 * M, valor: { fcAcima: 205, frAcima: 60, pasAbaixo: 70, temperatura: '< 36 ou > 38' } },
  { rotulo: '≥ 3 meses–1 ano', de: 3 * M, ate: 1 * A, valor: { fcAcima: 190, frAcima: 60, pasAbaixo: 70, temperatura: '< 36 ou > 38,5' } },
  { rotulo: '≥ 1–2 anos', de: 1 * A, ate: 2 * A, valor: { fcAcima: 190, frAcima: 40, pasAbaixo: 'formula', temperatura: '< 36 ou > 38,5' } },
  { rotulo: '≥ 2–4 anos', de: 2 * A, ate: 4 * A, valor: { fcAcima: 140, frAcima: 40, pasAbaixo: 'formula', temperatura: '< 36 ou > 38,5' } },
  { rotulo: '≥ 4–6 anos', de: 4 * A, ate: 6 * A, valor: { fcAcima: 140, frAcima: 34, pasAbaixo: 'formula', temperatura: '< 36 ou > 38,5' } },
  { rotulo: '≥ 6–10 anos', de: 6 * A, ate: 10 * A, valor: { fcAcima: 140, frAcima: 20, pasAbaixo: 'formula', temperatura: '< 36 ou > 38,5' } },
  { rotulo: '≥ 10–13 anos', de: 10 * A, ate: 13 * A, valor: { fcAcima: 100, frAcima: 20, pasAbaixo: 90, temperatura: '< 36 ou > 38,5' } },
  { rotulo: '≥ 13 anos', de: 13 * A, ate: Infinity, valor: { fcAcima: 100, frAcima: 16, pasAbaixo: 90, temperatura: '< 36 ou > 38,5' } },
]

/** PAS < 70 + (2 × idade em anos) — a fórmula das linhas de 1 a 10 anos da Tabela 1 (p. 87) e do Quadro 3 do cap. 6 (p. 98). */
export const pasFormula = (anosCompletos: number) => 70 + 2 * anosCompletos

// ── cap. 6, Quadro 3, rodapé (p. 98): PA sistólica baixa na anafilaxia ──
export const PAS_BAIXA_ANAFILAXIA: Linha<number | 'formula'>[] = [
  { rotulo: '1 mês a 1 ano', de: 1 * M, ate: 1 * A, valor: 70 },
  { rotulo: '1 a 10 anos', de: 1 * A, ate: 11 * A, valor: 'formula' },
  { rotulo: '11 a 17 anos', de: 11 * A, ate: 18 * A, valor: 90 },
]

// ── cap. 8, Tabela 1, rodapé (p. 114): FR normal (crise asmática) ──
export const FR_NORMAL_ASMA: Linha<string>[] = [
  { rotulo: 'Menos de 2 meses', de: 0, ate: 2 * M, valor: '< 60 ciclos/min' },
  { rotulo: '2 a 11 meses', de: 2 * M, ate: 1 * A, valor: '< 50 ciclos/min' },
  { rotulo: '1 a 5 anos', de: 1 * A, ate: 6 * A, valor: '< 40 ciclos/min' },
  { rotulo: '6 a 8 anos', de: 6 * A, ate: 9 * A, valor: '< 30 ciclos/min' },
  { rotulo: 'Acima de 8 anos', de: 9 * A, ate: Infinity, valor: 'igual à FR do adulto (o livro não dá o número)' },
]

export const DICA_CAP2 =
  'Taquicardia: FC acima de 180 bpm até 1 ano e acima de 120 bpm depois de 1 ano. Bradicardia: FC abaixo de 60 bpm em qualquer idade (cap. 2, p. 40).'

export type Referencias = {
  fc: Linha<FcNormal> | undefined
  anormal: (Linha<Anormal> & { pas: number }) | undefined
  pasAnafilaxia: { rotulo: string; pas: number } | undefined
  frAsma: Linha<string> | undefined
}

const resolverPas = (v: number | 'formula', dias: number) => (v === 'formula' ? pasFormula(Math.floor(dias / A)) : v)

/** Linhas de referência para a idade (em dias). Pediatria: até antes dos 14 anos. */
export function referenciasPorIdade(dias: number): Referencias | null {
  if (!Number.isFinite(dias) || dias < 0 || dias >= 14 * A) return null
  const an = achar(ANORMAIS_CHOQUE, dias)
  const pa = achar(PAS_BAIXA_ANAFILAXIA, dias)
  return {
    fc: achar(FC_NORMAL, dias),
    anormal: an && { ...an, pas: resolverPas(an.valor.pasAbaixo, dias) },
    pasAnafilaxia: pa && { rotulo: pa.rotulo, pas: resolverPas(pa.valor, dias) },
    frAsma: achar(FR_NORMAL_ASMA, dias),
  }
}
