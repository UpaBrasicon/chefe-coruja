// LG12, decisões V2 e V4 = A (RT, 18/11/2026): fila de tecnovigilância do
// responsável técnico, com o prazo do art. 8º da RDC 67/2009, o andamento
// (só de inclusão), a conclusão que volta para quem relatou e a suspensão da
// versão na rede. O gestor vê os relatos da unidade, só leitura (V1).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Flag } from 'lucide-react'
import * as React from 'react'

import { TituloSecao } from '@/components/monitor/Pagina'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { diaMesHora } from '@/lib/formato'
import { supabase } from '@/lib/supabase'
import { DESFECHO, SITUACAO_RELATO, TIPO_RELATO, textoPrazo, type RelatoTv } from '@/lib/tecnovigilancia'
import { cn } from '@/lib/utils'

type Suspensao = { id: string; ferramenta_id: string; versao: string; motivo: string; em: string; relato: number | null }

export function FilaTecnovigilancia() {
  const { data: fila } = useQuery({
    queryKey: ['fila-tecnovigilancia'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('fila_tecnovigilancia')
      if (error) throw error
      return (data ?? []) as unknown as RelatoTv[]
    },
  })
  const abertos = (fila ?? []).filter((r) => r.situacao !== 'concluido')
  const concluidos = (fila ?? []).filter((r) => r.situacao === 'concluido')
  return (
    <section aria-label="Fila de tecnovigilância" className="flex flex-col gap-3">
      <SuspensoesVigentes />
      <TituloSecao className="mb-0">Relatos abertos</TituloSecao>
      {abertos.length === 0 && <p className="text-apoio text-tinta-sussurro">Nenhum relato aberto. Os relatos chegam do botão Relatar problema das ferramentas clínicas.</p>}
      {abertos.map((r) => <CartaoRelato key={r.id} r={r} rt />)}
      {concluidos.length > 0 && (
        <details className="text-apoio text-tinta-apoio">
          <summary className="cursor-pointer">Concluídos ({concluidos.length})</summary>
          <div className="mt-2 flex flex-col gap-2">{concluidos.map((r) => <CartaoRelato key={r.id} r={r} rt />)}</div>
        </details>
      )}
    </section>
  )
}

export function RelatosDaUnidade({ unidadeId }: { unidadeId: string }) {
  const { data } = useQuery({
    queryKey: ['tecnovigilancia-unidade', unidadeId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('tecnovigilancia_da_unidade', { p_unidade: unidadeId })
      if (error) throw error
      return (data ?? []) as unknown as RelatoTv[]
    },
  })
  return (
    <section aria-label="Relatos de tecnovigilância da unidade" className="flex flex-col gap-2">
      <TituloSecao className="mb-0">Relatos de problema da unidade</TituloSecao>
      <p className="text-apoio text-tinta-apoio">
        Cópia para a gestão. Quem investiga é o responsável técnico da Chefe Coruja. Se o problema chegou ao paciente, o Núcleo de Segurança do Paciente da unidade avalia a notificação no Notivisa.
      </p>
      {data && data.length === 0 && <p className="text-apoio text-tinta-sussurro">Nenhum relato da unidade. O relato nasce do botão Relatar problema, no topo de cada ferramenta do módulo clínico, quando alguém da equipe vê um resultado errado ou estranho. O andamento da investigação aparece aqui.</p>}
      {(data ?? []).map((r) => <CartaoRelato key={r.id} r={r} rt={false} />)}
    </section>
  )
}

