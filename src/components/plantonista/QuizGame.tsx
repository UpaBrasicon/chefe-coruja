import { useState } from 'react'

import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type Questao = {
  pergunta: string
  opcoes: string[]
  correta: number
  explicacao: string
}

export function QuizGame({
  title,
  description,
  questoes,
}: {
  title: string
  description: string
  questoes: Questao[]
}) {
  const [indice, setIndice] = useState(0)
  const [respostas, setRespostas] = useState<number[]>([])
  const [terminou, setTerminou] = useState(false)

  const q = questoes[indice]
  const resposta = respostas[indice]

  function escolher(opcao: number) {
    if (resposta !== undefined) return
    const novo = [...respostas]
    novo[indice] = opcao
    setRespostas(novo)
  }

  function proxima() {
    if (indice + 1 >= questoes.length) setTerminou(true)
    else setIndice(indice + 1)
  }

  function reiniciar() {
    setIndice(0)
    setRespostas([])
    setTerminou(false)
  }

  const acertos = questoes.reduce((s, quest, i) => s + (respostas[i] === quest.correta ? 1 : 0), 0)

  if (terminou) {
    return (
      <ToolLayout title={title} description={description}>
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-base">
              Resultado
              <Badge className="text-lg">{acertos} / {questoes.length}</Badge>
              <Badge variant={acertos >= questoes.length * 0.7 ? 'success' : acertos >= questoes.length * 0.4 ? 'warning' : 'destructive'}>
                {acertos >= questoes.length * 0.7 ? 'Excelente!' : acertos >= questoes.length * 0.4 ? 'Continue treinando' : 'Revise o conteúdo'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {questoes.map((quest, i) => (
              <div key={i} className={cn('rounded-lg border px-3 py-2 text-sm', respostas[i] === quest.correta ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50')}>
                <p className="font-medium">{quest.pergunta}</p>
                <p className="text-xs text-muted-foreground">
                  {respostas[i] === quest.correta ? '✓ Correto' : `✗ Sua resposta: ${quest.opcoes[respostas[i]]}`} · Resposta: {quest.opcoes[quest.correta]}
                </p>
              </div>
            ))}
            <div>
              <Button onClick={reiniciar}>Jogar de novo</Button>
            </div>
          </CardContent>
        </Card>
      </ToolLayout>
    )
  }

  return (
    <ToolLayout title={title} description={description}>
      <div className="flex items-center justify-between">
        <Badge variant="secondary">Pergunta {indice + 1} / {questoes.length}</Badge>
        <Badge variant="outline">Acertos: {acertos}</Badge>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 pt-6">
          <p className="text-base font-medium">{q.pergunta}</p>
          <div className="flex flex-col gap-2">
            {q.opcoes.map((opcao, i) => (
              <button
                key={i}
                type="button"
                onClick={() => escolher(i)}
                className={cn(
                  'rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                  resposta === undefined && 'hover:bg-muted/50',
                  resposta !== undefined && i === q.correta && 'border-emerald-300 bg-emerald-50',
                  resposta === i && i !== q.correta && 'border-red-300 bg-red-50',
                  resposta !== undefined && i !== q.correta && i !== resposta && 'opacity-60'
                )}
              >
                {opcao}
              </button>
            ))}
          </div>
          {resposta !== undefined && (
            <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              {q.explicacao}
            </p>
          )}
          {resposta !== undefined && (
            <div>
              <Button onClick={proxima}>{indice + 1 >= questoes.length ? 'Ver resultado' : 'Próxima'}</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </ToolLayout>
  )
}
