import type { ReactNode } from 'react'

import { Chip } from '@/components/monitor/Pagina'
import { NumberField } from '@/components/plantonista/NumberField'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

// Peças visuais das telas do lote C (manual do HCFMUSP, adulto). Só
// componentes: a regra fica em src/clinico/adulto.

/** Campo de peso no topo da tela. */
export function CampoPeso({ id, peso, onChange, children }: { id: string; peso: number; onChange: (v: number) => void; children?: ReactNode }) {
  return (
    <Card>
      <CardContent className="grid gap-4 pt-6 md:grid-cols-3">
        <NumberField id={id} label="Peso" unit="kg" value={peso} onChange={onChange} min={0} step={0.1} />
        {children}
      </CardContent>
    </Card>
  )
}

/** Um bloco da tela (título + linhas). */
export function Bloco({ titulo, descricao, children }: { titulo: string; descricao?: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-corpo">{titulo}</CardTitle>
        {descricao && <CardDescription>{descricao}</CardDescription>}
      </CardHeader>
      <CardContent className="flex flex-col gap-2">{children}</CardContent>
    </Card>
  )
}

/** Uma droga: o que o manual traz, a conta (quando há) e a página. */
export function LinhaManual({
  nome,
  texto,
  conta,
  pagina,
  errata,
  nota,
}: {
  nome: string
  texto: ReactNode
  conta?: ReactNode
  pagina: string
  errata?: string
  nota?: string
}) {
  return (
    <div className="rounded-controle border px-3 py-2 text-apoio">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-medium">{nome}</span>
        {conta && <span className="tabular-nums">{conta}</span>}
      </div>
      <p className="text-tinta-sussurro">O manual traz: {texto} ({pagina})</p>
      {nota && <p className="text-tinta-sussurro">{nota}</p>}
      {errata && (
        <p className="text-atencao">
          <Badge variant="warning" className="mr-1">errata</Badge>
          {errata}
        </p>
      )}
    </div>
  )
}

const NAO_SIM: [boolean, string][] = [[false, 'Não'], [true, 'Sim']]

/** Pergunta de escolha única com chips (o mesmo controle dos escores); sem `opcoes`, Não/Sim. */
export function Pergunta<T extends string | boolean>({ rotulo, valor, opcoes, onChange }: {
  rotulo: string; valor: T | undefined; opcoes?: [T, string][]; onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-trilha py-2.5 last:border-0">
      <span className="text-controle text-tinta">{rotulo}</span>
      <div role="radiogroup" aria-label={rotulo} className="flex flex-wrap gap-2">
        {(opcoes ?? (NAO_SIM as [T, string][])).map(([v, r]) => <Chip key={String(v)} radio variante="opcao" ativo={valor === v} onClick={() => onChange(v)}>{r}</Chip>)}
      </div>
    </div>
  )
}

