import { useMemo, useState } from 'react'

import { BOLUS, GRUPOS, NEONATO_FORA, calcularBolus, fichaBolusPediatrico, type Bolus, type Grupo } from '@/clinico/pediatria/bolus'
import { IDADE_ADULTO_ANOS } from '@/clinico/ficha'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

const num = (x: number, casas = 2) => (Math.round(x * 10 ** casas) / 10 ** casas).toLocaleString('pt-BR')
const faixaTxt = ([a, b]: [number, number], casas = 2) => (a === b ? num(a, casas) : `${num(a, casas)}–${num(b, casas)}`)
const porKgTxt = (b: Bolus) => `${faixaTxt(b.faixa, 3)} ${b.unidade}${b.porKg ? '/kg' : ''}`

function Item({ b, peso, idadeMeses }: { b: Bolus; peso: number; idadeMeses?: number }) {
  const r = calcularBolus(b, peso, idadeMeses)
  const fora = r?.aplica === 'nao'
  return (
    <div className={`rounded-lg border px-3 py-2 text-sm ${fora ? 'opacity-60' : ''}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-medium">
          {b.nome}
          {b.condicao && <Badge variant="outline" className="ml-2 align-middle">{b.condicao.texto}</Badge>}
        </span>
        {r && (
          <span className="tabular-nums">
            <strong>{faixaTxt(r.faixa)} {b.unidade}</strong>
            {r.volumeMl && <span className="text-muted-foreground"> · {faixaTxt(r.volumeMl)} mL</span>}
          </span>
        )}
      </div>
      {b.semCalculo ? (
        <p className="mt-1 text-atencao">{b.semCalculo}</p>
      ) : (
        <p className="mt-1 text-muted-foreground">
          {porKgTxt(b)}
          {b.maximo !== undefined && ` · máximo ${num(b.maximo, 3)} ${b.unidade}`}
          {b.apresentacao && ` · ${b.apresentacao}`}
          {' · '}{b.via}
        </p>
      )}
      {fora && <p className="text-muted-foreground">Fora da condição do livro para o peso/idade informados.</p>}
      {r?.aplica === 'indefinido' && <p className="text-muted-foreground">Depende da idade: informe a idade para conferir a condição do livro.</p>}
      {r?.noMaximo && <p className="text-atencao">Dose limitada ao máximo do livro.</p>}
      {r?.abaixoDoAviso && b.aviso && <p className="text-atencao">{b.aviso.texto}</p>}
      {b.errata && <p className="text-muted-foreground"><Badge variant="outline" className="mr-1">errata</Badge>{b.errata}</p>}
      {b.nota && <p className="text-muted-foreground">No livro: {b.nota}</p>}
      {b.anexo2Adulto && <p className="text-muted-foreground">Divergência: {b.anexo2Adulto}</p>}
      <p className="text-rotulo text-tinta-sussurro">PS Pediatria ICr-HCFMUSP, {b.pagina}.</p>
    </div>
  )
}

/** Doses pediátricas em bolus por peso (Fase 5.4; fonte em src/clinico/pediatria/fonte.ts). */
export function BolusPediatrico() {
  const [peso, setPeso] = useState(0)
  const [anos, setAnos] = useState(0)
  const [meses, setMeses] = useState(0)
  const [busca, setBusca] = useState('')
  const valido = peso > 0 && peso <= 150
  const idadeInformada = anos > 0 || meses > 0
  const idadeMeses = idadeInformada ? Math.floor(anos) * 12 + Math.floor(meses) : undefined
  const adulto = idadeMeses !== undefined && idadeMeses >= IDADE_ADULTO_ANOS * 12

  const grupos = useMemo(() => {
    const t = busca.trim().toLowerCase()
    const lista = BOLUS.filter((b) => !t || b.nome.toLowerCase().includes(t) || GRUPOS[b.grupo].toLowerCase().includes(t))
    return (Object.keys(GRUPOS) as Grupo[]).map((g) => ({ g, itens: lista.filter((b) => b.grupo === g) })).filter((x) => x.itens.length)
  }, [busca])

  return (
    <ToolLayout
      title="Doses pediátricas por peso"
      description="Apêndice do PS Pediatria ICr-HCFMUSP (4ª ed., 2023), com página. Pediatria: de 1 dia de vida até antes dos 14 anos."
      ficha={fichaBolusPediatrico}
    >
      <Card>
        <CardContent className="grid gap-4 pt-6 md:grid-cols-4">
          <NumberField id="ped-peso" label="Peso aferido ou estimado" unit="kg" value={peso} onChange={setPeso} min={0} step={0.1} />
          <NumberField id="ped-anos" label="Idade" unit="anos completos" value={anos} onChange={setAnos} min={0} max={13} step={1} />
          <NumberField id="ped-meses" label="e meses" unit="0 a 11" value={meses} onChange={setMeses} min={0} max={11} step={1} />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="ped-busca" className="text-sm font-medium">Buscar medicamento</label>
            <Input id="ped-busca" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="ex.: naloxona, crise" />
          </div>
          <p className="text-sm text-muted-foreground md:col-span-4">
            {NEONATO_FORA} A idade é opcional: só muda o que o livro separa por idade (ex.: midazolam, diazepam, naloxona).
            A dose mostrada é a faixa do livro para o peso; a escolha dentro dela é do profissional.
          </p>
        </CardContent>
      </Card>

      {adulto && (
        <Card>
          <CardContent className="pt-6 text-sm text-atencao">A partir de 14 anos completos o paciente é adulto; esta ferramenta é pediátrica.</CardContent>
        </Card>
      )}

      {!valido && !adulto && (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">Informe o peso para calcular (acima de 0 e até 150 kg).</CardContent>
        </Card>
      )}

      {valido && !adulto && grupos.map(({ g, itens }) => (
        <Card key={g}>
          <CardHeader>
            <CardTitle className="text-base">{GRUPOS[g]}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {itens.map((b) => <Item key={b.id} b={b} peso={peso} idadeMeses={idadeMeses} />)}
          </CardContent>
        </Card>
      ))}
    </ToolLayout>
  )
}
