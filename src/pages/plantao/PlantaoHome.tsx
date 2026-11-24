import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Activity, BedDouble, Hourglass, MapPin, RotateCw } from 'lucide-react'

import { useAuth } from '@/contexts/AuthContext'
import { useUnidade } from '@/contexts/UnidadeContext'
import { useFaixaPlantonista } from '@/hooks/useFaixaPlantonista'
import { supabase } from '@/lib/supabase'
import { formatarDuracao, nivelDaObservacao } from '@/domain/plantao'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { TituloPagina, TituloSecao } from '@/components/monitor/Pagina'
import { Button } from '@/components/ui/button'
import { MensagemErro } from '@/components/ui/mensagem-erro'
import { BotaoLinha } from '@/components/ui/botao-linha'
import { Skeleton } from '@/components/ui/skeleton'
import { EsqueletoLinhas } from '@/components/ui/esqueleto-linhas'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AbasPlantao } from '@/components/plantao/AbasPlantao'
import { dataHora, hora as horaFmt } from '@/lib/formato'

// Plantão (design_handoff/telas/02): sem faixa — ela é só da página inicial.
// Revisão do médico (RT, 24/11/2026): M1 o quadro do meu turno (pacientes por
// setor e pendências) e as seções como abas; M2 os números contam pacientes;
// M3 o estado do check-in conversa com a escala de agora.

const hora = (iso: string | null) => (iso ? horaFmt(iso) : null)
// tolerância para o check-in feito um pouco antes do início do plantão
const ANTES_DO_INICIO_MS = 2 * 3600_000

function CartaoResumo({ icone: Icone, rotulo, valor, detalhe, cor, carregando, onClick }: {
  icone: typeof BedDouble; rotulo: string; valor: string; detalhe: string; cor: string; carregando: boolean; onClick: () => void
}) {
  // Nenhum número de risco sem caminho: o cartão inteiro é o link.
  return (
    <BotaoLinha onClick={onClick} className="block px-4 py-3 shadow-repouso transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:bg-superficie hover:shadow-halo">
      <span className={cn('rotulo flex items-center gap-1.5', cor)}>
        <Icone className="size-3" aria-hidden />
        {rotulo}
      </span>
      {carregando ? (
        // Pedido 1 do desempenho: enquanto a faixa carrega, faixas cinza no lugar do número e do texto.
        <span className="block">
          <span className="sr-only">Carregando…</span>
          <Skeleton className="mt-1.5 h-[30px] w-16" />
          <Skeleton className="mt-1 h-3.5 w-2/3" />
        </span>
      ) : (
        <>
          <span className="mt-1.5 block text-numeral-ok leading-none font-semibold tracking-[-0.03em] text-ok tabular">{valor}</span>
          <span className="mt-1 block text-rotulo text-tinta-apoio">{detalhe}</span>
        </>
      )}
    </BotaoLinha>
  )
}

type LinhaQuadro = {
  setorId: string
  nome: string
  porta: boolean
  observacao: boolean
  /** porta: aguardando e em atendimento; outros setores: pacientes no setor */
  aguardando: number
  emAtendimento: number
  pacientes: number
  pendencias: number
  vencidas: number
}

const PORTA = ['emergencia', 'consultorio']

/** M1: pacientes por setor da escala de agora e as pendências abertas de cada setor. */
function useQuadroDoTurno(setores: string[] | undefined) {
  return useQuery({
    queryKey: ['quadro-do-turno', setores],
    enabled: !!setores && setores.length > 0,
    refetchInterval: 60_000,
    queryFn: async (): Promise<LinhaQuadro[]> => {
      const ids = setores!
      const [s, p, e] = await Promise.all([
        supabase.from('setores').select('id, nome, tipo, ordem').in('id', ids),
        supabase.from('pacientes').select('id, setor_id').eq('ativo', true).in('setor_id', ids),
        supabase.from('episodios').select('id, setor_id, atendimento_iniciado_em').eq('etapa', 'atendimento').in('setor_id', ids),
      ])
      for (const r of [s, p, e]) if (r.error) throw r.error
      const pacientes = p.data ?? []
      const idsPac = pacientes.map((x) => x.id)
      const pend = idsPac.length
        ? await supabase.from('pendencias').select('paciente_id, prazo').eq('situacao', 'aberta').in('paciente_id', idsPac)
        : { data: [] as { paciente_id: string; prazo: string | null }[], error: null }
      if (pend.error) throw pend.error
      const setorDoPaciente = new Map(pacientes.map((x) => [x.id, x.setor_id]))
      const agora = Date.now()
      return [...(s.data ?? [])]
        .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0) || a.nome.localeCompare(b.nome, 'pt-BR'))
        .map((st) => {
          const doSetor = (pend.data ?? []).filter((x) => setorDoPaciente.get(x.paciente_id) === st.id)
          const eps = (e.data ?? []).filter((x) => x.setor_id === st.id)
          return {
            setorId: st.id,
            nome: st.nome,
            porta: PORTA.includes(st.tipo),
            observacao: st.tipo === 'observacao',
            aguardando: eps.filter((x) => !x.atendimento_iniciado_em).length,
            emAtendimento: eps.filter((x) => x.atendimento_iniciado_em).length,
            pacientes: pacientes.filter((x) => x.setor_id === st.id).length,
            pendencias: doSetor.length,
            vencidas: doSetor.filter((x) => x.prazo && Date.parse(x.prazo) < agora).length,
          }
        })
    },
  })
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

