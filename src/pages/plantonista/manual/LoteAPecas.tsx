import type { ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'

// Peças comuns das telas do lote A: trecho do livro com página e errata,
// escolha por botões, bloco de resultado e alertas.

export function Trecho({ texto, pagina, errata }: { texto: string; pagina: string; errata?: string }) {
  return (
    <p className="text-sm">
      {texto} <span className="text-muted-foreground">(Manual HCFMUSP, {pagina})</span>
      {errata && (
        <span className="mt-1 block text-muted-foreground">
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
      <Label>{label}</Label>
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
        <CardTitle className="text-base">{titulo}</CardTitle>
        {descricao && <CardDescription>{descricao}</CardDescription>}
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">{children}</CardContent>
    </Card>
  )
}

export function Resultado({ rotulo, valor }: { rotulo: string; valor: ReactNode }) {
  return (
    <div className="flex flex-col">
      <span className="text-muted-foreground">{rotulo}</span>
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
