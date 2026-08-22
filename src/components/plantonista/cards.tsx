import { Link } from 'react-router-dom'
import { ChevronRight, Star, type LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export function SectionCard({
  to,
  icon: Icon,
  label,
  description,
  count,
  rodape,
}: {
  to: string
  icon: LucideIcon
  label: string
  description: string
  count: number
  /** Substitui a contagem de ferramentas no rodapé do card. */
  rodape?: string
}) {
  return (
    <Link to={to} className="group block">
      <div className="relative flex h-full flex-col gap-3 rounded-2xl border bg-card p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_8px_24px_-8px_rgba(13,148,136,0.25)]">
        <div className="flex items-start justify-between">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="size-5" />
          </div>
          <span className="flex size-6 items-center justify-center rounded-full bg-muted text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
            <ChevronRight className="size-3.5" />
          </span>
        </div>
        <div>
          <div className="font-semibold tracking-tight">{label}</div>
          <div className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {description}
          </div>
        </div>
        <div className="mt-auto text-xs font-medium text-primary/80">
          {rodape ?? (count > 0 ? `${count} ferramenta${count > 1 ? 's' : ''}` : 'Em breve')}
        </div>
      </div>
    </Link>
  )
}

export function ToolCard({
  to,
  label,
  description,
  badge,
  favorito,
  onFavoritar,
}: {
  to: string
  label: string
  description: string
  badge?: string
  favorito?: boolean
  onFavoritar?: () => void
}) {
  return (
    <div className="group relative">
      <Link to={to} className="block">
        <div className="flex h-full flex-col gap-2 rounded-2xl border bg-card p-4 pr-10 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_8px_20px_-8px_rgba(13,148,136,0.2)]">
          <div className="font-medium leading-snug tracking-tight">{label}</div>
          <div className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{description}</div>
          {badge && <div className="mt-auto pt-1 text-xs font-medium text-primary/70">{badge}</div>}
        </div>
      </Link>
      {onFavoritar && (
        <Button
          variant="ghost"
          size="icon"
          aria-label={favorito ? 'Remover dos favoritos' : 'Favoritar'}
          className="absolute top-2.5 right-2 opacity-70 transition-opacity hover:opacity-100"
          onClick={onFavoritar}
        >
          <Star
            className={cn('size-4', favorito ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground')}
          />
        </Button>
      )}
    </div>
  )
}
