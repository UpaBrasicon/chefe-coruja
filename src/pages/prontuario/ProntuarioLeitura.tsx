import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { Eye, FileClock, Printer } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { TituloCartao, TituloPagina, Trilha, Vazio } from '@/components/monitor/Pagina'
import { SeloAlergia } from '@/components/paciente/AlergiasEventos'
import { ativas, negaVigente, rotuloGrau, rotuloGravidade, rotuloTipo, useAlergias } from '@/components/paciente/useAlergias'
import { HistoricoRegulacao } from '@/components/regulacao/HistoricoRegulacao'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MensagemErro } from '@/components/ui/mensagem-erro'
import { Carregando } from '@/components/ui/spinner'
import { useUnidade } from '@/contexts/UnidadeContext'
import { idadeLegivel } from '@/lib/cadastroPaciente'
import { data, dataHora, dataIso, dataPura } from '@/lib/formato'
import { abrirProntuario } from '@/lib/prontuario'
import { ancoraDoAno, juntarPaginas, montarLinhaTempo, type PaginaProntuario } from '@/lib/prontuarioLinhaTempo'
import { supabase } from '@/lib/supabase'
import { CartaoAtendimento, ListaAtendimentos } from './LinhaDoTempo'

// Prontuário completo (fase 6; redesenho do achado guardado, item 6: A em P1 a
// P7 e direção visual A do RT, 06/11/2026). Serve a quem tem pedido aprovado e
// vigente e a quem já tem acesso pela escala. Só leitura: não há botão de
// escrever, e o banco também não deixaria (o pedido não entra em
// pode_atuar_no_paciente). Abrir grava o acesso no servidor (abrir_prontuario)
// antes de qualquer leitura. Os cadastros unificados aparecem juntos: a
// leitura (prontuario_leitura) usa a mesma família de cadastros_do_paciente.
// Sinais vitais saem crus, sem marca de alterado: a análise é de quem lê.
// A impressão (ImpressaoProntuario.tsx) não mudou (P7).

const POR_PAGINA = 5

