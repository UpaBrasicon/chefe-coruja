import type { ReactNode } from 'react'

import { SEM_VALOR_NEONATAL } from '@/clinico/pediatria/fonteIcr'
import { NumberField } from '@/components/plantonista/NumberField'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'

import { idadePediatrica, type Paciente } from './formatoIcr'

// Peças visuais das telas do lote P3 (Pronto-Socorro ICr-HCFMUSP, 4ª ed.).
// Só componentes: a regra fica em src/clinico/pediatria.

/** Botões de escolha única. */
export function Opcoes<T extends string | number | boolean>({ label, valor, opcoes, onChange }: { label: string; valor: T; opcoes: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {opcoes.map(([v, t]) => (
          <Button key={t} type="button" size="sm" variant={valor === v ? 'default' : 'outline'} onClick={() => onChange(v)}>
            {t}
          </Button>
        ))}
      </div>
    </div>
  )
}

/** Peso, idade (anos + meses) e recém-nascido, no topo da tela. */
export function CampoPaciente({ id, p, onChange, semIdade, children }: { id: string; p: Paciente; onChange: (p: Paciente) => void; semIdade?: boolean; children?: ReactNode }) {
  const foraDaPediatria = !semIdade && !idadePediatrica(p.anos, p.meses)
  return (
    <Card>
      <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 md:grid-cols-4">
        <NumberField id={`${id}-peso`} label="Peso" unit="kg" value={p.peso} onChange={(peso) => onChange({ ...p, peso })} min={0} step={0.1} />
        {!semIdade && (
          <>
            <NumberField id={`${id}-anos`} label="Idade" unit="anos" value={p.anos} onChange={(anos) => onChange({ ...p, anos })} min={0} max={13} />
            <NumberField id={`${id}-meses`} label="e meses" unit="meses" value={p.meses} onChange={(meses) => onChange({ ...p, meses })} min={0} max={11} />
          </>
        )}
        <Opcoes label="Recém-nascido?" valor={p.rn} opcoes={[[false, 'Não'], [true, 'Sim']]} onChange={(rn) => onChange({ ...p, rn })} />
        {children}
        {foraDaPediatria && (
          <p className="text-sm text-atencao sm:col-span-2 md:col-span-4">A partir dos 14 anos completos é adulto: esta ferramenta é pediátrica.</p>
        )}
      </CardContent>
    </Card>
  )
}

/** Um bloco da tela (título + linhas). */
export function Bloco({ titulo, descricao, children }: { titulo: string; descricao?: ReactNode; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{titulo}</CardTitle>
        {descricao && <CardDescription>{descricao}</CardDescription>}
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">{children}</CardContent>
    </Card>
  )
}

/** Uma linha: o que o livro traz, a conta para o peso (quando há) e a página. */
export function LinhaLivro({ nome, texto, conta, pagina, errata, nota }: { nome: string; texto: ReactNode; conta?: ReactNode; pagina: string; errata?: string; nota?: string }) {
  return (
    <div className="rounded-lg border px-3 py-2 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-medium">{nome}</span>
        {conta && <span className="tabular-nums">{conta}</span>}
      </div>
      <p className="text-muted-foreground">
        O livro traz: {texto} ({pagina})
      </p>
      {nota && <p className="text-muted-foreground">{nota}</p>}
      {errata && <Errata texto={errata} />}
    </div>
  )
}

export function Errata({ texto }: { texto: string }) {
  return (
    <p className="text-sm text-atencao">
      <Badge variant="warning" className="mr-1">
        errata
      </Badge>
      {texto}
    </p>
  )
}

export function Nota({ children }: { children: ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>
}

/** Recém-nascido sem valor neonatal explícito no capítulo, ou peso não informado. */
export function Pendencia({ p, precisaPeso = true }: { p: Paciente; precisaPeso?: boolean }) {
  if (p.rn)
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-atencao">{SEM_VALOR_NEONATAL}</CardContent>
      </Card>
    )
  if (precisaPeso && !(p.peso > 0))
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">Informe o peso para calcular.</CardContent>
      </Card>
    )
  return null
}
