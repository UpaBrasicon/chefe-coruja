import { useState } from 'react'

import { ToolLayout } from '@/components/plantonista/ToolLayout'
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

export function PreparoColonoscopia() {
  const [horario, setHorario] = useState<'manha' | 'tarde'>('manha')

  const manha = horario === 'manha'

  return (
    <ToolLayout
      title="Preparo para Colonoscopia"
      description="Dieta, hidratação e preparo intestinal conforme o horário do exame."
      referencia="Hassan C, et al. Bowel preparation for colonoscopy: ESGE Guideline Update 2019. Endoscopy. 2019;51(8):775-794."
      revisadoEm="Revisado em 08/2026"
    >
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-2">
            <Label>Horário do exame</Label>
            <Select value={horario} onValueChange={(v) => setHorario((v as 'manha') ?? 'manha')}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manha">Pela manhã</SelectItem>
                <SelectItem value="tarde">Pela tarde</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dieta</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1.5 text-sm text-muted-foreground">
          <p>• Café da manhã: chá claro com torrada ou pãozinho.</p>
          <p>• Almoço e jantar: sopa de legumes batida e coada + macarrão.</p>
          <p>• No decorrer do dia: chá, sucos e água de coco à vontade.</p>
          <p>• Após o jantar: apenas água, chás claros e água de coco.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hidratação</CardTitle>
          <CardDescription>Mínimo de 3 L/dia (atenção a restrições de volume).</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Preparo intestinal</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <div className="rounded-lg border px-3 py-2">
            <Badge variant="secondary" className="mb-1">Manitol 20%</Badge>
            <p>
              750 mL Manitol 20% + 750 mL suco/água/mate, tomado aos poucos em 1–2h, às{' '}
              <strong>{manha ? '18–19h do dia anterior' : '7h da manhã do dia do exame'}</strong>.
            </p>
          </div>
          <div className="rounded-lg border px-3 py-2">
            <Badge variant="secondary" className="mb-1">Dimeticona</Badge>
            <p>Diluir 1 frasco (15 mL) na última solução de preparo antes do exame.</p>
          </div>
          <div className="rounded-lg border px-3 py-2">
            <Badge variant="secondary" className="mb-1">Bisacodil (5 mg/cp)</Badge>
            <p>
              2 cp (10 mg) VO às <strong>{manha ? '14h do dia anterior' : '19h do dia anterior'}</strong>.
            </p>
          </div>
        </CardContent>
      </Card>
    </ToolLayout>
  )
}
