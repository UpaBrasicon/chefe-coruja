// Exames pedidos e agravos de notificação (Fase 4.7) — no leito e na porta.
// Exame pedido sai da pendência com resultado ou cancelado com motivo; agravo
// suspeito, com a notificação registrada ou descartado com motivo. Os dois
// impedem a alta enquanto abertos.
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, FlaskConical, Megaphone } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'

import { LaudoDoGrupo } from '@/components/clinico/LaudoDoGrupo'
import { ResultadoExame } from '@/components/clinico/ResultadoExame'
import { PENDENTE, SITUACAO_EXAME, type SituacaoExame } from '@/lib/exames'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { dataHora } from '@/lib/formato'
import { agruparExames, atrasado, idadePedido, type GrupoExameLinha } from '@/lib/examesLeito'
import { useAgora } from '@/hooks/useAgora'

type Exame = {
  id: string; exame: string; situacao: string; resultado: string | null; motivo_cancelamento: string | null; pedido_em: string
  // Fase 5C, etapa 1.1: código do catálogo (null = texto livre) e urgência
  procedimento: string | null; urgencia: string
  // etapa 1.2: situações novas, crítico do laboratório e "novo" até alguém abrir
  critico: boolean; resultado_visto_em: string | null
}
type Agravo = { id: string; agravo: string; cid: string | null; situacao: string; numero_sinan: string | null; motivo_descarte: string | null }

const hora = dataHora