function CartaoRelato({ r, rt }: { r: RelatoTv; rt: boolean }) {
  const aberto = r.situacao !== 'concluido'
  const prazo = aberto ? textoPrazo(r.prazo_em) : ''
  const vencido = prazo.startsWith('venceu')
  return (
    <div className={cn('flex flex-col gap-1.5 rounded-cartao border bg-superficie px-4 py-3 text-apoio text-tinta-apoio',
      r.grave && aberto ? 'border-critico' : 'border-fio')}>
      <p className="flex flex-wrap items-center gap-x-2 text-corpo text-tinta">
        <Flag className="size-3.5" aria-hidden />
        Nº {r.numero} · {r.ferramenta_titulo ?? r.ferramenta_id}{r.versao ? ` (versão ${r.versao})` : ''}
      </p>
      <p>
        {SITUACAO_RELATO[r.situacao]} · {TIPO_RELATO[r.tipo]}{r.desfecho ? ` · ${DESFECHO[r.desfecho]}` : ''} · {r.unidade ?? 'sem unidade'}
        {r.relatado_por ? ` · ${r.relatado_por}` : ''} · {diaMesHora(r.relatado_em)}
      </p>
      {aberto && (
        <p className={cn(vencido ? 'text-critico' : 'text-tinta')}>
          Prazo {r.prazo_legal ? '(RDC 67/2009, art. 8º)' : '(meta interna)'}: {prazo} · {diaMesHora(r.prazo_em)}
        </p>
      )}
      <p className="whitespace-pre-line text-tinta">{r.descricao}</p>
      {r.andamento.filter((a) => a.situacao !== 'recebido').map((a, i) => (
        <p key={i} className="border-l-2 border-fio pl-2">
          {diaMesHora(a.em)} · {a.situacao === 'aviso_rt' ? 'Aviso por e-mail' : SITUACAO_RELATO[a.situacao]}{a.por ? ` · ${a.por}` : ''}: {a.texto}
          {a.causa ? ` Causa: ${a.causa}.` : ''}{a.acao ? ` Ação: ${a.acao}.` : ''}{a.versao_corrigida ? ` Versão corrigida: ${a.versao_corrigida}.` : ''}
        </p>
      ))}
      {r.suspensao && <p className="text-tinta">Versão suspensa na rede desde {diaMesHora(r.suspensao.em)}: {r.suspensao.motivo}</p>}
      {rt && aberto && <AcoesRT r={r} />}
    </div>
  )
}

