import { Bird, CalendarClock, MapPin, ShieldCheck } from 'lucide-react'
import type { ReactNode, Ref } from 'react'
import { Link } from 'react-router-dom'

import { cn } from '@/lib/utils'

// Coluna verde da entrada (login.html do protótipo, 33–64 e 225–255): mesma
// paleta e mesmas formas da landing. Some abaixo de lg; lá fica só a marca.

function Ponto({ icone: Icone, titulo, texto, cor }: { icone: typeof MapPin; titulo: string; texto: string; cor: string }) {
  return (
    <li className="grid grid-cols-[34px_minmax(0,1fr)] items-start gap-[13px]">
      <span className={cn('grid size-[34px] place-items-center rounded-controle text-sobre-acao', cor)} aria-hidden>
        <Icone className="size-[17px]" />
      </span>
      <span>
        <b className="block text-corpo font-semibold tracking-[-0.01em] text-sobre-veu">{titulo}</b>
        <span className="text-controle leading-[1.5] text-marca-texto-claro">{texto}</span>
      </span>
    </li>
  )
}

export function LadoMarca() {
  return (
    <aside className="relative hidden flex-col justify-between gap-10 overflow-hidden bg-veu px-12 pt-9 pb-10 text-sobre-veu lg:flex">
      <span aria-hidden className="cc-barra-1 pointer-events-none absolute -top-[50px] -right-[180px] h-[92px] w-[620px] rounded-capsula bg-marca" />
      <span aria-hidden className="cc-barra-2 pointer-events-none absolute top-40 -right-[90px] h-[92px] w-[480px] rounded-capsula bg-marca-clara/15" />
      <span aria-hidden className="cc-bolha-1 pointer-events-none absolute -bottom-[120px] -left-[110px] size-[300px] rounded-capsula bg-marca-clara/8" />

      <Link to="/" className="relative z-[2] flex items-center gap-2.5 text-sobre-veu hover:text-sobre-veu">
        <span className="grid size-8 place-items-center rounded-controle bg-sobre-veu/12" aria-hidden>
          <Bird className="size-[18px]" />
        </span>
        <span className="text-secao font-semibold tracking-[-0.02em]">Chefe Coruja</span>
      </Link>

      <div className="relative z-[2]">
        {/* padrao-ok: título da tela de marca (40 px do desenho da entrada, fora da escala de tela) */}
        <h1 className="mb-3.5 max-w-[15ch] text-[40px] leading-[1.06] font-semibold tracking-[-0.032em] text-sobre-veu">
          O turno começa <span className="text-marca-clara">quando a escala diz</span>
        </h1>
        <p className="max-w-[40ch] text-corpo text-pretty text-marca-texto-claro">
          A entrada é conferida contra a escala e o relógio do servidor. Fora do seu horário, a plataforma não abre.
        </p>
        <ul className="mt-[34px] flex flex-col gap-4">
          <Ponto icone={CalendarClock} cor="bg-leitos" titulo="Escala antes da senha" texto="O acesso vale para a janela do plantão, não para o dia inteiro." />
          <Ponto icone={MapPin} cor="bg-suprimento" titulo="Check-in dentro do raio" texto="A presença é confirmada na unidade; o horário fica registrado." />
          <Ponto icone={ShieldCheck} cor="bg-observacao" titulo="Cada papel vê o seu" texto="Plantonista, enfermagem, farmácia, coordenação e administração têm telas próprias." />
        </ul>
      </div>

      <span className="relative z-[2] text-apoio text-marca-texto-claro/80">Cada registro tem autor: quem escreve é quem está no login.</span>
    </aside>
  )
}

/** Marca compacta, no lugar da coluna verde, em telas estreitas. */
export function MarcaCompacta() {
  return (
    <Link to="/" className="mb-8 flex items-center gap-2.5 text-tinta hover:text-tinta lg:hidden">
      <span className="grid size-8 place-items-center rounded-controle bg-veu text-sobre-veu" aria-hidden>
        <Bird className="size-4" />
      </span>
      <span className="text-corpo font-semibold">Chefe Coruja</span>
    </Link>
  )
}

/**
 * Título do formulário nas telas de entrada (login, primeiro acesso, recuperar
 * senha): 26 px na cor da ação, sem o azulejo do TituloPagina.
 */
export function TituloEntrada({ id, ref, tabIndex, className, children }: {
  id?: string; ref?: Ref<HTMLHeadingElement>; tabIndex?: number; className?: string; children: ReactNode
}) {
  return (
    // padrao-ok: título da tela de marca (26 px do desenho da entrada; o TituloPagina tem 24 px e azulejo)
    <h2 id={id} ref={ref} tabIndex={tabIndex} className={cn('mb-1.5 text-[26px] leading-[1.15] font-semibold tracking-[-0.026em] text-acao-pressionada', className)}>
      {children}
    </h2>
  )
}
