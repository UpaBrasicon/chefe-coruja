import { useState } from 'react'

import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BotaoLinha } from '@/components/ui/botao-linha'
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
  fonte,
}: {
  title: string
  description: string
  questoes: Questao[]
  /** linha de fonte visível abaixo do jogo */
  fonte?: string
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
        <Card className="border-acao">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-corpo">
              Resultado
              <Badge className="text-secao">{acertos} / {questoes.length}</Badge>
              <Badge variant={acertos >= questoes.length * 0.7 ? 'success' : acertos >= questoes.length * 0.4 ? 'warning' : 'destructive'}>
                {acertos >= questoes.length * 0.7 ? 'Excelente!' : acertos >= questoes.length * 0.4 ? 'Continue treinando' : 'Revise o conteúdo'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {questoes.map((quest, i) => (
              <div key={i} className={cn('rounded-controle border px-3 py-2 text-apoio', respostas[i] === quest.correta ? 'border-conforme/30 bg-alerta-conforme' : 'border-critico/30 bg-alerta-critico')}>
                <p className="font-medium">{quest.pergunta}</p>
                <p className="text-rotulo text-tinta-sussurro">
                  {respostas[i] === quest.correta ? '✓ Correto' : `✗ Sua resposta: ${quest.opcoes[respostas[i]]}`} · Resposta: {quest.opcoes[quest.correta]}
                </p>
              </div>
            ))}
            <div>
              <Button onClick={reiniciar}>Jogar de novo</Button>
            </div>
          </CardContent>
        </Card>
        {fonte && <p className="text-apoio text-tinta-sussurro">{fonte}</p>}
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
          <p className="text-corpo font-medium">{q.pergunta}</p>
          <div className="flex flex-col gap-2">
            {q.opcoes.map((opcao, i) => (
              <BotaoLinha
                key={i}
                onClick={() => escolher(i)}
                className={cn(
                  'w-full rounded-controle px-3 py-2 text-apoio',
                  resposta !== undefined && i === q.correta && 'border-conforme/30 bg-alerta-conforme hover:border-conforme/30 hover:bg-alerta-conforme',
                  resposta === i && i !== q.correta && 'border-critico/30 bg-alerta-critico hover:border-critico/30 hover:bg-alerta-critico',
                  resposta !== undefined && i !== q.correta && i !== resposta && 'opacity-60 hover:border-fio hover:bg-superficie'
                )}
              >
                {opcao}
              </BotaoLinha>
            ))}
          </div>
          {resposta !== undefined && (
            <p className="rounded-controle border bg-trilha/40 px-3 py-2 text-apoio text-tinta-sussurro">
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
      {fonte && <p className="text-apoio text-tinta-sussurro">{fonte}</p>}
    </ToolLayout>
  )
}
