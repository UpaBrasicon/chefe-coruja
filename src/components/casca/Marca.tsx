import { Bird } from 'lucide-react'

import { cn } from '@/lib/utils'

// A marca da casca (P/index.html 898–904): a coruja sobre o teal da ação,
// "Chefe Coruja" em 15px/600 e o papel sussurrado embaixo.
export function Marca({ papel, tamanho = 34, className }: { papel?: string; tamanho?: 30 | 34; className?: string }) {
  return (
    <span className={cn('flex min-w-0 items-center gap-2.5', className)}>
      <span
        className={cn(
          'grid shrink-0 place-items-center bg-acao text-white',
          tamanho === 34 ? 'size-[34px] rounded-controle' : 'size-[30px] rounded-controle-sm',
        )}
        aria-hidden
      >
        <Bird className={tamanho === 34 ? 'size-[19px]' : 'size-[17px]'} />
      </span>
      <span className="cc-some flex min-w-0 flex-col leading-[1.2]">
        <span className="truncate text-corpo font-semibold tracking-[-0.01em] text-tinta">Chefe Coruja</span>
        {papel && <span className="truncate text-rotulo text-tinta-sussurro">{papel}</span>}
      </span>
    </span>
  )
}
