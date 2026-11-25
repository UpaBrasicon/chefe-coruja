import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Loader2, Pill, Search, ShieldAlert } from 'lucide-react'
import * as React from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { supabase } from '@/lib/supabase'
import { normalizarMedicamento } from '@/lib/search'
import { filtroDaUnidade } from '@/lib/medicamentoCadastro'
import { cn } from '@/lib/utils'
import { useUnidade } from '@/contexts/UnidadeContext'
import { useValorAdiado } from '@/hooks/useValorAdiado'
import { useTerminologia } from '@/hooks/useTerminologia'
import { TituloPagina, Trilha } from '@/components/monitor/Pagina'
import { BotaoLinha } from '@/components/ui/botao-linha'
import { DiluicoesPublicadas } from '@/components/farmacia/DiluicaoPublicada'
import { SeloAltaVigilancia } from '@/components/farmacia/SeloAltaVigilancia'

// Consulta de medicamentos do médico. Revisão da Farmácia do médico (RT,
// 24/11/2026): uma busca só, nos medicamentos da unidade e na tabela CMED
// juntos, com a fonte marcada em cada resultado; o resultado abre a ficha ao
// lado (apresentação e diluição publicada). Saiu o cartão "Itens da
// prescrição": esta tela é só consulta; prescrever é na prescrição do paciente.

type Medicamento = {
  id: string
  principio_ativo: string
  concentracao: string | null
  apresentacao: string | null
  rxcui: string | null
  alta_vigilancia: boolean
}

type Escolha =
  | { fonte: 'unidade'; medicamento: Medicamento }
  | { fonte: 'cmed'; codigo: string; descricao: string }

const DESCRICAO = 'Busque pelo nome. Para prescrever, abra a prescrição do paciente: lá o sistema confere alergia, idade e peso deste atendimento.'

