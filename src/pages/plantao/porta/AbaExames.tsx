// Aba "Exames" (protótipo, "Pedido de exames"): pedido rápido no atendimento,
// sem imprimir — cada exame vira pendência do episódio (exames_pedidos), e
// "Resultado chegou" a resolve. Exame com resultado fica no registro. Os
// agravos de notificação moram aqui também: os dois impedem a alta.
import { useQuery } from '@tanstack/react-query'
import { FlaskConical, Megaphone, Printer } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'

import { ResultadoExame } from '@/components/clinico/ResultadoExame'
import { useUnidade } from '@/contexts/UnidadeContext'
import { botoesDeExame, codigoExameNaTela, jaPedido, type ExameBuscado, type ListaExamesUnidade, type Urgencia } from '@/lib/exames'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import { hora, type ExamePS } from './comum'

type Agravo = { id: string; agravo: string; cid: string | null; situacao: string; numero_sinan: string | null; motivo_descarte: string | null }

function LinhaExame({ e, aoMudar }: { e: ExamePS; aoMudar: () => void }) {
  const [texto, setTexto] = React.useState('')
  const [cancelando, setCancelando] = React.useState(false)
  const [erro, setErro] = React.useState<string | null>(null)
  const [aberto, setAberto] = React.useState(false)
  const pendente = e.situacao === 'pedido' || e.situacao === 'coletado' || e.situacao === 'em_analise' || e.situacao === 'realizado'
  const resolver = async (resultado?: string, motivo?: string) => {
    const { error } = await supabase.rpc('resolver_exame', { p_exame: e.id, p_resultado: resultado, p_motivo_cancelamento: motivo })
    if (error) return setErro(error.message)
    setErro(null); setTexto(''); setCancelando(false); aoMudar()
  }
  const tom = e.situacao === 'resultado' ? (e.critico ? 'bg-alerta-critico text-critico' : 'bg-alerta-conforme text-conforme') : e.situacao === 'cancelado' ? 'bg-trilha text-tinta-sussurro' : 'bg-alerta-atencao text-atencao'
  const sit = e.situacao === 'resultado' ? `Resultado ${hora(e.resolvido_em)}` : e.situacao === 'cancelado' ? `Cancelado ${hora(e.resolvido_em)}`
    : e.situacao === 'coletado' ? `Coletado ${hora(e.coletado_em ?? e.pedido_em)}` : e.situacao === 'em_analise' ? 'Em análise'
    : e.situacao === 'realizado' ? `Realizado ${hora(e.realizado_em ?? e.pedido_em)}` : `Pedido ${hora(e.pedido_em)}`
  return (
    <div className="flex flex-col gap-1.5 border-b border-trilha px-4 py-2.5 last:border-0">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="min-w-0 flex-[1_1_180px] text-controle text-tinta">
          {e.exame}
          {e.urgencia === 'urgente' && <Badge variant="destructive" className="ml-2">urgente</Badge>}
          {e.impresso && <span className="ml-2 text-rotulo text-tinta-sussurro">pedido impresso</span>}
          {!e.procedimento && <span className="ml-2 text-rotulo text-tinta-sussurro" title="Não vai ao laboratório integrado">sem código</span>}
          {e.observacao && <span className="block text-rotulo text-tinta-sussurro">Obs.: {e.observacao}</span>}
        </span>
        <span className={cn('rounded-capsula px-2.5 py-[3px] text-rotulo font-semibold whitespace-nowrap', tom)}>{sit}</span>
        {e.novo && <Badge variant={e.critico ? 'destructive' : 'info'}>{e.critico ? 'crítico · novo' : 'novo'}</Badge>}
        {!e.novo && e.critico && <Badge variant="destructive">crítico</Badge>}
        <Button size="xs" variant="ghost" onClick={() => setAberto(!aberto)}>{aberto ? 'Fechar' : e.situacao === 'resultado' ? 'Ver resultado' : 'Detalhe'}</Button>
        {pendente && (
          <>
            <Input className="h-8 w-56" aria-label={`Resultado de ${e.exame} (opcional)`} placeholder={cancelando ? 'Motivo do cancelamento (10 letras)' : 'Resultado (opcional)'}
              value={texto} onChange={(ev) => setTexto(ev.target.value)} />
            {cancelando ? (
              <>
                <Button size="xs" variant="outline" disabled={texto.trim().length < 10} onClick={() => void resolver(undefined, texto)}>Cancelar exame</Button>
                <Button size="xs" variant="ghost" onClick={() => { setCancelando(false); setTexto('') }}>Voltar</Button>
              </>
            ) : (
              <>
                <Button size="xs" onClick={() => void resolver(texto.trim() || 'Resultado disponível')}>Resultado chegou</Button>
                <Button size="xs" variant="ghost" onClick={() => setCancelando(true)}>Cancelar</Button>
              </>
            )}
          </>
        )}
      </div>
      {!pendente && !aberto && (e.resultado || e.motivo_cancelamento) && (
        <span className="text-rotulo text-tinta-sussurro">{e.situacao === 'resultado' ? e.resultado : `Motivo: ${e.motivo_cancelamento}`}</span>
      )}
      {aberto && <ResultadoExame exameId={e.id} aoMudar={aoMudar} />}
      {erro && <p className="text-apoio text-critico">{erro}</p>}
    </div>
  )
}

