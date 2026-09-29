import type { ReactNode } from 'react'

import { calcularDose, SEM_VALOR_NEONATAL_P2, type DosePeso } from '@/clinico/pediatria/fonteP2'
import { NumberField } from '@/components/plantonista/NumberField'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import { faixaTxt, num } from './formatoP2'

// Peças visuais do lote P2 (livro do ICr). Só componentes.


const porKgTxt = (u: DosePeso['unidade']) =>
  u === 'µg/min' ? 'µg/kg/min' : u === 'mg/h' ? 'mg/kg/h' : u === 'mL/h' ? 'mL/kg/h' : `${u}/kg`

/** Peso + marca de recém-nascido (período neonatal). */
export function CampoPesoRn({ id, peso, setPeso, rn, setRn }: { id: string; peso: number; setPeso: (x: number) => void; rn: boolean; setRn: (x: boolean) => void }) {
  return (
    <Card>
      <CardContent className="grid gap-4 pt-6 md:grid-cols-2">
        <NumberField id={id} label="Peso aferido ou estimado" unit="kg" value={peso} onChange={setPeso} min={0} step={0.1} />
        <label className="flex cursor-pointer items-center gap-2 self-end rounded-md border px-3 py-2 text-sm hover:bg-trilha/50">
          <input type="checkbox" className="size-4" checked={rn} onChange={(e) => setRn(e.target.checked)} />
          Recém-nascido (período neonatal)
        </label>
      </CardContent>
    </Card>
  )
}

export function AvisoRn() {
  return (
    <Card>
      <CardContent className="pt-6 text-sm text-tinta-sussurro">{SEM_VALOR_NEONATAL_P2}</CardContent>
    </Card>
  )
}

export function PesoInvalido() {
  return (
    <Card>
      <CardContent className="pt-6 text-sm text-tinta-sussurro">Informe o peso para calcular (acima de 0 e até 80 kg).</CardContent>
    </Card>
  )
}

/** Uma linha de dose calculada pelo peso, com faixa por kg, máximo, via e página. */
export function LinhaDose({ d, peso, extra }: { d: DosePeso; peso: number; extra?: ReactNode }) {
  const r = calcularDose(d, peso)
  if (!r) return null
  return (
    <div className="rounded-lg border px-3 py-2 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-medium">{d.nome}</span>
        <span className="tabular-nums">
          <strong>{faixaTxt(r.dose)} {d.unidade}</strong>
          {r.volumeMl && d.unidade !== 'mL' && <span className="text-tinta-sussurro"> · {faixaTxt(r.volumeMl)} mL</span>}
        </span>
      </div>
      <p className="mt-1 text-tinta-sussurro">
        {faixaTxt(d.porKg, 3)} {porKgTxt(d.unidade)}
        {d.maximo !== undefined && ` · máximo ${num(d.maximo)} ${d.unidade}`}
        {d.solucao && ` · ${d.solucao}`}
        {' · '}{d.via}
      </p>
      {r.noMaximo && <p className="text-atencao">Limitado ao máximo do livro.</p>}
      {extra}
      {d.nota && <p className="text-tinta-sussurro">No livro: {d.nota}</p>}
      {d.errata && <p className="text-tinta-sussurro"><Badge variant="outline" className="mr-1">errata</Badge>{d.errata}</p>}
      <p className="text-rotulo text-tinta-sussurro">Livro ICr, {d.pagina}.</p>
    </div>
  )
}

export function Bloco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{titulo}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">{children}</CardContent>
    </Card>
  )
}

/** Item de referência sem cálculo (texto do livro + página). */
export function LinhaReferencia({ rotulo, texto, pagina }: { rotulo?: string; texto: string; pagina: string }) {
  return (
    <div className="rounded-lg border px-3 py-2 text-sm">
      {rotulo && <p className="font-medium">{rotulo}</p>}
      <p className={rotulo ? 'text-tinta-sussurro' : ''}>{texto}</p>
      <p className="text-rotulo text-tinta-sussurro">Livro ICr, {pagina}.</p>
    </div>
  )
}

export function Errata({ children }: { children: ReactNode }) {
  return (
    <p className="text-tinta-sussurro"><Badge variant="outline" className="mr-1">errata</Badge>{children}</p>
  )
}
