import { useState } from 'react'

import {
  ERRATA_ADROGUE, LIMITES_HIPERNATREMIA, SOLUCOES_HIPERNATREMIA, aguaCorporalTotal, deficitAguaLivre, fatorAguaCorporal, fichaHipernatremia,
  litrosParaDeficit, litrosParaReducao, sodioCorrigido, variacaoPorLitro, type Sexo,
} from '@/clinico/adulto/sodio'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'

const br = (x: number | null | undefined, casas = 1) => (x === null || x === undefined ? '—' : (Math.round(x * 10 ** casas) / 10 ** casas).toLocaleString('pt-BR'))

function Opcoes<T extends string | boolean>({ label, valor, opcoes, onChange }: { label: string; valor: T; opcoes: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {opcoes.map(([v, t]) => (
          <Button key={t} type="button" size="sm" variant={valor === v ? 'default' : 'outline'} onClick={() => onChange(v)}>{t}</Button>
        ))}
      </div>
    </div>
  )
}

/** Hipernatremia no adulto: déficit de água livre e Adrogué-Madias — cap. 66 do manual do HCFMUSP. */
export function HipernatremiaManual() {
  const [peso, setPeso] = useState(0)
  const [na, setNa] = useState(0)
  const [glic, setGlic] = useState(0)
  const [sexo, setSexo] = useState<Sexo>('masculino')
  const [idoso, setIdoso] = useState(false)
  const [aguda, setAguda] = useState(false)
  const [reducao, setReducao] = useState(8)

  const naRef = glic > 0 ? sodioCorrigido(na, glic) : na > 0 ? na : null
  const act = aguaCorporalTotal(peso, sexo, idoso)
  const deficit = act !== null && naRef !== null ? deficitAguaLivre(naRef, act) : null
  const horas = aguda ? LIMITES_HIPERNATREMIA.agudaHoras[1] : 24
  const limite = aguda ? LIMITES_HIPERNATREMIA.agudaPorHora * LIMITES_HIPERNATREMIA.agudaHoras[1] : LIMITES_HIPERNATREMIA.cronicaMax24h[1]

  return (
    <ToolLayout
      title="Hipernatremia — água livre e Adrogué-Madias"
      description="Água corporal total, déficit de água livre, variação do sódio por litro de cada solução e volume para a redução escolhida, com os limites de velocidade do manual do HCFMUSP. Adulto (14 anos ou mais)."
      ficha={fichaHipernatremia}
    >
      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 md:grid-cols-3">
          <NumberField id="hiperm-peso" label="Peso" unit="kg" value={peso} onChange={setPeso} step={0.1} />
          <NumberField id="hiperm-na" label="Sódio medido" unit="mEq/L" value={na} onChange={setNa} />
          <NumberField id="hiperm-glic" label="Glicemia (opcional)" unit="mg/dL" value={glic} onChange={setGlic} />
          <Opcoes label="Sexo" valor={sexo} opcoes={[['masculino', 'Masculino'], ['feminino', 'Feminino']]} onChange={setSexo} />
          <Opcoes label="Idoso (o manual não define a idade)" valor={idoso} opcoes={[[false, 'Não'], [true, 'Sim']]} onChange={setIdoso} />
          <Opcoes label="Instalação" valor={aguda} opcoes={[[false, 'Crônica (> 48 h) ou desconhecida'], [true, 'Aguda (< 48 h)']]} onChange={setAguda} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Água corporal e déficit (p. 896–897)</CardTitle>
          <CardDescription>ACT = peso × 0,6 (♂) ou 0,5 (♀); idoso 0,5 (♂) ou 0,45 (♀). Déficit (L) = [(Na − 140)/140] × ACT. No hipovolêmico, o manual traz expandir com SF até sinais vitais estáveis e só então calcular o déficit.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm tabular-nums">
          {glic > 0 && <p>Sódio corrigido pela glicemia (p. 896): <strong>{br(naRef)} mEq/L</strong></p>}
          <p>ACT: <strong>{br(act)} L</strong> (fator {fatorAguaCorporal(sexo, idoso).toLocaleString('pt-BR')})</p>
          <p>Déficit de água livre: <strong>{deficit === null ? '—' : deficit <= 0 ? 'sem déficit (Na ≤ 140)' : `${br(deficit)} L`}</strong></p>
          {naRef !== null && naRef <= LIMITES_HIPERNATREMIA.definicao && <p className="text-muted-foreground">Hipernatremia é Na &gt; 145 mEq/L (p. 892).</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Por solução (p. 898)</CardTitle>
          <CardDescription>
            Adrogué-Madias: variação por litro = (Na − Na da solução)/(ACT + 1) — estimativa; o manual traz dosar o sódio a cada 4–6 h. Limite do manual: crônica até 8–10 mEq/L nas primeiras 24 h; aguda 1 mEq/L/h nas primeiras 6–8 h.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <NumberField id="hiperm-red" label={`Redução desejada em ${horas} h`} unit="mEq/L" value={reducao} onChange={setReducao} step={0.5} />
          {reducao > limite && <p className="text-atencao">Acima do limite do manual ({aguda ? '1 mEq/L/h por 6–8 h' : '8–10 mEq/L em 24 h'}).</p>}
          {act === null || naRef === null ? <p className="text-muted-foreground">Informe peso e sódio.</p> : (
            <div className="flex flex-col gap-2">
              {SOLUCOES_HIPERNATREMIA.map((s) => {
                const porL = variacaoPorLitro(naRef, s.naMeqL, act)
                const litros = porL === null ? null : litrosParaReducao(reducao, porL)
                const litrosDef = deficit === null ? null : litrosParaDeficit(deficit, s)
                return (
                  <div key={s.id} className="rounded-lg border px-3 py-2 tabular-nums">
                    <div className="font-medium">{s.nome} <span className="text-xs font-normal text-muted-foreground">(Na {s.naMeqL} mEq/L{s.aguaLivreLporL !== null && `; ${s.aguaLivreLporL.toLocaleString('pt-BR')} L de água livre por litro`} — {s.pagina})</span></div>
                    <div>1 L muda o Na em <strong>{porL === null ? '—' : `${porL > 0 ? '−' : '+'}${br(Math.abs(porL))} mEq/L`}</strong>
                      {litros !== null && <> · redução de {br(reducao)} → <strong>{br(litros, 2)} L</strong> ≈ {br((litros * 1000) / horas, 0)} mL/h em {horas} h</>}
                    </div>
                    {litrosDef !== null && <div className="text-muted-foreground">Volume que contém o déficit de água livre: {br(litrosDef, 2)} L</div>}
                  </div>
                )
              })}
            </div>
          )}
          <p className="text-xs text-muted-foreground">O cálculo de litros é a variação por litro do manual estendida linearmente; perdas contínuas não entram na conta.</p>
          <p className="text-xs text-muted-foreground"><Badge variant="outline" className="mr-1">errata</Badge>{ERRATA_ADROGUE}</p>
        </CardContent>
      </Card>
    </ToolLayout>
  )
}
