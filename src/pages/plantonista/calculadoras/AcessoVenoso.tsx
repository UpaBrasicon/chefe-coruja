import { useState } from 'react'

import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type Opcao = { valor: string; label: string }

function Grupo({ titulo, opcoes, valor, set }: { titulo: string; opcoes: Opcao[]; valor: string; set: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-sm font-semibold">{titulo}</Label>
      <div className="grid gap-2 sm:grid-cols-2">
        {opcoes.map((o) => (
          <button
            key={o.valor}
            type="button"
            onClick={() => set(o.valor)}
            className={cn(
              'rounded-lg border px-3 py-2 text-left text-sm transition-colors',
              valor === o.valor ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted/50'
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function AcessoVenoso() {
  const [perfil, setPerfil] = useState('')
  const [terapia, setTerapia] = useState('')
  const [caracteristica, setCaracteristica] = useState('')
  const [rede, setRede] = useState('')
  const [urgencia, setUrgencia] = useState('')

  const completo = perfil && terapia && caracteristica && rede && urgencia

  function recomendar() {
    if (!completo) return null
    const t = terapia
    const c = caracteristica
    const r = rede
    const u = urgencia
    const urg = u === 'urgente'

    if (perfil === 'neonatal' || perfil === 'pediatrico') {
      if (t === 'longa' || c !== 'nao' || r === 'ruim') {
        return { dispositivo: 'Cateter central (PICC ou CVC)', motivo: 'Terapia prolongada, infusão irritante/vesicante ou rede venosa comprometida.' }
      }
      return { dispositivo: 'Cateter periférico curto', motivo: 'Terapia curta e infusão compatível com acesso periférico.' }
    }

    if (urg) {
      return { dispositivo: 'Acesso periférico rápido (2 cateteres) / intraósseo se choque', motivo: 'Situação emergencial — acesso imediato.' }
    }
    if (c !== 'nao') {
      return { dispositivo: 'Cateter central (CVC ou PICC)', motivo: 'Infusão vesicante/irritante, osmolaridade alta ou pH extremo.' }
    }
    if (t === 'longa' || r === 'ruim') {
      return { dispositivo: 'PICC (ou CVC se alta osmolaridade)', motivo: 'Terapia prolongada (> 6 dias) ou rede venosa ruim.' }
    }
    return { dispositivo: 'Cateter periférico curto (acesso único)', motivo: 'Terapia curta, infusão compatível e rede venosa adequada.' }
  }

  const resultado = recomendar()

  return (
    <ToolLayout
      title="Escolha do Acesso Venoso"
      description="Avalie terapia, duração e perfil do paciente para receber uma recomendação estruturada."
    >
      <div className="flex flex-col gap-5">
        <Grupo
          titulo="1. Perfil do paciente"
          opcoes={[{ valor: 'adulto', label: 'Adulto (≥ 12 anos)' }, { valor: 'pediatrico', label: 'Pediátrico (29 dias – 11 anos)' }, { valor: 'neonatal', label: 'Neonatal (0 – 28 dias)' }]}
          valor={perfil}
          set={setPerfil}
        />
        <Grupo
          titulo="2. Terapia"
          opcoes={[{ valor: 'curta', label: 'Curta (≤ 6 dias)' }, { valor: 'longa', label: 'Longa (> 6 dias)' }]}
          valor={terapia}
          set={setTerapia}
        />
        <Grupo
          titulo="3. Características da infusão"
          opcoes={[{ valor: 'nao', label: 'Compatível com via periférica' }, { valor: 'irritante', label: 'Irritante / vesicante' }, { valor: 'osmolaridade', label: 'Osmolaridade alta (> 900 mOsm/L)' }]}
          valor={caracteristica}
          set={setCaracteristica}
        />
        <Grupo
          titulo="4. Rede venosa"
          opcoes={[{ valor: 'boa', label: 'Boa rede venosa' }, { valor: 'ruim', label: 'Rede venosa comprometida / sem acesso periférico' }]}
          valor={rede}
          set={setRede}
        />
        <Grupo
          titulo="5. Urgência"
          opcoes={[{ valor: 'urgente', label: 'Emergencial (instabilidade)' }, { valor: 'programada', label: 'Não urgente' }]}
          valor={urgencia}
          set={setUrgencia}
        />

        {!completo && (
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">
              Responda todas as etapas para gerar a recomendação.
            </CardContent>
          </Card>
        )}

        {resultado && (
          <Card className="border-primary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                Dispositivo recomendado
                <Badge className="text-base">{resultado.dispositivo}</Badge>
              </CardTitle>
              <CardDescription>{resultado.motivo}</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Considerar ultrassom para guiar punção quando a rede venosa estiver comprometida.
            </CardContent>
          </Card>
        )}
      </div>
    </ToolLayout>
  )
}
