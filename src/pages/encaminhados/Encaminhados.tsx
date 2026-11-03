// Encaminhados da UBS (5A, tarefa 5, parte 5.2; H3 e opção C do RT em
// 03/11/2026): os envios à UPA e as solicitações de regulação da unidade, em
// lista, e à direita o rastreio em etapas do escolhido (ref. Shop, acompanhar o
// pedido). Envio à UPA: enviado → aguardando a chegada (12 h) → chegou / não
// chegou / cancelado. Regulação: a situação da central e do destino.
// 5A, tarefa 6 (I4): a aba Retornos traz o paciente que voltou da UPA ou do
// hospital; a notificação abre direto nela (?aba=retornos).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ambulance, Send, Waypoints, X } from 'lucide-react'
import * as React from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { Chip, Chips, TituloPagina, TituloSecao, Vazio } from '@/components/monitor/Pagina'
import { Estado } from '@/components/porta/Estado'
import { BotaoLinha } from '@/components/ui/botao-linha'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { useUnidade } from '@/contexts/UnidadeContext'
import { SITUACAO_ENVIO, etapasDoEnvio, nomeDoEnvio, type EnvioUpa, type Etapa } from '@/domain/encaminhamento'
import { rotuloIdade } from '@/domain/idade'
import { dataIso, diaMesHora } from '@/lib/formato'
import { STATUS } from '@/lib/regulacao'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

import { Retornos } from './Retornos'
import { useRetornos } from './useRetornos'

type Regulacao = {
  id: string; numero: number; status: keyof typeof STATUS; tipo: string; especialidade: string | null; procedimento_nome: string | null
  destino_unidade: { id: string; nome: string } | null; destino_externo: string | null
  paciente: { id: string; nome: string; nascimento: string | null } | null
  criada_em: string; autorizada_em: string | null; data_prevista: string | null; realizada_em: string | null; falta_em: string | null
  negada_em: string | null; cancelada_em: string | null; quadro_clinico: string
}
type Item = { tipo: 'upa'; em: string; e: EnvioUpa } | { tipo: 'regulacao'; em: string; r: Regulacao }

const msg = (e: unknown) => (e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e))
const TOM_REG: Partial<Record<string, 'ambar' | 'verde' | 'vermelho' | 'cinza' | 'teal'>> = {
  realizada: 'verde', agendada: 'verde', autorizada: 'teal', falta: 'vermelho', negada: 'vermelho', cancelada: 'cinza', excluida: 'cinza',
}
const TIPO_REG: Record<string, string> = { consulta: 'Consulta', exame: 'Exame', leito: 'Leito', transferencia: 'Transferência' }

function etapasDaRegulacao(r: Regulacao): Etapa[] {
  const fim = ['realizada', 'falta', 'negada', 'cancelada', 'excluida'].includes(r.status)
  const autorizada = ['autorizada', 'agendada', 'aguardando_destino', 'em_transito', 'realizada', 'falta'].includes(r.status)
  const etapas: Etapa[] = [
    { titulo: 'Solicitada à central', detalhe: diaMesHora(r.criada_em), estado: 'feita' },
    { titulo: autorizada ? 'Autorizada' : r.status === 'negada' ? 'Negada' : 'Na central', detalhe: STATUS[r.status] ?? r.status,
      estado: autorizada ? 'feita' : r.status === 'negada' || r.status === 'cancelada' ? 'falhou' : 'atual' },
  ]
  if (autorizada) {
    etapas.push({
      titulo: r.status === 'realizada' ? 'Realizada' : r.status === 'falta' ? 'Paciente faltou' : 'Aguardando o atendimento',
      detalhe: [r.destino_unidade?.nome ?? r.destino_externo, r.data_prevista ? `previsto ${r.data_prevista.split('-').reverse().join('/')}` : null].filter(Boolean).join(' · '),
      estado: r.status === 'realizada' ? 'feita' : r.status === 'falta' ? 'falhou' : 'atual',
    })
  }
  if (r.status === 'cancelada' && !fim) etapas.push({ titulo: 'Cancelada', detalhe: '', estado: 'falhou' })
  return etapas
}

