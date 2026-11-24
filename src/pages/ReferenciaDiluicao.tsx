import { useQuery } from '@tanstack/react-query'
import { Droplets, ShieldAlert } from 'lucide-react'
import * as React from 'react'
import { useSearchParams } from 'react-router-dom'

import { supabase } from '@/lib/supabase'
import { normalizarMedicamento } from '@/lib/search'
import { filtroDaUnidade } from '@/lib/medicamentoCadastro'
import { cn } from '@/lib/utils'
import { useUnidade } from '@/contexts/UnidadeContext'
import { useValorAdiado } from '@/hooks/useValorAdiado'
import { Chip, TituloPagina, Trilha } from '@/components/monitor/Pagina'
import { DiluicoesPublicadas } from '@/components/farmacia/DiluicaoPublicada'
import { SeloAltaVigilancia } from '@/components/farmacia/SeloAltaVigilancia'
import { BotaoLinha } from '@/components/ui/botao-linha'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'

// Referência de diluição. Revisão da Farmácia do médico (RT, 24/11/2026): lista
// e ficha na altura toda, linhas compactas sem caixinhas, legenda do escudo de
// alta vigilância e o filtro "Só alta vigilância". A Consulta de medicamentos
// e a busca da Central abrem aqui com ?m=<medicamento> (e ?q=<nome>).

type Medicamento = {
  id: string
  principio_ativo: string
  concentracao: string | null
  apresentacao: string | null
  rxcui: string | null
  alta_vigilancia: boolean
  anvisa_registro: string | null
}

const CAMPOS = 'id, principio_ativo, concentracao, apresentacao, rxcui, alta_vigilancia, anvisa_registro'

