import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { GRUPOS_SECAO } from '@/content/gruposSecoes'
import type { SecaoExibida, ToolExibida } from '@/content/registry'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

// Lateral da seção dentro da ferramenta (revisão visual 3.8, opção C: leitura
// de manual, escolha do RT em 23/10/2026). As ferramentas da seção ficam à
// vista, nos mesmos grupos da página da seção, e a troca é sem voltar ao
// índice. Só na tela larga: no celular a trilha leva de volta à seção.

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function LateralSecao({ secao, atual }: { secao: SecaoExibida; atual: { secao: string; slug: string } }) {
  const [filtro, setFiltro] = useState('')
  const grupos = useMemo(() => {
    const porSlug = new Map(secao.tools.map((t) => [t.slug, t]))
    const def = GRUPOS_SECAO[secao.slug]
    const base = def
      ? def.map((g) => ({ rotulo: g.rotulo, tools: g.slugs.map((s) => porSlug.get(s)).filter((t): t is ToolExibida => !!t) }))
      : [{ rotulo: '', tools: secao.tools }]
    const q = semAcento(filtro.trim())
    if (!q) return base
    const casa = (t: ToolExibida) => semAcento([t.label, ...(t.tags ?? [])].join(' ')).includes(q)
    return base.map((g) => ({ ...g, tools: g.tools.filter(casa) })).filter((g) => g.tools.length > 0)
  }, [secao, filtro])

  return (
    <nav aria-label={`Ferramentas de ${secao.label}`} className="sticky top-4 hidden max-h-[calc(100vh-2rem)] flex-col gap-3 overflow-y-auto border-r border-fio pr-4 lg:flex">
      <Input
        aria-label={`Filtrar em ${secao.label}`}
        placeholder={`Filtrar (${secao.tools.length})`}
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
        className="h-8"
      />
      {grupos.length === 0 && <p className="text-apoio text-tinta-sussurro">Nada encontrado.</p>}
      {grupos.map((g) => (
        <div key={g.rotulo || 'todas'} className="flex flex-col gap-0.5">
          {g.rotulo && <span className="mb-0.5 text-rotulo font-semibold text-tinta-apoio">{g.rotulo}</span>}
          {g.tools.map((t) => (
            <Link
              key={`${t.secao}/${t.slug}`}
              to={`/plantonista/${t.secao}/${t.slug}`}
              aria-current={t.slug === atual.slug && t.secao === atual.secao ? 'page' : undefined}
              className={cn(
                'rounded-controle px-2 py-1 text-apoio leading-[1.35]',
                t.slug === atual.slug && t.secao === atual.secao ? 'bg-campo font-medium text-acao' : 'text-tinta-apoio hover:bg-campo hover:text-tinta',
              )}
            >
              {t.label}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  )
}