function Trilha({ etapas }: { etapas: Etapa[] }) {
  return (
    <ol className="flex flex-col">
      {etapas.map((t, i) => (
        <li key={i} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span aria-hidden className={cn('mt-0.5 size-3.5 shrink-0 rounded-capsula border-2',
              t.estado === 'feita' ? 'border-acao bg-acao' : t.estado === 'atual' ? 'border-atencao bg-atencao'
                : t.estado === 'falhou' ? 'border-critico bg-critico' : 'border-fio-forte bg-superficie')} />
            {i < etapas.length - 1 && <span aria-hidden className="min-h-7 w-0.5 flex-1 bg-fio" />}
          </div>
          <div className="pb-3">
            <span className={cn('text-controle font-semibold', t.estado === 'falta' ? 'text-tinta-sussurro' : 'text-tinta')}>{t.titulo}</span>
            {t.detalhe && <p className="text-apoio text-tinta-apoio">{t.detalhe}</p>}
          </div>
        </li>
      ))}
    </ol>
  )
}

export default function Encaminhados() {
  const { unidadeAtiva } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  const [busca, setBusca] = useSearchParams()
  const aba = busca.get('aba') === 'retornos' ? 'retornos' : 'enviados'
  const aVer = (useRetornos(unidadeId).data ?? []).filter((r) => r.situacao === 'a_ver').length
  return (
    <>
      <TituloPagina titulo="Encaminhados" descricao="Envios à UPA, solicitações de regulação e retornos da UPA ou do hospital nos últimos 30 dias." />
      <Chips rotulo="Encaminhados">
        <Chip ativo={aba === 'enviados'} onClick={() => setBusca({}, { replace: true })}>Enviados</Chip>
        <Chip ativo={aba === 'retornos'} contagem={aVer || undefined} onClick={() => setBusca({ aba: 'retornos' }, { replace: true })}>Retornos</Chip>
      </Chips>
      {aba === 'retornos' ? <Retornos unidadeId={unidadeId} /> : <Enviados unidadeId={unidadeId} />}
    </>
  )
}

function Enviados({ unidadeId }: { unidadeId: string | undefined }) {
  const envios = useQuery({
    queryKey: ['encaminhamentos-upa', 'origem', unidadeId],
    enabled: !!unidadeId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('encaminhamentos_upa_origem', { p_unidade: unidadeId!, p_dias: 30 })
      if (error) throw error
      return (data ?? []) as unknown as EnvioUpa[]
    },
  })
  // a regulação é do médico, do gestor e do NIR: para os outros papéis, a lista fica só com os envios à UPA
  const regulacoes = useQuery({
    queryKey: ['encaminhamentos-regulacao', unidadeId],
    enabled: !!unidadeId,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('regulacao_lista', { p_unidade: unidadeId! })
      if (error) return [] as Regulacao[]
      const desde = Date.now() - 30 * 86_400_000
      return ((data ?? []) as unknown as Regulacao[]).filter((r) => Date.parse(r.criada_em) > desde)
    },
  })
  const itens: Item[] = [
    ...(envios.data ?? []).map((e) => ({ tipo: 'upa' as const, em: e.enviado_em, e })),
    ...(regulacoes.data ?? []).map((r) => ({ tipo: 'regulacao' as const, em: r.criada_em, r })),
  ].sort((a, b) => b.em.localeCompare(a.em))
  const [sel, setSel] = React.useState<string | null>(null)
  const escolhido = itens.find((i) => (i.tipo === 'upa' ? i.e.id : i.r.id) === sel) ?? itens[0]

  return (
    <>
      {envios.isLoading ? <Spinner /> : envios.error ? <p className="text-apoio text-critico">{msg(envios.error)}</p>
        : itens.length === 0 ? <Vazio icone={Send} titulo="Nada encaminhado" texto="Os envios à UPA e as solicitações de regulação aparecem aqui." /> : (
          <div className="grid items-start overflow-hidden rounded-cartao border border-fio bg-superficie md:grid-cols-[minmax(0,340px)_1fr]">
            <ul aria-label="Encaminhados" className="max-h-[70vh] overflow-y-auto border-b border-fio md:border-r md:border-b-0">
              {itens.map((i) => {
                const id = i.tipo === 'upa' ? i.e.id : i.r.id
                const ativo = escolhido && (escolhido.tipo === 'upa' ? escolhido.e.id : escolhido.r.id) === id
                return (
                  <li key={id}>
                    <BotaoLinha variante="linha" aria-current={ativo || undefined} onClick={() => setSel(id)}
                      className={cn('flex-col gap-0.5', ativo && 'bg-alerta-marca')}>
                      <span className="flex w-full items-center justify-between gap-2">
                        <strong className="truncate text-controle text-tinta">{i.tipo === 'upa' ? nomeDoEnvio(i.e) : i.r.paciente?.nome ?? '—'}</strong>
                        {i.tipo === 'upa'
                          ? <Estado tom={SITUACAO_ENVIO[i.e.situacao].tom}>{SITUACAO_ENVIO[i.e.situacao].rotulo}</Estado>
                          : <Estado tom={TOM_REG[i.r.status] ?? 'ambar'}>{STATUS[i.r.status] ?? i.r.status}</Estado>}
                      </span>
                      <span className="text-rotulo text-tinta-sussurro">
                        {i.tipo === 'upa' ? `UPA → ${i.e.unidade_destino}` : `Regulação → ${TIPO_REG[i.r.tipo] ?? i.r.tipo}${i.r.especialidade ? `: ${i.r.especialidade}` : ''}`} · {diaMesHora(i.em)}
                      </span>
                    </BotaoLinha>
                  </li>
                )
              })}
            </ul>
            {escolhido && (escolhido.tipo === 'upa' ? <DetalheEnvio key={escolhido.e.id} e={escolhido.e} /> : <DetalheRegulacao key={escolhido.r.id} r={escolhido.r} />)}
          </div>
        )}
    </>
  )
}

