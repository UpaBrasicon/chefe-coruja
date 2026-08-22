import * as React from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronRight, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Spinner } from '@/components/ui/spinner'

export type AbaDef = {
  /** Valor na URL (`?aba=`). Mantê-lo estável — vira link compartilhável. */
  valor: string
  rotulo: string
  /** Render sob demanda: a aba inativa não monta, então não busca dados à toa. */
  conteudo: () => React.ReactNode
}

/**
 * Página com abas cujo estado vive na URL (`?aba=...`).
 *
 * Isso é o que permite deep-link, botão voltar do navegador e link
 * compartilhável para uma aba específica — coisas que as abas em `useState`
 * não davam.
 */
export function TabsPagina({
  titulo,
  descricao,
  icone: Icone,
  abas,
  param = 'aba',
  largura = 'max-w-6xl',
  acoes,
  breadcrumb,
}: {
  titulo: string
  descricao?: React.ReactNode
  icone?: LucideIcon
  abas: AbaDef[]
  param?: string
  largura?: string
  acoes?: React.ReactNode
  breadcrumb?: { rotulo: string; para?: string }[]
}) {
  const [searchParams, setSearchParams] = useSearchParams()
  const daUrl = searchParams.get(param)
  const ativa = abas.some((a) => a.valor === daUrl) ? daUrl! : abas[0].valor

  function trocar(valor: string) {
    const proximo = new URLSearchParams(searchParams)
    if (valor === abas[0].valor) proximo.delete(param)
    else proximo.set(param, valor)
    setSearchParams(proximo, { replace: true })
  }

  return (
    <div className={`mx-auto flex w-full ${largura} flex-col gap-6`}>
      <div className="flex flex-col gap-1">
        {breadcrumb && breadcrumb.length > 0 && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            {breadcrumb.map((b, i) => (
              <React.Fragment key={`${b.rotulo}-${i}`}>
                {i > 0 && <ChevronRight className="size-3.5" />}
                {b.para ? (
                  <Link to={b.para} className="transition-colors hover:text-foreground">
                    {b.rotulo}
                  </Link>
                ) : (
                  <span className="font-medium text-foreground">{b.rotulo}</span>
                )}
              </React.Fragment>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {Icone && (
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icone className="size-5" />
              </span>
            )}
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
              {descricao && <p className="text-sm text-muted-foreground">{descricao}</p>}
            </div>
          </div>
          {acoes}
        </div>
      </div>

      <Tabs value={ativa} onValueChange={(v) => trocar(String(v))}>
        <TabsList variant="line" className="w-full overflow-x-auto">
          {abas.map((a) => (
            <TabsTrigger key={a.valor} value={a.valor}>
              {a.rotulo}
            </TabsTrigger>
          ))}
        </TabsList>

        {abas.map((a) => (
          <TabsContent key={a.valor} value={a.valor} className="pt-4">
            {/* Só a aba ativa monta — evita disparar as queries das outras. */}
            {a.valor === ativa && (
              <React.Suspense
                fallback={
                  <div className="flex h-40 items-center justify-center">
                    <Spinner />
                  </div>
                }
              >
                {a.conteudo()}
              </React.Suspense>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
