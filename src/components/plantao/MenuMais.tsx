// ─────────────────────────────────────────────────────────────────────────────
// Menu "Mais" e menu "…" (revisão de perfis do médico, RT 24/11/2026).
//
// MenuMais: um botão que abre a lista das ações ou abas que não cabem na
// linha. AbasComMais: as abas principais numa linha e o resto no "Mais"; a aba
// escolhida no "Mais" aparece na linha enquanto estiver aberta. Só apresentação:
// cada item chama o que o botão antigo chamava.
// ─────────────────────────────────────────────────────────────────────────────
import { Menu } from '@base-ui/react/menu'
import { ChevronDown, Ellipsis } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'
import { TabsList, TabsTrigger } from '@/components/ui/tabs'

export type ItemMenu = { chave: string; rotulo: React.ReactNode; onSelecionar: () => void; desabilitado?: boolean; ativo?: boolean }

export function MenuMais({ itens, rotulo = 'Mais', icone = false, className, rotuloAcessivel }: {
  itens: ItemMenu[]
  /** Texto do botão; com `icone`, o botão é só "…". */
  rotulo?: React.ReactNode
  icone?: boolean
  className?: string
  rotuloAcessivel?: string
}) {
  if (itens.length === 0) return null
  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={rotuloAcessivel ?? (icone ? 'Mais ações' : undefined)}
        className={cn(
          'inline-flex shrink-0 items-center gap-1 rounded-controle border border-fio bg-superficie text-apoio text-tinta-apoio transition-colors hover:border-acao/40 hover:text-acao data-popup-open:border-acao/40 data-popup-open:text-acao',
          icone ? 'size-8 justify-center' : 'h-8 px-3',
          className,
        )}
      >
        {icone ? <Ellipsis className="size-4" aria-hidden /> : <>{rotulo}<ChevronDown className="size-3.5" aria-hidden /></>}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={6} className="z-[80]">
          <Menu.Popup className="flex min-w-[200px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-container border border-fio bg-superficie py-1 text-tinta shadow-popover outline-none">
            {itens.map((i) => (
              <Menu.Item
                key={i.chave}
                disabled={i.desabilitado}
                onClick={i.onSelecionar}
                className={cn(
                  'flex cursor-default items-center gap-2 px-3.5 py-2 text-apoio outline-none select-none data-disabled:opacity-50 data-highlighted:bg-campo',
                  i.ativo && 'font-semibold text-acao',
                )}
              >
                {i.rotulo}
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}

export type AbaLinha = { k: string; rotulo: string; n?: React.ReactNode; desabilitado?: boolean }

/**
 * Abas principais numa linha e o resto em "Mais". Vai dentro de um `<Tabs>`
 * controlado: `valor` é a aba aberta e `onTrocar` troca de aba.
 */
export function AbasComMais({ abas, principais, valor, onTrocar, rotulo, className }: {
  abas: AbaLinha[]
  principais: string[]
  valor: string
  onTrocar: (k: string) => void
  rotulo: string
  className?: string
}) {
  const linha = abas.filter((a) => principais.includes(a.k) || a.k === valor)
  const resto = abas.filter((a) => !principais.includes(a.k) && a.k !== valor)
  return (
    <div className={cn('flex items-end gap-2 border-b border-fio-forte', className)}>
      <TabsList aria-label={rotulo} className="w-auto min-w-0 flex-1 gap-3.5 border-b-0">
        {linha.map((a) => (
          <TabsTrigger key={a.k} value={a.k} disabled={a.desabilitado} className="shrink-0">
            {a.rotulo}
            {a.n !== undefined && <span className="text-rotulo font-semibold text-acao tabular-nums">{a.n}</span>}
          </TabsTrigger>
        ))}
      </TabsList>
      <div className="pb-1.5">
        <MenuMais
          rotuloAcessivel={`Mais partes: ${resto.map((a) => a.rotulo).join(', ')}`}
          itens={resto.map((a) => ({
            chave: a.k,
            desabilitado: a.desabilitado,
            onSelecionar: () => onTrocar(a.k),
            rotulo: <>{a.rotulo}{a.n !== undefined && <span className="ml-auto text-rotulo font-semibold text-acao tabular-nums">{a.n}</span>}</>,
          }))}
        />
      </div>
    </div>
  )
}
