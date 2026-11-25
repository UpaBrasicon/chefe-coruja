// ─────────────────────────────────────────────────────────────────────────────
// Painel do pedido ao lado da lista (revisão do perfil Médico regulador, RD1 =
// A, RT 24/11/2026). A lista fica à esquerda e o pedido aberto à direita, com
// o cabeçalho fixo; abaixo de 1024 px o pedido abre na gaveta lateral. As
// ações raras (cancelar) moram no menu "…" do cabeçalho, com o diálogo do
// motivo. Só apresentação: cada ação chama a RPC de antes.
// ─────────────────────────────────────────────────────────────────────────────
import { Menu } from '@base-ui/react/menu'
import { Ellipsis } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Gaveta } from '@/components/ui/gaveta'
import { Label } from '@/components/ui/label'
import { MensagemErro } from '@/components/ui/mensagem-erro'
import { Textarea } from '@/components/ui/textarea'
import { useLarguraAte } from '@/hooks/useLarguraAte'
import { cn } from '@/lib/utils'

/** Lista à esquerda e o pedido aberto à direita (gaveta no celular e no tablet). */
export function ListaComPainel({ lista, aberto, painel, aoFechar, rotulo }: {
  lista: React.ReactNode
  aberto: string | null
  painel: (id: string) => React.ReactNode
  aoFechar: () => void
  rotulo: string
}) {
  const estreito = useLarguraAte(1023)
  if (estreito) {
    return (
      <>
        {lista}
        <Gaveta aberta={!!aberto} onAbertaChange={(v) => { if (!v) aoFechar() }} rotulo={rotulo} className="max-w-[560px]">
          {aberto && painel(aberto)}
        </Gaveta>
      </>
    )
  }
  return (
    <div className={cn('grid items-start gap-4', aberto && 'grid-cols-[minmax(0,1fr)_minmax(380px,460px)]')}>
      <div className="min-w-0">{lista}</div>
      {aberto && (
        <aside aria-label={rotulo}
          className="sticky top-4 max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-container border border-fio bg-superficie">
          {painel(aberto)}
        </aside>
      )}
    </div>
  )
}

export type AcaoMenu = { chave: string; rotulo: string; onSelecionar: () => void; perigo?: boolean }

/** Menu "…" do cabeçalho do pedido. */
export function MenuAcoesPedido({ itens, rotulo = 'Mais ações do pedido' }: { itens: AcaoMenu[]; rotulo?: string }) {
  if (itens.length === 0) return null
  return (
    <Menu.Root>
      <Menu.Trigger aria-label={rotulo}
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-controle border border-fio bg-superficie text-tinta-apoio transition-colors hover:border-acao/40 hover:text-acao data-popup-open:border-acao/40 data-popup-open:text-acao">
        <Ellipsis className="size-4" aria-hidden />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={4} className="z-[80]">
          <Menu.Popup className="flex min-w-[200px] flex-col overflow-hidden rounded-container border border-fio bg-superficie py-1 text-tinta shadow-popover outline-none">
            {itens.map((i) => (
              <Menu.Item key={i.chave} onClick={i.onSelecionar}
                className={cn('flex cursor-default items-center px-4 py-2 text-apoio outline-none select-none data-highlighted:bg-campo', i.perigo && 'text-critico')}>
                {i.rotulo}
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}

/** Diálogo de motivo (o mesmo mínimo de 10 letras de antes). */
export function DialogoMotivo({ aberto, aoFechar, titulo, descricao, rotulo, confirmar, minimo = 10, ocupado, erro, aoConfirmar }: {
  aberto: boolean; aoFechar: () => void
  titulo: string; descricao?: string; rotulo: string; confirmar: string
  minimo?: number; ocupado: boolean; erro?: unknown
  aoConfirmar: (motivo: string) => void
}) {
  const [motivo, setMotivo] = React.useState('')
  const id = React.useId()
  const fechar = (v: boolean) => { if (!v) { setMotivo(''); aoFechar() } }
  return (
    <Dialog open={aberto} onOpenChange={fechar}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          {descricao && <DialogDescription>{descricao}</DialogDescription>}
        </DialogHeader>
        <div className="flex flex-col gap-1">
          <Label htmlFor={id} className="text-rotulo">{rotulo}</Label>
          <Textarea id={id} rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <span className="text-rotulo text-tinta-sussurro">Pelo menos {minimo} letras. Fica no histórico do pedido.</span>
        </div>
        <MensagemErro erro={erro} acao={confirmar.toLowerCase()} />
        <DialogFooter>
          <Button variant="ghost" onClick={() => fechar(false)}>Voltar</Button>
          <Button variant="destructive" disabled={ocupado || motivo.trim().length < minimo} onClick={() => aoConfirmar(motivo.trim())}>{confirmar}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
