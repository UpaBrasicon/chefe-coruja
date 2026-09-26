import { Link } from 'react-router-dom'
import { ChevronRight, Star, type LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

// Cartões de destino no Monitor de Cabeceira: plano em repouso, halo teal e
// 2px de subida só no hover (a elevação é resposta a estado).

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
    <Link to={to} className="group block text-tinta hover:text-tinta">
      <div className="flex h-full flex-col gap-3 rounded-cartao border border-fio bg-superficie p-5 shadow-repouso transition-[transform,box-shadow] duration-150 group-hover:-translate-y-0.5 group-hover:shadow-halo-ferramenta">
        <div className="flex items-start justify-between">
          <span className="grid size-[42px] place-items-center rounded-controle bg-marca/10 text-acao">
            <Icon className="size-5" />
          </span>
          <ChevronRight className="size-4 text-tinta-sussurro" aria-hidden />
        </div>
        <div>
          <div className="text-corpo font-semibold tracking-[-0.01em]">{label}</div>
          <div className="mt-1 line-clamp-2 text-apoio text-tinta-sussurro">{description}</div>
        </div>
        <div className="mt-auto text-rotulo font-medium text-acao tabular">
          {rodape ?? (count > 0 ? `${count} ferramenta${count > 1 ? 's' : ''}` : 'Em preparo')}
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
      <Link to={to} className="block text-tinta hover:text-tinta">
        <div className="flex h-full flex-col gap-1 rounded-container border border-fio bg-superficie px-4 py-3 pr-10 shadow-repouso transition-[transform,box-shadow] duration-150 group-hover:-translate-y-0.5 group-hover:shadow-halo">
          {badge && <span className="rotulo text-tinta-sussurro">{badge}</span>}
          <div className="text-corpo font-semibold tracking-[-0.01em]">{label}</div>
          <div className="line-clamp-2 text-apoio text-tinta-sussurro">{description}</div>
        </div>
      </Link>
      {onFavoritar && (
        <button
          type="button"
          aria-pressed={favorito}
          aria-label={favorito ? `Tirar ${label} dos favoritos` : `Favoritar ${label}`}
          className="absolute top-2.5 right-2.5 rounded-controle-sm p-1 text-tinta-sussurro hover:text-acao"
          onClick={onFavoritar}
        >
          <Star className={cn('size-4', favorito && 'fill-marca text-marca')} />
        </button>
      )}
    </div>
  )
}
