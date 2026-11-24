// Pendências do plantão da enfermagem por paciente (PS1–PS2 e IN1–IN3,
// revisão do perfil Enfermeiro, RT 24/11/2026): a faixa do topo conta o que
// está atrasado agora e filtra a lista; cada linha mostra uma pendência
// principal (a mais urgente) e o resto abre em Cuidados. Os dados vêm das
// leituras de sempre (enfermagem_pendencias, fila_checagem, contencoes_ativas,
// fugulin_de_hoje e dini_de_hoje); aqui só se escolhe e se conta.

export type ChavePendencia = 'vencida' | 'atrasada' | 'contencao' | 'vencendo' | 'escala'

/** A ordem da faixa e da escolha da pendência principal: vencidas primeiro. */
export const ORDEM_PENDENCIAS: readonly { chave: ChavePendencia; rotulo: string }[] = [
  { chave: 'vencida', rotulo: 'Prescrição vencida' },
  { chave: 'atrasada', rotulo: 'Medicação atrasada' },
  { chave: 'contencao', rotulo: 'Contenção ativa' },
  { chave: 'vencendo', rotulo: 'Prescrição vencendo' },
  { chave: 'escala', rotulo: 'Fugulin ou Dini pendente' },
]

export type PendenciasPaciente = {
  /** itens com a prescrição vencida (não se administram) */
  vencidos: number
  /** itens que vencem nas próximas 2 h */
  vencendo: number
  /** aprazamentos atrasados (do servidor) */
  atrasados: number
  /** o selo mais urgente da contenção ativa, se houver */
  contencao: { texto: string; critico: boolean } | null
  /** "Fugulin" ou "Dini" quando a classificação de hoje está pendente */
  escala: 'Fugulin' | 'Dini' | null
}

export const SEM_PENDENCIA: PendenciasPaciente = { vencidos: 0, vencendo: 0, atrasados: 0, contencao: null, escala: null }

export function tem(p: PendenciasPaciente, chave: ChavePendencia): boolean {
  switch (chave) {
    case 'vencida': return p.vencidos > 0
    case 'atrasada': return p.atrasados > 0
    case 'contencao': return !!p.contencao
    case 'vencendo': return p.vencendo > 0
    case 'escala': return !!p.escala
  }
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

/** O texto curto de cada pendência, na linha do paciente. */
function texto(p: PendenciasPaciente, chave: ChavePendencia): string {
  switch (chave) {
    case 'vencida': return plural(p.vencidos, 'item vencido', 'itens vencidos')
    case 'atrasada': return plural(p.atrasados, 'dose atrasada', 'doses atrasadas')
    case 'contencao': return p.contencao!.texto
    case 'vencendo': return plural(p.vencendo, 'item vencendo', 'itens vencendo')
    case 'escala': return `${p.escala} de hoje pendente`
  }
}

/** A pendência principal da linha (a mais urgente) e quantas outras ficam em Cuidados. */
export function pendenciaPrincipal(p: PendenciasPaciente): { chave: ChavePendencia; texto: string; critica: boolean; outras: number } | null {
  const todas = ORDEM_PENDENCIAS.filter((o) => tem(p, o.chave))
  if (todas.length === 0) return null
  const chave = todas[0].chave
  const critica = chave === 'vencida' || chave === 'atrasada' || (chave === 'contencao' && !!p.contencao?.critico)
  return { chave, texto: texto(p, chave), critica, outras: todas.length - 1 }
}

/** Quantos pacientes têm cada pendência (a faixa do topo); só as que existem para a tela. */
export function contarFaixa(lista: readonly PendenciasPaciente[], chaves: readonly ChavePendencia[]): { chave: ChavePendencia; rotulo: string; n: number }[] {
  return ORDEM_PENDENCIAS.filter((o) => chaves.includes(o.chave)).map((o) => ({ ...o, n: lista.filter((p) => tem(p, o.chave)).length }))
}
