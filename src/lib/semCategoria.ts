/**
 * M7 (RT, 31/10/2026, "Categoria em comum"): os plantões sem categoria do mês
 * do gestor, por pessoa, para o aviso "N plantões sem categoria" e o atalho que
 * define a categoria de cada um, ou de todos de uma pessoa de uma vez
 * (`definir_categoria_plantoes`). Um plantão que cobre duas faixas conta uma vez,
 * na primeira em que aparece.
 */
type EscaladoMes = { plantao_id: string; perfil_id: string; nome: string; papel: string | null }
type FaixaMes = { data: string; turno: string; escalados: EscaladoMes[] }

export type GrupoSemCategoria = {
  perfil_id: string
  nome: string
  plantoes: { plantao_id: string; data: string; turno: string }[]
}

export function agruparSemCategoria(faixas: FaixaMes[]): GrupoSemCategoria[] {
  const vistos = new Set<string>()
  const grupos = new Map<string, GrupoSemCategoria>()
  for (const f of faixas) {
    for (const e of f.escalados) {
      if (e.papel !== null || vistos.has(e.plantao_id)) continue
      vistos.add(e.plantao_id)
      const g = grupos.get(e.perfil_id) ?? { perfil_id: e.perfil_id, nome: e.nome, plantoes: [] }
      g.plantoes.push({ plantao_id: e.plantao_id, data: f.data, turno: f.turno })
      grupos.set(e.perfil_id, g)
    }
  }
  return [...grupos.values()]
}
