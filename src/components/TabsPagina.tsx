import * as React from 'react'
import { useSearchParams } from 'react-router-dom'
import { type LucideIcon } from 'lucide-react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Spinner } from '@/components/ui/spinner'
import { TituloPagina, Trilha } from '@/components/monitor/Pagina'

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
    <div className={`flex w-full ${largura === 'max-w-6xl' ? '' : largura} flex-col`}>
      {breadcrumb && breadcrumb.length > 0 && (
        <Trilha niveis={breadcrumb.map((b) => ({ rotulo: b.rotulo, to: b.para }))} />
      )}
      {Icone ? (
        <TituloPagina icone={Icone} titulo={titulo} descricao={descricao} acoes={acoes} />
      ) : (
        <header className="mb-[22px] flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-titulo leading-[1.1] font-semibold tracking-[-0.02em] text-tinta">{titulo}</h1>
            {descricao && <p className="mt-1 text-apoio text-tinta-sussurro">{descricao}</p>}
          </div>
          {acoes}
        </header>
      )}
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
