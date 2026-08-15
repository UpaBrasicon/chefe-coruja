import { Link } from 'react-router-dom'

import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function NefropatiaProtocolo() {
  return (
    <ToolLayout
      title="Protocolo de Prevenção de Nefropatia Induzida por Contraste"
      description="Nefroproteção antes de exames com contraste iodado."
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Indicação</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1.5 text-sm text-muted-foreground">
          <p>• ClCr &lt; 60 mL/min (Cockcroft–Gault), DM, idade avançada, IRA prévia.</p>
          <p>• Contrastes de baixa osmolalidade sempre que possível.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nefroproteção</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1.5 text-sm text-muted-foreground">
          <p>• SF 0,9% 1–1,5 mL/kg/h: 12h antes e 12h após o exame.</p>
          <p>• Ou Bicarbonato de Sódio 8,4% (150 mL + 850 mL SG 5%) 3 mL/kg/h 1h antes e 1 mL/kg/h por 6h.</p>
          <p>• N-acetilcisteína 600 mg VO/EV 8/8h (24h antes e no dia).</p>
          <p>• Suspender IECA, BRA, diuréticos e metformina por 24–48h.</p>
          <p>• Avaliar função renal a cada 48h.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ferramenta</CardTitle>
        </CardHeader>
        <CardContent>
          <Link to="/plantonista/calculadoras/nefropatia-contraste" className="text-sm text-primary hover:underline">
            → Abrir calculadora de Nefropatia por Contraste
          </Link>
        </CardContent>
      </Card>
    </ToolLayout>
  )
}
