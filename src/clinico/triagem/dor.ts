import type { Ficha } from '../ficha.ts'
import { idadeEm } from '../../domain/idade.ts'

// Dor na triagem (porte do protótipo, 26/09). A escala muda com a idade:
// o lactente não relata a dor, então a enfermagem observa o comportamento.
//   • NIPS: recém-nascido e lactente até 2 meses, 0 a 7, dor com 4 ou mais.
//   • FLACC: 2 meses a 3 anos, ou criança que não consegue relatar, 0 a 10.
//   • A partir de 4 anos (e no adulto): autorrelato 0 a 10 — a Escala Visual
//     Analógica que o protocolo da unidade manda usar em adultos e crianças
//     (Anexo I).
// O escore é registro da enfermagem: NÃO muda nem sugere a cor (CLAUDE.md).
// Os mesmos itens e máximos estão em private.validar_dor_triagem
// (migration 20261003000004): o servidor recusa o que não bater.

export type EscalaDor = 'nips' | 'flacc' | 'numerica'

export type OpcaoDor = { valor: number; rotulo: string }
export type ItemDor = { id: string; rotulo: string; opcoes: OpcaoDor[] }

export type DefinicaoEscalaDor = {
  id: EscalaDor
  nome: string
  faixa: string
  max: number
  /** vazio na numérica: o paciente diz o número */
  itens: ItemDor[]
  leitura: (total: number) => string
  ficha: Ficha
}

const REVISADO = '29/09/2026 (porte do protótipo)'

export const fichaNips: Ficha = {
  id: 'triagem-dor-nips',
  titulo: 'NIPS — escala de dor no recém-nascido e lactente',
  versao: '2026-09-29.1',
  publico: 'pediatrico',
  fontes: [
    { citacao: 'Lawrence J, Alcock D, McGrath P, et al. The development of a tool to assess neonatal pain. Neonatal Netw. 1993;12(6):59–66.', pediatrica: true },
    { citacao: 'Ministério da Saúde. Atenção à saúde do recém-nascido: guia para os profissionais de saúde, v. 2.', pediatrica: true },
  ],
  revisadoEm: REVISADO,
}

export const fichaFlacc: Ficha = {
  id: 'triagem-dor-flacc',
  titulo: 'FLACC — escala comportamental de dor',
  versao: '2026-09-29.1',
  publico: 'pediatrico',
  fontes: [
    { citacao: 'Merkel SI, Voepel-Lewis T, Shayevitz JR, Malviya S. The FLACC: a behavioral scale for scoring postoperative pain in young children. Pediatr Nurs. 1997;23(3):293–297.', pediatrica: true },
    // o protótipo cita só autor e ano da versão portuguesa; conferir a referência completa
    { citacao: 'Versão portuguesa: Batalha et al., 2009.', pediatrica: true },
  ],
  revisadoEm: REVISADO,
}

export const fichaDorNumerica: Ficha = {
  id: 'triagem-dor-numerica',
  titulo: 'Dor por autorrelato (0 a 10)',
  versao: '2026-09-29.1',
  publico: 'ambos',
  fontes: [
    {
      citacao: 'Protocolo de Classificação de Risco · SMS Aparecida de Goiânia · 2025, Anexo I (Avaliação da severidade da dor; manual de Acolhimento e Classificação de Risco, Brasília-DF, 2021)',
      pediatrica: true,
    },
  ],
  revisadoEm: REVISADO,
}

