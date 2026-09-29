import * as React from 'react'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { XIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

// Gaveta lateral (P/index.html .cc-lateral): entra pela direita, de fora da
// tela onde o presente está — chat, episódios anteriores, caderno do leito.
// 420px no desktop, largura toda abaixo de 520px; rola dentro de si.

export function Gaveta({
  aberta,
  onAbertaChange,
  rotulo,
  children,
  className,
}: {
  aberta: boolean
  onAbertaChange: (v: boolean) => void
  /** Nome acessível do diálogo. */
  rotulo: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <DialogPrimitive.Root open={aberta} onOpenChange={onAbertaChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-[45] bg-[rgba(15,23,42,0.42)] data-open:animate-cc-scrim data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Popup
          aria-label={rotulo}
          className={cn(
            'fixed inset-y-0 right-0 z-[46] flex h-dvh w-full max-w-[420px] flex-col overflow-y-auto bg-superficie shadow-lateral outline-none data-open:animate-cc-lateral data-closed:animate-out data-closed:fade-out-0 data-closed:slide-out-to-right-4 max-[520px]:max-w-none',
            className,
          )}
        >
          {children}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

/** Cabeçalho da gaveta: sobretítulo em rótulo, título de 17px e o fechar. */
export function GavetaCabeca({
  sobre,
  titulo,
  detalhe,
  antes,
}: {
  sobre?: string
  titulo: React.ReactNode
  detalhe?: React.ReactNode
  /** Botão à esquerda do título (ex.: voltar). */
  antes?: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3 border-b border-trilha px-[22px] pt-5 pb-4">
      {antes}
      <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
        {sobre && <span className="rotulo text-tinta-sussurro">{sobre}</span>}
        <DialogPrimitive.Title className="text-secao font-semibold tracking-[-0.015em] text-tinta">{titulo}</DialogPrimitive.Title>
        {detalhe && <span className="text-apoio text-tinta-sussurro">{detalhe}</span>}
      </div>
      <DialogPrimitive.Close aria-label="Fechar" className="flex shrink-0 p-1 text-tinta-sussurro hover:text-acao">
        <XIcon className="size-[17px]" aria-hidden />
      </DialogPrimitive.Close>
    </div>
  )
}

/** Rodapé fixo da gaveta: a regra de alcance ou o campo de escrever. */
export function GavetaPe({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('mt-auto border-t border-trilha bg-campo px-[22px] pt-3.5 pb-5 text-apoio leading-[1.5] text-tinta-sussurro', className)}>
      {children}
    </div>
  )
}
