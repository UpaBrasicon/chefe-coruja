import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { AlertTriangle, ChevronDown, Eye, FileClock, Printer, RotateCw, ShieldCheck, ShieldQuestion } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'

import { TituloPagina, Trilha, Vazio } from '@/components/monitor/Pagina'
import { ativas, declaracaoVigente, negaVigente, rotuloGrau, rotuloGravidade, rotuloTipo, useAlergias } from '@/components/paciente/useAlergias'
import { HistoricoRegulacao } from '@/components/regulacao/HistoricoRegulacao'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MensagemErro } from '@/components/ui/mensagem-erro'
import { Carregando } from '@/components/ui/spinner'
import { useUnidade } from '@/contexts/UnidadeContext'
import { idadeLegivel } from '@/lib/cadastroPaciente'
import { classificarErro } from '@/lib/erros'
import { data, dataHora, dataPura } from '@/lib/formato'
import { abrirProntuario } from '@/lib/prontuario'
import { ancoraDoAno, anoCarregado, idCabecalho, juntarPaginas, montarLinhaTempo, type PaginaProntuario } from '@/lib/prontuarioLinhaTempo'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { CartaoAtendimento, ListaAtendimentos, SeparadorData } from './LinhaDoTempo'

// Prontuário completo (fase 6; redesenho do achado guardado, item 6: A em P1 a
// P7 e direção visual A do RT, 06/11/2026). Serve a quem tem pedido aprovado e
// vigente e a quem já tem acesso pela escala. Só leitura: não há botão de
// escrever, e o banco também não deixaria (o pedido não entra em
// pode_atuar_no_paciente). Abrir grava o acesso no servidor (abrir_prontuario)
// antes de qualquer leitura. Os cadastros unificados aparecem juntos: a
// leitura (prontuario_leitura) usa a mesma família de cadastros_do_paciente.
// Sinais vitais saem crus, sem marca de alterado: a análise é de quem lê.
// A impressão (ImpressaoProntuario.tsx) não mudou (P7).
//
// Polish (06/11/2026): a ficha é um painel só, com seções rotuladas, como na
// maquete; sem acesso tem estado próprio; falha de rede tem "Tentar de novo".

const POR_PAGINA = 5

const SEM_ACESSO = 'Sem acesso a este paciente'
const MOTIVO_SEM_ACESSO = 'O pedido pode ter vencido ou ainda não foi aprovado.'

/** O paciente não veio: o pedido venceu, não foi aprovado ou não existe. */
class SemAcesso extends Error {
  constructor() { super(`${SEM_ACESSO}. ${MOTIVO_SEM_ACESSO}`) }
}

const recusaDoServidor = (erro: unknown) => !!erro && typeof erro === 'object' && (erro as { code?: unknown }).code === 'P0001'

/**
 * Motivo para o estado "Sem acesso", ou null quando é falha de rede ou de
 * servidor (essa tem "Tentar de novo"). A recusa escrita pelo banco aparece como veio.
 */
function motivoSemAcesso(erro: unknown): string | null {
  if (erro instanceof SemAcesso) return MOTIVO_SEM_ACESSO
  if (!recusaDoServidor(erro)) return null
  const texto = classificarErro(erro, 'abrir o prontuário').texto
  const resto = texto.startsWith(SEM_ACESSO) ? texto.slice(SEM_ACESSO.length).replace(/^[.\s]+/, '') : texto
  return resto || MOTIVO_SEM_ACESSO
}

const SEXO: Record<string, string> = { F: 'feminino', M: 'masculino', I: 'sexo ignorado' }