export const ESCALAS_DOR: Record<EscalaDor, DefinicaoEscalaDor> = {
  nips: {
    id: 'nips',
    nome: 'NIPS',
    faixa: 'recém-nascido e lactente até 2 meses',
    max: 7,
    itens: [
      { id: 'face', rotulo: 'Expressão facial', opcoes: [{ valor: 0, rotulo: 'Relaxada' }, { valor: 1, rotulo: 'Contraída' }] },
      { id: 'choro', rotulo: 'Choro', opcoes: [{ valor: 0, rotulo: 'Ausente' }, { valor: 1, rotulo: 'Resmungos' }, { valor: 2, rotulo: 'Vigoroso' }] },
      { id: 'resp', rotulo: 'Respiração', opcoes: [{ valor: 0, rotulo: 'Relaxada' }, { valor: 1, rotulo: 'Diferente do basal' }] },
      { id: 'bracos', rotulo: 'Braços', opcoes: [{ valor: 0, rotulo: 'Relaxados ou contidos' }, { valor: 1, rotulo: 'Fletidos ou estendidos' }] },
      { id: 'pernas', rotulo: 'Pernas', opcoes: [{ valor: 0, rotulo: 'Relaxadas ou contidas' }, { valor: 1, rotulo: 'Fletidas ou estendidas' }] },
      { id: 'alerta', rotulo: 'Estado de alerta', opcoes: [{ valor: 0, rotulo: 'Dormindo ou calmo' }, { valor: 1, rotulo: 'Desconfortável ou agitado' }] },
    ],
    leitura: (t) => (t >= 4 ? 'Dor (4 ou mais na NIPS)' : 'Sem dor pela NIPS (menos de 4)'),
    ficha: fichaNips,
  },
  flacc: {
    id: 'flacc',
    nome: 'FLACC',
    faixa: '2 meses a 3 anos, ou criança que não consegue relatar a dor',
    max: 10,
    itens: [
      { id: 'face', rotulo: 'Face', opcoes: [
        { valor: 0, rotulo: 'Sem expressão especial ou sorriso' },
        { valor: 1, rotulo: 'Caretas ou sobrancelhas franzidas de vez em quando, desinteresse' },
        { valor: 2, rotulo: 'Tremor frequente do queixo, mandíbula cerrada' },
      ] },
      { id: 'pernas', rotulo: 'Pernas', opcoes: [
        { valor: 0, rotulo: 'Normais ou relaxadas' },
        { valor: 1, rotulo: 'Inquietas, agitadas, tensas' },
        { valor: 2, rotulo: 'Aos pontapés ou esticadas' },
      ] },
      { id: 'atividade', rotulo: 'Atividade', opcoes: [
        { valor: 0, rotulo: 'Quieta, posição normal, move-se com facilidade' },
        { valor: 1, rotulo: 'Contorce-se, vai para a frente e para trás, tensa' },
        { valor: 2, rotulo: 'Curvada, rígida ou com movimentos bruscos' },
      ] },
      { id: 'choro', rotulo: 'Choro', opcoes: [
        { valor: 0, rotulo: 'Sem choro' },
        { valor: 1, rotulo: 'Geme ou choraminga, queixa ocasional' },
        { valor: 2, rotulo: 'Choro persistente, grita ou soluça' },
      ] },
      { id: 'consolo', rotulo: 'Consolabilidade', opcoes: [
        { valor: 0, rotulo: 'Satisfeita, relaxada' },
        { valor: 1, rotulo: 'Tranquiliza com toque, colo ou conversa; distrai-se' },
        { valor: 2, rotulo: 'Difícil de consolar ou confortar' },
      ] },
    ],
    leitura: (t) => (t === 0 ? 'Relaxado e confortável (0)' : t <= 3 ? 'Desconforto leve (1 a 3)' : t <= 6 ? 'Dor moderada (4 a 6)' : 'Dor intensa (7 a 10)'),
    ficha: fichaFlacc,
  },
  numerica: {
    id: 'numerica',
    nome: 'Numérica 0–10',
    faixa: 'a partir de 4 anos e adultos, pelo relato do paciente',
    max: 10,
    itens: [],
    // Anexo I: sem dor 0; leve 1–3; moderada 4–6; intensa 7–10. Só o nome da
    // faixa — a coluna de cor do anexo não entra (a cor é do enfermeiro).
    leitura: (t) => (t === 0 ? 'Sem dor (0)' : t <= 3 ? 'Dor leve (1 a 3)' : t <= 6 ? 'Dor moderada (4 a 6)' : 'Dor intensa (7 a 10)'),
    ficha: fichaDorNumerica,
  },
}

/** Escalas que a tela oferece: NIPS e FLACC só no grupo pediátrico. */
export function escalasDoGrupo(publico: 'adulto' | 'pediatrico' | null): EscalaDor[] {
  return publico === 'pediatrico' ? ['nips', 'flacc', 'numerica'] : ['numerica']
}

/**
 * Escala pela idade: menos de 2 meses → NIPS; de 2 meses a 3 anos (antes de
 * completar 4) → FLACC; 4 anos ou mais → autorrelato. Sem nascimento → numérica.
 */
export function escalaPelaIdade(nascimento: string | null, hoje: string): EscalaDor {
  if (!nascimento) return 'numerica'
  const i = idadeEm(nascimento, hoje)
  if (!i) return 'numerica'
  const meses = i.anos * 12 + i.meses
  return meses < 2 ? 'nips' : meses < 48 ? 'flacc' : 'numerica'
}

export type ItensDor = Record<string, number>

/** Soma dos itens; null enquanto faltar item ou houver valor fora das opções. */
export function totalDor(escala: EscalaDor, itens: ItensDor): number | null {
  const def = ESCALAS_DOR[escala]
  if (def.itens.length === 0) return null
  let t = 0
  for (const it of def.itens) {
    const v = itens[it.id]
    if (v === undefined || !it.opcoes.some((o) => o.valor === v)) return null
    t += v
  }
  return t
}

/** Quantos itens já foram marcados (para "3 de 5 itens marcados"). */
export function itensMarcados(escala: EscalaDor, itens: ItensDor): number {
  return ESCALAS_DOR[escala].itens.filter((it) => itens[it.id] !== undefined).length
}

/** Nota numérica válida do autorrelato: inteiro de 0 a 10. */
export function notaNumerica(texto: string): number | null {
  const t = texto.trim()
  if (!/^\d{1,2}$/.test(t)) return null
  const n = Number(t)
  return n <= 10 ? n : null
}

/** O que vai ao servidor junto da classificação (p_dor). */
export function registroDor(escala: EscalaDor, itens: ItensDor, total: number) {
  return escala === 'numerica' ? { escala, total } : { escala, itens, total }
}
