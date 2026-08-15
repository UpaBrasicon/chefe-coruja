import { useState } from 'react'

import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { NumberField } from '@/components/plantonista/NumberField'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const ajustes = [
  { faixa: '< 35', bolo: '80 U/kg', interromper: false, delta: 4 },
  { faixa: '35 – 45', bolo: '40 U/kg', interromper: false, delta: 3 },
  { faixa: '46 – 60', bolo: '40 U/kg', interromper: false, delta: 2 },
  { faixa: '61 – 85', bolo: null, interromper: false, delta: 0 },
  { faixa: '86 – 110', bolo: null, interromper: false, delta: -2 },
  { faixa: '> 110', bolo: null, interromper: true, delta: -4 },
]

export function HeparinizacaoAjuste() {
  const [peso, setPeso] = useState(70)
  const [vazao, setVazao] = useState(8.4)
  const [ttpa, setTtpa] = useState(3)

  const atual = ajustes[ttpa]
  const uhPorKg = (vazao * 100) / peso // 1 mL = 100 U
  const novoUhKg = uhPorKg + atual.delta
  const novaVazao = (novoUhKg * peso) / 100

  return (
    <ToolLayout
      title="Ajuste da Heparinização pelo TTPa"
      description="Diluição padrão: 5 mL + 245 mL SF 0,9% → 1 mL = 100 U. TTPa alvo: 61 – 85 s."
    >
      <Card>
        <CardContent className="grid gap-4 pt-6 md:grid-cols-3">
          <NumberField id="haj-peso" label="Peso" unit="kg" value={peso} onChange={setPeso} min={1} />
          <NumberField id="haj-vazao" label="Vazão atual" unit="mL/h" value={vazao} onChange={setVazao} min={0} step={0.1} />
          <div className="flex flex-col gap-2">
            <Label>TTPa</Label>
            <Select value={atual.faixa} onValueChange={(v) => setTtpa(Math.max(0, ajustes.findIndex((a) => a.faixa === v)))}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ajustes.map((a) => (
                  <SelectItem key={a.faixa} value={a.faixa}>{a.faixa} s</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conduta</CardTitle>
          <CardDescription>
            Dose atual: {uhPorKg.toFixed(1)} U/kg/h.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          {atual.bolo && (
            <p><Badge variant="secondary" className="mr-2">Bólus</Badge>{atual.bolo} EV.</p>
          )}
          {atual.interromper && (
            <p><Badge variant="destructive" className="mr-2">Interromper</Badge>Infusão suspensa por 60 minutos.</p>
          )}
          {atual.delta === 0 ? (
            <p><Badge variant="success" className="mr-2">Manter</Badge>Dentro do alvo — manter {vazao.toFixed(1)} mL/h.</p>
          ) : atual.delta > 0 ? (
            <p><Badge variant="warning" className="mr-2">Aumentar</Badge>{atual.delta} U/kg/h → nova vazão: <strong>{novaVazao.toFixed(1)} mL/h</strong> ({(vazao + (atual.delta * peso) / 100).toFixed(1)} mL/h).</p>
          ) : (
            <p><Badge variant="warning" className="mr-2">Reduzir</Badge>{Math.abs(atual.delta)} U/kg/h → nova vazão: <strong>{Math.max(0, novaVazao).toFixed(1)} mL/h</strong>.</p>
          )}
          <p className="text-xs text-muted-foreground">Solicitar TTPa a cada 6 horas.</p>
        </CardContent>
      </Card>
    </ToolLayout>
  )
}