export function ExamesEAgravos({ pacienteId, medico }: { pacienteId: string; medico: boolean }) {
  const qc = useQueryClient()
  const [erro, setErro] = React.useState<string | null>(null)
  const exames = useQuery({
    queryKey: ['exames-pedidos', pacienteId],
    queryFn: async () => {
      const { data, error } = await supabase.from('exames_pedidos').select('id, exame, situacao, resultado, motivo_cancelamento, pedido_em, procedimento, urgencia, critico, resultado_visto_em')
        .eq('paciente_id', pacienteId).order('pedido_em', { ascending: false }).limit(40)
      if (error) throw error
      return (data ?? []) as Exame[]
    },
  })
  const agravos = useQuery({
    queryKey: ['agravos', pacienteId],
    queryFn: async () => {
      const { data, error } = await supabase.from('agravos_notificacao').select('id, agravo, cid, situacao, numero_sinan, motivo_descarte')
        .eq('paciente_id', pacienteId).order('suspeito_em', { ascending: false })
      if (error) throw error
      return (data ?? []) as Agravo[]
    },
  })
  const recarregar = () => {
    for (const k of ['exames-pedidos', 'agravos', 'impeditivos']) void qc.invalidateQueries({ queryKey: [k] })
  }
  const rpc = async (nome: 'resolver_exame' | 'marcar_agravo' | 'resolver_agravo', args: Record<string, unknown>) => {
    const { error } = await supabase.rpc(nome, args as never)
    if (error) { setErro(error.message); return false }
    setErro(null); recarregar(); return true
  }
  const pendentes = (exames.data ?? []).filter((e) => PENDENTE.includes(e.situacao as SituacaoExame))
  const resolvidos = (exames.data ?? []).filter((e) => !PENDENTE.includes(e.situacao as SituacaoExame))

  return (
    <div className="flex flex-col gap-4 text-apoio">
      {erro && <p className="rounded-controle border border-critico/30 bg-alerta-critico p-2 text-critico">{erro}</p>}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1.5 text-rotulo font-semibold text-tinta-sussurro">
          <FlaskConical className="size-3.5" /> Exames pedidos
        </div>
        {pendentes.length === 0 && <p className="text-tinta-sussurro">Nenhum exame aguardando resultado. (Os exames entram quando o pedido é impresso.)</p>}
        {pendentes.map((e) => <LinhaExame key={e.id} e={e} aoMudar={recarregar} aoResolver={(r, m) => rpc('resolver_exame', { p_exame: e.id, p_resultado: r, p_motivo_cancelamento: m })} />)}
        {pendentes.length > 1 && <LaudoDoGrupo pacienteId={pacienteId} aoMudar={recarregar} pendentes={pendentes.map((e) => e.id).join(',')} />}
        {/* resultado novo (ainda não aberto) fica fora do recolhido */}
        {resolvidos.filter((e) => e.situacao === 'resultado' && !e.resultado_visto_em).map((e) => <LinhaResolvido key={e.id} e={e} aoMudar={recarregar} />)}
        {resolvidos.some((e) => e.situacao !== 'resultado' || e.resultado_visto_em) && (
          <details className="text-rotulo text-tinta-sussurro">
            <summary className="cursor-pointer">Resolvidos ({resolvidos.filter((e) => e.situacao !== 'resultado' || e.resultado_visto_em).length})</summary>
            <div className="mt-1 flex flex-col gap-1">
              {resolvidos.filter((e) => e.situacao !== 'resultado' || e.resultado_visto_em).map((e) => <LinhaResolvido key={e.id} e={e} aoMudar={recarregar} />)}
            </div>
          </details>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1.5 text-rotulo font-semibold text-tinta-sussurro">
          <Megaphone className="size-3.5" /> Agravos de notificação
        </div>
        {(agravos.data ?? []).map((a) => <LinhaAgravo key={a.id} a={a}
          aoResolver={(notificado, numero, motivo) => rpc('resolver_agravo', { p_agravo: a.id, p_notificado: notificado, p_numero_sinan: numero, p_motivo_descarte: motivo })} />)}
        {medico && <MarcarAgravo aoMarcar={(agravo, cid) => rpc('marcar_agravo', { p_paciente: pacienteId, p_agravo: agravo, p_cid: cid || undefined })} />}
        <p className="text-rotulo text-tinta-sussurro">Agravo suspeito impede a alta até a notificação ser registrada (o envio ao SINAN é fora do sistema) ou a suspeita ser descartada com motivo.</p>
      </div>
    </div>
  )
}

function LinhaExame({ e, aoResolver, aoMudar }: { e: Exame; aoResolver: (resultado?: string, motivo?: string) => Promise<boolean>; aoMudar: () => void }) {
  const [texto, setTexto] = React.useState('')
  const [aberto, setAberto] = React.useState(false)
  return (
    <div className="flex flex-col gap-2 rounded-controle border border-atencao/30 bg-alerta-atencao px-3 py-2">
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-medium">{e.exame}</span>
      <span className="text-rotulo text-tinta-apoio">{SITUACAO_EXAME[e.situacao as SituacaoExame]}</span>
      {e.urgencia === 'urgente' && <Badge variant="destructive">urgente</Badge>}
      {!e.procedimento && <span className="text-rotulo text-tinta-sussurro" title="Não vai ao laboratório integrado">sem código</span>}
      <span className="text-rotulo text-tinta-sussurro">pedido {hora(e.pedido_em)}</span>
      <Input className="h-8 min-w-48 flex-1" placeholder="Resultado, ou motivo do cancelamento" value={texto} onChange={(ev) => setTexto(ev.target.value)} />
      <Button size="xs" disabled={!texto.trim()} onClick={() => void aoResolver(texto).then((ok) => ok && setTexto(''))}>Registrar resultado</Button>
      <Button size="xs" variant="outline" disabled={texto.trim().length < 10} onClick={() => void aoResolver(undefined, texto).then((ok) => ok && setTexto(''))}>Cancelar</Button>
      <Button size="xs" variant="outline" aria-expanded={aberto} onClick={() => setAberto(!aberto)}>
        {aberto ? 'Fechar' : 'Detalhe'}
        <ChevronDown className={aberto ? 'rotate-180' : undefined} aria-hidden />
      </Button>
    </div>
    {aberto && <ResultadoExame exameId={e.id} aoMudar={aoMudar} />}
    </div>
  )
}

// resultado ou cancelado: abre o resultado completo (versões, laudo, ciência)
function LinhaResolvido({ e, aoMudar }: { e: Exame; aoMudar: () => void }) {
  const [aberto, setAberto] = React.useState(false)
  const novo = e.situacao === 'resultado' && !e.resultado_visto_em
  return (
    <div className={`flex flex-col gap-1 ${novo ? 'rounded-controle border border-acao/30 px-3 py-2' : ''}`}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={novo ? 'font-medium text-tinta' : ''}>{e.exame}: {e.situacao === 'resultado' ? e.resultado : `cancelado — ${e.motivo_cancelamento}`} · pedido {hora(e.pedido_em)}</span>
        {novo && (e.critico ? <Badge variant="destructive">crítico · novo</Badge> : <span className="text-rotulo font-semibold text-acao">novo</span>)}
        {!novo && e.critico && <Badge variant="destructive">crítico</Badge>}
        {e.situacao === 'resultado' && (
          <Button size="xs" variant="outline" aria-expanded={aberto} onClick={() => setAberto(!aberto)}>
            {aberto ? 'Fechar' : 'Ver resultado'}
            <ChevronDown className={aberto ? 'rotate-180' : undefined} aria-hidden />
          </Button>
        )}
      </div>
      {aberto && <ResultadoExame exameId={e.id} aoMudar={aoMudar} />}
    </div>
  )
}

function LinhaAgravo({ a, aoResolver }: { a: Agravo; aoResolver: (notificado: boolean, numero?: string, motivo?: string) => Promise<boolean> }) {
  const [texto, setTexto] = React.useState('')
  if (a.situacao !== 'suspeito') {
    return (
      <p className="text-rotulo text-tinta-sussurro">
        {a.agravo}{a.cid ? ` (${a.cid})` : ''}: {a.situacao === 'notificado' ? `notificado${a.numero_sinan ? ` · SINAN ${a.numero_sinan}` : ''}` : `descartado — ${a.motivo_descarte}`}
      </p>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-controle border border-critico/30 bg-alerta-critico px-3 py-2">
      <Badge variant="destructive">suspeito</Badge>
      <span className="font-medium">{a.agravo}{a.cid ? ` (${a.cid})` : ''}</span>
      <Input className="h-8 min-w-48 flex-1" placeholder="Nº da notificação (opcional) ou motivo do descarte" value={texto} onChange={(ev) => setTexto(ev.target.value)} />
      <Button size="xs" onClick={() => void aoResolver(true, texto || undefined)}>Notificação registrada</Button>
      <Button size="xs" variant="outline" disabled={texto.trim().length < 10} onClick={() => void aoResolver(false, undefined, texto)}>Descartar</Button>
      <Link to={`/notificacao-compulsoria?ficha=${a.id}`} className="text-rotulo text-acao hover:underline">Ficha SINAN</Link>
    </div>
  )
}

function MarcarAgravo({ aoMarcar }: { aoMarcar: (agravo: string, cid: string) => Promise<boolean> }) {
  const [agravo, setAgravo] = React.useState('')
  const [cid, setCid] = React.useState('')
  return (
    <div className="flex flex-wrap gap-2">
      <Input className="h-8 min-w-48 flex-1" placeholder="Agravo suspeito (ex.: dengue)" value={agravo} onChange={(e) => setAgravo(e.target.value)} />
      <Input className="h-8 w-24" placeholder="CID" value={cid} onChange={(e) => setCid(e.target.value)} />
      <Button size="xs" variant="outline" disabled={agravo.trim().length < 3} onClick={() => void aoMarcar(agravo, cid).then((ok) => { if (ok) { setAgravo(''); setCid('') } })}>
        Marcar suspeita
      </Button>
    </div>
  )
}

// ── caderno do leito (EX2 e EX3, revisão da Internação, RT 24/11/2026) ──────

/** As mesmas leituras e ações da lista de cima, para as peças do caderno do leito. */
function useExamesDoPaciente(pacienteId: string) {
  const qc = useQueryClient()
  const [erro, setErro] = React.useState<string | null>(null)
  const exames = useQuery({
    queryKey: ['exames-pedidos', pacienteId],
    queryFn: async () => {
      const { data, error } = await supabase.from('exames_pedidos').select('id, exame, situacao, resultado, motivo_cancelamento, pedido_em, procedimento, urgencia, critico, resultado_visto_em')
        .eq('paciente_id', pacienteId).order('pedido_em', { ascending: false }).limit(40)
      if (error) throw error
      return (data ?? []) as Exame[]
    },
  })
  const recarregar = () => {
    for (const k of ['exames-pedidos', 'agravos', 'impeditivos', 'exames-da-internacao']) void qc.invalidateQueries({ queryKey: [k] })
  }
  const resolver = async (id: string, resultado?: string, motivo?: string) => {
    const { error } = await supabase.rpc('resolver_exame', { p_exame: id, p_resultado: resultado, p_motivo_cancelamento: motivo } as never)
    if (error) { setErro(error.message); return false }
    setErro(null); recarregar(); return true
  }
  return { exames, erro, setErro, recarregar, resolver }
}

/**
 * EX2: exames do leito em três grupos — com resultado (valor cru, data e o
 * anterior do mesmo exame), aguardando (idade do pedido, mais de 48 h em
 * destaque; repetidos numa linha) e cancelados recolhidos. Registrar
 * resultado abre a gaveta da linha. O laudo de vários continua.
 */
export function ListaExamesLeito({ pacienteId, medico }: { pacienteId: string; medico: boolean }) {
  const agora = useAgora()
  const { exames, erro, recarregar, resolver } = useExamesDoPaciente(pacienteId)
  const g = agruparExames(exames.data ?? [], agora)
  const [cancelados, setCancelados] = React.useState(false)
  const pendentesIds = g.aguardando.flatMap((x) => x.ids)
  return (
    <div className="flex flex-col gap-4 text-apoio">
      {erro && <p role="alert" className="rounded-controle border border-critico/30 bg-alerta-critico p-2 text-critico">{erro}</p>}
      <section aria-label="Com resultado" className="flex flex-col gap-1.5">
        <span className="flex items-center gap-1.5 text-controle font-semibold text-tinta">
          <FlaskConical className="size-4 text-acao" aria-hidden /> Com resultado <span className="text-rotulo text-tinta-sussurro tabular-nums">{g.comResultado.length}</span>
        </span>
        {g.comResultado.length === 0 && <p className="text-tinta-sussurro">Nenhum resultado registrado ainda.</p>}
        {g.comResultado.map((x) => <LinhaComResultado key={x.e.id} x={x} aoMudar={recarregar} />)}
      </section>

      <section aria-label="Aguardando" className="flex flex-col gap-1.5">
        <span className="text-controle font-semibold text-tinta">
          Aguardando <span className="text-rotulo text-tinta-sussurro tabular-nums">{g.aguardando.length}</span>
        </span>
        {g.aguardando.length === 0 && <p className="text-tinta-sussurro">Nenhum exame aguardando resultado.</p>}
        {g.aguardando.map((x) => (
          <LinhaAguardando key={x.e.id} x={x} medico={medico} aoMudar={recarregar}
            aoResolver={async (r, m) => {
              let ok = true
              // o resultado é de um pedido; o cancelamento com motivo vale para os repetidos juntos
              for (const id of m ? x.ids : [x.e.id]) ok = (await resolver(id, r, m)) && ok
              return ok
            }} />
        ))}
        {medico && pendentesIds.length > 1 && <LaudoDoGrupo pacienteId={pacienteId} aoMudar={recarregar} pendentes={pendentesIds.join(',')} />}
      </section>

      {g.cancelados.length > 0 && (
        <section aria-label="Cancelados" className="flex flex-col gap-1">
          <Button size="sm" variant="ghost" aria-expanded={cancelados} onClick={() => setCancelados(!cancelados)} className="self-start px-0 text-tinta-apoio hover:bg-transparent">
            <ChevronDown className={cancelados ? 'rotate-180' : undefined} aria-hidden /> Cancelados ({g.cancelados.length})
          </Button>
          {cancelados && g.cancelados.map((e) => (
            <p key={e.id} className="text-rotulo text-tinta-sussurro">{e.exame} · pedido {hora(e.pedido_em)} · cancelado: {e.motivo_cancelamento}</p>
          ))}
        </section>
      )}
    </div>
  )
}

function LinhaComResultado({ x, aoMudar }: { x: GrupoExameLinha<Exame>; aoMudar: () => void }) {
  const [aberto, setAberto] = React.useState(false)
  const e = x.e
  const novo = !e.resultado_visto_em
  return (
    <div className={`flex flex-col gap-1 rounded-controle border px-3 py-2 ${novo ? 'border-acao/30' : 'border-fio'}`}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="font-medium text-tinta">{e.exame}</span>
        {/* o valor como veio do laboratório ou foi registrado, sem reinterpretar */}
        <span className="text-tinta">{e.resultado}</span>
        {x.anterior && <span className="text-rotulo text-tinta-apoio">anterior: {x.anterior.resultado} ({hora(x.anterior.pedido_em)})</span>}
        {e.critico && <span className="text-rotulo font-semibold text-critico">crítico</span>}
        {novo && <span className="text-rotulo font-semibold text-acao">novo</span>}
        <span className="text-rotulo text-tinta-sussurro">pedido {hora(e.pedido_em)}</span>
        <Button size="xs" variant="outline" className="ml-auto" aria-expanded={aberto} onClick={() => setAberto(!aberto)}>
          {aberto ? 'Fechar' : 'Ver resultado'}
          <ChevronDown className={aberto ? 'rotate-180' : undefined} aria-hidden />
        </Button>
      </div>
      {aberto && <ResultadoExame exameId={e.id} aoMudar={aoMudar} />}
    </div>
  )
}

function LinhaAguardando({ x, medico, aoResolver, aoMudar }: {
  x: GrupoExameLinha<Exame>; medico: boolean; aoResolver: (resultado?: string, motivo?: string) => Promise<boolean>; aoMudar: () => void
}) {
  const [gaveta, setGaveta] = React.useState(false)
  const [texto, setTexto] = React.useState('')
  const e = x.e
  const tarde = atrasado(x.horas)
  return (
    <div className={`flex flex-col gap-2 rounded-controle border px-3 py-2 ${tarde ? 'border-atencao/40 bg-alerta-atencao' : 'border-fio'}`}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="font-medium text-tinta">{e.exame}</span>
        {x.vezes > 1 && <span className="text-rotulo font-semibold text-tinta-apoio">pedido {x.vezes}×</span>}
        <span className="text-rotulo text-tinta-apoio">{SITUACAO_EXAME[e.situacao as SituacaoExame]}</span>
        {e.urgencia === 'urgente' && <span className="text-rotulo font-semibold text-critico">urgente</span>}
        <span className={`text-rotulo ${tarde ? 'font-semibold text-atencao' : 'text-tinta-sussurro'}`}>{idadePedido(x.horas ?? 0)} · {hora(e.pedido_em)}</span>
        {medico && (
          <Button size="xs" variant="outline" className="ml-auto" aria-expanded={gaveta} onClick={() => setGaveta(!gaveta)}>
            {gaveta ? 'Fechar' : 'Registrar resultado'}
          </Button>
        )}
      </div>
      {gaveta && (
        <div className="flex flex-col gap-2 border-t border-trilha pt-2">
          <Input className="h-8" placeholder="Resultado como veio (ou o motivo do cancelamento)" value={texto} onChange={(ev) => setTexto(ev.target.value)} />
          <div className="flex flex-wrap gap-2">
            <Button size="xs" disabled={!texto.trim()} onClick={() => void aoResolver(texto).then((ok) => { if (ok) { setTexto(''); setGaveta(false) } })}>Registrar resultado</Button>
            <Button size="xs" variant="outline" disabled={texto.trim().length < 10}
              onClick={() => void aoResolver(undefined, texto).then((ok) => { if (ok) { setTexto(''); setGaveta(false) } })}>
              Cancelar {x.vezes > 1 ? `os ${x.vezes} pedidos` : 'o pedido'} com este motivo
            </Button>
          </div>
          <ResultadoExame exameId={e.id} aoMudar={aoMudar} />
        </div>
      )}
    </div>
  )
}

/**
 * EX3: agravos de notificação num bloco próprio (Resumo do leito e Alta),
 * fora da lista de exames. Agravo suspeito impede a alta até a notificação
 * ser registrada ou a suspeita descartada com motivo.
 */
export function AgravosNotificacao({ pacienteId, medico, sempre = false }: { pacienteId: string; medico: boolean; sempre?: boolean }) {
  const qc = useQueryClient()
  const [erro, setErro] = React.useState<string | null>(null)
  const [marcar, setMarcar] = React.useState(false)
  const agravos = useQuery({
    queryKey: ['agravos', pacienteId],
    queryFn: async () => {
      const { data, error } = await supabase.from('agravos_notificacao').select('id, agravo, cid, situacao, numero_sinan, motivo_descarte')
        .eq('paciente_id', pacienteId).order('suspeito_em', { ascending: false })
      if (error) throw error
      return (data ?? []) as Agravo[]
    },
  })
  const rpc = async (nome: 'marcar_agravo' | 'resolver_agravo', args: Record<string, unknown>) => {
    const { error } = await supabase.rpc(nome, args as never)
    if (error) { setErro(error.message); return false }
    setErro(null)
    for (const k of ['agravos', 'impeditivos']) void qc.invalidateQueries({ queryKey: [k] })
    return true
  }
  const lista = agravos.data ?? []
  const suspeitos = lista.filter((a) => a.situacao === 'suspeito')
  if (!sempre && lista.length === 0 && !marcar) {
    return medico ? (
      <div className="flex items-center gap-2 text-apoio text-tinta-sussurro">
        <Megaphone className="size-3.5" aria-hidden /> Nenhum agravo de notificação.
        <Button size="xs" variant="outline" onClick={() => setMarcar(true)}>Marcar suspeita</Button>
      </div>
    ) : null
  }
  return (
    <section id="caderno-agravos" aria-label="Notificação de agravo"
      className={`flex flex-col gap-2 rounded-container border bg-superficie px-4 py-3 text-apoio ${suspeitos.length ? 'border-critico/30' : 'border-fio'}`}>
      <span className="flex items-center gap-2 text-controle font-semibold text-tinta">
        <Megaphone className="size-4 text-acao" aria-hidden /> Notificação de agravo
        {suspeitos.length > 0 && <span className="text-apoio font-semibold text-critico">{suspeitos.length} suspeito{suspeitos.length === 1 ? '' : 's'} · impede a alta</span>}
      </span>
      {erro && <p role="alert" className="text-critico">{erro}</p>}
      {lista.map((a) => <LinhaAgravo key={a.id} a={a}
        aoResolver={(notificado, numero, motivo) => rpc('resolver_agravo', { p_agravo: a.id, p_notificado: notificado, p_numero_sinan: numero, p_motivo_descarte: motivo })} />)}
      {medico && (marcar || lista.length > 0) && (
        <MarcarAgravo aoMarcar={(agravo, cid) => rpc('marcar_agravo', { p_paciente: pacienteId, p_agravo: agravo, p_cid: cid || undefined })} />
      )}
    </section>
  )
}
