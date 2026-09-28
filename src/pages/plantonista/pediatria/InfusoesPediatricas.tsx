import { useState } from 'react'

import { IDADE_ADULTO_ANOS } from '@/clinico/ficha'
import {
  GRUPOS_INFUSAO,
  INFUSOES_PED,
  alertasInfusao,
  dosePed,
  faixaEmMlH,
  fichaInfusoesPediatricas,
  precisaConcentracao,
  unidadeConcentracao,
  unidadeDoseInfusao,
  velocidadePed,
  type GrupoInfusao,
} from '@/clinico/pediatria/infusoes'
import { NEONATO_FORA } from '@/clinico/pediatria/bolus'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const br = (x: number | null, casas = 2) => (x === null ? '—' : (Math.round(x * 10 ** casas) / 10 ** casas).toLocaleString('pt-BR'))
const lerNumero = (v: string) => (v.trim() === '' ? Number.NaN : Number(v.replace(',', '.')))

/** Infusões contínuas pediátricas: peso + concentração informada → mL/h e o inverso (fonte em src/clinico/pediatria/infusoes.ts). */
export function InfusoesPediatricas() {
  const [peso, setPeso] = useState(0)
  const [anos, setAnos] = useState(0)
  const [id, setId] = useState(INFUSOES_PED[0].id)
  const [conc, setConc] = useState('')
  const [dose, setDose] = useState('')
  const [mlh, setMlh] = useState('')

  const i = INFUSOES_PED.find((x) => x.id === id) ?? INFUSOES_PED[0]
  const u = unidadeDoseInfusao(i)
  const uc = unidadeConcentracao(i)
  const c = precisaConcentracao(i) ? lerNumero(conc) : 1
  const d = lerNumero(dose)
  const v = lerNumero(mlh)
  const adulto = anos >= IDADE_ADULTO_ANOS
  const faltaPeso = i.porKg && !(peso > 0)
  const faltaConc = precisaConcentracao(i) && !(c > 0)
  const faixaMl = faixaEmMlH(i, peso, c)
  const vel = Number.isFinite(d) ? velocidadePed(i, d, peso, c) : null
  const doseDaBomba = Number.isFinite(v) ? dosePed(i, v, peso, c) : null
  const alertas = alertasInfusao(i, Number.isFinite(d) ? d : doseDaBomba, peso, c)
  const falta = faltaPeso ? 'Informe o peso.' : faltaConc ? `Informe a concentração (${uc}).` : null

  const trocar = (novo: string) => {
    setId(novo)
    setConc('')
    setDose('')
    setMlh('')
  }

  return (
    <ToolLayout
      title="Infusões contínuas pediátricas"
      description="Faixas do apêndice do PS Pediatria ICr-HCFMUSP (4ª ed., 2023), com página. O livro não traz preparo padrão: a velocidade sai da concentração que você informa."
      ficha={fichaInfusoesPediatricas}
    >
      <Card>
        <CardContent className="grid gap-4 pt-6 md:grid-cols-3">
          <NumberField id="inf-ped-peso" label="Peso" unit="kg" value={peso} onChange={setPeso} min={0} step={0.1} />
          <NumberField id="inf-ped-anos" label="Idade (opcional)" unit="anos completos" value={anos} onChange={setAnos} min={0} step={1} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="inf-ped-droga">Medicamento</Label>
            <select
              id="inf-ped-droga"
              value={i.id}
              onChange={(e) => trocar(e.target.value)}
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
            >
              {(Object.keys(GRUPOS_INFUSAO) as GrupoInfusao[]).map((g) => (
                <optgroup key={g} label={GRUPOS_INFUSAO[g]}>
                  {INFUSOES_PED.filter((x) => x.grupo === g).map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
          <p className="text-sm text-muted-foreground md:col-span-3">{NEONATO_FORA} Pediatria: de 1 dia de vida até antes dos 14 anos.</p>
        </CardContent>
      </Card>

      {adulto ? (
        <Card>
          <CardContent className="pt-6 text-sm text-atencao">A partir de 14 anos completos o paciente é adulto; esta ferramenta é pediátrica.</CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{i.nome}</CardTitle>
            <CardDescription>
              {i.semCalculo ? 'Sem cálculo — ver aviso.' : <>Faixa do livro {br(i.faixa[0], 3)}–{br(i.faixa[1], 3)} {u}{i.maximo !== undefined && ` · máximo ${br(i.maximo, 3)} ${u}`}{i.tetoAbsoluto !== undefined && ` · teto ${br(i.tetoAbsoluto)} ${i.numerador === 'mcg' ? 'µg' : i.numerador}/${i.tempo}`}</>}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <p className="text-muted-foreground">Texto do livro: “{i.textoLivro}” ({i.paginaTexto ?? i.pagina}).</p>
            {i.semCalculo ? (
              <p className="text-atencao">{i.semCalculo}</p>
            ) : (
              <>
                {precisaConcentracao(i) ? (
                  <div className="flex flex-col gap-1.5 md:max-w-xs">
                    <Label htmlFor="inf-ped-conc">Concentração final da solução ({uc})</Label>
                    <Input id="inf-ped-conc" inputMode="decimal" value={conc} onChange={(e) => setConc(e.target.value)} />
                    {i.apresentacao && <p className="text-muted-foreground">Apresentação citada no livro: {i.apresentacao}. Não é o preparo.</p>}
                  </div>
                ) : (
                  <p className="text-muted-foreground">A dose já é volume ({u}); não depende de concentração.</p>
                )}
                <p className="tabular-nums">
                  Faixa do livro em mL/h: {falta ?? (faixaMl ? <strong>{br(faixaMl[0])}–{br(faixaMl[1])} mL/h</strong> : '—')}
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="inf-ped-dose">Dose ({u}) → velocidade</Label>
                    <Input id="inf-ped-dose" inputMode="decimal" value={dose} onChange={(e) => setDose(e.target.value)} />
                    <p className="tabular-nums">{falta ?? (vel === null ? '—' : <strong>{br(vel)} mL/h</strong>)}</p>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="inf-ped-mlh">Velocidade na bomba (mL/h) → dose</Label>
                    <Input id="inf-ped-mlh" inputMode="decimal" value={mlh} onChange={(e) => setMlh(e.target.value)} />
                    <p className="tabular-nums">{falta ?? (doseDaBomba === null ? '—' : <strong>{br(doseDaBomba, 3)} {u}</strong>)}</p>
                  </div>
                </div>
                {alertas.map((a) => <p key={a.tipo + a.texto} className="text-atencao">{a.texto}</p>)}
              </>
            )}
            {i.errata && <p className="text-muted-foreground"><Badge variant="outline" className="mr-1">errata</Badge>{i.errata}</p>}
            {i.nota && <p className="text-muted-foreground">No livro: {i.nota}</p>}
            <p className="text-rotulo text-tinta-sussurro">PS Pediatria ICr-HCFMUSP, {i.pagina}.</p>
          </CardContent>
        </Card>
      )}
    </ToolLayout>
  )
}
