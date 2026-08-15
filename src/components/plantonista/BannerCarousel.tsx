import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, ChevronLeft, ChevronRight, ImageOff } from 'lucide-react'
import { Link } from 'react-router-dom'

import { useUnidade } from '@/contexts/UnidadeContext'
import { useBanners } from '@/hooks/useBanners'
import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/spinner'

export function BannerCarousel() {
  const { unidadeAtiva, ehGestor, ehAdmin } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  const { data: banners, isLoading } = useBanners(unidadeId)

  const ativos = useMemo(() => banners ?? [], [banners])
  const [indice, setIndice] = useState(0)
  const [pausado, setPausado] = useState(false)

  useEffect(() => {
    if (ativos.length <= 1 || pausado) return
    const timer = setInterval(() => setIndice((i) => (i + 1) % ativos.length), 6000)
    return () => clearInterval(timer)
  }, [ativos.length, pausado])

  const indiceAtual = ativos.length === 0 ? 0 : indice % ativos.length

  const podeGerenciar = (ehGestor || ehAdmin) && unidadeAtiva
  if (isLoading) {
    return <div className="flex h-44 items-center justify-center rounded-3xl border bg-card"><Spinner /></div>
  }

  if (ativos.length === 0) {
    return (
      <div className="relative flex min-h-44 flex-col items-center justify-center gap-2 overflow-hidden rounded-3xl border bg-card px-6 py-10 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <ImageOff className="size-6 text-muted-foreground/50" />
        <p className="text-sm font-medium text-muted-foreground">Nenhum banner ativo</p>
        {podeGerenciar && (
          <Link to="/banners" className="text-sm font-medium text-primary hover:underline">
            Gerenciar imagens da unidade →
          </Link>
        )}
      </div>
    )
  }

  return (
    <div
      className="group relative overflow-hidden rounded-3xl border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
    >
      <div className="aspect-[21/9] w-full sm:aspect-[3/1]">
        {ativos.map((b, i) => (
          <div
            key={b.id}
            className={cn(
              'absolute inset-0 transition-opacity duration-700',
              i === indiceAtual ? 'opacity-100' : 'pointer-events-none opacity-0'
            )}
          >
            {b.link_url ? (
              <a
                href={b.link_url}
                target="_blank"
                rel="noreferrer"
                className="block h-full w-full"
                aria-label={b.titulo ?? 'Banner'}
              >
                <img src={b.imagem_url} alt={b.titulo ?? 'Banner da unidade'} className="h-full w-full object-cover" />
              </a>
            ) : (
              <img src={b.imagem_url} alt={b.titulo ?? 'Banner da unidade'} className="h-full w-full object-cover" />
            )}
            {(b.titulo || b.descricao || b.link_url) && (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-4 sm:p-6">
                {b.titulo && <div className="text-sm font-semibold text-white sm:text-lg">{b.titulo}</div>}
                {b.descricao && <div className="mt-0.5 text-xs text-white/80 sm:text-sm">{b.descricao}</div>}
                {b.link_url && (
                  <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur">
                    Saiba mais <ArrowRight className="size-3.5" />
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {ativos.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Banner anterior"
            onClick={() => setIndice((i) => (i - 1 + ativos.length) % ativos.length)}
            className="absolute top-1/2 left-3 hidden -translate-y-1/2 rounded-full bg-black/30 p-1.5 text-white opacity-0 backdrop-blur transition-opacity hover:bg-black/50 group-hover:opacity-100 sm:block"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Próximo banner"
            onClick={() => setIndice((i) => (i + 1) % ativos.length)}
            className="absolute top-1/2 right-3 hidden -translate-y-1/2 rounded-full bg-black/30 p-1.5 text-white opacity-0 backdrop-blur transition-opacity hover:bg-black/50 group-hover:opacity-100 sm:block"
          >
            <ChevronRight className="size-4" />
          </button>
          <div className="absolute inset-x-0 bottom-2 flex items-center justify-center gap-1.5 sm:bottom-3">
            {ativos.map((b, i) => (
              <button
                key={b.id}
                type="button"
                aria-label={`Ir para banner ${i + 1}`}
                onClick={() => setIndice(i)}
                className={cn(
                  'h-1.5 rounded-full bg-white/50 transition-all',
                  i === indiceAtual ? 'w-6 bg-white' : 'w-1.5 hover:bg-white/80'
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
