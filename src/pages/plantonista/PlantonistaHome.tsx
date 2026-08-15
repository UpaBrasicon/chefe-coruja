import { useMemo, useState } from 'react'
import { Clock, Search, Star } from 'lucide-react'

import { SECOES } from '@/content/registry'
import { fuzzyMatch } from '@/lib/search'
import { useFavoritos, useRecentes } from '@/lib/useFavoritos'
import { SectionCard, ToolCard } from '@/components/plantonista/cards'
import { Input } from '@/components/ui/input'

type Resultado = { secao: string; secaoLabel: string; slug: string; label: string; description: string }

export default function PlantonistaHome() {
  const [consulta, setConsulta] = useState('')
  const { favoritos, alternarFavorito } = useFavoritos()
  const { recentes } = useRecentes()

  const todas = useMemo<Resultado[]>(
    () =>
      SECOES.flatMap((s) =>
        s.tools.map((t) => ({
          secao: s.slug,
          secaoLabel: s.label,
          slug: t.slug,
          label: t.label,
          description: t.description,
        }))
      ),
    []
  )

  const resultados = useMemo(() => {
    if (!consulta.trim()) return []
    const q = consulta.trim()
    return todas.filter((r) => {
      const secao = SECOES.find((s) => s.slug === r.secao)
      const tool = secao?.tools.find((t) => t.slug === r.slug)
      const campo = [r.label, r.description, r.secaoLabel, ...(tool?.tags ?? [])].join(' ')
      return fuzzyMatch(campo, q)
    })
  }, [consulta, todas])

  const favoritosCards = favoritos
    .map((slug) => todas.find((r) => r.slug === slug))
    .filter((r): r is Resultado => !!r)

  const recentesCards = recentes
    .map((slug) => todas.find((r) => r.slug === slug))
    .filter((r): r is Resultado => !!r)
    .filter((r) => !favoritosCards.some((f) => f.slug === r.slug))
    .slice(0, 3)

  const secoesComTools = SECOES.filter((s) => s.tools.length > 0)

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border bg-card px-6 py-10 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-48 w-96 rounded-full bg-primary/10 blur-3xl"
        />
        <div className="relative flex flex-col items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Central do Plantonista
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            Calculadoras, escores, protocolos e decisões clínicas — tudo em um só lugar, pensado
            para o ritmo da UPA.
          </p>
        </div>
      </div>

      {/* Busca */}
      <div className="relative mx-auto w-full max-w-lg">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          placeholder="Buscar por droga, escore ou conduta…"
          className="h-11 rounded-xl border-muted bg-card pl-11 text-sm shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-shadow focus-visible:shadow-[0_4px_16px_-4px_rgba(13,148,136,0.25)]"
        />
      </div>

      {resultados.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Search className="size-4" />
            Resultados para “{consulta}” <span className="text-muted-foreground/60">({resultados.length})</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {resultados.map((r) => (
              <ToolCard
                key={r.slug}
                to={`/plantonista/${r.secao}/${r.slug}`}
                label={r.label}
                description={r.description}
                badge={r.secaoLabel}
                favorito={favoritos.includes(r.slug)}
                onFavoritar={() => alternarFavorito(r.slug)}
              />
            ))}
          </div>
        </div>
      )}

      {consulta.trim() && resultados.length === 0 && (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Nenhuma ferramenta encontrada para “{consulta}”.
        </p>
      )}

      {!consulta.trim() && favoritosCards.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground/80">
            <Star className="size-4 text-amber-400" /> Favoritos
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {favoritosCards.map((r) => (
              <ToolCard
                key={r.slug}
                to={`/plantonista/${r.secao}/${r.slug}`}
                label={r.label}
                description={r.description}
                badge={r.secaoLabel}
                favorito
                onFavoritar={() => alternarFavorito(r.slug)}
              />
            ))}
          </div>
        </div>
      )}

      {!consulta.trim() && recentesCards.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground/80">
            <Clock className="size-4 text-muted-foreground" /> Usados recentemente
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recentesCards.map((r) => (
              <ToolCard
                key={r.slug}
                to={`/plantonista/${r.secao}/${r.slug}`}
                label={r.label}
                description={r.description}
                badge={r.secaoLabel}
                favorito={favoritos.includes(r.slug)}
                onFavoritar={() => alternarFavorito(r.slug)}
              />
            ))}
          </div>
        </div>
      )}

      {!consulta.trim() && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-foreground/80">Seções</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {secoesComTools.map((secao) => (
              <SectionCard
                key={secao.slug}
                to={`/plantonista/${secao.slug}`}
                icon={secao.icon}
                label={secao.label}
                description={secao.description}
                count={secao.tools.length}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
