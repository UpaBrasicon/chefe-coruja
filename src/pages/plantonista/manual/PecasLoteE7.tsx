import { Badge } from '@/components/ui/badge'

import { botao } from './loteE7Formato'

// Peças visuais das telas do lote E7 (manual do HCFMUSP, adulto). Só
// apresentação: a regra fica em src/clinico/adulto.

/** Grupo de botões de escolha única. */
export function Escolhas<T extends string>({ valor, opcoes, onChange }: { valor: T; opcoes: readonly (readonly [T, string])[]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {opcoes.map(([v, rotulo]) => (
        <button key={v} type="button" aria-pressed={valor === v} onClick={() => onChange(v)} className={botao(valor === v)}>{rotulo}</button>
      ))}
    </div>
  )
}

/** Lista de itens do livro com a página. */
export function ListaLivro({ itens }: { itens: { texto: string; pagina: string }[] }) {
  return (
    <ul className="list-disc pl-5 text-sm">
      {itens.map((i) => <li key={i.texto}>{i.texto} <span className="text-muted-foreground">({i.pagina})</span></li>)}
    </ul>
  )
}

/** Linhas de errata/nota conferidas no livro. */
export function Erratas({ itens }: { itens: string[] }) {
  return (
    <div className="flex flex-col gap-1 text-sm">
      {itens.map((e) => (
        <p key={e} className="text-atencao"><Badge variant="warning" className="mr-1">errata</Badge>{e}</p>
      ))}
    </div>
  )
}
