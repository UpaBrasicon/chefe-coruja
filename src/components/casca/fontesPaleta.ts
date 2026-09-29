import type { LucideIcon } from 'lucide-react'

import { SECOES } from '@/content/registry'
import { SECOES_PLANTAO } from '@/content/plantaoRegistry'
import { fuzzyMatch, normalizar } from '@/lib/search'

import type { ItemNav } from './navegacao'

// Índice da paleta de busca (protótipo: fontesBusca + montarPaleta).
// Aqui ficam as fontes que não dependem do banco (telas e ferramentas) e o
// ranking. As fontes do banco (pacientes, setores, farmácia, unidades) vêm de
// useFontesDoBanco, sempre pela RLS de quem está logado.

export type EntradaPaleta = {
  id: string
  grupo: string
  rotulo: string
  detalhe?: string
  to: string
  /** Texto extra onde o termo também é procurado (descrição, setor, leito…). */
  termos: string
  icone?: LucideIcon
  /** Paciente do acesso — usado para decidir a linha "Fora do seu acesso". */
  paciente?: boolean
}

export const GRUPO_TELAS = 'Telas'
export const MAX_RESULTADOS = 12
/** Sem termo: amostra curta por grupo (Telas entram inteiras). */
const AMOSTRA_POR_GRUPO = 2

export function fontesEstaticas({
  telas, comFerramentas, comPlantao,
}: { telas: ItemNav[]; comFerramentas: boolean; comPlantao: boolean }): EntradaPaleta[] {
  const e: EntradaPaleta[] = telas.map((t) => ({
    id: `tela:${t.to}`, grupo: GRUPO_TELAS, rotulo: t.rotulo, to: t.to, termos: `${t.rotulo} ${t.curto ?? ''}`, icone: t.icone,
  }))
  if (comPlantao) {
    for (const s of SECOES_PLANTAO) {
      for (const f of s.tools) {
        e.push({
          id: `plantao:${s.slug}/${f.slug}`, grupo: 'Plantão', rotulo: f.label, detalhe: s.label,
          to: `/plantao/${s.slug}/${f.slug}`, termos: `${f.label} ${s.label} ${f.description}`, icone: s.icon,
        })
      }
    }
  }
  if (comFerramentas) {
    for (const s of SECOES) {
      for (const f of s.tools) {
        e.push({
          id: `tool:${s.slug}/${f.slug}`, grupo: 'Ferramentas', rotulo: f.label, detalhe: s.label,
          to: `/plantonista/${s.slug}/${f.slug}`, termos: `${f.label} ${s.label} ${f.description} ${(f.tags ?? []).join(' ')}`,
          icone: s.icon,
        })
      }
    }
  }
  return e
}

function pontuar(x: EntradaPaleta, q: string, n: string) {
  // Trecho no nome > trecho em qualquer termo > letras em ordem no nome.
  // Letras em ordem sobre a descrição inteira casavam quase tudo.
  if (normalizar(x.rotulo).includes(n)) return 3
  if (normalizar(`${x.termos} ${x.detalhe ?? ''}`).includes(n)) return 2
  return fuzzyMatch(x.rotulo, q) ? 1 : 0
}

export type ResultadoPaleta = { itens: EntradaPaleta[]; algumPeloNome: boolean; algumPaciente: boolean }

export function buscarNaPaleta(indice: EntradaPaleta[], termo: string): ResultadoPaleta {
  const q = termo.trim()
  if (!q) {
    const porGrupo = new Map<string, number>()
    const itens = indice.filter((x) => {
      const n = porGrupo.get(x.grupo) ?? 0
      porGrupo.set(x.grupo, n + 1)
      return x.grupo === GRUPO_TELAS || n < AMOSTRA_POR_GRUPO
    })
    return { itens, algumPeloNome: false, algumPaciente: false }
  }
  const n = normalizar(q)
  const pontuados = indice
    .map((x) => ({ x, p: pontuar(x, q, n) }))
    .filter((r) => r.p > 0)
    .sort((a, b) => b.p - a.p)
  return {
    itens: pontuados.slice(0, MAX_RESULTADOS).map((r) => r.x),
    algumPeloNome: pontuados.some((r) => r.p === 3),
    // Paciente conta só com casamento real (trecho), não com letras soltas em ordem.
    algumPaciente: pontuados.some((r) => r.x.paciente && r.p >= 2),
  }
}

/** O termo parece nome de pessoa: só letras (e espaço/apóstrofo/hífen), ≥3 letras. */
export function pareceNome(termo: string) {
  const t = termo.trim()
  if (!/^[\p{L}\s'.-]+$/u.test(t)) return false
  return (t.match(/\p{L}/gu) ?? []).length >= 3
}
