import { Link } from 'react-router-dom'

import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function ControleGlicemicoProtocolo() {
  return (
    <ToolLayout
      title="Protocolo de Controle Glicêmico Intensivo"
      description="Resumo do protocolo de insulina em infusão contínua."
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Início</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1.5 text-sm text-muted-foreground">
          <p>• Alvo: 100 – 140 mg/dL (paciente crítico).</p>
          <p>• Glicemia &gt; 180 mg/dL → bólus (se &gt; 300) + infusão contínua de insulina Regular 10 mL/h.</p>
          <p>• Em dieta zero: associação de SG 10%.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Manutenção</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1.5 text-sm text-muted-foreground">
          <p>• &lt; 70: suspender, glicose 50% 40 mL, avisar equipe.</p>
          <p>• 70 – 99: suspender, reavaliar 1/1h (até 6h), depois 2/2h.</p>
          <p>• 100 – 140: manter infusão (meta).</p>
          <p>• 141 – 180: reduzir vazão pela metade.</p>
          <p>• &gt; 180: aumentar vazão; &gt; 300: bólus + comunicar médico.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ferramenta</CardTitle>
        </CardHeader>
        <CardContent>
          <Link to="/plantonista/calculadoras/controle-glicemico" className="text-sm text-primary hover:underline">
            → Abrir calculadora de Controle Glicêmico
          </Link>
        </CardContent>
      </Card>
    </ToolLayout>
  )
}
