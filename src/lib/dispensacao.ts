// Dispensação da farmácia (Fase 5B, etapa 3.2): formatos das RPCs. A regra
// (quem dispensa, sugestão, estoque) é do servidor; aqui só se mostra.

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
