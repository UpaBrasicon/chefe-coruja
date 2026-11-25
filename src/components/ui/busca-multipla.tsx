// Busca com seleção múltipla (RT, 24/11/2026: "sem parede de checkbox"). Os
// escolhidos ficam como fichas acima do campo; a lista só mostra o que bate
// com a busca, no máximo `limite` opções por vez.
import { Search, X } from 'lucide-react'
import * as React from 'react'

import { BotaoLinha } from '@/components/ui/botao-linha'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export type OpcaoBusca = { id: string; nome: string }

const normalizar = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

export function BuscaMultipla({ id, opcoes, selecionados, onChange, placeholder = 'Buscar pelo nome', limite = 8, vazio = 'Nenhum resultado.' }: {
  id?: string
  opcoes: OpcaoBusca[]
  selecionados: string[]
  onChange: (ids: string[]) => void
  placeholder?: string
  limite?: number
  vazio?: string
}) {
  const [termo, setTermo] = React.useState('')
  const escolhidos = opcoes.filter((o) => selecionados.includes(o.id))
  const t = normalizar(termo.trim())
  const restantes = opcoes.filter((o) => !selecionados.includes(o.id) && (!t || normalizar(o.nome).includes(t)))
  const mostrar = restantes.slice(0, limite)
  return (
    <div className="flex flex-col gap-2">
      {escolhidos.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {escolhidos.map((o) => (
            <span key={o.id} className="inline-flex items-center gap-1 rounded-capsula bg-acao/10 py-0.5 pr-1 pl-2.5 text-rotulo text-acao">
              {o.nome}
              <Button type="button" variant="ghost" size="xs" aria-label={`Tirar ${o.nome}`}
                className="size-5 min-h-0 rounded-capsula p-0 text-acao hover:text-acao"
                onClick={() => onChange(selecionados.filter((x) => x !== o.id))}>
                <X className="size-3" />
              </Button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-tinta-sussurro" aria-hidden />
        <Input id={id} className="h-8 pl-8" placeholder={placeholder} value={termo} onChange={(e) => setTermo(e.target.value)} />
      </div>
      {(t || escolhidos.length === 0) && (
        <ul className="flex flex-col rounded-controle border border-fio">
          {mostrar.map((o) => (
            <li key={o.id}>
              <BotaoLinha variante="linha" className="py-2 text-apoio text-tinta" onClick={() => { onChange([...selecionados, o.id]); setTermo('') }}>
                {o.nome}
              </BotaoLinha>
            </li>
          ))}
          {mostrar.length === 0 && <li className="px-3 py-2 text-rotulo text-tinta-sussurro">{vazio}</li>}
          {restantes.length > mostrar.length && (
            <li className="px-3 py-1.5 text-rotulo text-tinta-sussurro">e mais {restantes.length - mostrar.length}: refine a busca</li>
          )}
        </ul>
      )}
    </div>
  )
}
