// Fila da porta por etapa (revisão do gestor, RT 24/11/2026, Porta M1 e M2):
// a fila numa faixa só, da chegada ao atendimento e à observação, e a lista
// dos pacientes agrupada pela mesma etapa. Regras puras, testadas em
// portaFila.test.ts; o formato vem de porta_agora() (lib/portaAgora.ts).
import type { Paciente, Porta } from './portaAgora.ts'

export type EtapaFila = Paciente['etapa']

export const ETAPAS_FILA: { chave: EtapaFila; rotulo: string }[] = [
  { chave: 'triagem', rotulo: 'Aguardando triagem' },
  { chave: 'aguardando_medico', rotulo: 'Aguardando médico' },
  { chave: 'em_atendimento', rotulo: 'Em atendimento' },
  { chave: 'observacao', rotulo: 'Em observação' },
]

export type SegmentoFila = {
  chave: EtapaFila; rotulo: string; n: number
  /** parte da fila (0 a 1), para a largura da faixa */
  parte: number
  esperaMaxMin: number | null
  /** quantos passaram do tempo-alvo (médico) ou de 6 h (observação) */
  atrasados: number
}

/** A faixa: uma parte por etapa, na ordem do caminho do paciente. */
export function faixaDaFila(p: Pick<Porta, 'etapas'>): SegmentoFila[] {
  const total = ETAPAS_FILA.reduce((a, e) => a + (p.etapas[e.chave]?.n ?? 0), 0)
  return ETAPAS_FILA.map((e) => {
    const v = p.etapas[e.chave]
    return {
      chave: e.chave, rotulo: e.rotulo, n: v?.n ?? 0,
      parte: total ? (v?.n ?? 0) / total : 0,
      esperaMaxMin: v?.espera_max_min ?? null,
      atrasados: e.chave === 'aguardando_medico' ? v?.fora_alvo ?? 0 : e.chave === 'observacao' ? v?.acima_6h ?? 0 : 0,
    }
  })
}

/**
 * Pacientes agrupados por etapa, na ordem do caminho; dentro do grupo, os fora
 * do alvo primeiro e depois a maior espera. Grupo vazio não aparece.
 */
export function agruparPorEtapa<T extends Pick<Paciente, 'etapa' | 'fora_alvo' | 'espera_min'>>(lista: T[]): { chave: EtapaFila; rotulo: string; pacientes: T[] }[] {
  return ETAPAS_FILA
    .map((e) => ({
      chave: e.chave, rotulo: e.rotulo,
      pacientes: lista.filter((p) => p.etapa === e.chave)
        .sort((a, b) => Number(b.fora_alvo) - Number(a.fora_alvo) || b.espera_min - a.espera_min),
    }))
    .filter((g) => g.pacientes.length > 0)
}
