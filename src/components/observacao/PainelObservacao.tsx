// ─────────────────────────────────────────────────────────────────────────────
// Pacientes em Observação (porte do Bloco 3 do protótipo, index.html 3541–3723).
//
// Revisão da Observação aprovada pelo RT em 24/11/2026 (OB1–OB3):
// - "Setor: Observação" no topo; abas "Em observação" e "Finalizados" com a
//   contagem; o aviso de quem passou de 6 horas virou o filtro "Acima de 6 h · N".
// - Uma linha por paciente, sem rolagem lateral (CartaoObservacao), os
//   vencidos primeiro; a situação diz se aguarda exame ou regulação.
// - Clicar na linha abre o paciente em tela inteira com as mesmas abas do
//   leito da Internação, com "Voltar à observação" (?paciente= no endereço: o
//   voltar do navegador fecha). Na aba Alta e documentos, o desfecho da
//   observação (finalizar_observacao).
// O estado de cada box vem derivado do banco (painel_observacao); os relógios
// correm pelo relógio do servidor.
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Eye, Shield } from 'lucide-react'
import * as React from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'

import { supabase } from '@/lib/supabase'
import { mostraSecao, semDuplicar, type ObservacaoQueAbri } from '@/lib/observacoesQueAbri'
import { ordenarObservacao } from '@/lib/observacaoLista'
import { PENDENTE } from '@/lib/exames'
import { useAuth } from '@/contexts/AuthContext'
import { useUnidade } from '@/contexts/UnidadeContext'
import { LeitoAberto } from '@/components/internacao/LeitoAberto'
import { Chip, Chips, TituloPagina, Trilha } from '@/components/monitor/Pagina'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { CartaoObservacao } from './CartaoObservacao'
import { LinhaQueAbri } from './ObservacoesQueAbri'
import { PainelDesfecho } from './PaineisCartao'
import { duracao, msgErro, relogioPermanencia, type Acao, type LinhaObservacao } from './modelo'
import { EsqueletoLinhas } from '@/components/ui/esqueleto-linhas'

type Aba = 'ativas' | 'finalizadas'

/** Cabeçalho de grupo da lista única (M1 da revisão do médico): "Que abri" e "Do meu setor". */
function Grupo({ titulo, n }: { titulo: string; n: number }) {
  return (
    <div className="border-b border-trilha bg-campo py-2 pl-5 text-apoio font-semibold text-tinta">
      {titulo} <span className="font-normal text-tinta-sussurro tabular-nums">· {n}</span>
    </div>
  )
}

/** OB3: na aba Alta e documentos do paciente aberto, o desfecho da observação. */
function DesfechoNoLeito({ linha, unidadeId }: { linha: LinhaObservacao; unidadeId: string }) {
  const qc = useQueryClient()
  const [erro, setErro] = React.useState<string | null>(null)
  const [feito, setFeito] = React.useState(false)
  const acao: Acao = async (fn) => {
    try {
      await fn()
      setErro(null)
      for (const k of ['painel-observacao', 'pendencias', 'impeditivos', 'pacientes-internados', 'ocupacao-setores', 'pendencias-observacao', 'leito-aberto'])
        void qc.invalidateQueries({ queryKey: [k] })
      return true
    } catch (e) {
      setErro(msgErro(e))
      return false
    }
  }
  if (linha.estado === 'finalizado' || feito) return <p className="text-apoio text-tinta-sussurro">Observação encerrada.</p>
  return <PainelDesfecho linha={linha} unidadeId={unidadeId} acao={acao} fechar={() => setFeito(true)} erro={erro} />
}

