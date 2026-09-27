import { useMemo, useState } from 'react'

import { BOLUS, GRUPOS, calcularBolus, fichaBolusPediatrico, type Grupo } from '@/clinico/pediatria/bolus'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

const num = (x: number, casas = 2) => (Math.round(x * 10 ** casas) / 10 ** casas).toLocaleString('pt-BR')
const faixaTxt = (a: number, b: number) => (a === b ? num(a, 3) : `${num(a, 3)}–${num(b, 3)}`)

/** Doses pediátricas em bolus por peso (Fase 5.4; fonte em src/clinico/pediatria/fonte.ts). */
export function BolusPediatrico() {
  const [peso, setPeso] = useState(0)
  const [busca, setBusca] = useState('')
  const valido = peso > 0 && peso <= 80

  const grupos = useMemo(() => {
    const t = busca.trim().toLowerCase()
    const lista = BOLUS.filter((b) => !t || b.nome.toLowerCase().includes(t) || GRUPOS[b.grupo].toLowerCase().includes(t))
    return (Object.keys(GRUPOS) as Grupo[]).map((g) => ({ g, itens: lista.filter((b) => b.grupo === g) })).filter((x) => x.itens.length)
  }, [busca])

  return (
    <ToolLayout
      title="Doses pediátricas por peso"
      description="Só o que o manual do HCFMUSP traz para a criança, com página. Pediatria: até antes dos 14 anos."
      ficha={fichaBolusPediatrico}
    >
      <Card>
        <CardContent className="grid gap-4 pt-6 md:grid-cols-2">
          <NumberField id="ped-peso" label="Peso aferido ou estimado" unit="kg" value={peso} onChange={setPeso} min={0} step={0.1} />
          <div className="flex flex-col gap-2">
            <label htmlFor="ped-busca" className="text-sm font-medium">Buscar medicamento</label>
            <Input id="ped-busca" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="ex.: rocurônio, anafilaxia" />
          </div>
        </CardContent>
      </Card>

      {!valido && (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">Informe o peso para calcular (acima de 0 e até 80 kg).</CardContent>
        </Card>
      )}

      {valido && grupos.map(({ g, itens }) => (
        <Card key={g}>
          <CardHeader>
            <CardTitle className="text-base">{GRUPOS[g]}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {itens.map((b) => {
              const r = calcularBolus(b, peso)!
              return (
                <div key={b.id} className="rounded-lg border px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium">{b.nome}</span>
                    <span className="tabular-nums">
                      <strong>{num(r.dose)} {b.unidade}</strong>
                      {r.volumeMl !== null && b.unidade !== 'mL' && (
                        <span className="text-muted-foreground"> · {num(r.volumeMl)} {b.unidade === 'mg/h' ? 'mL/h' : 'mL'}</span>
                      )}
                    </span>
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    {faixaTxt(b.faixa[0], b.faixa[1])} {b.unidade === 'mg/h' ? 'mg/kg/h' : `${b.unidade}/kg`}
                    {b.faixa[0] !== b.faixa[1] && ` (calculado a ${num(b.calcularEm, 3)})`}
                    {b.maximo !== undefined && ` · máximo ${num(b.maximo)} ${b.unidade}`}
                    {b.minimo !== undefined && ` · mínimo ${num(b.minimo)} ${b.unidade}`}
                    {' · '}{b.apresentacao} · {b.via}
                  </p>
                  {(r.noMaximo || r.noMinimo) && (
                    <p className="text-atencao">{r.noMaximo ? 'Dose limitada ao máximo absoluto.' : 'Dose elevada ao mínimo absoluto.'}</p>
                  )}
                  {b.nota && <p className="text-muted-foreground">Divergência no livro: {b.nota}</p>}
                  {b.errata && <p className="text-muted-foreground"><Badge variant="outline" className="mr-1">errata</Badge>{b.errata}</p>}
                  <p className="text-rotulo text-tinta-sussurro">Manual HCFMUSP, {b.pagina}.</p>
                </div>
              )
            })}
          </CardContent>
        </Card>
      ))}
    </ToolLayout>
  )
}