export default function ProntuarioLeitura() {
  const { papelAtivo } = useUnidade()
  const { pacienteId } = useParams<{ pacienteId: string }>()
  const [fichaAberta, setFichaAberta] = useState(false)
  const [folga, setFolga] = useState(false)
  const idDetalhes = useId()

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
      if (!pac.data) throw new SemAcesso()
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
  const atendimentos = grupos.filter((g) => g.tipo === 'atendimento')

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = linha

  // foco e rolagem depois que a lista nova está na tela (efeito, não requestAnimationFrame:
  // aba em segundo plano não roda quadro)
  // cada pedido é um objeto novo; o ref marca o que já foi atendido (sem setState no efeito)
  const [alvo, setAlvo] = useState<{ id: string; rolar: boolean } | null>(null)
  const alvoAtendido = useRef<{ id: string; rolar: boolean } | null>(null)
  useEffect(() => {
    if (!alvo || alvoAtendido.current === alvo) return
    const el = document.getElementById(alvo.id)
    if (!el) return
    alvoAtendido.current = alvo
    el.focus({ preventScroll: alvo.rolar })
    if (alvo.rolar) el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
  }, [alvo, grupos])

  // "Ver mais": o foco vai para o primeiro atendimento que chegou
  async function verMais() {
    const vistos = atendimentos.length
    const r = await fetchNextPage()
    if (r.isError || !r.data) return
    const novo = montarLinhaTempo(juntarPaginas(r.data.pages)).grupos.filter((g) => g.tipo === 'atendimento')[vistos]
    if (novo) setAlvo({ id: idCabecalho(novo.chave), rolar: false })
  }

  // navegação por ano: carrega até o ano vir inteiro (aparece o ano anterior ou acaba a lista)
  const [buscandoAno, setBuscandoAno] = useState<number | null>(null)
  async function irParaAno(ano: number) {
    const chegadas = (paginas: PaginaProntuario[] | undefined) => (paginas ?? []).flatMap((p) => p.atendimentos.map((a) => a.chegada_em))
    let paginas = linha.data?.pages
    let mais = !!hasNextPage
    if (!anoCarregado(chegadas(paginas), ano, mais)) {
      setBuscandoAno(ano)
      try {
        while (!anoCarregado(chegadas(paginas), ano, mais)) {
          const r = await fetchNextPage()
          if (r.isError) break
          paginas = r.data?.pages
          mais = r.hasNextPage
        }
      } finally { setBuscandoAno(null) }
    }
    // espaço no fim para o ano mais antigo também subir ao topo
    setFolga(true)
    setAlvo({ id: ancoraDoAno(ano), rolar: true })
  }

  if (abertura.isLoading) return <Carregando rotulo="Abrindo o prontuário…" />
  if (abertura.error || !abertura.data) {
    const motivo = abertura.error ? motivoSemAcesso(abertura.error) : MOTIVO_SEM_ACESSO
    if (motivo != null) {
      // sem dado do paciente: estado próprio, a saída é voltar aos pedidos
      return (
        <div className="flex max-w-2xl flex-col items-start">
          <Trilha niveis={[{ rotulo: 'Prontuários', to: '/prontuarios' }, { rotulo: SEM_ACESSO }]} />
          <TituloPagina titulo={SEM_ACESSO} descricao={motivo} className="mb-base" />
          <Button nativeButton={false} render={<Link to="/prontuarios" />}>Voltar aos pedidos</Button>
        </div>
      )
    }
    return (
      <div className="flex max-w-2xl flex-col gap-3">
        <Trilha niveis={[{ rotulo: 'Prontuários', to: '/prontuarios' }, { rotulo: 'Prontuário' }]} />
        <MensagemErro erro={abertura.error} acao="abrir o prontuário" />
        <div className="flex flex-wrap gap-2">
          <Button disabled={abertura.isFetching} onClick={() => void abertura.refetch()}>
            <RotateCw aria-hidden className={cn(abertura.isFetching && 'animate-spin')} /> {abertura.isFetching ? 'Tentando…' : 'Tentar de novo'}
          </Button>
          <Button variant="outline" nativeButton={false} render={<Link to="/prontuarios" />}>Voltar aos pedidos</Button>
        </div>
      </div>
    )
  }
  const paciente = abertura.data
  const nome = paciente.nome_social ? `${paciente.nome_social} (${paciente.nome})` : paciente.nome
  const avulsos = grupos.filter((g) => g.tipo !== 'atendimento')
  const resumo = dados?.resumo
  // falha ao buscar mais: a lista já carregada fica
  const erroMais = dados && linha.isFetchNextPageError ? linha.error : null
  // no celular, alergia em detalhe, regulações e anos ficam num resumo recolhível
  const recolhe = !fichaAberta && 'max-lg:hidden'

  return (
    <div className="w-full max-w-6xl">
      <Trilha niveis={[{ rotulo: 'Prontuários', to: '/prontuarios' }, { rotulo: paciente.nome_social || paciente.nome }]} />
      <div className="grid items-start gap-secao lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        {/* ficha: um painel só (maquete A); no celular fica em cima, curta */}
        <aside
          aria-label="Ficha do paciente"
          className="flex flex-col rounded-cartao border border-fio bg-superficie shadow-repouso lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto"
        >
          <div className="flex flex-col gap-proximo px-secao pt-secao pb-base">
            <TituloPagina
              titulo={nome}
              className="mb-0"
              descricao={[
                paciente.data_nascimento ? `nasc. ${dataPura(paciente.data_nascimento)} · ${idadeLegivel(paciente.data_nascimento)}` : null,
                paciente.sexo ? SEXO[paciente.sexo] ?? paciente.sexo : null,
                paciente.prontuario ? 'prontuário ' + paciente.prontuario : null,
              ].filter(Boolean).join(' · ')}
            />
            <p className="flex items-center gap-1.5 text-rotulo text-tinta-sussurro">
              <Eye className="size-3.5 shrink-0" aria-hidden /> Somente leitura · este acesso fica registrado
            </p>
            {/* ponto 5: a impressão é do plantonista (rota dele), com o paciente escolhido */}
            {papelAtivo === 'plantonista' && (
              <Button variant="outline" size="sm" className="self-start" nativeButton={false} render={<Link to={`/impressao-prontuario?paciente=${paciente.id}`} />}>
                <Printer /> Imprimir prontuário
              </Button>
            )}
          </div>

          <Secao titulo="Números do prontuário" tituloOculto>
            <dl className="grid grid-cols-3 gap-2">
              <Numero rotulo="Atendimentos" valor={resumo ? String(resumo.atendimentos) : '…'} />
              <Numero rotulo="Internações" valor={resumo ? String(resumo.internacoes) : '…'} />
              <Numero rotulo="Último atendimento" valor={resumo ? (resumo.ultimo_em ? data(resumo.ultimo_em) : '—') : '…'} />
            </dl>
          </Secao>

          <Secao titulo="Alergias e eventos adversos">
            <AlergiasLeitura pacienteId={paciente.id} detalhe={recolhe} />
          </Secao>

          <div id={idDetalhes} className={cn('flex flex-col', recolhe)}>
            {/* Fase 4, tarefa 5: regulações do paciente na rede (médico e gestor) */}
            <HistoricoRegulacao
              pacienteId={paciente.id}
              secao={{ titulo: <RotuloSecao>Regulações</RotuloSecao>, className: 'border-t border-fio px-secao py-base' }}
            />

            {resumo && resumo.anos.length > 0 && (
              <Secao titulo="Navegar por ano" como="nav">
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
                {buscandoAno != null && <p role="status" className="mt-1.5 text-rotulo text-tinta-sussurro">Carregando {buscandoAno}…</p>}
              </Secao>
            )}
          </div>

          <div className="border-t border-fio px-secao py-justo lg:hidden">
            <Button variant="ghost" size="sm" className="-mx-2 w-[calc(100%+1rem)] justify-between" aria-expanded={fichaAberta} aria-controls={idDetalhes}
              onClick={() => setFichaAberta((v) => !v)}>
              {fichaAberta ? 'Recolher detalhes da ficha' : 'Detalhes da ficha: alergias, regulações e anos'}
              <ChevronDown aria-hidden className={cn('transition-transform duration-200', fichaAberta && 'rotate-180')} />
            </Button>
          </div>
        </aside>

        {/* linha do tempo: o mais recente no topo */}
        <section aria-label="Atendimentos" className="relative min-w-0">
          <div aria-hidden className="absolute inset-y-0 left-1/2 hidden border-l border-dashed border-fio-forte sm:block" />
          {!dados && linha.error ? (
            <Falha erro={linha.error} acao="carregar os atendimentos" tentando={linha.isFetching} tentar={() => void linha.refetch()} />
          ) : !dados ? <Carregando rotulo="Carregando os atendimentos…" /> : grupos.length === 0 ? (
            <div className="relative z-10">
              <Vazio icone={FileClock} titulo="Nenhum atendimento" texto="Nenhum atendimento ou registro deste paciente aparece para você." />
            </div>
          ) : (
            <div className="mx-auto flex max-w-3xl flex-col">
              <ListaAtendimentos grupos={atendimentos} />
              {hasNextPage ? (
                <Button variant="outline" size="sm" className="relative z-10 mx-auto mt-proximo rounded-capsula px-4"
                  disabled={isFetchingNextPage} onClick={() => void verMais()}>
                  {isFetchingNextPage ? 'Carregando…' : 'Ver mais atendimentos'}
                  {resumo && (
                    <span className="text-tinta-sussurro tabular">
                      {atendimentos.length} de {Math.max(resumo.atendimentos, atendimentos.length)}
                    </span>
                  )}
                </Button>
              ) : atendimentos.length > 0 && (
                <p className="relative z-10 mx-auto mt-secao w-max rounded-capsula border border-dashed border-fio-forte bg-superficie px-3 py-0.5 text-rotulo text-tinta-sussurro">
                  Primeiro atendimento registrado
                </p>
              )}
              {erroMais && (
                <Falha erro={erroMais} acao="carregar mais atendimentos" tentando={isFetchingNextPage} tentar={() => void verMais()} className="mt-2" />
              )}
              {/* registros sem atendimento ligado (ou de atendimento que não aparece para quem lê): no fim */}
              {avulsos.length > 0 && <SeparadorData>Registros fora dos atendimentos</SeparadorData>}
              {avulsos.map((g, i) => (
                <div key={g.chave} className={cn(i > 0 && 'mt-proximo')}>
                  <CartaoAtendimento grupo={g} inicialAberto={false} />
                </div>
              ))}
              {folga && <div aria-hidden className="h-[70dvh]" />}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

/** Rótulo de seção do painel da ficha (h2), como na maquete. */
function RotuloSecao({ children, id, className }: { children: ReactNode; id?: string; className?: string }) {
  // padrao-ok: rótulo de seção do painel da ficha (maquete A); TituloSecao tem 17 px e quebraria o painel de 340 px
  return <h2 id={id} className={cn('text-rotulo font-semibold tracking-[0.05em] text-tinta-sussurro uppercase', className)}>{children}</h2>
}

function Secao({ titulo, tituloOculto = false, como: Como = 'section', className, children }: {
  titulo: string; tituloOculto?: boolean; como?: 'section' | 'nav'; className?: string; children: ReactNode
}) {
  const id = useId()
  return (
    <Como aria-labelledby={id} className={cn('border-t border-fio px-secao py-base', className)}>
      <RotuloSecao id={id} className={tituloOculto ? 'sr-only' : 'mb-2'}>{titulo}</RotuloSecao>
      {children}
    </Como>
  )
}

/** Falha de rede ou de servidor: a mensagem e "Tentar de novo". A recusa escrita pelo banco não tem o botão. */
function Falha({ erro, acao, tentar, tentando, className }: {
  erro: unknown; acao: string; tentar: () => void; tentando: boolean; className?: string
}) {
  return (
    <div className={cn('relative z-10 flex flex-col items-start gap-2', className)}>
      {/* fundo opaco: a lavagem do erro é translúcida e o fio da linha do tempo passaria por trás */}
      <div className="self-stretch rounded-container bg-superficie"><MensagemErro erro={erro} acao={acao} /></div>
      {!recusaDoServidor(erro) && (
        <Button variant="outline" size="sm" disabled={tentando} onClick={tentar}>
          <RotateCw aria-hidden className={cn(tentando && 'animate-spin')} /> {tentando ? 'Tentando…' : 'Tentar de novo'}
        </Button>
      )}
    </div>
  )
}

function Numero({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    // o valor fica no pé: rótulo de duas linhas não desalinha os números
    <div className="flex flex-col justify-between">
      <dt className="text-rotulo text-tinta-sussurro">{rotulo}</dt>
      <dd className="text-corpo font-semibold text-tinta tabular">{valor}</dd>
    </div>
  )
}

const quando = (iso: string | null | undefined) => (iso ? dataHora(iso) : '')

/**
 * Alergias e eventos adversos, só leitura, numa forma só, com os estados do
 * resto do produto (tem / nega / não informada / não registrada): lista vazia
 * não é "nega". A leitura vem de alergias_do_paciente, que aceita o pedido de
 * acesso vigente. A alergia ativa fica sempre à vista; `detalhe` recolhe
 * reação, autor e eventos no celular.
 */
function AlergiasLeitura({ pacienteId, detalhe }: { pacienteId: string; detalhe?: string | false }) {
  const q = useAlergias(pacienteId)
  const lista = ativas(q.data)
  const eventos = (q.data?.eventos ?? []).filter((e) => !e.inativado_em)
  const estado = q.data?.estado
  const nega = negaVigente(q.data)
  const declarou = declaracaoVigente(q.data)

  if (q.isLoading) return <p className="text-apoio text-tinta-sussurro">Carregando alergias…</p>
  return (
    <div className="flex flex-col gap-2 text-apoio">
      {q.error || !q.data ? (
        // sem leitura não se afirma nada: nem "nega", nem "não registrada"
        <Situacao icone={<AlertTriangle />} tom="atencao">Alergia não verificada</Situacao>
      ) : estado === 'tem' && lista.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {lista.map((a) => (
            <li key={a.id}>
              <span className="inline-flex items-center gap-1.5 rounded-capsula border border-critico/30 bg-alerta-critico px-2.5 py-0.5 font-semibold text-critico">
                <AlertTriangle aria-hidden className="size-3.5 shrink-0" />
                {a.substancia} · {rotuloGravidade(a.gravidade).toLowerCase()}
              </span>
              <p className={cn('mt-1 text-tinta-apoio', detalhe)}>{rotuloTipo(a.tipo)}{a.reacao ? ` · ${a.reacao}` : ''}</p>
              <p className={cn('text-rotulo text-tinta-sussurro', detalhe)}>{quando(a.registrado_em)}{a.autor ? ` · ${a.autor}` : ''}</p>
            </li>
          ))}
        </ul>
      ) : estado === 'nega' ? (
        <Situacao icone={<ShieldCheck />} tom="neutro"
          sub={nega ? `registrado em ${quando(nega.registrado_em)}${nega.autor ? ` por ${nega.autor}` : ''}` : null}>
          Nega alergias
        </Situacao>
      ) : estado === 'desconhece' ? (
        <Situacao icone={<ShieldQuestion />} tom="atencao"
          sub={`Perguntou e não soube informar${declarou ? ` · ${quando(declarou.registrado_em)}${declarou.autor ? ` · ${declarou.autor}` : ''}` : ''}`}>
          Alergia não informada
        </Situacao>
      ) : estado === 'nao_registrada' || estado === 'tem' ? (
        <Situacao icone={<ShieldQuestion />} tom="atencao" sub="Ninguém registrou ainda se o paciente tem ou nega alergias.">
          Alergia não registrada
        </Situacao>
      ) : null}
      {eventos.length > 0 && (
        <div className={cn('mt-1', detalhe)}>
          <h3 className="mb-1 text-rotulo font-semibold text-tinta-apoio">Eventos adversos</h3>
          <ul className="flex flex-col gap-1.5">
            {eventos.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <Badge variant="warning">{e.evento}</Badge>
                <span>{rotuloGrau(e.grau)}{e.item_descricao ? ` · ${e.item_descricao}` : ''}{e.observacao ? ` · ${e.observacao}` : ''}</span>
                <span className="text-rotulo text-tinta-sussurro">{quando(e.registrado_em)}{e.autor ? ` · ${e.autor}` : ''}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function Situacao({ icone, tom, sub, children }: { icone: ReactNode; tom: 'atencao' | 'neutro'; sub?: string | null; children: ReactNode }) {
  return (
    <div>
      <p className={cn('flex items-center gap-1.5 [&_svg]:size-3.5 [&_svg]:shrink-0', tom === 'atencao' ? 'font-medium text-atencao' : 'text-tinta-apoio')}>
        <span aria-hidden className="contents">{icone}</span>
        {children}
      </p>
      {sub && <p className="text-rotulo text-tinta-sussurro">{sub}</p>}
    </div>
  )
}
