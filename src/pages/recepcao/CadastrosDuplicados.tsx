import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Check, ChevronDown, ChevronRight, GitMerge, Undo2, Users, X } from 'lucide-react'
import * as React from 'react'

import { TituloPagina, TituloSecao, Vazio } from '@/components/monitor/Pagina'
import { BotaoLinha } from '@/components/ui/botao-linha'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { useUnidade } from '@/contexts/UnidadeContext'
import { fmtData, fmtDataHora } from '@/lib/datas'
import { dataIso } from '@/lib/formato'
import { supabase } from '@/lib/supabase'
import {
  chavePar, compararCampos, documentosDivergentes, motivoMinimo, porQueSugerido, ROTULO_REGRA, sugerirPrincipal,
  type Cadastro, type Candidato, type LinhaComparacao, type PedidoUnificacao,
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
// Revisão do gestor (RT, 24/11/2026): M1 comparação campo a campo com a
// diferença marcada, M2 uma lista só por par com a situação, M3 decisão com as
// opções explicadas e a recomendada marcada.

function AlertaDocumentos({ divergencias }: { divergencias: string[] }) {
  if (divergencias.length === 0) return null
  return (
    <p role="alert" className="flex items-start gap-2 rounded-controle border border-critico/30 bg-alerta-critico px-3 py-2 text-apoio text-critico">
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

// Situação com ponto e nome, sem caixa alta (cor discreta)
const TOM = {
  acao: 'bg-acao', atencao: 'bg-atencao', critico: 'bg-critico', calmo: 'bg-tinta-sussurro', ok: 'bg-conforme',
} as const
function Situacao({ tom, children }: { tom: keyof typeof TOM; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-apoio whitespace-nowrap text-tinta-apoio">
      <span className={cn('size-2 rounded-capsula', TOM[tom])} aria-hidden />
      {children}
    </span>
  )
}

const STATUS: Record<PedidoUnificacao['status'], { rotulo: string; tom: keyof typeof TOM }> = {
  pendente: { rotulo: 'aguardando o gestor', tom: 'acao' },
  aprovado: { rotulo: 'unificado', tom: 'ok' },
  recusado: { rotulo: 'recusado', tom: 'critico' },
  cancelado: { rotulo: 'cancelado', tom: 'calmo' },
  desfeito: { rotulo: 'desfeito', tom: 'calmo' },
}

function LinhaCadastro({ c, destaque }: { c: Cadastro | PedidoUnificacao['principal']; destaque?: string }) {
  const k = c as Partial<Cadastro>
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-0.5 px-3 py-2">
      <span className="flex flex-wrap items-center gap-1.5 text-controle font-medium text-tinta">
        {c.nome} {destaque && <span className="text-rotulo font-medium text-acao">{destaque}</span>}
      </span>
      <span className="text-rotulo text-tinta-apoio">
        Pront. {c.prontuario ?? '—'} · nasc. {c.data_nascimento ? fmtData(c.data_nascimento) : '—'} · mãe {c.nome_mae ?? '—'}
      </span>
      {k.atendimentos !== undefined && (
        <span className="text-rotulo text-tinta-sussurro">
          {k.cpf ? `CPF ${k.cpf} · ` : ''}{k.atendimentos} atendimento{k.atendimentos === 1 ? '' : 's'}
          {k.aberto ? ' · atendimento aberto agora' : k.ultimo_atendimento ? ` · último ${fmtData(dataIso(k.ultimo_atendimento))}` : ''}
        </span>
      )}
    </div>
  )
}

const valorCampo = (l: LinhaComparacao, v: string | null) => (v == null ? '—' : l.chave === 'data_nascimento' ? fmtData(v) : v)

// M1: os dois cadastros lado a lado, campo a campo; a diferença fica marcada
function Comparacao({ a, b, rotuloA, rotuloB }: {
  a: Cadastro | PedidoUnificacao['principal']; b: Cadastro | PedidoUnificacao['principal']; rotuloA: string; rotuloB: string
}) {
  const linhas = compararCampos(a, b)
  const ka = a as Partial<Cadastro>
  const kb = b as Partial<Cadastro>
  const nDif = linhas.filter((l) => l.situacao === 'diferente').length
  const uso = (k: Partial<Cadastro>) => (k.atendimentos === undefined ? '—'
    : `${k.atendimentos} ${k.atendimentos === 1 ? 'atendimento' : 'atendimentos'}${k.aberto ? ', um aberto agora' : k.ultimo_atendimento ? `, último em ${fmtData(dataIso(k.ultimo_atendimento))}` : ''}`)
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-rotulo text-tinta-sussurro">
        {nDif === 0 ? 'Nenhum campo diferente entre os dois cadastros.' : `${nDif} ${nDif === 1 ? 'campo diferente' : 'campos diferentes'}, marcados abaixo.`}
      </span>
      <div className="overflow-x-auto rounded-controle border border-fio">
        <Table className="min-w-[520px] text-apoio">
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">Campo</TableHead>
              <TableHead>{rotuloA}</TableHead>
              <TableHead>{rotuloB}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.map((l) => (
              <TableRow key={l.chave} className={cn(l.situacao === 'diferente' && 'bg-alerta-atencao')}>
                <TableCell className="text-tinta-apoio">
                  {l.rotulo}
                  {l.situacao === 'diferente' && <span className="block text-rotulo font-medium text-atencao">diferente</span>}
                  {l.situacao === 'so_um' && <span className="block text-rotulo text-tinta-sussurro">só em um</span>}
                </TableCell>
                <TableCell className={cn(l.situacao === 'diferente' ? 'font-medium text-tinta' : 'text-tinta-apoio')}>{valorCampo(l, l.a)}</TableCell>
                <TableCell className={cn(l.situacao === 'diferente' ? 'font-medium text-tinta' : 'text-tinta-apoio')}>{valorCampo(l, l.b)}</TableCell>
              </TableRow>
            ))}
            {(ka.atendimentos !== undefined || kb.atendimentos !== undefined) && (
              <TableRow>
                <TableCell className="text-tinta-apoio">Uso</TableCell>
                <TableCell className="text-tinta-apoio">{uso(ka)}</TableCell>
                <TableCell className="text-tinta-apoio">{uso(kb)}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

// M3: cada opção com o que acontece; a recomendada vem marcada
function Opcao({ titulo, texto, recomendada, children }: { titulo: string; texto: string; recomendada?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn('flex flex-col gap-2 rounded-controle border px-3 py-2.5 sm:flex-row sm:items-center', recomendada ? 'border-acao/50 bg-alerta-marca' : 'border-fio')}>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-controle font-medium text-tinta">
          {titulo}{recomendada && <span className="ml-2 text-rotulo font-medium text-acao">recomendado</span>}
        </span>
        <span className="text-apoio text-tinta-apoio">{texto}</span>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}

type Par =
  | { chave: string; tipo: 'pedido'; pedido: PedidoUnificacao; candidato: Candidato | null }
  | { chave: string; tipo: 'candidato'; candidato: Candidato }

export default function CadastrosDuplicados() {
  const { unidadeAtiva, papelAtivo } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  const ehGestor = papelAtivo === 'gestor'
  const queryClient = useQueryClient()
  const [aberto, setAberto] = React.useState<string | null>(null)
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

  // M2: uma lista só, um par por linha: primeiro o que espera o gestor, depois o que ninguém pediu
  const pares = React.useMemo<Par[]>(() => {
    const porChave = new Map((candidatos.data ?? []).map((c) => [chavePar(c.cadastros.map((k) => k.id)), c]))
    const comPedido: Par[] = pendentes.map((p) => {
      const chave = chavePar([p.principal.id, p.absorvido.id])
      return { chave, tipo: 'pedido', pedido: p, candidato: porChave.get(chave) ?? null }
    })
    const usadas = new Set(comPedido.map((p) => p.chave))
    const semPedido: Par[] = [...porChave.entries()].filter(([k]) => !usadas.has(k)).map(([chave, candidato]) => ({ chave, tipo: 'candidato', candidato }))
    return [...comPedido, ...semPedido]
  }, [candidatos.data, pendentes])
  const carregando = candidatos.isLoading || pedidos.isLoading
  // a primeira linha abre sozinha; '' = todas fechadas
  const chaveAberta = aberto === null ? (pares[0]?.chave ?? null) : aberto

  function abrirPedido(c: Candidato) {
    setPedindo(c); setPrincipal(sugerirPrincipal(c.cadastros)); setMotivo(''); setConfirmoPedido(false); pedir.reset()
  }

  function detalhe(par: Par) {
    if (par.tipo === 'candidato') {
      const c = par.candidato
      const [a, b] = c.cadastros
      const div = documentosDivergentes(c.cadastros)
      const sugerido = sugerirPrincipal(c.cadastros)
      return (
        <div className="flex flex-col gap-3 border-t border-trilha bg-campo px-4 py-3">
          <Comparacao a={a} b={b} rotuloA={`Cadastro 1${a.id === sugerido ? ' · sugerido para ficar' : ''}`} rotuloB={`Cadastro 2${b.id === sugerido ? ' · sugerido para ficar' : ''}`} />
          <AlertaDocumentos divergencias={div} />
          {c.pedido_pendente ? (
            <span className="text-apoio text-tinta-apoio">Já há um pedido aguardando o gestor para este par.</span>
          ) : (
            <Opcao titulo="Pedir unificação" recomendada={div.length === 0}
              texto={div.length === 0
                ? 'Os dados batem o bastante para ser a mesma pessoa. O pedido vai para o gestor com o seu motivo; nada muda até ele aprovar.'
                : 'Os documentos não batem: confira o documento com o paciente antes de pedir. O motivo precisa de 30 letras.'}>
              <Button size="sm" variant="outline" onClick={() => abrirPedido(c)}><GitMerge /> Pedir unificação</Button>
            </Opcao>
          )}
        </div>
      )
    }
    const p = par.pedido
    const div = p.divergencias ?? []
    const cad = par.candidato?.cadastros
    const fica = cad?.find((k) => k.id === p.principal.id) ?? p.principal
    const sai = cad?.find((k) => k.id === p.absorvido.id) ?? p.absorvido
    return (
      <div className="flex flex-col gap-3 border-t border-trilha bg-campo px-4 py-3">
        <Comparacao a={fica} b={sai} rotuloA="Fica (principal)" rotuloB="É absorvido" />
        <span className="text-rotulo text-tinta-apoio">
          Pedido por {p.pedido_por ?? '—'} em {fmtDataHora(p.pedido_em)} · "{p.motivo}"
          {p.confirmado_no_pedido ? ' · quem pediu confirmou que é a mesma pessoa' : ''}
        </span>
        <AlertaDocumentos divergencias={div} />
        {ehGestor && !p.meu && (
          <div className="flex flex-col gap-2">
            <Opcao titulo="Aprovar" recomendada={div.length === 0}
              texto={`${p.principal.nome} fica; o outro cadastro fica inativo e passa a aparecer junto dele. Nenhum registro clínico muda de paciente, e dá para desfazer depois.`}>
              {div.length > 0 && (
                <Confirmo id={`confirmo-${p.id}`} marcado={!!confirmados[p.id]} mudar={(v) => setConfirmados((x) => ({ ...x, [p.id]: v }))} />
              )}
              <Button size="sm" disabled={decidir.isPending || (div.length > 0 && !confirmados[p.id])}
                onClick={() => decidir.mutate({ id: p.id, aprovar: true, confirmo: !!confirmados[p.id] })}><Check /> Aprovar</Button>
            </Opcao>
            <Opcao titulo="Recusar" recomendada={div.length > 0}
              texto="Os dois cadastros continuam separados. Use quando forem pessoas diferentes ou quando o documento não puder ser conferido.">
              <Button size="sm" variant="outline" onClick={() => { setDecidindo({ p, acao: 'recusar' }); setMotivoDecisao('') }}><X /> Recusar</Button>
            </Opcao>
          </div>
        )}
        {ehGestor && p.meu && <span className="text-apoio text-tinta-sussurro">Você pediu: outro gestor da unidade decide.</span>}
        {!ehGestor && !p.meu && <span className="text-apoio text-tinta-sussurro">O gestor da unidade decide este pedido.</span>}
        {p.meu && (
          <div><Button size="sm" variant="outline" disabled={cancelar.isPending} onClick={() => cancelar.mutate(p.id)}>Cancelar meu pedido</Button></div>
        )}
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <TituloPagina
        icone={GitMerge}
        titulo="Cadastros duplicados"
        descricao="A recepção pede a unificação com motivo; o gestor aprova. Unificar vincula os cadastros: nenhum registro clínico muda de paciente, e o gestor pode desfazer."
      />
      {erroAcao && <p role="alert" className="text-apoio text-critico">{erroAcao.message}</p>}

      <section className="flex flex-col gap-2">
        <TituloSecao extra={pares.length ? `${pendentes.length} aguardando o gestor · ${pares.length - pendentes.length} sem pedido` : undefined}>
          Pares para conferir
        </TituloSecao>
        {carregando ? <Spinner /> : candidatos.error ? (
          <p role="alert" className="text-apoio text-critico">{(candidatos.error as Error).message}</p>
        ) : pares.length === 0 ? (
          <Vazio icone={Users} titulo="Nenhum cadastro parecido" texto="Pares com mesmo nome e nascimento, mesma mãe e nascimento ou mesmo CPF/CNS aparecem aqui." />
        ) : (
          <div className="overflow-hidden rounded-container border border-fio bg-superficie">
            {pares.map((par) => {
              const nomes = par.tipo === 'pedido' ? [par.pedido.principal.nome, par.pedido.absorvido.nome] : par.candidato.cadastros.map((k) => k.nome)
              const regras = (par.candidato?.regras ?? []).map((r) => ROTULO_REGRA[r]).join(' · ')
              const div = par.tipo === 'pedido' ? par.pedido.divergencias ?? [] : documentosDivergentes(par.candidato.cadastros)
              const estaAberto = chaveAberta === par.chave
              return (
                <div key={par.chave} className="border-b border-trilha last:border-0">
                  <BotaoLinha variante="linha" aria-expanded={estaAberto} onClick={() => setAberto(estaAberto ? '' : par.chave)}
                    className="items-center border-0">
                    {estaAberto ? <ChevronDown className="size-4 shrink-0 text-tinta-sussurro" aria-hidden /> : <ChevronRight className="size-4 shrink-0 text-tinta-sussurro" aria-hidden />}
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-controle font-medium text-tinta">{nomes.join(' × ')}</span>
                      <span className="truncate text-rotulo text-tinta-sussurro">{regras || 'pedido de unificação'}</span>
                    </span>
                    {div.length > 0 && <Situacao tom="critico">documentos diferentes</Situacao>}
                    {par.tipo === 'pedido'
                      ? <Situacao tom="acao">aguardando o gestor</Situacao>
                      : par.candidato.pedido_pendente ? <Situacao tom="acao">aguardando o gestor</Situacao> : <Situacao tom="calmo">sem pedido</Situacao>}
                  </BotaoLinha>
                  {estaAberto && detalhe(par)}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {historico.length > 0 && (
        <section className="flex flex-col gap-2">
          <TituloSecao>Histórico</TituloSecao>
          {historico.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-controle border border-fio bg-superficie px-3 py-2 text-apoio">
              <Situacao tom={STATUS[p.status].tom}>{STATUS[p.status].rotulo}</Situacao>
              <span className="text-tinta">{p.absorvido.nome} ({p.absorvido.prontuario}) → {p.principal.nome} ({p.principal.prontuario})</span>
              {(p.divergencias ?? []).length > 0 && <span className="text-rotulo text-tinta-apoio">documentos diferentes ({p.divergencias.join(' e ')}), confirmado</span>}
              <span className="text-rotulo text-tinta-sussurro">
                {p.decidido_por ? `por ${p.decidido_por}` : ''}{p.decidido_em ? ` em ${fmtDataHora(p.decidido_em)}` : ''}
                {p.motivo_decisao ? ` · "${p.motivo_decisao}"` : ''}{p.motivo_desfazer ? ` · desfeito: "${p.motivo_desfazer}"` : ''}
              </span>
              {ehGestor && p.status === 'aprovado' && (
                <Button size="sm" variant="outline" className="ml-auto" onClick={() => { setDecidindo({ p, acao: 'desfazer' }); setMotivoDecisao('') }}>
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
            {pedindo?.cadastros.map((k) => {
              const sugerido = sugerirPrincipal(pedindo.cadastros) === k.id
              return (
                // padrao-ok: cartão selecionável do par de cadastros (radio); não há peça de base para cartão
                <button key={k.id} type="button" role="radio" aria-checked={principal === k.id} onClick={() => setPrincipal(k.id)}
                  className={cn('flex flex-col rounded-controle border text-left', principal === k.id ? 'border-acao ring-1 ring-acao' : 'border-fio')}>
                  <LinhaCadastro c={k} destaque={principal === k.id ? 'fica' : undefined} />
                  {sugerido && (
                    <span className="px-3 pb-2 text-rotulo text-acao">recomendado: {porQueSugerido(pedindo.cadastros)}</span>
                  )}
                </button>
              )
            })}
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