export default function PrescricaoTeste({ embutido = false }: { embutido?: boolean } = {}) {
  const [params] = useSearchParams()
  const [busca, setBusca] = React.useState(() => (params.get('q') ?? '').slice(0, 80))
  const [escolha, setEscolha] = React.useState<Escolha | null>(null)
  const buscaAdiada = useValorAdiado(busca)
  const termo = buscaAdiada.trim()

  const unidadeBusca = useUnidade().unidadeAtiva?.unidade_id
  const { data: daUnidade, isFetching: buscandoUnidade } = useQuery({
    queryKey: ['buscar-medicamentos-canonico', buscaAdiada, unidadeBusca],
    enabled: termo.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('medicamento')
        .select('id, principio_ativo, concentracao, apresentacao, rxcui, alta_vigilancia')
        .eq('ativo', true).or(filtroDaUnidade(unidadeBusca))
        .ilike('principio_ativo_norm', `%${normalizarMedicamento(termo)}%`)
        .order('principio_ativo')
        .limit(12)
      if (error) throw error
      return (data ?? []) as Medicamento[]
    },
    staleTime: 60_000,
  })
  const cmed = useTerminologia('medicamento_cmed', busca)

  const buscando = buscandoUnidade || cmed.isFetching
  const unidade = termo.length >= 2 ? daUnidade ?? [] : []
  const daCmed = busca.trim().length >= 2 ? cmed.data ?? [] : []
  const semNada = termo.length >= 2 && !buscando && unidade.length === 0 && daCmed.length === 0

  return (
    <div className="flex w-full flex-col gap-4">
      {embutido ? (
        <TituloPagina icone={Pill} titulo="Consulta de medicamentos" descricao={DESCRICAO} className="mb-0" />
      ) : (
        <div>
          <Trilha niveis={[{ rotulo: 'Início', to: '/' }, { rotulo: 'Consulta de medicamentos' }]} />
          <TituloPagina icone={Pill} titulo="Consulta de medicamentos" descricao={DESCRICAO} className="mb-0" />
        </div>
      )}

      <div className="relative max-w-2xl">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-tinta-sussurro" aria-hidden />
        <input
          type="search"
          value={busca}
          onChange={(e) => { setBusca(e.target.value); setEscolha(null) }}
          placeholder="Ex.: dipirona, ceftriaxona, omeprazol…"
          aria-label="Buscar medicamento nos medicamentos da unidade e na tabela CMED"
          autoComplete="off"
          maxLength={80}
          className="h-11 w-full rounded-container border border-fio bg-superficie pr-10 pl-10 text-corpo text-tinta outline-none placeholder:text-tinta-sussurro focus-visible:border-acao focus-visible:shadow-anel-campo"
        />
        {buscando && <Loader2 className="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 animate-spin text-tinta-sussurro" aria-label="Buscando" />}
      </div>

      {busca.trim().length < 2 ? (
        <p className="text-apoio text-tinta-sussurro">Digite ao menos 2 letras. A busca olha os medicamentos da unidade (com diluição publicada) e a tabela CMED (preço e registro).</p>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <section aria-label="Resultados" aria-live="polite" className="overflow-hidden rounded-cartao border border-fio bg-superficie">
            {semNada && <p className="p-3 text-apoio text-tinta-sussurro">Nenhum medicamento encontrado para "{busca.trim()}".</p>}
            <ul>
              {unidade.map((m) => {
                const ativo = escolha?.fonte === 'unidade' && escolha.medicamento.id === m.id
                return (
                  <li key={m.id}>
                    <BotaoLinha variante="linha" onClick={() => setEscolha({ fonte: 'unidade', medicamento: m })} aria-current={ativo ? 'true' : undefined}
                      className={cn('gap-3 px-3 py-2 last:border-b hover:bg-campo', ativo && 'bg-acao/10 hover:bg-acao/10')}>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className={cn('flex items-center gap-1.5 text-apoio font-medium', ativo ? 'text-acao' : 'text-tinta')}>
                          {m.principio_ativo}
                          {m.alta_vigilancia && <ShieldAlert className="size-3.5 shrink-0 text-atencao" aria-label="alta vigilância" />}
                        </span>
                        <span className="text-rotulo text-tinta-sussurro">{[m.concentracao, m.apresentacao].filter(Boolean).join(' · ') || 'sem apresentação cadastrada'}</span>
                      </span>
                      <span className="shrink-0 text-rotulo text-tinta-sussurro">Unidade</span>
                    </BotaoLinha>
                  </li>
                )
              })}
              {daCmed.map((r) => {
                const ativo = escolha?.fonte === 'cmed' && escolha.codigo === r.codigo
                return (
                  <li key={`cmed-${r.codigo}`}>
                    <BotaoLinha variante="linha" onClick={() => setEscolha({ fonte: 'cmed', codigo: r.codigo, descricao: r.descricao })} aria-current={ativo ? 'true' : undefined}
                      className={cn('gap-3 px-3 py-2 last:border-b hover:bg-campo', ativo && 'bg-acao/10 hover:bg-acao/10')}>
                      <span className={cn('min-w-0 flex-1 text-apoio', ativo ? 'text-acao' : 'text-tinta')}>{r.descricao}</span>
                      <span className="shrink-0 text-rotulo text-tinta-sussurro">CMED</span>
                    </BotaoLinha>
                  </li>
                )
              })}
            </ul>
            {(unidade.length > 0 || daCmed.length > 0) && (
              <p className="px-3 py-1.5 text-rotulo text-tinta-sussurro">
                Unidade = medicamentos da unidade, com diluição publicada · CMED = tabela da ANVISA, preço e registro
              </p>
            )}
          </section>

          <section aria-label="Ficha do medicamento" className="rounded-cartao border border-fio bg-superficie p-4">
            {!escolha ? (
              <p className="text-apoio text-tinta-sussurro">Escolha um resultado para ver a ficha.</p>
            ) : escolha.fonte === 'unidade' ? (
              <div className="flex flex-col gap-3">
                <div>
                  <h3 className="flex flex-wrap items-center gap-2 text-secao font-semibold text-tinta">
                    {escolha.medicamento.principio_ativo}
                    {escolha.medicamento.alta_vigilancia && <SeloAltaVigilancia />}
                  </h3>
                  <p className="text-apoio text-tinta-sussurro">
                    {[escolha.medicamento.concentracao, escolha.medicamento.apresentacao].filter(Boolean).join(' · ') || 'sem apresentação cadastrada'}
                    {' · medicamento da unidade'}
                  </p>
                </div>
                <DiluicoesPublicadas medicamentoId={escolha.medicamento.id} />
                <Link to={`/plantonista/farmacia/referencia-diluicao?m=${encodeURIComponent(escolha.medicamento.id)}`}
                  className="inline-flex items-center gap-1 self-start text-apoio text-acao underline-offset-4 hover:underline">
                  Abrir na referência de diluição <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <h3 className="text-secao font-semibold text-tinta">{escolha.descricao}</h3>
                <p className="text-apoio text-tinta-sussurro">Tabela CMED · código {escolha.codigo}</p>
                <p className="text-apoio text-tinta">
                  A tabela CMED da ANVISA traz preço e registro. Diluição publicada só existe para os medicamentos da unidade.
                </p>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
