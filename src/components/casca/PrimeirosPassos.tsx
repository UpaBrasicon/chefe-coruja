// Cartão "Primeiros passos" na tela inicial do papel (Fase 1, item 13;
// OB1–OB4 = A do RT, 23/11/2026). Tarefas e regras dos roteiros de
// treinamento; cada tarefa leva à tela; "Já sei" marca; "Esconder" some com o
// cartão, que volta pelo menu do usuário.
import { Check, ChevronRight, Compass, X } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { guiaDoPapel, mostrarCartao } from '@/domain/primeirosPassos'
import { usePrimeirosPassos } from '@/hooks/usePrimeirosPassos'
import { cn } from '@/lib/utils'

export function PrimeirosPassos({ rotasDoMenu, perfilId, papel }: { rotasDoMenu: string[]; perfilId: string | undefined; papel: string | null }) {
  const { progresso, marcar, esconder, marcarVisto } = usePrimeirosPassos(perfilId, papel)
  const guia = guiaDoPapel(papel, rotasDoMenu)
  const mostrar = mostrarCartao(guia, progresso)
  // EN3 (revisão do perfil Enfermeiro, RT 24/11/2026): aberto só na primeira
  // visita; depois, uma linha recolhida com "Abrir". A visita fica guardada na
  // primeira vez que o cartão aparece para a pessoa e o papel.
  const jaVisto = !!progresso.visto
  const chave = perfilId && papel ? `${perfilId}:${papel}` : null
  const [estado, setEstado] = React.useState<{ chave: string; aberto: boolean } | null>(null)
  if (mostrar && chave && estado?.chave !== chave) setEstado({ chave, aberto: !jaVisto })
  const setAberto = (aberto: boolean) => { if (chave) setEstado({ chave, aberto }) }
  React.useEffect(() => {
    if (mostrar && chave && !jaVisto) marcarVisto()
  }, [mostrar, chave, jaVisto, marcarVisto])
  if (!guia || !mostrar) return null
  const feitos = guia.passos.filter((x) => progresso.feitos.includes(x.id)).length
  const total = guia.passos.length
  if (!(estado?.aberto ?? !jaVisto)) {
    return (
      <section aria-label="Primeiros passos" className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-cartao border border-fio bg-superficie px-4 py-2">
        <Compass className="size-4 text-acao" aria-hidden />
        <span className="text-apoio text-tinta">Primeiros passos · {guia.titulo}</span>
        <span className="text-apoio tabular-nums text-tinta-sussurro">{feitos} de {total}</span>
        <Button variant="ghost" size="xs" className="ml-auto" onClick={() => setAberto(true)}>Abrir</Button>
      </section>
    )
  }
  return (
    <section aria-label="Primeiros passos" className="mb-5 flex flex-col gap-3 rounded-cartao border border-fio-forte bg-superficie px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Compass className="size-4 text-acao" aria-hidden />
        <span className="text-controle font-semibold text-tinta">Primeiros passos · {guia.titulo}</span>
        <span className="text-apoio tabular-nums text-tinta-sussurro">{feitos} de {total}</span>
        <Button variant="ghost" size="xs" className="ml-auto" onClick={() => setAberto(false)}>Recolher</Button>
        <Button variant="outline" size="xs" onClick={esconder}><X /> Esconder</Button>
      </div>
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
    </section>
  )
}
