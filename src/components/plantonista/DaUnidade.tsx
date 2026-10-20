import { ArrowRight, ImageOff, Pause, Play } from 'lucide-react'
import { useEffect, useState } from 'react'

import { TituloCartao } from '@/components/monitor/Pagina'
import { Button } from '@/components/ui/button'
import { useBanners } from '@/hooks/useBanners'
import { cn } from '@/lib/utils'

// Bloco "Da unidade": imagens e avisos publicados pelo gestor. Gira a cada 6 s,
// com pausa manual (WCAG 2.2.2) e começa pausado sob prefers-reduced-motion.
// Sem o cartão de clima: ele geolocalizava o IP do usuário num serviço de
// terceiro (ipwho.is), o que não cabe num app de saúde.

const INTERVALO_MS = 6000

export function DaUnidade({ unidadeId }: { unidadeId?: string }) {
  const { data: banners = [] } = useBanners(unidadeId)
  const [i, setI] = useState(0)
  const [pausado, setPausado] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  useEffect(() => {
    if (pausado || banners.length < 2) return
    const t = window.setInterval(() => setI((x) => (x + 1) % banners.length), INTERVALO_MS)
    return () => window.clearInterval(t)
  }, [pausado, banners.length])

  const atual = banners.length ? banners[i % banners.length] : null

  return (
    <section aria-label="Da unidade" className="overflow-hidden rounded-container border border-fio bg-superficie">
      <div className="flex items-center justify-between border-b border-trilha px-4 py-2.5">
        <TituloCartao className="mb-0">Da unidade</TituloCartao>
        {banners.length > 1 && (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setPausado((v) => !v)}
            aria-label={pausado ? 'Retomar a troca automática' : 'Pausar a troca automática'}
          >
            {pausado ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
          </Button>
        )}
      </div>
      {atual ? (
        <div aria-live={pausado ? 'polite' : 'off'}>
          <img src={atual.imagem_url} alt={atual.titulo ?? ''} className="aspect-[16/9] w-full bg-trilha object-cover" />
          {(atual.titulo || atual.descricao) && (
            <div className="px-4 py-3">
              {atual.titulo && <p className="text-apoio font-semibold text-tinta">{atual.titulo}</p>}
              {atual.descricao && <p className="mt-0.5 text-apoio text-tinta-sussurro">{atual.descricao}</p>}
              {atual.link_url && (
                <a href={atual.link_url} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-apoio font-medium">
                  Abrir <ArrowRight className="size-3.5" aria-hidden />
                </a>
              )}
            </div>
          )}
          {banners.length > 1 && (
            <div className="flex justify-center gap-1.5 pb-3" role="tablist" aria-label="Avisos da unidade">
              {banners.map((b, k) => (
                // padrao-ok: ponto do carrossel (marcador de 6 px que alarga quando ativo); nenhuma peça tem essa forma
                <button
                  key={b.id}
                  type="button"
                  role="tab"
                  aria-selected={k === i % banners.length}
                  aria-label={`Aviso ${k + 1} de ${banners.length}`}
                  onClick={() => setI(k)}
                  className={cn('h-1.5 rounded-capsula transition-[width] duration-200', k === i % banners.length ? 'w-4 bg-acao' : 'w-1.5 bg-fio-forte')}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1.5 px-4 py-8 text-center">
          <ImageOff className="size-5 text-tinta-sussurro" aria-hidden />
          <p className="text-apoio text-tinta-sussurro">A unidade ainda não publicou avisos.</p>
        </div>
      )}
    </section>
  )
}
