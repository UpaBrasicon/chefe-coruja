import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Check, GitMerge, Undo2, Users, X } from 'lucide-react'
import * as React from 'react'

import { TituloPagina, TituloSecao, Vazio } from '@/components/monitor/Pagina'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { useUnidade } from '@/contexts/UnidadeContext'
import { fmtData, fmtDataHora } from '@/lib/datas'
import { supabase } from '@/lib/supabase'
import {
  documentosDivergentes, motivoMinimo, ROTULO_REGRA, sugerirPrincipal, type Cadastro, type Candidato, type PedidoUnificacao,
} from '@/lib/unificacao'
import { cn } from '@/lib/utils'

// Cadastros duplicados (Fase 1, tarefa 9 do BACKLOG). A recepção (ou o gestor)
// vê os pares suspeitos — mesmo nome e nascimento, mesma mãe e nascimento,
// mesmo CPF/CNS — e pede a unificação com motivo; o gestor aprova ou recusa
// (ninguém aprova o próprio pedido) e pode desfazer. Unificar é VINCULAR: o
// cadastro absorvido fica inativo apontando para o principal e nenhum registro
// clínico muda de paciente (migration 20261030000004).
// Portão 2, tarefa 3 (R2-02): CPF ou CNS diferentes nos dois cadastros não
// travam, mas avisam — pedido com motivo de 30 letras e "confirmo que é a mesma
// pessoa"; o gestor também confirma para aprovar (20261122000001).

function AlertaDocumentos({ divergencias }: { divergencias: string[] }) {
  if (divergencias.length === 0) return null
  return (
    <p role="alert" className="flex items-start gap-2 rounded-lg border border-critico/30 bg-critico/[0.08] px-3 py-2 text-apoio text-critico">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
      Documentos diferentes ({divergencias.join(' e ')}): os cadastros podem ser de pessoas diferentes. Confira o documento antes de unificar.
    </p>
  )
}

function Confirmo({ id, marcado, mudar }: { id: string; marcado: boolean; mudar: (v: boolean) => void }) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-apoio font-medium text-tinta">
      <input id={id} type="checkbox" checked={marcado} onChange={(e) => mudar(e.target.checked)} />
      Confirmo que é a mesma pessoa
    </label>
  )
}

const STATUS: Record<PedidoUnificacao['status'], { rotulo: string; variante: 'info' | 'outline' | 'secondary' | 'destructive' }> = {
  pendente: { rotulo: 'aguardando o gestor', variante: 'info' },
  aprovado: { rotulo: 'unificado', variante: 'secondary' },
  recusado: { rotulo: 'recusado', variante: 'destructive' },
  cancelado: { rotulo: 'cancelado', variante: 'outline' },
  desfeito: { rotulo: 'desfeito', variante: 'outline' },
}

function LinhaCadastro({ c, destaque }: { c: Cadastro | PedidoUnificacao['principal']; destaque?: string }) {
  const k = c as Partial<Cadastro>
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-lg border border-fio px-3 py-2">
      <span className="flex flex-wrap items-center gap-1.5 text-controle font-medium text-tinta">
        {c.nome} {destaque && <Badge variant="info">{destaque}</Badge>}
      </span>
      <span className="text-rotulo text-tinta-apoio">
        Pront. {c.prontuario ?? '—'} · nasc. {c.data_nascimento ? fmtData(c.data_nascimento) : '—'} · mãe {c.nome_mae ?? '—'}
      </span>
      {k.atendimentos !== undefined && (
        <span className="text-rotulo text-tinta-sussurro">
          {k.cpf ? `CPF ${k.cpf} · ` : ''}{k.atendimentos} atendimento{k.atendimentos === 1 ? '' : 's'}
          {k.aberto ? ' · atendimento aberto agora' : k.ultimo_atendimento ? ` · último ${fmtData(k.ultimo_atendimento.slice(0, 10))}` : ''}
        </span>
      )}
    </div>
  )
}

