import * as React from 'react'
import { TriangleAlert } from 'lucide-react'

import { Button } from '@/components/ui/button'

type Props = { children: React.ReactNode; onReset?: () => void }
type State = { erro: Error | null }

/**
 * Barreira de erro de render.
 *
 * Sem isso, uma exceção em qualquer ferramenta derrubava a árvore inteira e o
 * plantonista via tela branca no meio do plantão. Aqui o AppShell continua de pé
 * e só o conteúdo da rota é substituído.
 */
export class ErroBoundary extends React.Component<Props, State> {
  state: State = { erro: null }

  static getDerivedStateFromError(erro: Error): State {
    return { erro }
  }

  componentDidCatch(erro: Error, info: React.ErrorInfo) {
    console.error('[ErroBoundary]', erro, info.componentStack)
  }

  render() {
    if (!this.state.erro) return this.props.children

    return (
      <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-4 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <TriangleAlert className="size-6" />
        </span>
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight">Algo quebrou nesta tela</h1>
          <p className="text-sm text-muted-foreground">
            O restante do sistema continua funcionando. Tente novamente ou volte para a tela anterior.
          </p>
        </div>
        <pre className="max-h-40 w-full overflow-auto rounded-lg border bg-muted/50 p-3 text-left text-xs text-muted-foreground">
          {this.state.erro.message}
        </pre>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              this.setState({ erro: null })
              this.props.onReset?.()
            }}
          >
            Tentar de novo
          </Button>
          <Button onClick={() => window.location.assign('/')}>Voltar ao início</Button>
        </div>
      </div>
    )
  }
}

/** Reseta a barreira sempre que a rota muda. */
export function ErroBoundaryDeRota({ chave, children }: { chave: string; children: React.ReactNode }) {
  return <ErroBoundary key={chave}>{children}</ErroBoundary>
}
