// Peças visuais da aba Evolução, no desenho do protótipo (aba Evolução do
// leito): bloco branco de 14px de raio, rótulos de seção em caixa alta,
// campos com fundo "campo" e selos em cápsula.
import * as React from 'react'

import { cn } from '@/lib/utils'
import { Textarea } from '@/components/ui/textarea'

export function Bloco({ children, className, ...props }: React.ComponentProps<'section'>) {
  return (
    <section className={cn('flex min-w-0 flex-col gap-3 rounded-menu border border-fio bg-superficie p-4', className)} {...props}>
      {children}
    </section>
  )
}

/** Rótulo de seção (12px/600, caixa alta, sussurro). */
export function RotuloSecao({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn('text-rotulo font-semibold tracking-[0.06em] text-tinta-sussurro uppercase', className)}>{children}</span>
}

export function CampoTexto({
  rotulo, dica, valor, onValor, placeholder, linhas = 2, id,
}: {
  rotulo: React.ReactNode
  dica?: string
  valor: string
  onValor: (v: string) => void
  placeholder?: string
  linhas?: number
  id: string
}) {
  return (
    <div className="flex flex-col gap-[5px]">
      <label htmlFor={id} className="text-apoio font-medium text-grafite">
        {rotulo} {dica && <span className="font-normal text-tinta-sussurro">{dica}</span>}
      </label>
      <Textarea id={id} rows={linhas} value={valor} placeholder={placeholder} onChange={(e) => onValor(e.target.value)} className="min-h-0 leading-[1.5]" />
    </div>
  )
}

/** Chip de escolha única (SpO₂ em, estado do CID, movimento do antibiótico). */
export function ChipEscolha({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-8 items-center rounded-capsula border px-3 py-1 text-apoio transition-colors',
        ativo ? 'border-marca/40 bg-marca/10 font-medium text-acao' : 'border-fio bg-superficie text-tinta-apoio hover:border-acao hover:text-acao',
      )}
    >
      {children}
    </button>
  )
}

export function Selo({ tom = 'marca', children, className }: { tom?: 'marca' | 'conforme' | 'atencao' | 'critico' | 'neutro'; children: React.ReactNode; className?: string }) {
  const cores = {
    marca: 'bg-marca/10 text-acao',
    conforme: 'bg-conforme/10 text-conforme',
    atencao: 'bg-atencao/10 text-atencao',
    critico: 'bg-critico/10 text-critico',
    neutro: 'bg-trilha text-tinta-apoio',
  }
  return <span className={cn('inline-flex items-center gap-[5px] rounded-capsula px-2.5 py-[3px] text-rotulo font-semibold whitespace-nowrap', cores[tom], className)}>{children}</span>
}

export type Aviso = { erro: boolean; texto: string } | null

export function Mensagem({ aviso }: { aviso: Aviso }) {
  if (!aviso) return null
  return (
    <p role={aviso.erro ? 'alert' : 'status'} className={cn('rounded-controle border px-3 py-2 text-apoio',
      aviso.erro ? 'border-critico/30 bg-critico/[0.06] text-critico' : 'border-conforme/30 bg-conforme/[0.06] text-conforme')}>
      {aviso.texto}
    </p>
  )
}
