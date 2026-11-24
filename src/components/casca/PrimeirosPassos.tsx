// Cartão "Primeiros passos" na tela inicial do papel (Fase 1, item 13;
// OB1–OB4 = A do RT, 23/11/2026). Tarefas e regras dos roteiros de
// treinamento; cada tarefa leva à tela; "Já sei" marca; "Esconder" some com o
// cartão, que volta pelo menu do usuário.
import { Check, ChevronDown, ChevronRight, Compass, X } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { guiaDoPapel, mostrarCartao } from '@/domain/primeirosPassos'
import { usePrimeirosPassos } from '@/hooks/usePrimeirosPassos'
import { cn } from '@/lib/utils'

export function PrimeirosPassos({ rotasDoMenu, perfilId, papel }: { rotasDoMenu: string[]; perfilId: string | undefined; papel: string | null }) {
  const { progresso, marcar, esconder } = usePrimeirosPassos(perfilId, papel)
  const guia = guiaDoPapel(papel, rotasDoMenu)
  // revisão do gestor (RT, 24/11/2026, M1): no gestor e no administrador o cartão abre recolhido
  const [recolhido, setRecolhido] = React.useState(papel === 'gestor' || papel === 'admin')
  if (!guia || !mostrarCartao(guia, progresso)) return null
  const feitos = guia.passos.filter((x) => progresso.feitos.includes(x.id)).length
  const total = guia.passos.length
  return (
    <section aria-label="Primeiros passos" className="mb-5 flex flex-col gap-3 rounded-cartao border border-fio-forte bg-superficie px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Compass className="size-4 text-acao" aria-hidden />
        <span className="text-controle font-semibold text-tinta">Primeiros passos · {guia.titulo}</span>
        <span className="text-apoio tabular-nums text-tinta-sussurro">{feitos} de {total}</span>
        <Button variant="ghost" size="xs" className="ml-auto" aria-expanded={!recolhido} onClick={() => setRecolhido((x) => !x)}>
          <ChevronDown className={cn('transition-transform', recolhido && '-rotate-90')} /> {recolhido ? 'Ver passos' : 'Recolher'}
        </Button>
        <Button variant="outline" size="xs" onClick={esconder}><X /> Esconder</Button>
      </div>
      {!recolhido && <>
      <div className="h-1.5 overflow-hidden rounded-capsula bg-trilha" aria-hidden>
        <div className="h-full rounded-capsula bg-acao" style={{ width: `${Math.round((feitos / total) * 100)}%` }} />
      </div>
      <ul className="flex flex-col">
        {guia.passos.map((x) => {
          const feito = progresso.feitos.includes(x.id)
          return (
            <li key={x.id} className="flex items-center gap-3 border-t border-trilha py-2 first:border-0">
              <span aria-hidden className={cn('grid size-5 shrink-0 place-items-center rounded-capsula border', feito ? 'border-conforme bg-conforme text-sobre-acao' : 'border-controle')}>
                {feito && <Check className="size-3" />}
              </span>
              <Link to={x.to} className={cn('flex min-w-0 flex-1 items-center gap-1 text-apoio hover:text-acao', feito ? 'text-tinta-sussurro line-through' : 'text-tinta')}>
                <span className="truncate">{x.texto}</span>
                <ChevronRight className="size-3.5 shrink-0" aria-hidden />
              </Link>
              {!feito && <Button variant="outline" size="xs" onClick={() => marcar(x.id)}><Check /> Já sei</Button>}
            </li>
          )
        })}
      </ul>
      {guia.regras.length > 0 && (
        <ul className="flex flex-col gap-0.5 border-t border-trilha pt-2 text-rotulo text-tinta-apoio">
          {guia.regras.map((r) => <li key={r}>• {r}</li>)}
        </ul>
      )}
      </>}
    </section>
  )
}
