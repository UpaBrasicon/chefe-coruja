import { Check, X } from 'lucide-react'

import type { RegraSenha } from '@/lib/senha'
import { cn } from '@/lib/utils'

/** Lista das regras da senha, marcadas ao vivo (primeiro-acesso.html do protótipo). */
export function RegrasSenha({ id, regras }: { id?: string; regras: RegraSenha[] }) {
  return (
    <ul id={id} className="mt-0.5 grid list-none gap-[5px] p-0" aria-live="polite">
      {regras.map((r) => {
        const Icone = r.ok ? Check : X
        return (
          <li key={r.chave} className={cn('grid grid-cols-[15px_minmax(0,1fr)] items-center gap-2 text-rotulo', r.ok ? 'text-[#14532D]' : 'text-tinta-sussurro')}>
            <Icone className="size-[13px]" aria-hidden />
            <span>
              {r.texto}
              <span className="sr-only">{r.ok ? ' — atendida' : ' — pendente'}</span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}

/** Ajuda da segunda digitação: "As duas conferem." em verde, ou o contrário em vermelho. */
export function ConfereSenha({ confirmacao, conferem }: { confirmacao: string; conferem: boolean }) {
  if (!confirmacao) return null
  return (
    <span className={cn('text-rotulo', conferem ? 'text-leitos' : 'text-critico')}>
      {conferem ? 'As duas conferem.' : 'As duas senhas não conferem.'}
    </span>
  )
}