export function PainelObservacao({ embutido = false }: { embutido?: boolean }) {
  const { unidadeAtiva, papelAtivo } = useUnidade()
  const { perfil } = useAuth()
  const unidadeId = unidadeAtiva?.unidade_id
  const ehGestor = papelAtivo === 'gestor' || papelAtivo === 'admin'

  const [aba, setAba] = React.useState<Aba>('ativas')
  const [soAcima, setSoAcima] = React.useState(false)

  // OB3: o paciente aberto mora no endereço; o voltar do navegador fecha
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const abertoId = params.get('paciente')
  const abrirPaciente = (l: { paciente_id: string }) => {
    setParams((q) => {
      const n = new URLSearchParams(q)
      n.set('paciente', l.paciente_id)
      n.delete('aba')
      return n
    }, { state: { pacienteAberto: true } })
    window.scrollTo({ top: 0 })
  }
  const fecharPaciente = () => {
    if ((location.state as { pacienteAberto?: boolean } | null)?.pacienteAberto) { navigate(-1); return }
    setParams((q) => {
      const n = new URLSearchParams(q)
      n.delete('paciente')
      n.delete('aba')
      return n
    }, { replace: true })
  }

  const painel = useQuery({
    queryKey: ['painel-observacao', unidadeId],
    enabled: !!unidadeId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('painel_observacao', { p_unidade: unidadeId! })
      if (error) throw error
      return (data ?? []) as unknown as LinhaObservacao[]
    },
  })

  // Relógio do servidor: a diferença para o do aparelho, e um tique a cada 30 s.
  const { data: desvio } = useQuery({
    queryKey: ['hora-servidor-desvio'],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const antes = Date.now()
      const { data, error } = await supabase.rpc('horario_servidor')
      if (error) throw error
      return Date.parse(data as string) - (antes + Date.now()) / 2
    },
  })
  const [tique, setTique] = React.useState(() => Date.now())
  React.useEffect(() => {
    const t = window.setInterval(() => setTique(Date.now()), 30_000)
    return () => window.clearInterval(t)
  }, [])
  const agora = tique + (desvio ?? 0)

  const linhas = React.useMemo(() => painel.data ?? [], [painel.data])
  const ativas = ordenarObservacao(linhas.filter((l) => l.estado !== 'finalizado'), agora)

  // OB1: "Aguardando exame" — exames do paciente ainda sem resultado (uma leitura para a lista)
  const ids = ativas.map((l) => l.paciente_id)
  const examesPendentes = useQuery({
    queryKey: ['observacao-exames-pendentes', [...ids].sort().join(',')],
    enabled: ids.length > 0,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('exames_pedidos').select('paciente_id').in('paciente_id', ids).in('situacao', PENDENTE)
      if (error) throw error
      return new Set((data ?? []).map((x) => x.paciente_id as string))
    },
  })

  // médico da porta: as observações que ele abriu (RT, 06/11/2026). M1 da revisão do médico (RT, 24/11/2026):
  // entram na mesma lista, no grupo "Que abri", e a contagem da aba soma os dois grupos
  const ehMedico = mostraSecao(papelAtivo)
  const queAbri = useQuery({
    queryKey: ['observacoes-que-abri', unidadeId],
    enabled: !!unidadeId && ehMedico,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('observacoes_que_abri', { p_unidade: unidadeId! })
      // função ausente (banco sem a 20270305000002 ou rollback): o grupo some
      if (error?.code === 'PGRST202') return []
      if (error) throw error
      return (data ?? []) as unknown as ObservacaoQueAbri[]
    },
  })
  const minhas = ehMedico ? ordenarObservacao(semDuplicar(queAbri.data ?? [], linhas.map((l) => l.internacao_id)), agora) : []
  const acimaDe6 = (x: { entrada: string; prazo: string }) => relogioPermanencia(x.entrada, x.prazo, agora).acima
  const acima = [...ativas, ...minhas].filter(acimaDe6)
  const maior = [...ativas, ...minhas].reduce((m, l) => Math.max(m, relogioPermanencia(l.entrada, l.prazo, agora).decorridoMin), 0)
  const emObservacao = ativas.length + minhas.length
  const setores = [...new Set(linhas.map((l) => l.setor_nome))].join(', ')
  const finalizadas = linhas.filter((l) => l.estado === 'finalizado')

  // OB3: o paciente aberto em tela inteira
  const abertoLinha = abertoId ? linhas.find((l) => l.paciente_id === abertoId) : undefined
  const abertoQueAbri = abertoId && !abertoLinha ? (queAbri.data ?? []).find((o) => o.paciente_id === abertoId) : undefined
  if (abertoId && (abertoLinha || abertoQueAbri)) {
    const nome = abertoLinha?.nome ?? abertoQueAbri?.nome ?? ''
    const box = abertoLinha?.box ?? abertoQueAbri?.box ?? null
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" onClick={fecharPaciente}><ArrowLeft aria-hidden /> Voltar à observação</Button>
          <span className="text-apoio text-tinta-sussurro">{box ? `${box} · ` : ''}{nome}</span>
        </div>
        <LeitoAberto modo="caderno" pacienteId={abertoId} pacienteNome={nome} ehGestor={ehGestor} abaInicial={params.get('aba') ?? undefined}
          conteudoAlta={abertoLinha && unidadeId && !ehGestor ? <DesfechoNoLeito linha={abertoLinha} unidadeId={unidadeId} /> : undefined} />
      </div>
    )
  }

  const lista = (itens: LinhaObservacao[], vazio: string, queAbriLista: ObservacaoQueAbri[] = []) => {
    const vis = soAcima ? itens.filter(acimaDe6) : itens
    const visMinhas = soAcima ? queAbriLista.filter(acimaDe6) : queAbriLista
    return (
      <section aria-label="Pacientes em observação" className="overflow-hidden rounded-cartao border border-fio bg-superficie">
        {vis.length === 0 && visMinhas.length === 0 ? (
          <p className="px-5 py-5 text-controle text-tinta-sussurro">{soAcima ? 'Ninguém acima de 6 horas.' : vazio}</p>
        ) : (
          <>
            {visMinhas.length > 0 && (
              <>
                <Grupo titulo="Que abri" n={visMinhas.length} />
                {visMinhas.map((o) => <LinhaQueAbri key={o.internacao_id} o={o} agora={agora} unidadeId={unidadeId!} />)}
                <Grupo titulo="Do meu setor" n={vis.length} />
                {vis.length === 0 && <p className="px-5 py-3 text-apoio text-tinta-sussurro">Ninguém em observação nos setores da sua escala agora.</p>}
              </>
            )}
            {vis.map((l) => (
              <CartaoObservacao key={l.internacao_id} linha={l} agora={agora} eu={perfil?.id} unidadeId={unidadeId!}
                podeAgir={!ehGestor} ehMedico={papelAtivo === 'plantonista'} examePendente={examesPendentes.data?.has(l.paciente_id)}
                onAbrirPaciente={abrirPaciente} />
            ))}
          </>
        )}
      </section>
    )
  }

  const corpo = !unidadeId ? (
    <p className="text-apoio text-tinta-sussurro">Escolha a unidade.</p>
  ) : painel.isLoading ? (
    <EsqueletoLinhas linhas={4} rotulo="Carregando a observação…" />
  ) : painel.error ? (
    <p className="rounded-container border border-critico/30 bg-alerta-critico px-4 py-3 text-apoio text-critico">{msgErro(painel.error)}</p>
  ) : (
    <div className="flex flex-col gap-3">
      {/* OB2: o setor no topo (antes, o texto do pé) */}
      <p className="flex items-center gap-[7px] text-apoio text-tinta-sussurro">
        <Shield className="size-3.5 shrink-0" aria-hidden />
        Setor: {setores || 'os da sua escala agora'}
        {ehGestor ? ' · com o que terminou nas últimas 12 horas' : ' · com o que terminou neste plantão'}
      </p>
      {queAbri.error && <p className="rounded-container border border-critico/30 bg-alerta-critico px-4 py-3 text-apoio text-critico">{msgErro(queAbri.error)}</p>}

      <Tabs value={aba} onValueChange={(v) => setAba(v as Aba)} className="gap-3">
        <div className="flex flex-wrap items-end gap-x-4 gap-y-1 border-b border-fio">
          <TabsList aria-label="Observação" className="w-auto max-w-full flex-[1_0_auto] gap-5 border-b-0">
            <TabsTrigger value="ativas">Em observação <span className="text-rotulo font-semibold text-acao tabular-nums">{emObservacao}</span></TabsTrigger>
            <TabsTrigger value="finalizadas">
              {ehGestor ? 'Finalizados em 12 horas' : 'Finalizados no plantão'} <span className="text-rotulo font-semibold text-acao tabular-nums">{finalizadas.length}</span>
            </TabsTrigger>
          </TabsList>
          <span className="pb-2.5 text-apoio text-tinta-sussurro">
            {emObservacao > 0 ? `maior permanência ${duracao(maior)}` : 'ninguém em observação agora'}
          </span>
        </div>

        {/* OB2: o aviso âmbar virou o contador no filtro */}
        <Chips rotulo="Filtrar a observação">
          <Chip ativo={!soAcima} onClick={() => setSoAcima(false)}>Todos</Chip>
          <Chip ativo={soAcima} tom={acima.length ? 'critico' : 'acao'} onClick={() => setSoAcima(true)}>Acima de 6 h · {acima.length}</Chip>
        </Chips>

        <TabsContent value="ativas">{lista(ativas, 'Nenhum paciente em observação agora.', minhas)}</TabsContent>
        <TabsContent value="finalizadas">{lista(finalizadas, ehGestor ? 'Nada terminou nas últimas 12 horas.' : 'Nada terminou neste plantão.')}</TabsContent>
      </Tabs>
    </div>
  )

  return (
    <div className="flex flex-col">
      {!embutido && (
        <>
          <Trilha niveis={[{ rotulo: 'Início', to: '/' }, { rotulo: 'Observação' }]} />
          <TituloPagina icone={Eye} titulo="Pacientes em observação" descricao="Permanência máxima de 6 horas: aviso de quem passou do prazo." />
        </>
      )}
      {corpo}
    </div>
  )
}
