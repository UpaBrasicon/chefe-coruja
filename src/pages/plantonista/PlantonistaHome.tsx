import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock, Search, Star } from 'lucide-react'

import { SECOES } from '@/content/registry'
import { fuzzyMatch } from '@/lib/search'
import { useFavoritos, useRecentes } from '@/lib/useFavoritos'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

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

  function CardFerramenta({ r }: { r: Resultado }) {
    const ehFavorito = favoritos.includes(r.slug)
    return (
      <div className="relative">
        <Link to={`/plantonista/${r.secao}/${r.slug}`}>
          <Card className="h-full pr-10 transition-colors hover:border-primary">
            <CardHeader>
              <CardTitle className="text-base">{r.label}</CardTitle>
              <CardDescription>{r.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant="outline">{r.secaoLabel}</Badge>
            </CardContent>
          </Card>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          aria-label={ehFavorito ? 'Remover dos favoritos' : 'Favoritar'}
          className="absolute top-3 right-2"
          onClick={() => alternarFavorito(r.slug)}
        >
          <Star className={ehFavorito ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'} />
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Central do Plantonista</h1>
        <p className="text-sm text-muted-foreground">
          Ferramentas de apoio à decisão clínica durante o plantão.
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          placeholder="Buscar ferramenta (ex.: noradrenalina, VNI, TTPa…)"
          className="pl-9"
        />
      </div>

      {resultados.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Search className="size-4" />
            Resultados para “{consulta}” ({resultados.length})
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {resultados.map((r) => (
              <CardFerramenta key={r.slug} r={r} />
            ))}
          </div>
        </div>
      )}

      {consulta.trim() && resultados.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Nenhuma ferramenta encontrada para “{consulta}”.
        </p>
      )}

      {!consulta.trim() && favoritosCards.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Star className="size-4" /> Favoritos
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {favoritosCards.map((r) => (
              <CardFerramenta key={r.slug} r={r} />
            ))}
          </div>
        </div>
      )}

      {!consulta.trim() && recentesCards.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Clock className="size-4" /> Usados recentemente
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {recentesCards.map((r) => (
              <CardFerramenta key={r.slug} r={r} />
            ))}
          </div>
        </div>
      )}

      {!consulta.trim() && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">Seções</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {SECOES.map((secao) => (
              <Link key={secao.slug} to={`/plantonista/${secao.slug}`}>
                <Card className="h-full transition-colors hover:border-primary">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <secao.icon className="size-4 text-muted-foreground" />
                      {secao.label}
                    </CardTitle>
                    <CardDescription>{secao.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    {secao.tools.length > 0 ? `${secao.tools.length} ferramenta(s)` : 'Em breve'}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
