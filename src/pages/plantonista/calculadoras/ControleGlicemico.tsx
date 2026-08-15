import { useState } from 'react'

import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { NumberField } from '@/components/plantonista/NumberField'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const faixasInicio = ['181 – 250', '251 – 300', '301 – 340', '> 340']

const faixasManutencao = [
  '< 70', '70 – 99', '100 – 140', '141 – 180', '181 – 200', '201 – 240', '241 – 300', '> 300',
]

function boloSugerido(faixaIdx: number) {
  return faixaIdx >= 2 // 301–340 e >340
}

export function ControleGlicemico() {
  const [peso, setPeso] = useState(70)
  const [faixaInicio, setFaixaInicio] = useState(0)
  const [dietaZero, setDietaZero] = useState(true)
  const [iniciado, setIniciado] = useState(false)

  const [glicemia, setGlicemia] = useState(2)
  const [vazao, setVazao] = useState(10)
  const [ajustado, setAjustado] = useState(false)

  function manter() {
    const faixas = [
      { label: '< 70 mg/dL', severidade: 'hipo' },
      { label: '70 – 99 mg/dL', severidade: 'baixo' },
      { label: '100 – 140 mg/dL', severidade: 'meta' },
      { label: '141 – 180 mg/dL', severidade: 'alto' },
      { label: '181 – 200 mg/dL', severidade: 'alto' },
      { label: '201 – 240 mg/dL', severidade: 'alto' },
      { label: '241 – 300 mg/dL', severidade: 'muitoAlto' },
      { label: '> 300 mg/dL', severidade: 'critico' },
    ]
    return faixas[glicemia]
  }

  const orientacao = manter()

  return (
    <ToolLayout
      title="Controle Glicêmico Intensivo"
      description="Protocolo de insulina em infusão contínua. Insulina Regular (100 UI/mL): 1 mL + 99 mL SF 0,9% → 1 mL = 1 UI."
    >
      {!iniciado ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Início</CardTitle>
            <CardDescription>Configure e inicie a infusão.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-4 md:grid-cols-3">
              <NumberField id="cgi-peso" label="Peso" unit="kg" value={peso} onChange={setPeso} min={1} />
              <div className="flex flex-col gap-2">
                <Label>Glicemia</Label>
                <Select value={faixasInicio[faixaInicio]} onValueChange={(v) => setFaixaInicio(Math.max(0, faixasInicio.indexOf(v ?? '')))}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {faixasInicio.map((f) => (
                      <SelectItem key={f} value={f}>{f} mg/dL</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Em dieta zero?</Label>
                <Select value={dietaZero ? 'sim' : 'nao'} onValueChange={(v) => setDietaZero(v === 'sim')}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sim">Sim</SelectItem>
                    <SelectItem value="nao">Não</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {boloSugerido(faixaInicio) && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
                  <Badge variant="warning" className="mb-1">Bólus de Insulina</Badge>
                  <p>Insulina Regular (100 UI/mL): 1 mL + 99 mL SF 0,9% → <strong>3 mL EV</strong> em bólus.</p>
                </div>
              )}
              <div className="rounded-lg border p-3 text-sm">
                <Badge variant="secondary" className="mb-1">Infusão contínua</Badge>
                <p>Iniciar Insulina Regular (1 mL + 99 mL SF 0,9%) em <strong>10 mL/h</strong>.</p>
              </div>
              {dietaZero && (
                <div className="rounded-lg border p-3 text-sm">
                  <Badge variant="info" className="mb-1">Soro Glicosado 10%</Badge>
                  <p>Glicose 50%: 50 mL + 450 mL SG 5% → <strong>54 mL/h</strong>.</p>
                </div>
              )}
            </div>

            <div>
              <Button onClick={() => setIniciado(true)}>INICIAR</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Manutenção</CardTitle>
            <CardDescription>Informe a glicemia atual e a vazão da insulina.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>Glicemia atual</Label>
                <Select value={faixasManutencao[glicemia]} onValueChange={(v) => setGlicemia(Math.max(0, faixasManutencao.indexOf(v ?? '')))}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {faixasManutencao.map((f) => (
                      <SelectItem key={f} value={f}>{f} mg/dL</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <NumberField id="cgi-vazao" label="Vazão da insulina" unit="mL/h" value={vazao} onChange={setVazao} min={0} />
            </div>

            <Button onClick={() => setAjustado(true)}>AJUSTAR</Button>

            {ajustado && (
              <div className="flex flex-col gap-2">
                {orientacao.severidade === 'hipo' && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
                    <Badge variant="destructive" className="mb-1">Suspender infusão</Badge>
                    <p>Administrar imediatamente <strong>40 mL de Glicose 50%</strong> EV. Comunicar médico/enfermagem. Checar dieta ou SG 10%.</p>
                  </div>
                )}
                {orientacao.severidade === 'baixo' && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
                    <Badge variant="warning" className="mb-1">Suspender infusão</Badge>
                    <p>Checar de <strong>1/1h por até 6 horas</strong>. Se mantiver entre 70–99 após 6h, checar de 2/2h por 24h. Se &gt; 140 mg/dL, reiniciar infusão a <strong>1 mL/h</strong>.</p>
                  </div>
                )}
                {orientacao.severidade === 'meta' && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
                    <Badge variant="success" className="mb-1">Meta atingida!</Badge>
                    <p>Manter a infusão em <strong>{vazao} mL/h</strong>.</p>
                  </div>
                )}
                {orientacao.severidade === 'alto' && (
                  <div className="rounded-lg border p-3 text-sm">
                    <Badge variant="secondary" className="mb-1">Reduzir vazão pela metade</Badge>
                    <p>Ajustar para <strong>{(vazao / 2).toFixed(1)} mL/h</strong>.</p>
                  </div>
                )}
                {orientacao.severidade === 'muitoAlto' && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
                    <Badge variant="warning" className="mb-1">Aumentar vazão</Badge>
                    <p>Bólus de insulina <strong>3 mL EV</strong> e aumentar a vazão em <strong>3 mL/h</strong> (para {vazao + 3} mL/h).</p>
                  </div>
                )}
                {orientacao.severidade === 'critico' && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
                    <Badge variant="destructive" className="mb-1">Glicemia crítica</Badge>
                    <p>Bólus de insulina <strong>3 mL EV</strong>, aumentar vazão em <strong>4 mL/h</strong> (para {vazao + 4} mL/h) e comunicar médico imediatamente.</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </ToolLayout>
  )
}
