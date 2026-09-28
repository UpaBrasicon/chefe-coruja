import type { ReactNode } from 'react'

import { SC_INFORMADA, type ItemLivro } from '@/clinico/pediatria/fonteP5'
import { NumberField } from '@/components/plantonista/NumberField'

import { faixaBr } from './formatoIcr'
import { LinhaLivro, Nota } from './PecasIcr'

// Peças visuais do lote P5 (livro do ICr). Só componentes.

/** Itens de referência do livro, cada um com a página. */
export function ListaLivro({ itens }: { itens: ItemLivro[] }) {
  return (
    <>
      {itens.map((r) => (
        <Nota key={r.texto}>
          {r.texto} ({r.pagina})
        </Nota>
      ))}
    </>
  )
}

/** Lista simples de critérios de um quadro do livro. */
export function ListaQuadro({ itens, pagina }: { itens: string[]; pagina: string }) {
  return (
    <div>
      <ul className="list-disc space-y-0.5 pl-5">
        {itens.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
      <p className="text-rotulo text-tinta-sussurro">Livro ICr, {pagina}.</p>
    </div>
  )
}

/** Superfície corpórea informada pelo médico (o livro não traz fórmula). */
export function CampoSC({ id, valor, onChange }: { id: string; valor: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <NumberField id={id} label="Superfície corpórea (informada)" unit="m²" value={valor} onChange={onChange} min={0} step={0.01} />
      <Nota>{SC_INFORMADA}</Nota>
    </div>
  )
}

/** Linha "o livro traz" com a conta em faixa. */
export function LinhaFaixa({
  nome, faixa, unidade, casas = 1, texto, pagina, nota, errata, extra,
}: {
  nome: string
  faixa: [number, number] | null
  unidade: string
  casas?: number
  texto: ReactNode
  pagina: string
  nota?: string
  errata?: string
  extra?: ReactNode
}) {
  return (
    <LinhaLivro
      nome={nome}
      texto={texto}
      pagina={pagina}
      nota={nota}
      errata={errata}
      conta={
        faixa ? (
          <>
            <strong>
              {faixaBr(faixa, casas)} {unidade}
            </strong>
            {extra}
          </>
        ) : undefined
      }
    />
  )
}
