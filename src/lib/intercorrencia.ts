// Intercorrência estruturada (Fase 2, tarefa 4): formatos das RPCs, gravidade
// e a versão vigente de cada registro (migration 20261031000003).

export type Gravidade = 'leve' | 'moderada' | 'grave'

export type Intercorrencia = {
  id: string; episodio_id: string | null; internacao_id: string | null
  tipo: string; tipo_rotulo: string; gravidade: Gravidade; ocorrida_em: string
  descricao: string; conduta: string; setor: string | null
  registrado_por: string | null; papel: string; registrado_em: string
  retifica_id: string | null; retificada: boolean
  paciente?: string
}

export type RelatorioIntercorrencias = {
  total: number
  por_gravidade: Partial<Record<Gravidade, number>>
  por_tipo: { tipo: string; total: number; graves: number }[]
  por_setor: { setor: string; total: number }[]
  por_papel: Record<string, number>
  casos: Intercorrencia[]
}

export const GRAVIDADES: { valor: Gravidade; rotulo: string; ajuda: string }[] = [
  { valor: 'leve', rotulo: 'Leve', ajuda: 'Sem dano ou com dano mínimo; observação ou medida simples.' },
  { valor: 'moderada', rotulo: 'Moderada', ajuda: 'Pediu intervenção ou tratamento a mais.' },
  { valor: 'grave', rotulo: 'Grave', ajuda: 'Risco de vida, ida à sala vermelha, transferência ou dano permanente.' },
]

export const PAPEL_REGISTRO: Record<string, string> = {
  plantonista: 'médico', enfermeiro: 'enfermeiro', tecnico_enfermagem: 'técnico de enfermagem',
}

/** Só as versões vigentes (as retificadas saem), da mais nova. */
export function vigentes(lista: Intercorrencia[]): Intercorrencia[] {
  return lista.filter((x) => !x.retificada).sort((a, b) => b.ocorrida_em.localeCompare(a.ocorrida_em))
}

/** As versões anteriores de um registro, da mais nova para a mais antiga. */
export function versoesAnteriores(lista: Intercorrencia[], atual: Intercorrencia): Intercorrencia[] {
  const porId = new Map(lista.map((x) => [x.id, x]))
  const out: Intercorrencia[] = []
  let ant = atual.retifica_id ? porId.get(atual.retifica_id) : undefined
  while (ant) { out.push(ant); ant = ant.retifica_id ? porId.get(ant.retifica_id) : undefined }
  return out
}