// Fase 5C, etapa 1.1: o pedido usa o catálogo da unidade (lista do gestor sobre o
// grupo 02.02 do SIGTAP). Os botões vêm da lista; sem lista, ficam os de antes.
// A busca acha no catálogo; o texto livre continua, sem código (não vai ao
// laboratório integrado). Urgência e observação valem para o que for pedido.
export function AbaExames({ episodioId, pacienteId, exames, aoMudar }: { episodioId: string; pacienteId: string; exames: ExamePS[]; aoMudar: () => void }) {
  const { unidadeAtiva } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  const [outro, setOutro] = React.useState('')
  const [urgencia, setUrgencia] = React.useState<Urgencia>('rotina')
  const [observacao, setObservacao] = React.useState('')
  const [erro, setErro] = React.useState<string | null>(null)
  const [pedindo, setPedindo] = React.useState(false)
  const lista = useQuery({
    queryKey: ['exames-unidade', unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('exames_da_unidade', { p_unidade: unidadeId! })
      if (error) throw error
      return data as unknown as ListaExamesUnidade
    },
  })
  const termo = outro.trim()
  const busca = useQuery({
    queryKey: ['buscar-exames', unidadeId, termo],
    enabled: !!unidadeId && termo.length >= 3,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('buscar_exames', { p_unidade: unidadeId!, p_termo: termo })
      if (error) throw error
      return (data ?? []) as unknown as ExameBuscado[]
    },
  })
  const pedir = async (itens: ({ procedimento: string } | { nome: string })[]) => {
    setPedindo(true)
    const { error } = await supabase.rpc('pedir_exames', {
      p_episodio: episodioId, p_itens: itens, p_urgencia: urgencia, p_observacao: observacao.trim() || undefined,
    })
    setPedindo(false)
    if (error) return setErro(error.message)
    setErro(null); setOutro(''); setObservacao(''); aoMudar()
  }
  const botoes = botoesDeExame(lista.data?.exames)
  const comLista = (lista.data?.exames ?? []).length > 0

  return (
    <div className="flex flex-col gap-4">
      <section className="overflow-hidden rounded-cartao border border-fio bg-superficie">
        <div className="flex flex-wrap items-center gap-2 border-b border-trilha px-4 py-3">
          <FlaskConical className="size-4 text-acao" aria-hidden />
          <span className="text-controle font-semibold text-tinta">Pedido de exames</span>
          <span className="text-apoio text-tinta-sussurro">Pedido rápido, sem imprimir. Fica pendente até o resultado.</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
          <span className="text-rotulo text-tinta-sussurro">Urgência</span>
          {(['rotina', 'urgente'] as const).map((u) => (
            <button key={u} type="button" aria-pressed={urgencia === u} onClick={() => setUrgencia(u)}
              className={cn('rounded-capsula border px-3 py-0.5 text-apoio',
                urgencia === u ? (u === 'urgente' ? 'border-critico bg-critico font-medium text-white' : 'border-acao bg-acao font-medium text-white') : 'border-fio text-tinta-apoio')}>
              {u}
            </button>
          ))}
          <Input className="h-8 min-w-48 flex-1" aria-label="Observação do pedido (opcional)" placeholder="Observação (opcional)" maxLength={300}
            value={observacao} onChange={(e) => setObservacao(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-1.5 px-4 py-3">
          {botoes.map((b) => {
            const on = jaPedido(b, exames)
            return (
              <button key={b.rotulo + (b.procedimento ?? '')} type="button" aria-pressed={on} disabled={on || pedindo}
                onClick={() => void pedir([b.procedimento ? { procedimento: b.procedimento } : { nome: b.rotulo }])}
                title={on ? 'Já pedido neste atendimento' : `Pedir ${b.rotulo}${b.procedimento ? '' : ' (sem código)'}`}
                className={cn('rounded-capsula border px-3 py-1 text-apoio transition-colors',
                  on ? 'border-acao bg-acao font-medium text-white' : 'border-fio bg-superficie text-tinta-apoio hover:border-acao hover:text-acao disabled:opacity-50')}>
                {b.rotulo}
              </button>
            )
          })}
        </div>
        <div className="flex flex-col gap-2 border-t border-trilha px-4 py-3">
          <div className="flex flex-wrap gap-2">
            <Input className="h-8 min-w-48 flex-1" aria-label="Buscar exame" placeholder={comLista ? 'Buscar na lista da unidade' : 'Buscar no SIGTAP (laboratório)'}
              value={outro} onChange={(e) => setOutro(e.target.value)} />
            <Button size="sm" variant="outline" disabled={termo.length < 2 || pedindo} onClick={() => void pedir([{ nome: termo }])}
              title="Sem código: não vai ao laboratório integrado">Pedir como texto livre</Button>
            <Button size="sm" variant="ghost" render={<Link to={`/plantao/atendimento-porta/pedido-exames?paciente=${pacienteId}`} />}>
              <Printer /> Pedido impresso
            </Button>
          </div>
          {(busca.data ?? []).length > 0 && (
            <div className="flex max-h-48 flex-col overflow-y-auto rounded-md border border-fio">
              {(busca.data ?? []).map((x) => (
                <Button key={x.procedimento} type="button" variant="ghost" size="sm" className="justify-start" disabled={pedindo}
                  onClick={() => void pedir([{ procedimento: x.procedimento }])}>
                  {x.nome}<span className="ml-1 text-rotulo text-tinta-sussurro">{codigoExameNaTela(x.procedimento)}</span>
                </Button>
              ))}
            </div>
          )}
          {termo.length >= 3 && busca.isSuccess && (busca.data ?? []).length === 0 && (
            <span className="text-rotulo text-tinta-sussurro">Nada no catálogo com esse nome. Pode pedir como texto livre (sem código).</span>
          )}
        </div>
        {erro && <p className="border-t border-trilha px-4 py-2 text-apoio text-critico">{erro}</p>}
        {exames.length === 0 && <p className="border-t border-trilha px-4 py-3 text-apoio text-tinta-sussurro">Nenhum exame pedido neste atendimento.</p>}
        {exames.length > 0 && <div className="border-t border-trilha">{exames.map((e) => <LinhaExame key={e.id} e={e} aoMudar={aoMudar} />)}</div>}
      </section>
      <Agravos pacienteId={pacienteId} episodioId={episodioId} />
    </div>
  )
}

function Agravos({ pacienteId, episodioId }: { pacienteId: string; episodioId: string }) {
  const [agravo, setAgravo] = React.useState('')
  const [cid, setCid] = React.useState('')
  const [erro, setErro] = React.useState<string | null>(null)
  const lista = useQuery({
    queryKey: ['agravos', pacienteId, episodioId],
    queryFn: async () => {
      const { data, error } = await supabase.from('agravos_notificacao').select('id, agravo, cid, situacao, numero_sinan, motivo_descarte')
        .eq('episodio_id', episodioId).order('suspeito_em', { ascending: false })
      if (error) throw error
      return (data ?? []) as Agravo[]
    },
  })
  const rpc = async (nome: 'marcar_agravo' | 'resolver_agravo', args: Record<string, unknown>) => {
    const { error } = await supabase.rpc(nome, args as never)
    if (error) { setErro(error.message); return false }
    setErro(null); void lista.refetch(); return true
  }
  return (
    <section className="flex flex-col gap-2 rounded-cartao border border-fio bg-superficie px-4 py-3">
      <div className="flex items-center gap-2">
        <Megaphone className="size-4 text-acao" aria-hidden />
        <span className="text-controle font-semibold text-tinta">Agravos de notificação</span>
      </div>
      {(lista.data ?? []).map((a) => <LinhaAgravo key={a.id} a={a}
        aoResolver={(notificado, numero, motivo) => rpc('resolver_agravo', { p_agravo: a.id, p_notificado: notificado, p_numero_sinan: numero, p_motivo_descarte: motivo })} />)}
      <div className="flex flex-wrap gap-2">
        <Input className="h-8 min-w-48 flex-1" placeholder="Agravo suspeito (ex.: dengue)" value={agravo} onChange={(e) => setAgravo(e.target.value)} />
        <Input className="h-8 w-24" placeholder="CID" value={cid} onChange={(e) => setCid(e.target.value)} />
        <Button size="sm" variant="outline" disabled={agravo.trim().length < 3}
          onClick={() => void rpc('marcar_agravo', { p_paciente: pacienteId, p_agravo: agravo, p_cid: cid || undefined }).then((ok) => { if (ok) { setAgravo(''); setCid('') } })}>
          Marcar suspeita
        </Button>
      </div>
      {erro && <p className="text-apoio text-critico">{erro}</p>}
      <p className="text-rotulo text-tinta-sussurro">Agravo suspeito impede a alta até a notificação ser registrada (o envio ao SINAN é fora do sistema) ou a suspeita ser descartada com motivo.</p>
    </section>
  )
}

function LinhaAgravo({ a, aoResolver }: { a: Agravo; aoResolver: (notificado: boolean, numero?: string, motivo?: string) => Promise<boolean> }) {
  const [texto, setTexto] = React.useState('')
  if (a.situacao !== 'suspeito') {
    return (
      <p className="text-apoio text-tinta-sussurro">
        {a.agravo}{a.cid ? ` (${a.cid})` : ''}: {a.situacao === 'notificado' ? `notificado${a.numero_sinan ? ` · SINAN ${a.numero_sinan}` : ''}` : `descartado — ${a.motivo_descarte}`}
      </p>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-container border border-critico/30 bg-alerta-critico px-3 py-2">
      <Badge variant="destructive">suspeito</Badge>
      <span className="font-medium">{a.agravo}{a.cid ? ` (${a.cid})` : ''}</span>
      <Input className="h-8 min-w-48 flex-1" placeholder="Nº da notificação (opcional) ou motivo do descarte" value={texto} onChange={(ev) => setTexto(ev.target.value)} />
      <Button size="xs" onClick={() => void aoResolver(true, texto || undefined)}>Notificação registrada</Button>
      <Button size="xs" variant="outline" disabled={texto.trim().length < 10} onClick={() => void aoResolver(false, undefined, texto)}>Descartar</Button>
    </div>
  )
}