function AcoesRT({ r }: { r: RelatoTv }) {
  const qc = useQueryClient()
  const [texto, setTexto] = React.useState('')
  const [causa, setCausa] = React.useState('')
  const [acao, setAcao] = React.useState('')
  const [versaoCorrigida, setVersaoCorrigida] = React.useState('')
  const [concluindo, setConcluindo] = React.useState(false)
  const [suspendendo, setSuspendendo] = React.useState(false)
  const [erro, setErro] = React.useState<string | null>(null)
  const andamento = useMutation({
    mutationFn: async (situacao: 'em_investigacao' | 'concluido') => {
      const { error } = await supabase.rpc('andamento_tecnovigilancia', {
        p_relato: r.id, p_situacao: situacao, p_texto: texto.trim(),
        p_causa: situacao === 'concluido' ? causa.trim() : undefined,
        p_acao: situacao === 'concluido' ? acao.trim() : undefined,
        p_versao_corrigida: situacao === 'concluido' && versaoCorrigida.trim() ? versaoCorrigida.trim() : undefined,
      })
      if (error) throw error
    },
    onSuccess: () => { setTexto(''); setCausa(''); setAcao(''); setVersaoCorrigida(''); setConcluindo(false); setErro(null); void qc.invalidateQueries({ queryKey: ['fila-tecnovigilancia'] }) },
    onError: (e: Error) => setErro(e.message),
  })
  const suspender = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('suspender_versao_rede', {
        p_ferramenta: r.ferramenta_id, p_versao: r.versao ?? '', p_motivo: texto.trim(), p_relato: r.id,
      })
      if (error) throw error
    },
    onSuccess: () => {
      setTexto(''); setSuspendendo(false); setErro(null)
      void qc.invalidateQueries({ queryKey: ['fila-tecnovigilancia'] })
      void qc.invalidateQueries({ queryKey: ['suspensoes-rede'] })
    },
    onError: (e: Error) => setErro(e.message),
  })
  const podeSuspender = !!r.versao && !r.suspensao && r.ferramenta_id !== 'modulo-clinico'
  return (
    <div className="mt-1 flex flex-col gap-2 border-t border-fio pt-2">
      <Textarea aria-label={`Andamento do relato ${r.numero}`} rows={2} value={texto} onChange={(e) => setTexto(e.target.value)}
        placeholder={suspendendo ? 'Motivo da suspensão (aparece na ficha para todos)' : 'O que foi feito ou concluído'} />
      {concluindo && (
        <div className="grid gap-2 sm:grid-cols-3">
          <Input aria-label="Causa" placeholder="Causa" value={causa} onChange={(e) => setCausa(e.target.value)} />
          <Input aria-label="Ação tomada" placeholder="Ação tomada" value={acao} onChange={(e) => setAcao(e.target.value)} />
          <Input aria-label="Versão corrigida" placeholder="Versão corrigida (se houver)" value={versaoCorrigida} onChange={(e) => setVersaoCorrigida(e.target.value)} />
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {suspendendo ? (
          <>
            <Button size="sm" variant="destructive" disabled={suspender.isPending} onClick={() => suspender.mutate()}>Confirmar suspensão na rede</Button>
            <Button size="sm" variant="ghost" onClick={() => setSuspendendo(false)}>Voltar</Button>
          </>
        ) : concluindo ? (
          <>
            <Button size="sm" disabled={andamento.isPending} onClick={() => andamento.mutate('concluido')}>Concluir e responder</Button>
            <Button size="sm" variant="ghost" onClick={() => setConcluindo(false)}>Voltar</Button>
          </>
        ) : (
          <>
            {r.situacao === 'recebido' && <Button size="sm" variant="outline" disabled={andamento.isPending} onClick={() => andamento.mutate('em_investigacao')}>Em investigação</Button>}
            <Button size="sm" variant="outline" onClick={() => setConcluindo(true)}>Concluir</Button>
            {podeSuspender && <Button size="sm" variant="destructive" onClick={() => setSuspendendo(true)}>Suspender esta versão na rede</Button>}
          </>
        )}
      </div>
      {erro && <p role="alert" className="text-rotulo text-critico">{erro}</p>}
    </div>
  )
}

function SuspensoesVigentes() {
  const qc = useQueryClient()
  const { data } = useQuery({
    queryKey: ['suspensoes-rede'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('suspensoes_rede_vigentes')
      if (error) throw error
      return (data ?? []) as unknown as Suspensao[]
    },
  })
  const [nota, setNota] = React.useState<Record<string, string>>({})
  const [erro, setErro] = React.useState<string | null>(null)
  const encerrar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('encerrar_suspensao_rede', { p_suspensao: id, p_nota: (nota[id] ?? '').trim() })
      if (error) throw error
    },
    onSuccess: () => { setErro(null); void qc.invalidateQueries({ queryKey: ['suspensoes-rede'] }); void qc.invalidateQueries({ queryKey: ['fila-tecnovigilancia'] }) },
    onError: (e: Error) => setErro(e.message),
  })
  if (!data?.length) return null
  return (
    <div className="flex flex-col gap-2 rounded-cartao border border-critico bg-superficie px-4 py-3 text-apoio text-tinta">
      <p className="font-semibold">Versões suspensas na rede</p>
      {data.map((s) => (
        <div key={s.id} className="flex flex-col gap-1.5">
          <p>{s.ferramenta_id} · versão {s.versao}{s.relato ? ` · relato nº ${s.relato}` : ''} · desde {diaMesHora(s.em)}: {s.motivo}</p>
          <div className="flex flex-wrap gap-2">
            <Input aria-label={`Por que a suspensão de ${s.ferramenta_id} acaba`} className="max-w-md flex-1" placeholder="Por que a suspensão acaba"
              value={nota[s.id] ?? ''} onChange={(e) => setNota((n) => ({ ...n, [s.id]: e.target.value }))} />
            <Button size="sm" variant="outline" disabled={encerrar.isPending} onClick={() => encerrar.mutate(s.id)}>Encerrar suspensão</Button>
          </div>
        </div>
      ))}
      {erro && <p role="alert" className="text-rotulo text-critico">{erro}</p>}
    </div>
  )
}
