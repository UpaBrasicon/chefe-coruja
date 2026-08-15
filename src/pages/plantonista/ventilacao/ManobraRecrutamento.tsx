import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function ManobraRecrutamento() {
  return (
    <ToolLayout
      title="Manobra de Recrutamento Pulmonar"
      description="Passo a passo da manobra com PEEP progressiva."
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Indicações</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm text-muted-foreground">
          <p>• SARA com hipoxemia refratária (PaO₂/FiO₂ &lt; 150).</p>
          <p>• Atelectasias após broncoaspiração ou desrecrutamento.</p>
          <p>• Após intubação ou deslocamento do paciente.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contraindicações</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm text-muted-foreground">
          <p>• Pneumotórax não drenado · Enfisema bolhoso · Instabilidade hemodinâmica.</p>
          <p>• Hipertensão intracraniana · Fístula broncopleural.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Execução (PEEP progressiva)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <div className="rounded-lg border px-3 py-2 text-sm">
            <Badge variant="secondary" className="mb-1">1. Preparo</Badge>
            <p>Sedar (RASS -5) e garantir estabilidade. Reduzir FR e FiO₂ (100%) por 30–60 s.</p>
          </div>
          <div className="rounded-lg border px-3 py-2 text-sm">
            <Badge variant="secondary" className="mb-1">2. Recrutamento</Badge>
            <p>Aumentar PEEP em degraus (ex.: 15 → 20 → 25 → 30 cmH₂O), ~30–40 s em cada nível.</p>
          </div>
          <div className="rounded-lg border px-3 py-2 text-sm">
            <Badge variant="secondary" className="mb-1">3. Titulação de PEEP</Badge>
            <p>Após a manobra, reduzir a PEEP até encontrar o menor valor que mantenha SpO₂ e Crs.</p>
          </div>
          <div className="rounded-lg border px-3 py-2 text-sm">
            <Badge variant="secondary" className="mb-1">4. Monitorar</Badge>
            <p>Pplatô ≤ 30 cmH₂O, PAS ≥ 90 mmHg, SpO₂. Interromper se dessaturação ou hipotensão.</p>
          </div>
        </CardContent>
      </Card>
    </ToolLayout>
  )
}