export default function ProntuarioLeitura() {
  const { papelAtivo } = useUnidade()
  const { pacienteId } = useParams<{ pacienteId: string }>()

  // 1º: grava o acesso e lê o cadastro; a linha do tempo só depois
  const abertura = useQuery({
    queryKey: ['prontuario-leitura', pacienteId],
    enabled: !!pacienteId,
    staleTime: 60_000,
    queryFn: async () => {
      await abrirProntuario(pacienteId!)
      const pac = await supabase.from('pacientes')
        .select('id, nome, nome_social, data_nascimento, sexo, prontuario').eq('id', pacienteId!).maybeSingle()
      if (pac.error) throw pac.error
      if (!pac.data) throw new Error('Sem acesso a este paciente. O pedido pode ter vencido ou ainda não foi aprovado.')
      return pac.data
    },
  })

  // 2º: os atendimentos, 5 por vez (P4)
  const linha = useInfiniteQuery({
    queryKey: ['prontuario-linha-tempo', pacienteId],
    enabled: abertura.isSuccess,
    staleTime: 60_000,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const { data: pagina, error } = await supabase.rpc('prontuario_leitura', {
        p_paciente: pacienteId!, p_limite: POR_PAGINA, ...(pageParam ? { p_antes: pageParam } : {}),
      })
      if (error) throw error
      return pagina as unknown as PaginaProntuario
    },
    getNextPageParam: (ultima) => (ultima.mais && ultima.proximo_antes ? ultima.proximo_antes : undefined),
  })

  const dados = useMemo(() => (linha.data?.pages.length ? juntarPaginas(linha.data.pages) : null), [linha.data])
  const grupos = useMemo(() => (dados ? montarLinhaTempo(dados).grupos : []), [dados])

  // navegação por ano: se o ano ainda não veio, busca as próximas páginas até ele
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = linha
  const [buscandoAno, setBuscandoAno] = useState<number | null>(null)
  async function irParaAno(ano: number) {
    const temAno = (paginas: PaginaProntuario[] | undefined) =>
      (paginas ?? []).some((p) => p.atendimentos.some((a) => dataIso(a.chegada_em).startsWith(String(ano))))
    let paginas = linha.data?.pages
    let mais = hasNextPage
    if (!temAno(paginas) && mais) {
      setBuscandoAno(ano)
      try {
        while (!temAno(paginas) && mais) {
          const r = await fetchNextPage()
          if (r.isError) break
          paginas = r.data?.pages
          mais = r.hasNextPage
        }
      } finally { setBuscandoAno(null) }
    }
    // espera a lista nova aparecer na tela antes de rolar
    requestAnimationFrame(() => requestAnimationFrame(() =>
      document.getElementById(ancoraDoAno(ano))?.scrollIntoView({ behavior: 'smooth', block: 'start' })))
  }

  if (abertura.isLoading) return <Carregando rotulo="Abrindo o prontuário…" />
  if (abertura.error || !abertura.data) {
    return (
      <div className="flex max-w-2xl flex-col gap-3">
        <MensagemErro erro={abertura.error} texto={abertura.error ? undefined : 'Sem acesso.'} acao="abrir o prontuário" />
        <Button variant="outline" className="self-start" render={<Link to="/prontuarios" />}>Voltar aos pedidos</Button>
      </div>
    )
  }
  const paciente = abertura.data
  const nome = paciente.nome_social ? `${paciente.nome_social} (${paciente.nome})` : paciente.nome
  const atendimentos = grupos.filter((g) => g.tipo === 'atendimento')
  const avulsos = grupos.filter((g) => g.tipo !== 'atendimento')
  const resumo = dados?.resumo
  // falha ao buscar mais: a lista já carregada fica
  const erroMais = dados && linha.isFetchNextPageError ? linha.error : null

  return (
    <div className="w-full max-w-6xl">
      <Trilha niveis={[{ rotulo: 'Prontuários', to: '/prontuarios' }, { rotulo: paciente.nome }]} />
      <div className="grid items-start gap-secao lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        {/* ficha fixa: no celular fica em cima */}
        <aside aria-label="Ficha do paciente" className="flex flex-col gap-proximo lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto">
          <Card className="gap-proximo py-base">
            <CardContent className="flex flex-col gap-proximo px-base">
              <TituloPagina
                titulo={nome}
                className="mb-0"
                descricao={[
                  paciente.data_nascimento ? `nasc. ${dataPura(paciente.data_nascimento)} · ${idadeLegivel(paciente.data_nascimento)}` : null,
                  paciente.prontuario ? 'prontuário ' + paciente.prontuario : null,
                ].filter(Boolean).join(' · ')}
              />
              <p className="flex items-center gap-1.5 text-rotulo text-tinta-sussurro">
                <Eye className="size-3.5 shrink-0" aria-hidden /> Somente leitura · este acesso fica registrado
              </p>
              <dl className="grid grid-cols-3 gap-2 border-t border-fio pt-proximo">
                <Numero rotulo="Atendimentos" valor={resumo ? String(resumo.atendimentos) : '…'} />
                <Numero rotulo="Internações" valor={resumo ? String(resumo.internacoes) : '…'} />
                <Numero rotulo="Último" valor={resumo ? (resumo.ultimo_em ? data(resumo.ultimo_em) : '—') : '…'} />
              </dl>
              {/* ponto 5: a impressão é do plantonista (rota dele), com o paciente escolhido */}
              {papelAtivo === 'plantonista' && (
                <Button variant="outline" size="sm" className="self-start" render={<Link to={`/impressao-prontuario?paciente=${paciente.id}`} />}>
                  <Printer /> Imprimir prontuário
                </Button>
              )}
            </CardContent>
          </Card>

          <AlergiasLeitura pacienteId={paciente.id} />

          {/* Fase 4, tarefa 5: regulações do paciente na rede (médico e gestor) */}
          <HistoricoRegulacao pacienteId={paciente.id} />

          {resumo && resumo.anos.length > 0 && (
            <nav aria-label="Atendimentos por ano" className="rounded-cartao border border-fio bg-superficie px-base py-proximo">
              <TituloCartao>Navegar</TituloCartao>
              <ul className="flex flex-wrap gap-1.5">
                {resumo.anos.map((a) => (
                  <li key={a.ano}>
                    <Button variant="outline" size="xs" className="rounded-capsula px-2.5 tabular" disabled={buscandoAno != null} onClick={() => void irParaAno(a.ano)}
                      aria-label={`${a.ano}: ${a.atendimentos} ${a.atendimentos === 1 ? 'atendimento' : 'atendimentos'}`}>
                      {a.ano} <span className="text-tinta-sussurro">({a.atendimentos})</span>
                    </Button>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </aside>

        {/* linha do tempo: o mais recente no topo */}
        <section aria-label="Atendimentos" className="relative min-w-0">
          <div aria-hidden className="absolute inset-y-0 left-1/2 hidden border-l border-dashed border-fio-forte sm:block" />
          {!dados && linha.error ? (
            <MensagemErro erro={linha.error} acao="carregar os atendimentos" className="relative z-10" />
          ) : !dados ? <Carregando rotulo="Carregando os atendimentos…" /> : grupos.length === 0 ? (
            <div className="relative z-10">
              <Vazio icone={FileClock} titulo="Nenhum atendimento" texto="Nenhum atendimento ou registro deste paciente aparece para você." />
            </div>
          ) : (
            <div className="mx-auto flex max-w-3xl flex-col">
              <ListaAtendimentos grupos={atendimentos} />
              {hasNextPage && (
                <Button variant="outline" size="sm" className="relative z-10 mx-auto mt-proximo rounded-capsula px-4"
                  disabled={isFetchingNextPage} onClick={() => void fetchNextPage()}>
                  {isFetchingNextPage ? 'Carregando…' : 'Ver mais atendimentos'}
                </Button>
              )}
              {erroMais && (
                <MensagemErro erro={erroMais} acao="carregar mais atendimentos" className="relative z-10 mt-2" />
              )}
              {/* registros sem atendimento ligado (ou de atendimento que não aparece para quem lê): no fim */}
              {avulsos.map((g) => (
                <div key={g.chave} className="mt-secao">
                  <CartaoAtendimento grupo={g} inicialAberto={false} />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function Numero({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <dt className="text-rotulo text-tinta-sussurro">{rotulo}</dt>
      <dd className="text-corpo font-semibold text-tinta tabular">{valor}</dd>
    </div>
  )
}

const quando = (iso: string | null | undefined) => (iso ? dataHora(iso) : '')

/**
 * Alergias e eventos adversos, só leitura, com os três estados do resto do
 * produto (tem / nega / não registrada): lista vazia não é "nega". A leitura
 * vem de alergias_do_paciente, que aceita o pedido de acesso vigente.
 */
function AlergiasLeitura({ pacienteId }: { pacienteId: string }) {
  const q = useAlergias(pacienteId)
  const lista = ativas(q.data)
  const nega = negaVigente(q.data)
  const eventos = (q.data?.eventos ?? []).filter((e) => !e.inativado_em)
  return (
    <Card className="gap-justo py-base shadow-none">
      <CardHeader className="px-base"><CardTitle className="text-controle">Alergias e eventos adversos</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-2 px-base text-apoio">
        <SeloAlergia pacienteId={pacienteId} />
        {q.data?.estado === 'nega' && nega && (
          <p className="text-tinta-sussurro">Nega alergias · registrado em {quando(nega.registrado_em)}{nega.autor ? ` por ${nega.autor}` : ''}</p>
        )}
        {q.data?.estado === 'nao_registrada' && (
          <p className="text-tinta-sussurro">Ninguém registrou ainda se o paciente tem ou nega alergias.</p>
        )}
        {lista.length > 0 && (
          <ul className="flex flex-col gap-1.5">
            {lista.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2">
                <Badge variant="destructive">{a.substancia}</Badge>
                <span>{rotuloTipo(a.tipo)} · {rotuloGravidade(a.gravidade).toLowerCase()}{a.reacao ? ` · ${a.reacao}` : ''}</span>
                <span className="text-rotulo text-tinta-sussurro">{quando(a.registrado_em)}{a.autor ? ` · ${a.autor}` : ''}</span>
              </li>
            ))}
          </ul>
        )}
        {eventos.length > 0 && (
          <>
            <p className="mt-1 text-rotulo font-semibold text-tinta-sussurro">Eventos adversos</p>
            <ul className="flex flex-col gap-1.5">
              {eventos.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-2">
                  <Badge variant="warning">{e.evento}</Badge>
                  <span>{rotuloGrau(e.grau)}{e.item_descricao ? ` · ${e.item_descricao}` : ''}{e.observacao ? ` · ${e.observacao}` : ''}</span>
                  <span className="text-rotulo text-tinta-sussurro">{quando(e.registrado_em)}{e.autor ? ` · ${e.autor}` : ''}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  )
}
