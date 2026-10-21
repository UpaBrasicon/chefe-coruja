import { Bird } from 'lucide-react'
import type { ReactNode, Ref } from 'react'
import { Link } from 'react-router-dom'
import '@fontsource-variable/newsreader'
import '@fontsource-variable/geist-mono'

import { cn } from '@/lib/utils'
import './entrada.css'

// Peças das telas de entrada, na direção "Livro da escala" da landing
// (trilha Revisão visual, parte 2; docs/frontend/revisao-visual/entrada/).
// A coluna da marca é a folha escura: colunas de 2 h da escala ao fundo,
// título em serifa e linhas de registro. Some abaixo de lg; lá fica a marca.

/** Linha de registro da coluna escura. `n` é o número do passo, quando a ordem importa. */
export function LinhaMarca({ n, titulo, texto, atual }: { n?: ReactNode; titulo: string; texto: string; atual?: boolean }) {
  return (
    <li className="cc-linha-marca" aria-current={atual ? 'step' : undefined}>
      {n !== undefined && <span className="cc-linha-marca-n" aria-hidden>{n}</span>}
      <b className={n === undefined ? 'col-span-2' : undefined}>{titulo}</b>
      <span className={n === undefined ? 'col-span-2' : undefined}>{texto}</span>
    </li>
  )
}

/** Coluna da marca: folha escura com marca, título, texto, linhas e rodapé. */
export function FolhaMarca({ titulo, texto, rodape, className, children }: {
  titulo: string; texto: string; rodape: string; className?: string; children: ReactNode
}) {
  return (
    <aside className={cn('cc-folha-marca flex-col justify-between gap-10 overflow-hidden px-12 pt-9 pb-10', className)}>
      <Link to="/" className="flex items-center gap-2.5 text-sobre-veu hover:text-sobre-veu">
        <span className="grid size-8 place-items-center rounded-controle bg-marca" aria-hidden>
          <Bird className="size-[18px]" />
        </span>
        <span className="text-secao font-semibold tracking-[-0.02em]">Chefe Coruja</span>
      </Link>

      <div>
        {/* padrao-ok: título da tela de marca (serifa da landing, entrada.css) */}
        <h1 className="cc-titulo-marca">{titulo}</h1>
        <p className="cc-texto-marca">{texto}</p>
        <ol className="cc-linhas-marca">{children}</ol>
      </div>

      <span className="cc-rodape-marca">{rodape}</span>
    </aside>
  )
}

export function LadoMarca() {
  return (
    <FolhaMarca
      className="hidden lg:flex"
      titulo="O turno começa quando a escala diz."
      texto="A entrada é conferida contra a escala e o relógio do servidor. Fora do seu horário, a plataforma não abre."
      rodape="Cada registro tem autor: quem escreve é quem está no login."
    >
      <LinhaMarca titulo="Escala antes da senha" texto="O acesso vale para a janela do plantão, não para o dia inteiro." />
      <LinhaMarca titulo="Check-in dentro do raio" texto="A presença é confirmada na unidade; o horário fica registrado." />
      <LinhaMarca titulo="Cada papel vê o seu" texto="Recepção, enfermagem, plantonista, farmácia, gestão e os demais papéis têm telas próprias." />
    </FolhaMarca>
  )
}

/** Marca compacta, no lugar da coluna escura, em telas estreitas. */
export function MarcaCompacta() {
  return (
    <Link to="/" className="mb-8 flex items-center gap-2.5 text-tinta hover:text-tinta lg:hidden">
      <span className="grid size-8 place-items-center rounded-controle bg-marca text-sobre-veu" aria-hidden>
        <Bird className="size-4" />
      </span>
      <span className="text-corpo font-semibold">Chefe Coruja</span>
    </Link>
  )
}

/**
 * Título do formulário nas telas de entrada (login, primeiro acesso, recuperar
 * senha): a serifa da landing, sem o azulejo do TituloPagina.
 */
export function TituloEntrada({ id, ref, tabIndex, className, children }: {
  id?: string; ref?: Ref<HTMLHeadingElement>; tabIndex?: number; className?: string; children: ReactNode
}) {
  return (
    // padrao-ok: título da tela de marca (serifa da landing, entrada.css; o TituloPagina tem 24 px e azulejo)
    <h2 id={id} ref={ref} tabIndex={tabIndex} className={cn('cc-titulo-entrada', className)}>
      {children}
    </h2>
  )
}

/** Linha de registro no fundo claro: título e texto, com fio embaixo. */
export function LinhaEntrada({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <li className="cc-linha">
      <b>{titulo}</b>
      <span>{children}</span>
    </li>
  )
}

/**
 * Página de entrada sem coluna (aguardando liberação, seletor de unidade,
 * link de receita): topo com a marca e uma ação, título em serifa e o conteúdo.
 */
export function PaginaEntrada({ titulo, abertura, acao, children }: {
  titulo: string; abertura?: ReactNode; acao?: ReactNode; children?: ReactNode
}) {
  return (
    <div className="min-h-dvh bg-campo text-tinta">
      <header className="cc-topo-entrada">
        <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between gap-4 px-4 sm:px-10">
          <Link to="/" className="flex items-center gap-2.5 text-tinta hover:text-tinta">
            <span className="grid size-[30px] place-items-center rounded-controle bg-marca text-sobre-veu" aria-hidden>
              <Bird className="size-[17px]" />
            </span>
            <span className="text-secao font-semibold tracking-[-0.02em]">Chefe Coruja</span>
          </Link>
          {acao}
        </div>
      </header>
      <main className="mx-auto w-full max-w-[560px] px-4 pt-16 pb-20 sm:px-6">
        {/* padrao-ok: título da tela de marca (serifa da landing, entrada.css) */}
        <h1 className="cc-titulo-entrada cc-titulo-pagina-entrada">{titulo}</h1>
        {abertura && <p className="mt-3 mb-8 text-corpo text-pretty text-tinta-apoio">{abertura}</p>}
        {children}
      </main>
    </div>
  )
}
