// Exames pedidos e agravos de notificação (Fase 4.7) — no leito e na porta.
// Exame pedido sai da pendência com resultado ou cancelado com motivo; agravo
// suspeito, com a notificação registrada ou descartado com motivo. Os dois
// impedem a alta enquanto abertos.
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FlaskConical, Megaphone } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'

import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Exame = { id: string; exame: string; situacao: string; resultado: string | null; motivo_cancelamento: string | null; pedido_em: string }
type Agravo = { id: string; agravo: string; cid: string | null; situacao: string; numero_sinan: string | null; motivo_descarte: string | null }

const hora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' })

export function ExamesEAgravos({ pacienteId, medico }: { pacienteId: string; medico: boolean }) {
  const qc = useQueryClient()
  const [erro, setErro] = React.useState<string | null>(null)
  const exames = useQuery({
    queryKey: ['exames-pedidos', pacienteId],
    queryFn: async () => {
      const { data, error } = await supabase.from('exames_pedidos').select('id, exame, situacao, resultado, motivo_cancelamento, pedido_em')
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
  const pendentes = (exames.data ?? []).filter((e) => e.situacao === 'pedido')
  const resolvidos = (exames.data ?? []).filter((e) => e.situacao !== 'pedido')

  return (
    <div className="flex flex-col gap-4 text-sm">
      {erro && <p className="rounded-lg border border-critico/30 bg-critico/[0.08] p-2 text-critico">{erro}</p>}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-tinta-sussurro uppercase">
          <FlaskConical className="size-3.5" /> Exames pedidos
        </div>
        {pendentes.length === 0 && <p className="text-tinta-sussurro">Nenhum exame aguardando resultado. (Os exames entram quando o pedido é impresso.)</p>}
        {pendentes.map((e) => <LinhaExame key={e.id} e={e} aoResolver={(r, m) => rpc('resolver_exame', { p_exame: e.id, p_resultado: r, p_motivo_cancelamento: m })} />)}
        {resolvidos.length > 0 && (
          <details className="text-xs text-tinta-sussurro">
            <summary className="cursor-pointer">Resolvidos ({resolvidos.length})</summary>
            {resolvidos.map((e) => (
              <div key={e.id}>{e.exame}: {e.situacao === 'resultado' ? e.resultado : `cancelado — ${e.motivo_cancelamento}`} · pedido {hora(e.pedido_em)}</div>
            ))}
          </details>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-tinta-sussurro uppercase">
          <Megaphone className="size-3.5" /> Agravos de notificação
        </div>
        {(agravos.data ?? []).map((a) => <LinhaAgravo key={a.id} a={a}
          aoResolver={(notificado, numero, motivo) => rpc('resolver_agravo', { p_agravo: a.id, p_notificado: notificado, p_numero_sinan: numero, p_motivo_descarte: motivo })} />)}
        {medico && <MarcarAgravo aoMarcar={(agravo, cid) => rpc('marcar_agravo', { p_paciente: pacienteId, p_agravo: agravo, p_cid: cid || undefined })} />}
        <p className="text-xs text-tinta-sussurro">Agravo suspeito impede a alta até a notificação ser registrada (o envio ao SINAN é fora do sistema) ou a suspeita ser descartada com motivo.</p>
      </div>
    </div>
  )
}

function LinhaExame({ e, aoResolver }: { e: Exame; aoResolver: (resultado?: string, motivo?: string) => Promise<boolean> }) {
  const [texto, setTexto] = React.useState('')
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-atencao/30 bg-atencao/[0.05] px-3 py-2">
      <span className="font-medium">{e.exame}</span>
      <span className="text-xs text-tinta-sussurro">pedido {hora(e.pedido_em)}</span>
      <Input className="h-8 min-w-48 flex-1" placeholder="Resultado, ou motivo do cancelamento" value={texto} onChange={(ev) => setTexto(ev.target.value)} />
      <Button size="xs" disabled={!texto.trim()} onClick={() => void aoResolver(texto).then((ok) => ok && setTexto(''))}>Registrar resultado</Button>
      <Button size="xs" variant="outline" disabled={texto.trim().length < 10} onClick={() => void aoResolver(undefined, texto).then((ok) => ok && setTexto(''))}>Cancelar</Button>
    </div>
  )
}

function LinhaAgravo({ a, aoResolver }: { a: Agravo; aoResolver: (notificado: boolean, numero?: string, motivo?: string) => Promise<boolean> }) {
  const [texto, setTexto] = React.useState('')
  if (a.situacao !== 'suspeito') {
    return (
      <p className="text-xs text-tinta-sussurro">
        {a.agravo}{a.cid ? ` (${a.cid})` : ''}: {a.situacao === 'notificado' ? `notificado${a.numero_sinan ? ` · SINAN ${a.numero_sinan}` : ''}` : `descartado — ${a.motivo_descarte}`}
      </p>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-critico/30 bg-critico/[0.05] px-3 py-2">
      <Badge variant="destructive">suspeito</Badge>
      <span className="font-medium">{a.agravo}{a.cid ? ` (${a.cid})` : ''}</span>
      <Input className="h-8 min-w-48 flex-1" placeholder="Nº da notificação (opcional) ou motivo do descarte" value={texto} onChange={(ev) => setTexto(ev.target.value)} />
      <Button size="xs" onClick={() => void aoResolver(true, texto || undefined)}>Notificação registrada</Button>
      <Button size="xs" variant="outline" disabled={texto.trim().length < 10} onClick={() => void aoResolver(false, undefined, texto)}>Descartar</Button>
      <Link to={`/notificacao-compulsoria?ficha=${a.id}`} className="text-xs text-acao hover:underline">Ficha SINAN</Link>
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