export default function ReferenciaDiluicao({ embutido = false }: { embutido?: boolean } = {}) {
  const [params] = useSearchParams()
  const [busca, setBusca] = React.useState(() => (params.get('q') ?? '').slice(0, 80))
  const [soAltaVigilancia, setSoAltaVigilancia] = React.useState(false)

  const unidadeBusca = useUnidade().unidadeAtiva?.unidade_id
  // pedido 3: a consulta espera a pessoa parar de digitar (300 ms); sem termo,
  // a lista inicial sai na hora como antes
  const buscaAdiada = useValorAdiado(busca)
  const { data: medicamentos, isLoading } = useQuery({
    queryKey: ['medicamento-catalogo', buscaAdiada, unidadeBusca],
    enabled: true,
    queryFn: async () => {
      let query = supabase
        .from('medicamento')
        .select(CAMPOS)
        .eq('ativo', true).or(filtroDaUnidade(unidadeBusca))
        .order('principio_ativo')
        .limit(200)
      if (buscaAdiada.trim().length >= 2) {
        query = query.ilike('principio_ativo_norm', `%${normalizarMedicamento(buscaAdiada.trim())}%`)
      }
      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as Medicamento[]
    },
  })

  // medicamento pedido pelo endereço (?m=), vindo da consulta ou da busca da Central
  const pedido = params.get('m')
  const { data: doEndereco } = useQuery({
    queryKey: ['medicamento-por-id', pedido, unidadeBusca],
    enabled: !!pedido,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('medicamento')
        .select(CAMPOS)
        .eq('id', pedido!).or(filtroDaUnidade(unidadeBusca))
        .maybeSingle()
      if (error) throw error
      return (data ?? null) as Medicamento | null
    },
  })

  const [escolhido, setEscolhido] = React.useState<Medicamento | null>(null)
  const sel = escolhido ?? doEndereco ?? null

  const lista = (medicamentos ?? []).filter((m) => !soAltaVigilancia || m.alta_vigilancia)
  const totalAv = (medicamentos ?? []).filter((m) => m.alta_vigilancia).length

  return (
    <div className="flex w-full flex-col gap-4">
      {embutido ? (
        <TituloPagina icone={Droplets} titulo="Referência de diluição" descricao="Diluições publicadas e revisadas por farmacêutico." className="mb-0" />
      ) : (
        <div>
          <Trilha niveis={[{ rotulo: 'Início', to: '/' }, { rotulo: 'Referência de diluição' }]} />
          <TituloPagina
            icone={Droplets}
            titulo="Referência de diluição"
            className="mb-0"
            descricao="Só registros publicados (revisados por farmacêutico). Registros em rascunho não aparecem."
          />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <section aria-label="Medicamentos" className="flex min-h-0 flex-col overflow-hidden rounded-cartao border border-fio bg-superficie lg:h-[calc(100dvh-13rem)] lg:min-h-[420px]">
          <div className="flex flex-col gap-2 border-b border-fio p-3">
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Filtrar por princípio ativo…"
              aria-label="Filtrar medicamentos por princípio ativo"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-rotulo text-tinta-sussurro">
                <ShieldAlert className="size-3.5 text-atencao" aria-hidden /> = alta vigilância (ISMP)
              </span>
              <Chip ativo={soAltaVigilancia} onClick={() => setSoAltaVigilancia((v) => !v)} contagem={medicamentos ? totalAv : undefined}>
                Só alta vigilância
              </Chip>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex h-24 items-center justify-center"><Spinner /></div>
            ) : lista.length === 0 ? (
              <p className="p-3 text-apoio text-tinta-sussurro">
                {soAltaVigilancia ? 'Nenhum medicamento de alta vigilância com esse nome.' : 'Nenhum medicamento encontrado.'}
              </p>
            ) : (
              <ul>
                {lista.map((m) => (
                  <li key={m.id}>
                    <BotaoLinha
                      variante="linha"
                      onClick={() => setEscolhido(m)}
                      aria-current={sel?.id === m.id ? 'true' : undefined}
                      className={cn('flex-col gap-0 px-3 py-1.5 last:border-b hover:bg-campo',
                        sel?.id === m.id && 'bg-acao/10 hover:bg-acao/10')}
                    >
                      <span className={cn('flex items-center gap-1.5 text-apoio font-medium', sel?.id === m.id ? 'text-acao' : 'text-tinta')}>
                        {m.principio_ativo}
                        {m.alta_vigilancia && <ShieldAlert className="size-3.5 shrink-0 text-atencao" aria-label="alta vigilância" />}
                      </span>
                      <span className="text-rotulo text-tinta-sussurro">
                        {[m.concentracao, m.apresentacao].filter(Boolean).join(' · ') || 'sem apresentação cadastrada'}
                      </span>
                    </BotaoLinha>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {medicamentos && (
            <p className="border-t border-fio px-3 py-1.5 text-rotulo text-tinta-sussurro tabular">
              {lista.length} {lista.length === 1 ? 'medicamento' : 'medicamentos'}
            </p>
          )}
        </section>

        <section aria-label="Diluição publicada" className="min-h-0 overflow-y-auto rounded-cartao border border-fio bg-superficie p-4 lg:h-[calc(100dvh-13rem)] lg:min-h-[420px]">
          {!sel ? (
            <p className="text-apoio text-tinta-sussurro">Escolha um medicamento na lista para ver a diluição publicada.</p>
          ) : (
            <div className="flex flex-col gap-3">
              <div>
                <h3 className="flex flex-wrap items-center gap-2 text-secao font-semibold text-tinta">
                  {sel.principio_ativo}
                  {sel.alta_vigilancia && <SeloAltaVigilancia />}
                </h3>
                <p className="text-apoio text-tinta-sussurro">
                  {[sel.concentracao, sel.apresentacao].filter(Boolean).join(' · ') || 'sem apresentação cadastrada'}
                  {sel.anvisa_registro ? ` · registro ANVISA ${sel.anvisa_registro}` : ''}
                </p>
              </div>
              <DiluicoesPublicadas medicamentoId={sel.id} />
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
