// Peças visuais do painel de cuidados (cartão, campo com rótulo, aviso e a
// linha de registro do protótipo: meta pequena em cima, texto embaixo).
import type * as React from 'react'

import { cn } from '@/lib/utils'

export const Cartao = ({ titulo, extra, children, className }: {
  titulo?: React.ReactNode; extra?: React.ReactNode; children: React.ReactNode; className?: string
}) => (
  <section className={cn('flex flex-col gap-2.5 rounded-menu border border-fio bg-superficie p-4 text-controle shadow-[0_1px_2px_rgba(15,23,42,0.04)]', className)}>
    {(titulo || extra) && (
      <div className="flex flex-wrap items-baseline gap-2.5">
        {titulo && <h3 className="m-0 min-w-0 flex-[1_1_220px] text-corpo font-semibold text-tinta">{titulo}</h3>}
        {extra}
      </div>
    )}
    {children}
  </section>
)

export const Campo = ({ rotulo, id, children, className }: { rotulo: string; id: string; children: React.ReactNode; className?: string }) => (
  <div className={cn('flex min-w-0 flex-col gap-1', className)}>
    <label htmlFor={id} className="text-rotulo text-tinta-apoio">{rotulo}</label>
    {children}
  </div>
)

export const Aviso = ({ erro, aviso }: { erro: string | null; aviso: string | null }) => (
  <>
    {erro && <p role="alert" className="rounded-controle border border-critico/30 bg-alerta-critico p-2.5 text-apoio text-critico">{erro}</p>}
    {aviso && <p role="status" className="rounded-controle border border-conforme/30 bg-alerta-conforme p-2.5 text-apoio text-conforme">{aviso}</p>}
  </>
)

export const Registro = ({ meta, children, acao, riscado }: { meta: React.ReactNode; children?: React.ReactNode; acao?: React.ReactNode; riscado?: boolean }) => (
  <div className="flex flex-wrap items-center gap-2.5 border-t border-trilha py-2.5">
    <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-0.5">
      <span className="text-rotulo text-tinta-sussurro">{meta}</span>
      {children && <span className={cn('text-controle leading-normal text-pretty text-tinta', riscado && 'text-tinta-sussurro line-through')}>{children}</span>}
    </div>
    {acao}
  </div>
)

export const Nota = ({ children }: { children: React.ReactNode }) => (
  <span className="text-apoio text-pretty text-tinta-sussurro">{children}</span>
)
