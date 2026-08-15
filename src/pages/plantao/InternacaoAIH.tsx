import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Card, CardContent } from '@/components/ui/card'

export default function InternacaoAIH() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link to="/plantao" className="transition-colors hover:text-foreground">
          Central de Plantão
        </Link>
        <ChevronRight className="size-3.5" />
        <Link to="/plantao/internacao" className="transition-colors hover:text-foreground">
          Internação
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="font-medium text-foreground">Documento de Internação (AIH)</span>
      </div>
      <ToolLayout
        title="Documento de Internação — AIH"
        description="Autorização de Internação Hospitalar."
      >
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            <p>
              Em construção. Seguirá o <strong>modelo de página</strong> que você vai enviar. Aqui
              entrará: dados do paciente (carregados pelo SaaS), leito/observação, CID, e o
              documento de internação (AIH ou encaminhamento).
            </p>
          </CardContent>
        </Card>
      </ToolLayout>
    </div>
  )
}
