import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { cn } from '@/lib/utils'

/** Título de página: h1 de 24px, sempre ao lado de um azulejo de 42px com o ícone. */
export function TituloPagina({
  icone: Icone, titulo, descricao, acoes, className,
}: { icone: LucideIcon; titulo: string; descricao?: ReactNode; acoes?: ReactNode; className?: string }) {
  return (
    <header className={cn('cc-pagina-cabeca mb-[22px] flex flex-wrap items-start gap-3.5', className)}>
      <span className="grid size-[42px] shrink-0 place-items-center rounded-controle bg-acao/10 text-acao" aria-hidden>
        <Icone className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <h1 className="text-titulo leading-[1.1] font-semibold tracking-[-0.02em] text-tinta">{titulo}</h1>
        {descricao && <p className="mt-1 text-apoio text-tinta-sussurro">{descricao}</p>}
      </div>
      {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
    </header>
  )
}

/** Trilha (migalha): cada nível é um link, o último é o lugar atual. */
export function Trilha({ niveis }: { niveis: { rotulo: string; to?: string }[] }) {
  return (
    <nav aria-label="Você está em" className="mb-3 flex flex-wrap items-center gap-1 text-apoio text-tinta-sussurro">
      {niveis.map((n, i) => (
        <span key={n.rotulo} className="flex items-center gap-1">
          {i > 0 && <span aria-hidden>›</span>}
          {n.to ? (
            <Link to={n.to} className="text-tinta-sussurro hover:text-acao">{n.rotulo}</Link>
          ) : (
            <span aria-current="page" className="font-medium text-tinta">{n.rotulo}</span>
          )}
        </span>
      ))}
    </nav>
  )
}

/** Título de seção (17px/600) com contagem opcional à direita. */
export function TituloSecao({ children, extra, className }: { children: ReactNode; extra?: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-3 flex items-baseline justify-between gap-3', className)}>
      <h2 className="text-secao leading-[1.3] font-semibold tracking-[-0.01em] text-tinta">{children}</h2>
      {extra && <span className="text-apoio text-tinta-sussurro">{extra}</span>}
    </div>
  )
}

/**
 * Chip: cápsula. `filtro` (padrão) liga com o fundo cheio da ação; `opcao`
 * (escolha num formulário, como o motivo da evasão) liga com o fundo suave e
 * tem 36 px de alvo. Ativo troca o peso de 400 para 500 — a troca de peso é
 * parte do estado, não enfeite. Com `radio`, vira role="radio" dentro de um
 * radiogroup; sem, é um botão que liga e desliga (aria-pressed).
 */
export function Chip({ ativo, children, onClick, contagem, variante = 'filtro', radio = false, tom = 'acao', titulo, desabilitado }: {
  ativo: boolean; children: ReactNode; onClick: () => void; contagem?: number; variante?: 'filtro' | 'opcao'; radio?: boolean
  /** `critico` liga em vermelho (ex.: urgência). */
  tom?: 'acao' | 'critico'; titulo?: string; desabilitado?: boolean
}) {
  return (
    <button
      type="button"
      {...(radio ? { role: 'radio', 'aria-checked': ativo } : { 'aria-pressed': ativo })}
      onClick={onClick}
      title={titulo}
      disabled={desabilitado}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-capsula border px-[13px] text-apoio whitespace-nowrap transition-colors disabled:cursor-not-allowed',
        variante === 'opcao' ? 'min-h-9' : 'py-[5px]',
        ativo
          ? tom === 'critico' ? 'border-critico bg-critico font-medium text-sobre-acao'
            : variante === 'opcao' ? 'border-acao bg-acao/10 font-medium text-acao' : 'border-acao bg-acao font-medium text-sobre-acao'
          : 'border-fio bg-superficie text-tinta-apoio hover:border-acao hover:text-acao disabled:opacity-50',
      )}
    >
      {children}
      {contagem !== undefined && <span className="tabular opacity-80">{contagem}</span>}
    </button>
  )
}

export function Chips({ children, rotulo }: { children: ReactNode; rotulo: string }) {
  return (
    <div role="group" aria-label={rotulo} className="mb-3.5 flex flex-wrap gap-2">
      {children}
    </div>
  )
}

/** Estado vazio: diz o que está vazio e por quê, nunca uma área em branco. */
export function Vazio({ icone: Icone, titulo, texto }: { icone: LucideIcon; titulo: string; texto?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-container border border-dashed border-fio bg-superficie px-6 py-10 text-center">
      <Icone className="size-6 text-tinta-sussurro" aria-hidden />
      <p className="text-corpo font-semibold text-tinta">{titulo}</p>
      {texto && <p className="max-w-md text-apoio text-tinta-sussurro">{texto}</p>}
    </div>
  )
}

/** Título de cartão (14px/600), menor que o de seção (guia do padrão, 4.1). */
export function TituloCartao({ children, extra, className, id }: { children: ReactNode; extra?: ReactNode; className?: string; id?: string }) {
  return (
    <div className={cn('mb-2 flex items-baseline justify-between gap-3', className)}>
      <h3 id={id} className="text-controle leading-[1.3] font-semibold text-tinta">{children}</h3>
      {extra && <span className="text-rotulo text-tinta-sussurro">{extra}</span>}
    </div>
  )
}

/** Vazio de uma linha, dentro de seção ou cartão: "Nenhum exame pedido neste atendimento." (guia 2.3). */
export function VazioLinha({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('py-justo text-apoio text-tinta-sussurro', className)}>{children}</p>
}

/** Abas em cápsula, uma por vez (role tablist). Era a peça da farmácia usada por dez áreas. */
export function Abas<K extends string>({ abas, valor, onChange, rotulo, className }: {
  /** [chave, rótulo] ou [chave, rótulo, contagem]. */
  abas: readonly (readonly [K, string] | readonly [K, string, number | undefined])[]; valor: K; onChange: (k: K) => void; rotulo: string; className?: string
}) {
  return (
    <div role="tablist" aria-label={rotulo} className={cn('mb-[18px] flex flex-wrap gap-1.5', className)}>
      {abas.map(([k, r, n]) => (
        <button key={k} type="button" role="tab" aria-selected={valor === k} onClick={() => onChange(k)}
          className={cn('inline-flex items-center gap-1.5 rounded-capsula border px-[13px] py-[5px] text-apoio transition-colors',
            valor === k ? 'border-acao bg-acao font-medium text-sobre-acao' : 'border-fio bg-superficie text-tinta-apoio hover:border-acao hover:text-acao')}>
          {r}
          {n !== undefined && <span className="tabular-nums opacity-80">{n}</span>}
        </button>
      ))}
    </div>
  )
}
