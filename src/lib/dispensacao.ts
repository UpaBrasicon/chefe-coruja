// Dispensação da farmácia (Fase 5B, etapa 3.2): formatos das RPCs. A regra
// (quem dispensa, sugestão, estoque) é do servidor; aqui só se mostra.
import { doseUnicaFeita } from './duplaChecagem.ts'

export type Sugestao = { quantidade: number | null; vezes: number | null; por_vez: number | null; explicacao: string; notas: string[] }

export type ItemParaDispensar = {
  item_id: string; paciente_id: string; paciente: string; prontuario: string | null; setor: string | null
  medicamento: string; medicamento_id: string; unidade_consumo: string | null; unidade_consumo_outra: string | null
  dose: string | null; via: string | null; posologia: string | null; se_necessario: boolean
  validacao: 'confere' | 'devolvido' | null; dispensado_24h: number; saldo_estoque: number | null
  sugestao: Sugestao
}

export type Dispensacao = {
  id: string; tipo: 'prescricao' | 'avulsa'; quantidade: number; unidade_consumo: string | null; devolvido: number
  medicamento: string; paciente: string | null; destino: string | null; motivo: string | null; sem_farmaceutico: boolean
  dispensada_por: string | null; dispensada_em: string; conferida_por: string | null; conferida_em: string | null
}

/**
 * RS1 e FM1 (revisão dos perfis Enfermeiro e Farmacêutico, RT 24/11/2026): a
 * mesma regra da Checagem. Item com a prescrição vencida não se dispensa
 * (COFEN 689/2022, art. 4º: mostra "vencido, peça renovação"); dose única
 * ("Agora") já feita sai da lista. A validade vem de prescricao_vigente e a
 * última checagem da fila_checagem (enfermagem); sem esses dados, o item
 * segue como veio do servidor. O servidor (itens_para_dispensar e
 * dispensar_item) ainda aceita os dois casos: correção registrada no BACKLOG.
 */
export type SituacaoDispensa = 'dispensar' | 'vencido' | 'dose_unica_feita'
export function situacaoParaDispensar(
  i: Pick<ItemParaDispensar, 'posologia' | 'se_necessario'>,
  extra: { validade?: string | null; ultimaSituacao?: string | null },
): SituacaoDispensa {
  if (doseUnicaFeita(i.posologia, i.se_necessario, extra.ultimaSituacao ?? null)) return 'dose_unica_feita'
  if (extra.validade === 'vencido') return 'vencido'
  return 'dispensar'
}

/** RS3: as notas da sugestão sem repetição, para uma nota só no topo. */
export function notasUnicas(itens: readonly Pick<ItemParaDispensar, 'sugestao'>[]): string[] {
  return [...new Set(itens.flatMap((i) => i.sugestao.notas))]
}

/** RS3: o motivo da retirada sem farmacêutico, escolhido uma vez no topo (o servidor pede 10 letras ou mais). */
export const MOTIVOS_RETIRADA = ['Farmácia fechada', 'Urgência sem farmacêutico de plantão'] as const
export function justificativaRetirada(motivo: string, complemento: string): string {
  return [motivo, complemento.trim()].filter(Boolean).join(': ')
}

/** Agrupa os itens por paciente, na ordem em que vieram. */
export function porPaciente(itens: ItemParaDispensar[]): { paciente_id: string; paciente: string; prontuario: string | null; setor: string | null; itens: ItemParaDispensar[] }[] {
  const grupos = new Map<string, { paciente_id: string; paciente: string; prontuario: string | null; setor: string | null; itens: ItemParaDispensar[] }>()
  for (const i of itens) {
    const g = grupos.get(i.paciente_id) ?? { paciente_id: i.paciente_id, paciente: i.paciente, prontuario: i.prontuario, setor: i.setor, itens: [] }
    g.itens.push(i)
    grupos.set(i.paciente_id, g)
  }
  return [...grupos.values()]
}