export default function PlantaoHome() {
  const navigate = useNavigate()
  const { perfil } = useAuth()
  const { unidadeAtiva } = useUnidade()
  const faixa = useFaixaPlantonista(unidadeAtiva?.unidade_id)

  const {
    data: presenca,
    isLoading: carregandoPresenca,
    isError: erroPresenca,
    error: falhaPresenca,
    isFetching: lendoPresenca,
    refetch: lerPresencaDeNovo,
  } = useQuery({
    queryKey: ['plantao-presenca', unidadeAtiva?.unidade_id, perfil?.id],
    enabled: !!unidadeAtiva?.unidade_id && !!perfil,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('presenca_plantonista')
        .select('checkin_em, checkout_em, checkin_dentro')
        .eq('unidade_id', unidadeAtiva!.unidade_id)
        .eq('perfil_id', perfil!.id)
        .order('checkin_em', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })

  const d = faixa.data
  const quadro = useQuadroDoTurno(d?.setores)
  const obs = d?.maiorObservacaoMin ?? null

  // M3: o selo do check-in conversa com a escala de agora. Check-in aberto = em plantão; com plantão
  // na escala agora, o check-in (ou o check-out) é deste plantão; sem plantão agora, não há "pendente".
  const emPlantao = !!presenca?.checkin_em && !presenca.checkout_em
  const janela = d?.janela ?? null
  const desteplantao = !!presenca?.checkin_em && !!janela && Date.parse(presenca.checkin_em) >= janela.inicio.getTime() - ANTES_DO_INICIO_MS
  const encerradoAgora = !emPlantao && desteplantao && !!presenca?.checkout_em
  const carregandoEstado = carregandoPresenca || faixa.isLoading

  // M2: os números contam pacientes. Na porta, quem aguarda e quem está em atendimento; nos outros setores, os pacientes do setor
  const linhas = quadro.data ?? []
  const sobCuidado = linhas.reduce((t, l) => t + (l.porta ? l.aguardando + l.emAtendimento : l.pacientes), 0)
  const pendencias = linhas.reduce((t, l) => t + l.pendencias, 0)
  const semSetor = !!d && d.setores.length === 0

  const irDoSetor = (l: LinhaQuadro) => navigate(l.porta ? '/atendimento' : l.observacao ? '/plantao/observacao' : '/plantao/internacao')

  return (
    <>
      <TituloPagina icone={Activity} titulo="Plantão" descricao="O seu turno: pacientes por setor, pendências e o caminho para cada seção." />
      <AbasPlantao />

      <section aria-label="Meu plantão" className="mb-[22px] flex flex-wrap items-center gap-x-5 gap-y-2 rounded-container border border-fio bg-superficie px-4 py-3">
        <span className="rotulo flex items-center gap-1.5 text-turno"><MapPin className="size-3" aria-hidden />Meu plantão</span>
        {carregandoEstado ? (
          // Pedido 1 do desempenho: o selo, os horários e o botão só depois de o banco responder.
          <span role="status" className="flex flex-1 items-center gap-x-5">
            <span className="sr-only">Carregando o check-in…</span>
            <Skeleton className="h-[22px] w-28 rounded-capsula" />
            <Skeleton className="h-3.5 w-48" />
            <Skeleton className="ml-auto h-4 w-24" />
          </span>
        ) : erroPresenca ? (
          // Item 34 do BACKLOG (pergunta do #1103): se a leitura falhou, a pessoa não sabe se já
          // fez o check-in. Nada de selo de pendente nem de botão de check-in: o aviso e "Tentar de novo".
          <>
            <MensagemErro formato="linha" erro={falhaPresenca} acao="ler o seu check-in" className="mt-0 text-apoio" />
            <Button variant="link" size="sm" disabled={lendoPresenca} onClick={() => void lerPresencaDeNovo()} className="ml-auto px-0 font-medium">
              <RotateCw aria-hidden className={cn(lendoPresenca && 'animate-spin')} /> {lendoPresenca ? 'Tentando…' : 'Tentar de novo'}
            </Button>
          </>
        ) : (
          <>
            {emPlantao ? (
              <Badge variant="success">Em plantão</Badge>
            ) : encerradoAgora ? (
              <Badge variant="secondary">Plantão encerrado</Badge>
            ) : janela ? (
              <Badge variant="warning">Check-in pendente</Badge>
            ) : (
              <Badge variant="secondary">Sem plantão agora</Badge>
            )}
            <span className="text-apoio text-tinta-apoio tabular-nums">
              {emPlantao
                ? <>Check-in às {hora(presenca!.checkin_em)}{presenca!.checkin_dentro === false && ' · fora do raio'}</>
                : encerradoAgora
                  ? <>Check-in às {hora(presenca!.checkin_em)} · check-out às {hora(presenca!.checkout_em)}</>
                  : janela
                    ? <>Plantão de {hora(janela.inicio.toISOString())} às {hora(janela.fim.toISOString())} na sua escala</>
                    : presenca?.checkout_em
                      ? <>Nenhum plantão na sua escala agora · último check-out em {dataHora(presenca.checkout_em)}</>
                      : <>Nenhum plantão na sua escala agora</>}
            </span>
            <Button variant="link" size="sm" onClick={() => navigate('/plantao/check-in')} className="ml-auto px-0 font-medium">
              {emPlantao ? 'Fazer check-out' : janela && !encerradoAgora ? 'Fazer check-in' : 'Ver check-in e check-out'}
            </Button>
          </>
        )}
      </section>

      <div className="mb-[22px] grid gap-3 sm:grid-cols-2">
        <CartaoResumo
          icone={BedDouble}
          rotulo="Pacientes sob cuidado"
          valor={semSetor ? '0' : quadro.data ? String(sobCuidado) : '—'}
          detalhe={semSetor ? 'Sem setor na escala agora' : pendencias > 0 ? `${plural(pendencias, 'pendência aberta', 'pendências abertas')} nos setores da sua escala` : 'nos setores da sua escala agora'}
          cor="text-leitos"
          carregando={faixa.isLoading || quadro.isLoading}
          onClick={() => navigate('/plantao/internacao/pacientes')}
        />
        <CartaoResumo
          icone={Hourglass}
          rotulo="Em observação"
          valor={d ? String(d.emObservacao) : '—'}
          detalhe={obs === null ? 'Ninguém em observação no seu acesso' : `maior permanência ${formatarDuracao(obs)}${nivelDaObservacao(obs) === 'critico' ? ' · acima de 6 h' : ''}`}
          cor="text-observacao"
          carregando={faixa.isLoading}
          onClick={() => navigate('/plantao/observacao')}
        />
      </div>

      <TituloSecao extra={d?.setores.length ? plural(d.setores.length, 'setor', 'setores') : undefined}>Quadro do meu turno</TituloSecao>
      <section aria-label="Quadro do meu turno" className="overflow-hidden rounded-cartao border border-fio bg-superficie">
        {faixa.isLoading || quadro.isLoading ? (
          <EsqueletoLinhas linhas={3} rotulo="Carregando o quadro do turno…" />
        ) : semSetor ? (
          <p className="px-5 py-5 text-apoio text-tinta-sussurro">Você não está na escala de nenhum setor agora. O quadro aparece durante o seu plantão.</p>
        ) : quadro.error ? (
          <MensagemErro formato="linha" erro={quadro.error} acao="ler o quadro do turno" className="mx-5 my-4" />
        ) : (
          <Table aria-label="Pacientes por setor">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5">Setor</TableHead>
                <TableHead>Pacientes</TableHead>
                <TableHead>Pendências</TableHead>
                <TableHead className="pr-5 text-right"><span className="sr-only">Abrir</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((l) => (
                <TableRow key={l.setorId} onClick={() => irDoSetor(l)}>
                  <TableCell className="pl-5 font-medium text-tinta">{l.nome}</TableCell>
                  <TableCell className="tabular-nums text-tinta-apoio">
                    {l.porta
                      ? `${l.aguardando} aguardando · ${l.emAtendimento} em atendimento`
                      : plural(l.pacientes, 'paciente', 'pacientes')}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {l.porta ? <span className="text-tinta-sussurro">—</span>
                      : l.pendencias === 0 ? <span className="text-tinta-sussurro">Nenhuma</span>
                        : (
                          <span className={cn(l.vencidas ? 'font-semibold text-critico' : 'text-atencao')}>
                            {plural(l.pendencias, 'aberta', 'abertas')}{l.vencidas ? ` · ${plural(l.vencidas, 'vencida', 'vencidas')}` : ''}
                          </span>
                        )}
                  </TableCell>
                  <TableCell className="pr-5 text-right">
                    <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); irDoSetor(l) }}>
                      {l.porta ? 'Abrir a fila' : l.observacao ? 'Abrir a observação' : 'Abrir os leitos'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </>
  )
}
