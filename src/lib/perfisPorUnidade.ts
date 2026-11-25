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
 * Agrupa os papéis por unidade: a ativa (ou a última usada) primeiro, as
 * demais SEMPRE pelo nome (pt-BR); dentro de cada unidade, os papéis na ordem
 * de precedência (ORDEM_PAPEL), sem repetição. Só os vínculos contam.
 *
 * ME2 (revisão das telas novas, RT 25/11/2026): antes o administrador geral
 * (super admin) entrava só no grupo da unidade ativa, pelos papéis do
 * contexto; a Central aparecia com "Administrador e Médico regulador" quando
 * estava em uso e com 1 perfil nas outras visitas. Agora, com `adminGeral`, o
 * papel admin sai dos grupos e a tela mostra o administrador uma vez, à parte
 * ("toda a rede"), em qualquer unidade.
 */
export function agruparPerfisPorUnidade(
  vinculos: readonly VinculoDoPerfil[],
  unidadeAtivaId: string | null | undefined,
  adminGeral = false,
): GrupoDePerfis[] {
  const grupos = new Map<string, GrupoDePerfis>()
  for (const v of vinculos) {
    if (adminGeral && v.papel === 'admin') continue
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

/** O seletor ganha busca quando há mais de seis unidades (ME2). */
export const BUSCA_DE_UNIDADES_A_PARTIR = 7

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Unidades cujo nome (ou o nome de um papel) casa com a busca, na mesma ordem. */
export function filtrarGrupos(grupos: readonly GrupoDePerfis[], busca: string, rotulo: (p: Papel) => string): GrupoDePerfis[] {
  const q = semAcento(busca.trim())
  if (!q) return [...grupos]
  return grupos.filter((g) => semAcento(g.nome).includes(q) || g.papeis.some((p) => semAcento(rotulo(p)).includes(q)))
}

export type RegistroDoPerfil = {
  crm?: string | null
  uf_crm?: string | null
  conselho?: string | null
  registro_numero?: string | null
  registro_uf?: string | null
}

/** Papéis que assinam com o CRM (médico, médico regulador e telemedicina). */
const ASSINA_COM_CRM: readonly Papel[] = ['plantonista', 'regulador', 'telemedicina']
/** O conselho próprio de outros papéis que assinam, quando o cadastro tem. */
const CONSELHO_DO_PAPEL: Partial<Record<Papel, string>> = {
  enfermeiro: 'COREN', tecnico_enfermagem: 'COREN', farmaceutico: 'CRF',
}

/**
 * ME3 (decisão do RT, 25/11/2026): o registro do conselho só aparece no menu
 * quando o perfil em uso assina com ele. Médico, médico regulador e
 * telemedicina: "CRM 000000/SP". Enfermagem e farmácia: o registro próprio
 * (COREN, CRF), se o cadastro tiver. NIR, gestor, recepção e os demais: nada.
 */
export function registroNoMenu(papel: Papel | null | undefined, p: RegistroDoPerfil | null | undefined): string | null {
  if (!papel || !p) return null
  const num = (p.registro_numero ?? '').trim()
  const uf = (p.registro_uf ?? '').trim()
  const conselho = (p.conselho ?? '').trim().toUpperCase()
  if (ASSINA_COM_CRM.includes(papel)) {
    const crm = (p.crm ?? '').trim()
    if (crm) return `CRM ${crm}${p.uf_crm ? `/${p.uf_crm}` : ''}`
    return conselho === 'CRM' && num ? `CRM ${num}${uf ? `/${uf}` : ''}` : null
  }
  const proprio = CONSELHO_DO_PAPEL[papel]
  if (proprio && conselho === proprio && num) return `${proprio} ${num}${uf ? `/${uf}` : ''}`
  return null
}
