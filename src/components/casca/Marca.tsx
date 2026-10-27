import { Bird } from 'lucide-react'

import { cn } from '@/lib/utils'

// A marca da casca (P/index.html 898–904): a coruja sobre o quadrado teal da marca,
// "Chefe Coruja" em 15px/600 e o papel sussurrado embaixo.
export function Marca({ papel, tamanho = 34, simbolo, className }: { papel?: string; tamanho?: 30 | 34; /** só a coruja, sem o nome (trilho do gestor) */ simbolo?: boolean; className?: string }) {
  return (
    <span className={cn('flex min-w-0 items-center gap-2.5', className)}>
      <span
        className={cn(
          'grid shrink-0 place-items-center bg-marca text-white', // padrao-ok: coruja branca sobre o quadrado da marca (identidade)
          tamanho === 34 ? 'size-[34px] rounded-controle' : 'size-[30px] rounded-controle',
        )}
        aria-hidden
      >
        <Bird className={tamanho === 34 ? 'size-[19px]' : 'size-[17px]'} />
      </span>
      <span className={cn('cc-some flex min-w-0 flex-col leading-[1.2]', simbolo && 'sr-only')}>
        <span className="truncate text-corpo font-semibold tracking-[-0.01em] text-tinta">Chefe Coruja</span>
        {papel && <span className="truncate text-rotulo text-tinta-sussurro">{papel}</span>}
      </span>
    </span>
  )
}
