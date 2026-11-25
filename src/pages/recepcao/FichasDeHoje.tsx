import { useQuery } from '@tanstack/react-query'
import * as React from 'react'

import { TituloCartao } from '@/components/monitor/Pagina'
import { Estado, type TomEstado } from '@/components/porta/Estado'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { inicioDoDia, rotuloEtapa, type TomEtapa } from '@/lib/fichasDeHoje'
import { hora } from '@/lib/formato'
import { supabase } from '@/lib/supabase'

// Fichas de hoje (RE1, revisão do perfil Recepção, RT 24/11/2026): abaixo da
// busca, as fichas abertas hoje na porta com a etapa de cada uma, para a
// recepção responder ao acompanhante sem trocar de tela. Lê só o que a
// recepção já lê: o episódio da porta (política de leitura pela escala) e, para
// quem está nas filas, o nome que vem de fila_da_porta.

type Ficha = {
  id: string
  etapa: string
  chegada_em: string
  atendimento_iniciado_em: string | null
  desfecho: string | null
  paciente: { nome: string; nome_social: string | null } | null
}

/** Nome das filas da porta (fila_da_porta), que vale mesmo sem leitura do cadastro. */
export type NomeNaFila = { episodio_id: string; nome: string; nome_social: string | null }

const TOM: Record<TomEtapa, TomEstado> = { espera: 'cinza', andamento: 'teal', alta: 'verde', saida: 'cinza' }
const INICIAIS = 8

// a Nova ficha invalida pelo prefixo 'recepcao-fichas-hoje' quando abre uma ficha
const chaveFichasDeHoje = (setorId: string, hoje: string) => ['recepcao-fichas-hoje', setorId, hoje] as const

export function FichasDeHoje({ setorId, hoje, ubs, naFila }: { setorId: string; hoje: string; ubs: boolean; naFila: NomeNaFila[] }) {
  const [todas, setTodas] = React.useState(false)
  const { data, isLoading, error } = useQuery({
    queryKey: chaveFichasDeHoje(setorId, hoje),
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('episodios')
        .select('id, etapa, chegada_em, atendimento_iniciado_em, desfecho, paciente:pacientes(nome, nome_social)')
        .eq('setor_id', setorId)
        .gte('chegada_em', inicioDoDia(hoje))
        .order('chegada_em', { ascending: false })
        .limit(200)
      if (error) throw error
      return (data ?? []) as unknown as Ficha[]
    },
  })

  const nomes = new Map(naFila.map((f) => [f.episodio_id, f.nome_social || f.nome]))
  const fichas = data ?? []
  const visiveis = todas ? fichas : fichas.slice(0, INICIAIS)

  return (
    <section aria-labelledby="rec-fichas-hoje" className="mt-6 flex flex-col">
      <TituloCartao id="rec-fichas-hoje">Fichas de hoje{data ? ` (${fichas.length})` : ''}</TituloCartao>
      <div className="overflow-hidden rounded-cartao border border-fio bg-superficie">
        {isLoading && <div className="px-5 py-4"><Spinner /></div>}
        {error && <p className="px-5 py-4 text-apoio text-critico">{(error as Error).message}</p>}
        {data && fichas.length === 0 && <p className="px-5 py-4 text-apoio text-tinta-sussurro">Nenhuma ficha aberta hoje nesta porta.</p>}
        {visiveis.map((f) => {
          const { rotulo, tom } = rotuloEtapa(f, ubs)
          const nome = nomes.get(f.id) ?? (f.paciente ? f.paciente.nome_social || f.paciente.nome : 'Paciente')
          return (
            <div key={f.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-trilha px-5 py-3 last:border-0">
              <span className="w-12 text-apoio tabular-nums text-tinta-sussurro">{hora(f.chegada_em)}</span>
              <span className="min-w-0 flex-[1_1_200px] truncate text-corpo font-medium text-tinta">{nome}</span>
              <Estado tom={TOM[tom]}>{rotulo}</Estado>
            </div>
          )
        })}
        {fichas.length > INICIAIS && (
          <div className="border-t border-trilha px-3 py-2">
            <Button variant="outline" size="sm" onClick={() => setTodas((v) => !v)}>
              {todas ? 'Mostrar menos' : `Ver as ${fichas.length}`}
            </Button>
          </div>
        )}
      </div>
    </section>
  )
}
