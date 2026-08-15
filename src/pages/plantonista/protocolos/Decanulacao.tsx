import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function Decanulacao() {
  return (
    <ToolLayout
      title="Decanulação"
      description="Roteiro para retirada da traqueostomia."
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Critérios para iniciar o desmame</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1.5 text-sm text-muted-foreground">
          <p>• Doença de base resolvida e causa da traqueostomia tratada.</p>
          <p>• Estabilidade hemodinâmica, sem drogas vasoativas.</p>
          <p>• Ausência de febre ou infecção ativa.</p>
          <p>• Secreções controladas, reflexo de tosse eficaz.</p>
          <p>• Tolerância à desconexão progressiva (sonda T / capnografia).</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Etapas</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {[
            ['1. Desmame ventilatório', 'Reduzir suporte progressivamente até desmame sem VNI.'],
            ['2. Redução do balonete', 'Diminuir volume do cuff para permitir fluxo aéreo glótico.'],
            ['3. Sonda T / capnografia', 'Avaliar respiração espontânea com via aérea parcialmente ocluída.'],
            ['4. Tolerância', 'Observar por 24–48h: manter SpO₂ e PaCO₂ adequadas, sem fadiga.'],
            ['5. Retirada', 'Remover cânula, ocluir estoma com curativo, orientar deglutição e voz.'],
            ['6. Acompanhamento', 'Monitorar via aérea, disfagia e fechamento do estoma.'],
          ].map(([titulo, texto]) => (
            <div key={titulo} className="rounded-lg border px-3 py-2 text-sm">
              <Badge variant="secondary" className="mb-1">{titulo}</Badge>
              <p className="text-muted-foreground">{texto}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </ToolLayout>
  )
}
