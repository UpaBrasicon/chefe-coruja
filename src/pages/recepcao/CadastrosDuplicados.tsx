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
// Ações no par aberto (RT, 24/11/2026: "ficam apenas os campos"): decide quem
// está com gestor em foco ou o administrador geral (o servidor aceita os dois,
// private.gestor_da_unidade); "Manter este" fica na própria comparação; o
// próprio pedido pode ser cancelado ou refeito com o outro cadastro ficando;
// toda ação confirma antes e avisa o resultado.

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
function Comparacao({ a, b, rotuloA, rotuloB, acaoA, acaoB }: {
  a: Cadastro | PedidoUnificacao['principal']; b: Cadastro | PedidoUnificacao['principal']; rotuloA: string; rotuloB: string
  /** escolha de qual cadastro fica, embaixo de cada coluna */
  acaoA?: React.ReactNode; acaoB?: React.ReactNode
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
            {(acaoA || acaoB) && (
              <TableRow>
                <TableCell className="text-tinta-apoio">Qual fica</TableCell>
                <TableCell>{acaoA}</TableCell>
                <TableCell>{acaoB}</TableCell>
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
    <div className={cn('flex flex-col gap-2 rounded-controle border px-3 py-2.5', recomendada ? 'border-acao/50 bg-alerta-marca' : 'border-fio bg-superficie')}>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-controle font-medium text-tinta">
          {titulo}{recomendada && <span className="ml-2 text-rotulo font-medium text-acao">recomendado</span>}
        </span>
        <span className="text-apoio text-tinta-apoio">{texto}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}

type Par =
  | { chave: string; tipo: 'pedido'; pedido: PedidoUnificacao; candidato: Candidato | null }
  | { chave: string; tipo: 'candidato'; candidato: Candidato }

type Decisao = { acao: 'aprovar' | 'recusar' | 'cancelar' | 'desfazer'; p: PedidoUnificacao }
type Pedindo = { candidato: Candidato; principal: string; substitui: PedidoUnificacao | null }

// o resultado de cada ação, dito no topo da tela
const AVISO: Record<Decisao['acao'], string> = {
  aprovar: 'Unificação aprovada: o par saiu da lista e está no histórico.',
  recusar: 'Pedido recusado: os dois cadastros continuam separados e o par está no histórico.',
  cancelar: 'Pedido cancelado: o par voltou a ficar sem pedido.',
  desfazer: 'Unificação desfeita: os dois cadastros voltaram a ficar separados.',
}
const TITULO_DECISAO: Record<Decisao['acao'], string> = {
  aprovar: 'Aprovar a unificação',
  recusar: 'Recusar a unificação',
  cancelar: 'Cancelar o pedido',
  desfazer: 'Desfazer a unificação',
}
const pront = (k: { prontuario: string | null }) => `pront. ${k.prontuario ?? '—'}`

export default function CadastrosDuplicados() {
  const { unidadeAtiva, papelAtivo, ehSuperAdmin } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  // Decide a unificação quem está com gestor em foco ou o administrador geral
  // em foco de administrador: o servidor aceita os dois (private.gestor_da_unidade).
  const podeDecidir = papelAtivo === 'gestor' || (ehSuperAdmin && papelAtivo === 'admin')
  const queryClient = useQueryClient()
  const [aberto, setAberto] = React.useState<string | null>(null)
  const [pedindo, setPedindo] = React.useState<Pedindo | null>(null)
  const [motivo, setMotivo] = React.useState('')
  const [confirmoPedido, setConfirmoPedido] = React.useState(false)
  const [decidindo, setDecidindo] = React.useState<Decisao | null>(null)
  const [motivoDecisao, setMotivoDecisao] = React.useState('')
  const [confirmoDecisao, setConfirmoDecisao] = React.useState(false)
  const [aviso, setAviso] = React.useState<string | null>(null)

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

  // Pedir; refazer o próprio pedido com o outro cadastro ficando = cancelar e pedir de novo
  const pedir = useMutation({
    mutationFn: async (x: Pedindo) => {
      let cancelou = false
      if (x.substitui) {
        const { error } = await supabase.rpc('cancelar_unificacao', { p_pedido: x.substitui.id })
        if (error) throw error
        cancelou = true
      }
      const absorvido = x.candidato.cadastros.find((c) => c.id !== x.principal)!.id
      const { error } = await supabase.rpc('pedir_unificacao', {
        p_principal: x.principal, p_absorvido: absorvido, p_motivo: motivo.trim(), p_confirmo: confirmoPedido,
      })
      if (error) {
        throw Object.assign(new Error(cancelou ? `O pedido antigo foi cancelado, mas o novo não foi enviado: ${error.message}` : error.message), { cancelou })
      }
      return x
    },
    onSuccess: (x) => {
      setPedindo(null); setMotivo(''); setConfirmoPedido(false)
      setAviso(x.substitui
        ? 'Pedido refeito com o outro cadastro ficando. O par continua aguardando o gestor.'
        : 'Pedido enviado. O par fica aguardando o gestor; nada muda nos cadastros até ele aprovar.')
      recarregar()
    },
    onError: (e) => {
      // o antigo já saiu: tentar de novo é um pedido novo
      if ((e as { cancelou?: boolean }).cancelou) setPedindo((p) => p && { ...p, substitui: null })
      recarregar()
    },
  })
  const decidir = useMutation({
    mutationFn: async ({ acao, p, m, confirmo }: Decisao & { m: string; confirmo: boolean }) => {
      const { error } = acao === 'aprovar'
        ? await supabase.rpc('decidir_unificacao', { p_pedido: p.id, p_aprovar: true, p_confirmo: confirmo })
        : acao === 'recusar'
          ? await supabase.rpc('decidir_unificacao', { p_pedido: p.id, p_aprovar: false, p_motivo: m, p_confirmo: false })
          : acao === 'cancelar'
            ? await supabase.rpc('cancelar_unificacao', { p_pedido: p.id })
            : await supabase.rpc('desfazer_unificacao', { p_pedido: p.id, p_motivo: m })
      if (error) throw error
      return acao
    },
    onSuccess: (acao) => { setDecidindo(null); setMotivoDecisao(''); setConfirmoDecisao(false); setAviso(AVISO[acao]); recarregar() },
  })

  const pendentes = (pedidos.data ?? []).filter((p) => p.status === 'pendente')
  const historico = (pedidos.data ?? []).filter((p) => p.status !== 'pendente')
  const divergenciasPedido = pedindo ? documentosDivergentes(pedindo.candidato.cadastros) : []
  const divergenciasDecisao = decidindo?.p.divergencias ?? []
  const precisaMotivo = decidindo?.acao === 'recusar' || decidindo?.acao === 'desfazer'

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

  function abrirPedido(c: Candidato, principal: string, substitui: PedidoUnificacao | null = null) {
    setPedindo({ candidato: c, principal, substitui })
    setMotivo(substitui?.motivo ?? ''); setConfirmoPedido(substitui?.confirmado_no_pedido ?? false)
    pedir.reset(); setAviso(null)
  }
  function abrirDecisao(acao: Decisao['acao'], p: PedidoUnificacao) {
    setDecidindo({ acao, p }); setMotivoDecisao(''); setConfirmoDecisao(false); decidir.reset(); setAviso(null)
  }

  function detalhe(par: Par) {
    if (par.tipo === 'candidato') {
      const c = par.candidato
      const [a, b] = c.cadastros
      const div = documentosDivergentes(c.cadastros)
      const sugerido = sugerirPrincipal(c.cadastros)
      // "Manter este" na própria comparação: abre o pedido com esse cadastro ficando
      const manter = (k: Cadastro) => (c.pedido_pendente ? undefined : (
        <Button size="sm" variant={k.id === sugerido && div.length === 0 ? 'default' : 'outline'} onClick={() => abrirPedido(c, k.id)}>
          <Check /> Manter este
        </Button>
      ))
      return (
        <div className="flex flex-col gap-3 border-t border-trilha bg-campo px-4 py-3">
          <Comparacao a={a} b={b} acaoA={manter(a)} acaoB={manter(b)}
            rotuloA={`Cadastro 1${a.id === sugerido ? ' · sugerido para ficar' : ''}`} rotuloB={`Cadastro 2${b.id === sugerido ? ' · sugerido para ficar' : ''}`} />
          <AlertaDocumentos divergencias={div} />
          {c.pedido_pendente ? (
            <span className="text-apoio text-tinta-apoio">
              Já há um pedido aguardando o gestor para este par. O pedido aparece para quem pediu e para o gestor da unidade.
            </span>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              <Opcao titulo="Unificar" recomendada={div.length === 0}
                texto={div.length === 0
                  ? `Os dados batem o bastante para ser a mesma pessoa. Fica o sugerido (${porQueSugerido(c.cadastros)}), ou use "Manter este" na coluna do outro. O pedido vai para o gestor; nada muda até ele aprovar.`
                  : 'Os documentos não batem: confira o documento com o paciente antes de pedir. O motivo precisa de 30 letras.'}>
                <Button size="sm" variant={div.length === 0 ? 'default' : 'outline'} onClick={() => abrirPedido(c, sugerido)}>
                  <GitMerge /> Pedir unificação
                </Button>
              </Opcao>
              <Opcao titulo="São pessoas diferentes" recomendada={div.length > 0}
                texto="Não peça a unificação: os dois cadastros continuam separados como estão. O par segue nesta lista enquanto os dados forem parecidos.">
                <Button size="sm" variant="outline" onClick={() => setAberto('')}><X /> Deixar separados</Button>
              </Opcao>
            </div>
          )}
        </div>
      )
    }
    const p = par.pedido
    const div = p.divergencias ?? []
    const cad = par.candidato
    const fica = cad?.cadastros.find((k) => k.id === p.principal.id) ?? p.principal
    const sai = cad?.cadastros.find((k) => k.id === p.absorvido.id) ?? p.absorvido
    // o próprio pedido pode ser refeito com o outro cadastro ficando (precisa dos dois ativos)
    const podeTrocar = p.meu && !!cad
    return (
      <div className="flex flex-col gap-3 border-t border-trilha bg-campo px-4 py-3">
        <Comparacao a={fica} b={sai} rotuloA="Fica (principal)" rotuloB="É absorvido"
          acaoA={podeTrocar ? <span className="text-rotulo font-medium text-acao">fica neste pedido</span> : undefined}
          acaoB={podeTrocar ? (
            <Button size="sm" variant="outline" onClick={() => abrirPedido(cad, p.absorvido.id, p)}><Check /> Manter este</Button>
          ) : undefined} />
        <span className="text-rotulo text-tinta-apoio">
          Pedido por {p.pedido_por ?? '—'} em {fmtDataHora(p.pedido_em)} · "{p.motivo}"
          {p.confirmado_no_pedido ? ' · quem pediu confirmou que é a mesma pessoa' : ''}
        </span>
        <AlertaDocumentos divergencias={div} />
        {podeDecidir && !p.meu ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <Opcao titulo="Aprovar" recomendada={div.length === 0}
              texto={`${p.principal.nome} (${pront(p.principal)}) fica; o outro cadastro fica inativo e passa a aparecer junto dele. Nenhum registro clínico muda de paciente, e dá para desfazer depois.`}>
              <Button size="sm" variant={div.length === 0 ? 'default' : 'outline'} onClick={() => abrirDecisao('aprovar', p)}><Check /> Aprovar</Button>
            </Opcao>
            <Opcao titulo="Recusar" recomendada={div.length > 0}
              texto="Os dois cadastros continuam separados. Use quando forem pessoas diferentes ou quando o documento não puder ser conferido.">
              <Button size="sm" variant={div.length > 0 ? 'default' : 'outline'} onClick={() => abrirDecisao('recusar', p)}><X /> Recusar</Button>
            </Opcao>
          </div>
        ) : p.meu ? (
          <div className="flex flex-col gap-2">
            <span className="text-apoio text-tinta-apoio">
              {podeDecidir
                ? 'Você pediu esta unificação, e quem pede não aprova o próprio pedido: decide outro gestor da unidade ou o administrador geral.'
                : 'Você pediu esta unificação: o gestor da unidade decide.'}
            </span>
            <div className="grid gap-2 sm:grid-cols-2">
              {podeTrocar && (
                <Opcao titulo="Trocar o cadastro que fica"
                  texto={`Refaz o pedido com o cadastro de ${pront(p.absorvido)} ficando e o de ${pront(p.principal)} absorvido. O motivo vem preenchido.`}>
                  <Button size="sm" variant="outline" onClick={() => abrirPedido(cad, p.absorvido.id, p)}><GitMerge /> Manter o outro</Button>
                </Opcao>
              )}
              <Opcao titulo="Cancelar o pedido" texto="O pedido sai da fila do gestor e os dois cadastros continuam separados. Use se pediu por engano.">
                <Button size="sm" variant="outline" onClick={() => abrirDecisao('cancelar', p)}><X /> Cancelar o pedido</Button>
              </Opcao>
            </div>
          </div>
        ) : (
          <span className="text-apoio text-tinta-sussurro">O gestor da unidade decide este pedido.</span>
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
      {aviso && (
        <p role="status" className="flex items-start gap-2 rounded-controle border border-conforme/30 bg-alerta-conforme px-3 py-2 text-apoio text-tinta">
          <Check className="mt-0.5 size-4 shrink-0 text-conforme" aria-hidden />
          {aviso}
        </p>
      )}
      {pedidos.error && <p role="alert" className="text-apoio text-critico">{(pedidos.error as Error).message}</p>}

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
                      ? <Situacao tom="acao">{par.pedido.meu ? 'seu pedido, aguardando o gestor' : 'aguardando o gestor'}</Situacao>
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
              {podeDecidir && p.status === 'aprovado' && (
                <Button size="sm" variant="outline" className="ml-auto" onClick={() => abrirDecisao('desfazer', p)}>
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
            <DialogTitle className="text-dialogo">{pedindo?.substitui ? 'Refazer o pedido' : 'Pedir unificação'}</DialogTitle>
            <DialogDescription className="text-controle">
              {pedindo?.substitui
                ? 'O pedido atual é cancelado e um novo vai para o gestor com o cadastro escolhido ficando. '
                : ''}
              Confira o cadastro que fica. O outro fica inativo e passa a aparecer junto do principal; nada é apagado e o gestor pode desfazer.
            </DialogDescription>
          </DialogHeader>
          <div role="radiogroup" aria-label="Cadastro que fica" className="flex flex-col gap-2">
            {pedindo?.candidato.cadastros.map((k) => {
              const sugerido = sugerirPrincipal(pedindo.candidato.cadastros) === k.id
              const escolhido = pedindo.principal === k.id
              return (
                // padrao-ok: cartão selecionável do par de cadastros (radio); não há peça de base para cartão
                <button key={k.id} type="button" role="radio" aria-checked={escolhido} onClick={() => setPedindo({ ...pedindo, principal: k.id })}
                  className={cn('flex flex-col rounded-controle border text-left', escolhido ? 'border-acao ring-1 ring-acao' : 'border-fio')}>
                  <LinhaCadastro c={k} destaque={escolhido ? 'fica' : undefined} />
                  {sugerido && (
                    <span className="px-3 pb-2 text-rotulo text-acao">recomendado: {porQueSugerido(pedindo.candidato.cadastros)}</span>
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
            <Button variant="outline" onClick={() => setPedindo(null)}>Voltar</Button>
            <Button disabled={pedir.isPending || !pedindo || motivo.trim().length < motivoMinimo(divergenciasPedido)
              || (divergenciasPedido.length > 0 && !confirmoPedido)} onClick={() => pedindo && pedir.mutate(pedindo)}>
              <GitMerge /> {pedindo?.substitui ? 'Refazer o pedido' : 'Pedir'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!decidindo} onOpenChange={(v) => !v && setDecidindo(null)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-dialogo">{decidindo ? TITULO_DECISAO[decidindo.acao] : ''}</DialogTitle>
            <DialogDescription className="text-controle">
              {decidindo?.acao === 'aprovar'
                ? `${decidindo.p.principal.nome} (${pront(decidindo.p.principal)}) fica; o cadastro de ${pront(decidindo.p.absorvido)} fica inativo e passa a aparecer junto dele. Nenhum registro clínico muda de paciente, e dá para desfazer depois.`
                : decidindo?.acao === 'recusar' ? 'Os dois cadastros continuam separados.'
                  : decidindo?.acao === 'cancelar' ? 'O pedido sai da fila do gestor e os dois cadastros continuam separados.'
                    : 'O cadastro absorvido volta a ficar ativo e separado; CPF/CNS que tinham passado ao principal voltam.'}
            </DialogDescription>
          </DialogHeader>
          {decidindo?.acao === 'aprovar' && divergenciasDecisao.length > 0 && (
            <>
              <AlertaDocumentos divergencias={divergenciasDecisao} />
              <Confirmo id="confirmo-decisao" marcado={confirmoDecisao} mudar={setConfirmoDecisao} />
            </>
          )}
          {precisaMotivo && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="motivo-dec">Motivo</Label>
              <Textarea id="motivo-dec" rows={2} value={motivoDecisao} onChange={(e) => setMotivoDecisao(e.target.value)} />
              <span className="text-rotulo text-tinta-sussurro">Mínimo de 10 letras.</span>
            </div>
          )}
          {decidir.error && <p role="alert" className="text-apoio text-critico">{(decidir.error as Error).message}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDecidindo(null)}>Voltar</Button>
            <Button variant={decidindo?.acao === 'aprovar' ? 'default' : 'destructive'}
              disabled={decidir.isPending || (precisaMotivo && motivoDecisao.trim().length < 10)
                || (decidindo?.acao === 'aprovar' && divergenciasDecisao.length > 0 && !confirmoDecisao)}
              onClick={() => decidindo && decidir.mutate({ ...decidindo, m: motivoDecisao.trim(), confirmo: confirmoDecisao })}>
              {decidindo?.acao === 'aprovar' ? <><Check /> Aprovar</>
                : decidindo?.acao === 'recusar' ? <><X /> Recusar</>
                  : decidindo?.acao === 'cancelar' ? <><X /> Cancelar o pedido</>
                    : <><Undo2 /> Desfazer</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
