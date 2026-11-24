import type { ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { VerMais } from '@/components/plantonista/calc/Evidencias'

// Peças comuns das telas do lote A: trecho do livro com página e errata,
// escolha por botões, bloco de resultado e alertas.

export function Trecho({ texto, pagina, errata, recolher }: { texto: string; pagina: string; errata?: string
  /** piloto das calculadoras (C6 = A): errata recolhida em "Notas do livro" */
  recolher?: boolean }) {
  // Com a errata recolhida, o trecho vira div: <details> não pode ficar dentro de <p>.
  if (errata && recolher) {
    return (
      <div className="text-apoio">
        <p>{texto} <span className="text-tinta-sussurro">(Manual HCFMUSP, {pagina})</span></p>
        <VerMais rotulo="Errata do livro"><p>{errata}</p></VerMais>
      </div>
    )
  }
  return (
    <p className="text-apoio">
      {texto} <span className="text-tinta-sussurro">(Manual HCFMUSP, {pagina})</span>
      {errata && (
        <span className="mt-1 block text-tinta-sussurro">
          <Badge variant="outline" className="mr-1">errata</Badge>
          {errata}
        </span>
      )}
    </p>
  )
}

export function Escolha<T extends string>({ label, value, onChange, opcoes }: { label: string; value: T; onChange: (v: T) => void; opcoes: { value: T; label: string }[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="flex-1 items-end leading-snug">{label}</Label>
      <div className="flex flex-wrap gap-2">
        {opcoes.map((o) => (
          <Button key={o.value} type="button" size="sm" variant={value === o.value ? 'default' : 'outline'} aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
            {o.label}
          </Button>
        ))}
      </div>
    </div>
  )
}

export function Bloco({ titulo, descricao, children }: { titulo: string; descricao?: ReactNode; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-corpo">{titulo}</CardTitle>
        {descricao && <CardDescription>{descricao}</CardDescription>}
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-apoio">{children}</CardContent>
    </Card>
  )
}

export function Resultado({ rotulo, valor }: { rotulo: string; valor: ReactNode }) {
  return (
    <div className="flex flex-col">
      <span className="text-tinta-sussurro">{rotulo}</span>
      <strong className="tabular-nums">{valor}</strong>
    </div>
  )
}

export function Alertas({ itens }: { itens: string[] }) {
  if (itens.length === 0) return null
  return (
    <ul className="flex flex-col gap-1 text-atencao">
      {itens.map((a) => <li key={a}>{a}</li>)}
    </ul>
  )
}
