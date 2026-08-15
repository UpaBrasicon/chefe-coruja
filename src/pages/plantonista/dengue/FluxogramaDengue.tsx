import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function FluxogramaDengue() {
  const grupos = [
    { grupo: 'A', cor: 'success' as const, criterio: 'Sem sinais de alarme e sem sangramento', conduta: 'Hidratação oral (60 mL/kg/dia), SRO + líquidos caseiros. Exames a critério.' },
    { grupo: 'B', cor: 'info' as const, criterio: 'Sangramento espontâneo de pele ou induzido (prova do laço)', conduta: 'Hemograma obrigatório. Se Ht normal, tratar como grupo A. Se hemoconcentração ou sinais de alarme → grupo C.' },
    { grupo: 'C', cor: 'warning' as const, criterio: 'Sinais de alarme presentes', conduta: 'Expansão EV com SF 0,9% (10 mL/kg 1ªh, repetir até 3 fases). Manutenção 25 mL/kg em 6h + 25 mL/kg em 8h. Internação.' },
    { grupo: 'D', cor: 'destructive' as const, criterio: 'Choque, sangramento grave ou disfunção grave de órgãos', conduta: 'Expansão rápida 20 mL/kg em até 20 min (repetir até 3×). UTI. Considerar coloides/albumina.' },
  ]

  return (
    <ToolLayout
      title="Fluxograma de Conduta na Dengue (MS)"
      description="Classificação em grupos A–D e conduta correspondente."
    >
      <div className="flex flex-col gap-3">
        {grupos.map((g, i) => (
          <Card key={g.grupo} className={g.cor === 'destructive' ? 'border-red-400' : g.cor === 'warning' ? 'border-amber-400' : undefined}>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-base">
                {i + 1}. Grupo <Badge className="text-base">{g.grupo}</Badge>
              </CardTitle>
              <Badge variant={g.cor}>{g.criterio}</Badge>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{g.conduta}</p>
            </CardContent>
          </Card>
        ))}
        <p className="text-xs text-muted-foreground">
          Fontes: Ministério da Saúde — Manual de Dengue; vídeo do Dr. Daniel Wagner (Infectologista).
        </p>
      </div>
    </ToolLayout>
  )
}

