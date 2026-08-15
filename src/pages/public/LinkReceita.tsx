import { useParams } from 'react-router-dom'
import { FileSignature, ScanLine } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function LinkReceita() {
  const { tipo, token } = useParams()

  const eEmissao = tipo === 'emissao'

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            {eEmissao ? <FileSignature className="size-5 text-primary" /> : <ScanLine className="size-5 text-primary" />}
            {eEmissao ? 'Assinatura de receita' : 'Consulta de receita'}
          </CardTitle>
          <CardDescription>
            Deep link público {eEmissao ? 'de emissão/assinatura' : 'de consulta'} da receita.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
          <p>
            Token: <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{token ?? '—'}</code>
          </p>
          <p>
            Este link será resolvido por uma <strong>Edge Function</strong> que valida o token e
            redireciona para a assinatura ICP-Brasil (emissão) ou para o portal do paciente /
            farmácia (consulta), conforme a configuração de integrações.
          </p>
          <p className="text-xs">
            Pendência técnica: criar a Edge Function <code>resolve-receita</code> e ligar o fluxo de
            assinatura (VIDaaS) e validação. Veja o fluxograma de pendências.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
