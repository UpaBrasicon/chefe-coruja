import * as React from 'react'
import { useSearchParams } from 'react-router-dom'
import { type LucideIcon } from 'lucide-react'

import { TituloPagina } from '@/components/monitor/Pagina'
import { FaixaDaPagina } from '@/components/monitor/faixaDaPagina'
import { EsqueletoLinhas } from '@/components/ui/esqueleto-linhas'
import { cn } from '@/lib/utils'

export type SecaoDef = {
  /** Valor na URL (`?aba=`), o mesmo das abas antigas: os links continuam valendo. */
  valor: string
  rotulo: string
  grupo: string
  descricao?: string
  /** Render sob demanda: a seção inativa não monta, então não busca dados à toa. */
  conteudo: () => React.ReactNode
}

/**
 * Página mestre-detalhe: as seções numa lista lateral em grupos e a escolhida
 * ao lado (revisão do gestor, RT 24/11/2026: as 9 abas da Unidade com
 * rolagem viram lista). O estado vive na URL (`?aba=`), como no TabsPagina.
 * No celular a lista fica em cima, em linha que rola.
 */
export function PaginaComLista({ titulo, descricao, icone, secoes, param = 'aba' }: {
  titulo: string
  descricao?: React.ReactNode
  icone: LucideIcon
  secoes: SecaoDef[]
  param?: string
}) {
  const [searchParams, setSearchParams] = useSearchParams()
  const daUrl = searchParams.get(param)
  const ativa = secoes.find((s) => s.valor === daUrl) ?? secoes[0]
  const grupos = [...new Set(secoes.map((s) => s.grupo))]

  function trocar(valor: string) {
    const proximo = new URLSearchParams(searchParams)
    if (valor === secoes[0].valor) proximo.delete(param)
    else proximo.set(param, valor)
    setSearchParams(proximo, { replace: true })
  }

  return (
    <div className="flex w-full flex-col">
      <TituloPagina icone={icone} titulo={titulo} descricao={descricao} />
      <div className="grid gap-5 md:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label={`Seções de ${titulo}`} className="flex gap-4 overflow-x-auto md:flex-col md:gap-5 md:overflow-visible">
          {grupos.map((g) => (
            <div key={g} className="flex shrink-0 flex-col gap-0.5">
              <span className="px-2.5 pb-1 text-rotulo font-medium text-tinta-sussurro">{g}</span>
              <div className="flex gap-0.5 md:flex-col">
                {secoes.filter((s) => s.grupo === g).map((s) => {
                  const atual = s.valor === ativa.valor
                  return (
                    <button
                      key={s.valor}
                      type="button"
                      aria-current={atual ? 'page' : undefined}
                      onClick={() => trocar(s.valor)}
                      className={cn(
                        'rounded-controle px-2.5 py-1.5 text-left text-controle whitespace-nowrap transition-colors',
                        atual ? 'bg-acao/10 font-medium text-acao' : 'text-tinta-apoio hover:bg-trilha hover:text-tinta',
                      )}
                    >
                      {s.rotulo}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>
        <section aria-label={ativa.rotulo} className="min-w-0">
          <div className="mb-4 border-b border-fio pb-2">
            <span className="text-secao font-semibold text-tinta">{ativa.rotulo}</span>
            {ativa.descricao && <p className="mt-0.5 text-apoio text-tinta-sussurro">{ativa.descricao}</p>}
          </div>
          <React.Suspense fallback={<EsqueletoLinhas linhas={4} className="px-0" />}>
            <FaixaDaPagina.Provider value={null}>{ativa.conteudo()}</FaixaDaPagina.Provider>
          </React.Suspense>
        </section>
      </div>
    </div>
  )
}
