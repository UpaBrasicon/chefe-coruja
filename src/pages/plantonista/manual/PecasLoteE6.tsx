import { Badge } from '@/components/ui/badge'

// Peças das telas do lote E6 (manual do HCFMUSP, adulto). Só componentes: a
// regra fica em src/clinico/adulto.

export type Ref = { texto: string; pagina: string; errata?: string }

/** Caixa de marcar com rótulo. */
export function Marca({ rotulo, marcado, onChange }: { rotulo: string; marcado: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm hover:bg-muted/50">
      <input type="checkbox" className="size-4" checked={marcado} onChange={(e) => onChange(e.target.checked)} />
      {rotulo}
    </label>
  )
}

/** Lista de trechos do livro com página e errata. */
export function ListaRef({ itens }: { itens: Ref[] }) {
  return (
    <ul className="flex flex-col gap-1.5 text-sm">
      {itens.map((i) => (
        <li key={i.texto} className="rounded-md border px-3 py-1.5">
          {i.texto} <span className="text-muted-foreground">({i.pagina})</span>
          {i.errata && (
            <span className="mt-1 block text-atencao">
              <Badge variant="warning" className="mr-1">errata</Badge>
              {i.errata}
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}

/** Uma errata solta. */
export function Errata({ texto }: { texto: string }) {
  return (
    <p className="text-sm text-atencao">
      <Badge variant="warning" className="mr-1">errata</Badge>
      {texto}
    </p>
  )
}

/** "O que o manual não traz". */
export function Fora({ itens }: { itens: string[] }) {
  return (
    <ul className="list-disc pl-5 text-sm text-muted-foreground">
      {itens.map((x) => <li key={x}>{x}</li>)}
    </ul>
  )
}
