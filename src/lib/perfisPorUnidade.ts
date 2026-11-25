// Perfis da pessoa em todas as unidades (RT, 25/11/2026): o menu "Trocar
// perfil" mostrava só os papéis da unidade ativa e, dentro da UBS, parecia que
// o médico do hospital, o regulador, o NIR e os outros tinham sumido. Aqui os
// vínculos viram grupos por unidade, a unidade ativa primeiro, para a tela
// dizer "Médico · UBS Homologação" e "Médico · UPA Homologação" sem confundir.
// Só a tela: quem pode o quê continua no banco.
import { ORDEM_PAPEL } from './constants.ts'
import type { Papel, TipoUnidade } from '@/types/database'

export type VinculoDoPerfil = {
  papel: Papel
  unidade_id: string
  unidade: { nome: string; tipo: TipoUnidade | null }
}

export type GrupoDePerfis = {
  unidadeId: string
  nome: string
  tipo: TipoUnidade | null
  ativa: boolean
  papeis: Papel[]
}

/**
 * Agrupa os papéis por unidade: a ativa primeiro, as demais pelo nome; dentro
 * de cada unidade, os papéis na ordem de precedência (ORDEM_PAPEL), sem
 * repetição. `papeisDaAtiva` substitui os papéis da unidade ativa quando vier
 * (o contexto já soma o administrador geral a ela).
 */
export function agruparPerfisPorUnidade(
  vinculos: readonly VinculoDoPerfil[],
  unidadeAtivaId: string | null | undefined,
  papeisDaAtiva?: readonly Papel[],
): GrupoDePerfis[] {
  const grupos = new Map<string, GrupoDePerfis>()
  for (const v of vinculos) {
    const g = grupos.get(v.unidade_id)
    if (g) {
      if (!g.papeis.includes(v.papel)) g.papeis.push(v.papel)
      continue
    }
    grupos.set(v.unidade_id, {
      unidadeId: v.unidade_id,
      nome: v.unidade?.nome ?? '',
      tipo: v.unidade?.tipo ?? null,
      ativa: v.unidade_id === unidadeAtivaId,
      papeis: [v.papel],
    })
  }
  if (unidadeAtivaId && papeisDaAtiva) {
    const ativa = grupos.get(unidadeAtivaId)
    if (ativa) ativa.papeis = [...new Set(papeisDaAtiva)]
  }
  const lista = [...grupos.values()]
  for (const g of lista) g.papeis.sort((a, b) => (ORDEM_PAPEL[a] ?? 99) - (ORDEM_PAPEL[b] ?? 99))
  return lista.sort((a, b) => Number(b.ativa) - Number(a.ativa) || a.nome.localeCompare(b.nome, 'pt-BR'))
}

/** Quantos perfis há ao todo (o menu só oferece a troca quando passa de um). */
export function totalDePerfis(grupos: readonly GrupoDePerfis[]): number {
  return grupos.reduce((n, g) => n + g.papeis.length, 0)
}

/**
 * As outras unidades abrem recolhidas quando a lista ficaria longa (sem parede
 * de botões): mais de seis perfis ao todo ou mais de três unidades.
 */
export function recolherOutrasUnidades(grupos: readonly GrupoDePerfis[]): boolean {
  return totalDePerfis(grupos) > 6 || grupos.length > 3
}