function DetalheEnvio({ e }: { e: EnvioUpa }) {
  const qc = useQueryClient()
  const [cancelar, setCancelar] = React.useState(false)
  const [motivo, setMotivo] = React.useState('')
  const soap = e.resumo.soap
  const cancela = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('encaminhamento_upa_cancelar', { p_id: e.id, p_motivo: motivo.trim() })
      if (error) throw error
    },
    onSuccess: () => { setCancelar(false); void qc.invalidateQueries({ queryKey: ['encaminhamentos-upa'] }) },
  })
  const p = e.resumo.paciente
  return (
    <section aria-label="Rastreio do envio" className="flex flex-col gap-3 px-5 py-4">
      <span className="rotulo flex items-center gap-1.5 text-tinta-sussurro"><Ambulance className="size-3.5" aria-hidden /> Envio à UPA nº {e.numero}</span>
      <TituloSecao className="mb-0" extra={p.data_nascimento ? rotuloIdade(p.data_nascimento, dataIso()) : undefined}>{nomeDoEnvio(e)}</TituloSecao>
      <p className="text-controle text-tinta-apoio">{e.motivo} · <span className="text-tinta-sussurro">{e.unidade_destino}</span></p>
      <Trilha etapas={etapasDoEnvio(e, diaMesHora)} />
      <div className="rounded-container border border-fio px-3.5 py-2.5 text-apoio text-tinta-apoio">
        <span className="rotulo text-tinta-sussurro">Resumo enviado</span>
        {soap?.avaliacao && <p><strong className="text-tinta">A</strong> {soap.avaliacao}{soap.cid ? ` · CID ${soap.cid}` : ''}</p>}
        {soap?.objetivo && <p><strong className="text-tinta">O</strong> {soap.objetivo}</p>}
        {!soap && <p>{e.resumo.queixa ?? 'Sem SOAP registrado no envio (veio da escuta inicial).'}</p>}
      </div>
      {e.situacao === 'enviado' && (
        <div><Button size="sm" variant="outline" onClick={() => setCancelar(true)}><X /> Cancelar o envio</Button></div>
      )}
      <Dialog open={cancelar} onOpenChange={(o) => { if (!o) setCancelar(false) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar o envio à {e.unidade_destino}</DialogTitle>
            <DialogDescription>A UPA é avisada de que o paciente não vai mais.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cancelar-envio">Motivo</Label>
            <Input id="cancelar-envio" value={motivo} onChange={(ev) => setMotivo(ev.target.value)} />
          </div>
          {cancela.error && <p role="alert" className="text-apoio text-critico">{msg(cancela.error)}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCancelar(false)}>Voltar</Button>
            <Button variant="destructive" disabled={motivo.trim().length < 5 || cancela.isPending} onClick={() => cancela.mutate()}>Cancelar o envio</Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}

function DetalheRegulacao({ r }: { r: Regulacao }) {
  return (
    <section aria-label="Rastreio da regulação" className="flex flex-col gap-3 px-5 py-4">
      <span className="rotulo flex items-center gap-1.5 text-tinta-sussurro"><Waypoints className="size-3.5" aria-hidden /> Regulação nº {r.numero}</span>
      <TituloSecao className="mb-0">{r.paciente?.nome ?? '—'}</TituloSecao>
      <p className="text-controle text-tinta-apoio">
        {TIPO_REG[r.tipo] ?? r.tipo}{r.especialidade ? `: ${r.especialidade}` : ''}{r.procedimento_nome ? ` · ${r.procedimento_nome}` : ''}
      </p>
      <Trilha etapas={etapasDaRegulacao(r)} />
      <div><Button size="sm" variant="outline" render={<Link to="/regulacao" />}><Waypoints /> Abrir na regulação</Button></div>
    </section>
  )
}