export default function CadastrosDuplicados() {
  const { unidadeAtiva, papelAtivo } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  const ehGestor = papelAtivo === 'gestor'
  const queryClient = useQueryClient()
  const [pedindo, setPedindo] = React.useState<Candidato | null>(null)
  const [principal, setPrincipal] = React.useState('')
  const [motivo, setMotivo] = React.useState('')
  const [decidindo, setDecidindo] = React.useState<{ p: PedidoUnificacao; acao: 'recusar' | 'desfazer' } | null>(null)
  const [motivoDecisao, setMotivoDecisao] = React.useState('')
  const [confirmoPedido, setConfirmoPedido] = React.useState(false)
  // pedidos pendentes com documento diferente que o gestor confirmou
  const [confirmados, setConfirmados] = React.useState<Record<string, boolean>>({})

  const candidatos = useQuery({
    queryKey: ['candidatos-duplicados', unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('candidatos_duplicados', { p_unidade: unidadeId! })
      if (error) throw error
      return data as unknown as Candidato[]
    },
  })
  const pedidos = useQuery({
    queryKey: ['pedidos-unificacao', unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('pedidos_unificacao_da_unidade', { p_unidade: unidadeId! })
      if (error) throw error
      return data as unknown as PedidoUnificacao[]
    },
  })
  const recarregar = () => {
    void queryClient.invalidateQueries({ queryKey: ['candidatos-duplicados', unidadeId] })
    void queryClient.invalidateQueries({ queryKey: ['pedidos-unificacao', unidadeId] })
  }

  const pedir = useMutation({
    mutationFn: async () => {
      const absorvido = pedindo!.cadastros.find((c) => c.id !== principal)!.id
      const { error } = await supabase.rpc('pedir_unificacao', {
        p_principal: principal, p_absorvido: absorvido, p_motivo: motivo.trim(), p_confirmo: confirmoPedido,
      })
      if (error) throw error
    },
    onSuccess: () => { setPedindo(null); setMotivo(''); setConfirmoPedido(false); recarregar() },
  })
  const decidir = useMutation({
    mutationFn: async ({ id, aprovar, m, confirmo }: { id: string; aprovar: boolean; m?: string; confirmo?: boolean }) => {
      const { error } = await supabase.rpc('decidir_unificacao', {
        p_pedido: id, p_aprovar: aprovar, p_motivo: m || undefined, p_confirmo: confirmo ?? false,
      })
      if (error) throw error
    },
    onSuccess: () => { setDecidindo(null); setMotivoDecisao(''); recarregar() },
  })
  const desfazer = useMutation({
    mutationFn: async ({ id, m }: { id: string; m: string }) => {
      const { error } = await supabase.rpc('desfazer_unificacao', { p_pedido: id, p_motivo: m })
      if (error) throw error
    },
    onSuccess: () => { setDecidindo(null); setMotivoDecisao(''); recarregar() },
  })
  const cancelar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('cancelar_unificacao', { p_pedido: id })
      if (error) throw error
    },
    onSuccess: recarregar,
  })

  const pendentes = (pedidos.data ?? []).filter((p) => p.status === 'pendente')
  const historico = (pedidos.data ?? []).filter((p) => p.status !== 'pendente')
  const erroAcao = (decidir.error ?? desfazer.error ?? cancelar.error) as Error | null
  const divergenciasPedido = pedindo ? documentosDivergentes(pedindo.cadastros) : []

  return (
    <div className="flex w-full flex-col gap-6">
      <TituloPagina
        icone={GitMerge}
        titulo="Cadastros duplicados"
        descricao="A recepção pede a unificação com motivo; o gestor aprova. Unificar vincula os cadastros: nenhum registro clínico muda de paciente, e o gestor pode desfazer."
      />
      {erroAcao && <p role="alert" className="text-apoio text-critico">{erroAcao.message}</p>}

      <section className="flex flex-col gap-2">
        <TituloSecao>Pedidos aguardando o gestor</TituloSecao>
        {pedidos.isLoading ? <Spinner /> : pendentes.length === 0 ? (
          <p className="text-apoio text-tinta-sussurro">Nenhum pedido pendente.</p>
        ) : pendentes.map((p) => (
          <div key={p.id} className="flex flex-col gap-2 rounded-container border border-fio bg-superficie px-4 py-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <LinhaCadastro c={p.principal} destaque="fica" />
              <LinhaCadastro c={p.absorvido} destaque="é absorvido" />
            </div>
            <span className="text-rotulo text-tinta-apoio">
              Pedido por {p.pedido_por ?? '—'} em {fmtDataHora(p.pedido_em)} · “{p.motivo}”
              {p.confirmado_no_pedido ? ' · quem pediu confirmou que é a mesma pessoa' : ''}
            </span>
            <AlertaDocumentos divergencias={p.divergencias ?? []} />
            <div className="flex flex-wrap items-center gap-2">
              {ehGestor && !p.meu && (
                <>
                  {(p.divergencias ?? []).length > 0 && (
                    <Confirmo id={`confirmo-${p.id}`} marcado={!!confirmados[p.id]} mudar={(v) => setConfirmados((x) => ({ ...x, [p.id]: v }))} />
                  )}
                  <Button size="sm" disabled={decidir.isPending || ((p.divergencias ?? []).length > 0 && !confirmados[p.id])}
                    onClick={() => decidir.mutate({ id: p.id, aprovar: true, confirmo: !!confirmados[p.id] })}><Check /> Aprovar</Button>
                  <Button size="sm" variant="outline" onClick={() => { setDecidindo({ p, acao: 'recusar' }); setMotivoDecisao('') }}><X /> Recusar</Button>
                </>
              )}
              {ehGestor && p.meu && <span className="text-rotulo text-tinta-sussurro">Você pediu: outro gestor da unidade decide.</span>}
              {p.meu && <Button size="sm" variant="ghost" disabled={cancelar.isPending} onClick={() => cancelar.mutate(p.id)}>Cancelar meu pedido</Button>}
            </div>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <TituloSecao>Possíveis duplicados</TituloSecao>
        {candidatos.isLoading ? <Spinner /> : candidatos.error ? (
          <p role="alert" className="text-apoio text-critico">{(candidatos.error as Error).message}</p>
        ) : (candidatos.data ?? []).length === 0 ? (
          <Vazio icone={Users} titulo="Nenhum cadastro parecido" texto="Pares com mesmo nome e nascimento, mesma mãe e nascimento ou mesmo CPF/CNS aparecem aqui." />
        ) : (candidatos.data ?? []).map((c, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-container border border-fio bg-superficie px-4 py-3">
            <span className="flex flex-wrap items-center gap-1.5 text-rotulo text-tinta-apoio">
              {c.regras.map((r) => ROTULO_REGRA[r]).join(' · ')}
              {documentosDivergentes(c.cadastros).length > 0 && (
                <Badge variant="destructive">documentos diferentes ({documentosDivergentes(c.cadastros).join(' e ')})</Badge>
              )}
            </span>
            <div className="flex flex-col gap-2 sm:flex-row">
              {c.cadastros.map((k) => <LinhaCadastro key={k.id} c={k} />)}
            </div>
            <div>
              {c.pedido_pendente ? <Badge variant="info">pedido aguardando o gestor</Badge> : (
                <Button size="sm" variant="outline" onClick={() => {
                  setPedindo(c); setPrincipal(sugerirPrincipal(c.cadastros)); setMotivo(''); setConfirmoPedido(false); pedir.reset()
                }}>
                  <GitMerge /> Pedir unificação
                </Button>
              )}
            </div>
          </div>
        ))}
      </section>

      {historico.length > 0 && (
        <section className="flex flex-col gap-2">
          <TituloSecao>Histórico</TituloSecao>
          {historico.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-fio bg-superficie px-3 py-2 text-apoio">
              <Badge variant={STATUS[p.status].variante}>{STATUS[p.status].rotulo}</Badge>
              <span className="text-tinta">{p.absorvido.nome} ({p.absorvido.prontuario}) → {p.principal.nome} ({p.principal.prontuario})</span>
              {(p.divergencias ?? []).length > 0 && <Badge variant="outline">documentos diferentes ({p.divergencias.join(' e ')}), confirmado</Badge>}
              <span className="text-rotulo text-tinta-sussurro">
                {p.decidido_por ? `por ${p.decidido_por}` : ''}{p.decidido_em ? ` em ${fmtDataHora(p.decidido_em)}` : ''}
                {p.motivo_decisao ? ` · “${p.motivo_decisao}”` : ''}{p.motivo_desfazer ? ` · desfeito: “${p.motivo_desfazer}”` : ''}
              </span>
              {ehGestor && p.status === 'aprovado' && (
                <Button size="sm" variant="ghost" className="ml-auto" onClick={() => { setDecidindo({ p, acao: 'desfazer' }); setMotivoDecisao('') }}>
                  <Undo2 /> Desfazer
                </Button>
              )}
            </div>
          ))}
        </section>
      )}

      <Dialog open={!!pedindo} onOpenChange={(v) => !v && setPedindo(null)}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle className="text-dialogo">Pedir unificação</DialogTitle>
            <DialogDescription className="text-controle">
              Escolha o cadastro que fica. O outro fica inativo e passa a aparecer junto do principal; nada é apagado e o gestor pode desfazer.
            </DialogDescription>
          </DialogHeader>
          <div role="radiogroup" aria-label="Cadastro que fica" className="flex flex-col gap-2">
            {pedindo?.cadastros.map((k) => (
              <button key={k.id} type="button" role="radio" aria-checked={principal === k.id} onClick={() => setPrincipal(k.id)}
                className={cn('rounded-lg border text-left', principal === k.id ? 'border-acao ring-1 ring-acao' : 'border-fio')}>
                <LinhaCadastro c={k} destaque={principal === k.id ? 'fica' : undefined} />
              </button>
            ))}
          </div>
          <AlertaDocumentos divergencias={divergenciasPedido} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="motivo-unif">Motivo</Label>
            <Textarea id="motivo-unif" rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: mesma paciente, nome digitado diferente na recepção" />
            <span className="text-rotulo text-tinta-sussurro">Mínimo de {motivoMinimo(divergenciasPedido)} letras.</span>
          </div>
          {divergenciasPedido.length > 0 && <Confirmo id="confirmo-pedido" marcado={confirmoPedido} mudar={setConfirmoPedido} />}
          {pedir.error && <p role="alert" className="text-apoio text-critico">{(pedir.error as Error).message}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPedindo(null)}>Cancelar</Button>
            <Button disabled={pedir.isPending || motivo.trim().length < motivoMinimo(divergenciasPedido) || !principal
              || (divergenciasPedido.length > 0 && !confirmoPedido)} onClick={() => pedir.mutate()}><GitMerge /> Pedir</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!decidindo} onOpenChange={(v) => !v && setDecidindo(null)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-dialogo">{decidindo?.acao === 'recusar' ? 'Recusar a unificação' : 'Desfazer a unificação'}</DialogTitle>
            <DialogDescription className="text-controle">
              {decidindo?.acao === 'recusar' ? 'Os dois cadastros continuam separados.' : 'O cadastro absorvido volta a ficar ativo e separado; CPF/CNS que tinham passado ao principal voltam.'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="motivo-dec">Motivo</Label>
            <Textarea id="motivo-dec" rows={2} value={motivoDecisao} onChange={(e) => setMotivoDecisao(e.target.value)} />
            <span className="text-rotulo text-tinta-sussurro">Mínimo de 10 letras.</span>
          </div>
          {(decidir.error || desfazer.error) && <p role="alert" className="text-apoio text-critico">{((decidir.error ?? desfazer.error) as Error).message}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDecidindo(null)}>Voltar</Button>
            <Button variant="destructive" disabled={motivoDecisao.trim().length < 10 || decidir.isPending || desfazer.isPending}
              onClick={() => decidindo && (decidindo.acao === 'recusar'
                ? decidir.mutate({ id: decidindo.p.id, aprovar: false, m: motivoDecisao.trim() })
                : desfazer.mutate({ id: decidindo.p.id, m: motivoDecisao.trim() }))}>
              {decidindo?.acao === 'recusar' ? <><X /> Recusar</> : <><Undo2 /> Desfazer</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
