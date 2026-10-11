// ─────────────────────────────────────────────────────────────────────────────
// Aceite pela unidade destino (Fase 4, tarefa 9; decisões do RT de 11/10/2026).
//
// • A central autoriza para uma unidade da rede; o pedido fica "aguardando o
//   destino". O médico plantonista ou o gestor do destino aceita (no pedido de
//   leito, escolhendo o leito que fica reservado) ou recusa com motivo; na
//   recusa o pedido volta à central.
// • Chegada: a origem marca "saiu"; o destino marca "chegou" ou "não chegou".
// • Destino fora da rede: a central registra a resposta e a chegada.
// Migration 20261115000001_aceite_destino.sql.
// ─────────────────────────────────────────────────────────────────────────────
import { useMutation, useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, Hospital } from 'lucide-react'
import * as React from 'react'

import { Vazio } from '@/components/monitor/Pagina'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { fmtDataHora } from '@/lib/datas'
import {
  MEIOS_CONFIRMACAO, MOTIVOS_RECUSA_DESTINO, PRIORIDADES, STATUS, esperandoChegada, resumoPedido,
  type MeioConfirmacao, type MotivoRecusaDestino, type Prioridade, type StatusRegulacao, type TipoSolicitacao,
} from '@/lib/regulacao'
import { supabase } from '@/lib/supabase'

const SELECT = 'h-8 rounded-controle border border-fio bg-campo px-2'

/** Campos do pedido que o destino e a chegada usam. */
export type PedidoDestino = {
  id: string; numero: number; status: StatusRegulacao; tipo: TipoSolicitacao; tipo_leito: string | null
  destino_tipo: 'rede' | 'externo' | 'a_definir'; destino_unidade: { id: string; nome: string } | null; destino_externo: string | null
  destino_enviado_em?: string | null; destino_resposta?: 'aceita' | 'recusada' | null; destino_respondido_em?: string | null
  destino_respondido_por?: string | null
  reserva?: { leito: string; setor: string; situacao: string; expira_em: string } | null
  saida_em?: string | null; saida_por?: string | null; realizada_em?: string | null; falta_em?: string | null
  chegada_observacao?: string | null; chegada_por?: string | null
  ultima_recusa?: { em: string; motivo: MotivoRecusaDestino | null; texto: string | null; registro: string | null; por: string | null
    destino: string | null; externo_quem: string | null; externo_meio: MeioConfirmacao | null } | null
  ultimo_aceite?: { em: string; texto: string | null; registro: string | null; por: string | null
    externo_quem: string | null; externo_meio: MeioConfirmacao | null } | null
  sou_destino?: boolean
  origem_pode_responder: boolean
}

/** O que aconteceu com o destino: aguardando, aceite, recusa anterior, saída e chegada. */
export function BlocoDestino({ s }: { s: PedidoDestino }) {
  const nome = s.destino_tipo === 'rede' ? s.destino_unidade?.nome : s.destino_externo
  const a = s.ultimo_aceite
  const r = s.ultima_recusa
  const quem = (x: { por: string | null; registro: string | null; externo_quem: string | null; externo_meio: MeioConfirmacao | null }) =>
    x.externo_quem
      ? `${x.externo_quem} (${x.externo_meio ? MEIOS_CONFIRMACAO[x.externo_meio].toLowerCase() : '—'}; registrado por ${x.por ?? '—'})`
      : `${x.por ?? '—'}${x.registro ? `, ${x.registro}` : ''}`
  return (
    <>
      {s.status === 'aguardando_destino' && (
        <div className="rounded-md border border-atencao/30 bg-alerta-atencao px-3 py-2 text-tinta">
          <b>Aguardando o destino</b>: {nome ?? '—'}{s.destino_enviado_em ? `, desde ${fmtDataHora(s.destino_enviado_em)}` : ''}.
          {s.destino_tipo === 'externo' && <span className="block text-tinta-apoio">Serviço de fora da rede: a central registra a resposta.</span>}
        </div>
      )}
      {a && s.destino_resposta === 'aceita' && ['autorizada', 'agendada', 'em_transito', 'realizada', 'falta'].includes(s.status) && (
        <div className="rounded-md border border-sucesso/30 bg-sucesso/5 px-3 py-2 text-tinta">
          <b>Aceito pelo destino</b> ({nome ?? '—'}) por {quem(a)} em {fmtDataHora(a.em)}
          {s.reserva && <> · leito <b>{s.reserva.leito}</b> ({s.reserva.setor}) {s.reserva.situacao === 'ativa' ? `reservado até ${fmtDataHora(s.reserva.expira_em)}` : `— reserva ${s.reserva.situacao}`}</>}
          {a.texto && <span className="block text-tinta-apoio">{a.texto}</span>}
        </div>
      )}
      {r && ['enviada', 'em_analise', 'pendencia'].includes(s.status) && s.destino_resposta === 'recusada' && (
        <div className="rounded-md border border-critico/30 bg-alerta-critico px-3 py-2 text-tinta">
          <b>Recusado pelo destino</b> ({r.destino ?? '—'}) por {quem(r)} em {fmtDataHora(r.em)}: {r.motivo ? MOTIVOS_RECUSA_DESTINO[r.motivo] : ''}
          {r.texto && <span className="block text-tinta-apoio">{r.texto}</span>}
          <span className="block text-tinta-apoio">O pedido voltou à central para escolher outro destino.</span>
        </div>
      )}
      {(s.saida_em || s.realizada_em || s.falta_em) && (
        <p className="text-tinta-apoio">
          {s.saida_em && <>Saiu da origem em {fmtDataHora(s.saida_em)} ({s.saida_por ?? '—'}). </>}
          {s.status === 'realizada' && s.realizada_em && <>Chegou ao destino em {fmtDataHora(s.realizada_em)} ({s.chegada_por ?? '—'}). </>}
          {s.status === 'falta' && s.falta_em && <>Não chegou — registrado em {fmtDataHora(s.falta_em)} ({s.chegada_por ?? '—'}). </>}
          {s.chegada_observacao}
        </p>
      )}
    </>
  )
}

type LeitoLivre = { id: string; leito: string; setor: string; tipo_regulacao: string | null; do_tipo: boolean }

/** O destino da rede responde (aceita ou recusa) e, depois, marca a chegada. */
export function AcoesDestino({ s, aoFim }: { s: PedidoDestino; aoFim: () => void }) {
  const [acao, setAcao] = React.useState<'aceitar' | 'recusar' | 'nao_chegou' | null>(null)
  const [leito, setLeito] = React.useState('')
  const [texto, setTexto] = React.useState('')
  const [motivo, setMotivo] = React.useState<MotivoRecusaDestino | ''>('')
  const aguardando = s.status === 'aguardando_destino' && s.destino_tipo === 'rede'
  const leitos = useQuery({
    queryKey: ['regulacao-leitos-destino', s.id],
    enabled: aguardando && acao === 'aceitar',
    queryFn: async () => {
      const { data, error } = await supabase.rpc('regulacao_leitos_destino', { p_id: s.id })
      if (error) throw error
      return (data ?? []) as unknown as LeitoLivre[]
    },
  })
  const fazer = useMutation({
    mutationFn: async (qual: 'aceitar' | 'recusar' | 'chegou' | 'nao_chegou') => {
      const r = qual === 'aceitar'
        ? await supabase.rpc('regulacao_destino_aceitar', { p_id: s.id, p_leito: leito || null, p_observacao: texto.trim() || null })
        : qual === 'recusar' ? await supabase.rpc('regulacao_destino_recusar', { p_id: s.id, p_motivo: motivo, p_texto: texto.trim() })
        : await supabase.rpc('regulacao_marcar_chegada', { p_id: s.id, p_chegou: qual === 'chegou', p_observacao: texto.trim() || null })
      if (r.error) throw r.error
    },
    onSuccess: () => { setAcao(null); setTexto(''); setMotivo(''); setLeito(''); aoFim() },
  })
  if (!s.sou_destino || !(aguardando || (s.destino_tipo === 'rede' && esperandoChegada(s.status)))) return null
  const exigeLeito = s.tipo === 'leito'
  return (
    <div className="flex flex-col gap-2 rounded-md border border-acao/30 p-3">
      <span className="font-medium text-tinta">{aguardando ? 'Resposta da unidade destino' : 'Chegada do paciente'}</span>
      <div className="flex flex-wrap gap-2">
        {aguardando ? (
          <>
            <Button size="xs" variant={acao === 'aceitar' ? 'default' : 'outline'} onClick={() => setAcao(acao === 'aceitar' ? null : 'aceitar')}>Aceitar</Button>
            <Button size="xs" variant="destructive" onClick={() => setAcao(acao === 'recusar' ? null : 'recusar')}>Recusar</Button>
          </>
        ) : (
          <>
            <Button size="xs" onClick={() => fazer.mutate('chegou')} disabled={fazer.isPending}>Paciente chegou</Button>
            <Button size="xs" variant="outline" onClick={() => setAcao(acao === 'nao_chegou' ? null : 'nao_chegou')}>Não chegou</Button>
          </>
        )}
      </div>
      {acao === 'aceitar' && (
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="flex flex-col gap-1 sm:col-span-2">
            <Label htmlFor={`ac-leito-${s.id}`} className="text-xs">{exigeLeito ? 'Leito reservado para o paciente (obrigatório)' : 'Leito reservado (opcional)'}</Label>
            {leitos.isLoading ? <Spinner /> : (
              <select id={`ac-leito-${s.id}`} className={SELECT} value={leito} onChange={(e) => setLeito(e.target.value)}>
                <option value="">{(leitos.data ?? []).length === 0 ? 'Nenhum leito livre' : 'Escolha…'}</option>
                {(leitos.data ?? []).map((l) => <option key={l.id} value={l.id}>{l.leito} · {l.setor}{l.do_tipo ? ' (do tipo pedido)' : ''}</option>)}
              </select>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`ac-obs-${s.id}`} className="text-xs">Observação (opcional)</Label>
            <Input id={`ac-obs-${s.id}`} className="h-8" value={texto} onChange={(e) => setTexto(e.target.value)} />
          </div>
          <div><Button size="sm" onClick={() => fazer.mutate('aceitar')} disabled={fazer.isPending || (exigeLeito && !leito)}>Confirmar aceite</Button></div>
        </div>
      )}
      {acao === 'recusar' && (
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor={`rc-mot-${s.id}`} className="text-xs">Motivo</Label>
            <select id={`rc-mot-${s.id}`} className={SELECT} value={motivo} onChange={(e) => setMotivo(e.target.value as MotivoRecusaDestino | '')}>
              <option value="">Escolha…</option>
              {(Object.keys(MOTIVOS_RECUSA_DESTINO) as MotivoRecusaDestino[]).map((k) => <option key={k} value={k}>{MOTIVOS_RECUSA_DESTINO[k]}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <Label htmlFor={`rc-txt-${s.id}`} className="text-xs">Justificativa (a central e a origem veem)</Label>
            <Input id={`rc-txt-${s.id}`} className="h-8" value={texto} onChange={(e) => setTexto(e.target.value)} />
          </div>
          <div><Button size="sm" variant="destructive" onClick={() => fazer.mutate('recusar')} disabled={fazer.isPending || !motivo || texto.trim().length < 10}>Confirmar recusa</Button></div>
        </div>
      )}
      {acao === 'nao_chegou' && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex min-w-60 flex-1 flex-col gap-1">
            <Label htmlFor={`nc-${s.id}`} className="text-xs">O que aconteceu (a origem é avisada; a reserva do leito é liberada)</Label>
            <Input id={`nc-${s.id}`} className="h-8" value={texto} onChange={(e) => setTexto(e.target.value)} />
          </div>
          <Button size="sm" variant="destructive" onClick={() => fazer.mutate('nao_chegou')} disabled={fazer.isPending || texto.trim().length < 10}>Registrar falta</Button>
        </div>
      )}
      {fazer.error && <p role="alert" className="text-rotulo text-critico">{(fazer.error as Error).message}</p>}
    </div>
  )
}

/** A origem marca a saída do paciente. */
export function SaidaOrigem({ s, aoFim }: { s: PedidoDestino; aoFim: () => void }) {
  const sair = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('regulacao_marcar_saida', { p_id: s.id })
      if (error) throw error
    },
    onSuccess: aoFim,
  })
  if (!s.origem_pode_responder || !(s.status === 'autorizada' || s.status === 'agendada')) return null
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" onClick={() => sair.mutate()} disabled={sair.isPending}>Paciente saiu</Button>
      <span className="text-rotulo text-tinta-sussurro">Avisa o destino que o paciente está a caminho.</span>
      {sair.error && <span role="alert" className="text-rotulo text-critico">{(sair.error as Error).message}</span>}
    </div>
  )
}

/** Destino fora da rede: o regulador registra a resposta do serviço e a chegada. */
export function DestinoExterno({ s, aoFim }: { s: PedidoDestino; aoFim: () => void }) {
  const [aceita, setAceita] = React.useState<'sim' | 'nao' | ''>('')
  const [quem, setQuem] = React.useState('')
  const [meio, setMeio] = React.useState<MeioConfirmacao | ''>('')
  const [motivo, setMotivo] = React.useState<MotivoRecusaDestino | ''>('')
  const [texto, setTexto] = React.useState('')
  const [falta, setFalta] = React.useState(false)
  const registrar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('regulacao_registrar_resposta_externa', {
        p_id: s.id, p_aceita: aceita === 'sim', p_quem: quem.trim(), p_meio: meio,
        p_motivo: aceita === 'nao' ? motivo || null : null, p_texto: texto.trim() || null,
      })
      if (error) throw error
    },
    onSuccess: () => { setAceita(''); setQuem(''); setMeio(''); setMotivo(''); setTexto(''); aoFim() },
  })
  const chegada = useMutation({
    mutationFn: async (chegou: boolean) => {
      const { error } = await supabase.rpc('regulacao_marcar_chegada', { p_id: s.id, p_chegou: chegou, p_observacao: texto.trim() || null })
      if (error) throw error
    },
    onSuccess: () => { setTexto(''); setFalta(false); aoFim() },
  })
  if (s.destino_tipo !== 'externo') return null
  if (s.status === 'aguardando_destino') {
    const pronto = aceita && quem.trim().length >= 3 && meio && (aceita === 'sim' || (motivo && texto.trim().length >= 10))
    return (
      <div className="flex flex-col gap-2 rounded-md border border-acao/30 p-3">
        <span className="font-medium text-tinta">Resposta do serviço de fora da rede ({s.destino_externo})</span>
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor={`ex-ac-${s.id}`} className="text-xs">Resposta</Label>
            <select id={`ex-ac-${s.id}`} className={SELECT} value={aceita} onChange={(e) => setAceita(e.target.value as 'sim' | 'nao' | '')}>
              <option value="">Escolha…</option><option value="sim">Aceitou</option><option value="nao">Recusou</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`ex-quem-${s.id}`} className="text-xs">Quem confirmou no serviço</Label>
            <Input id={`ex-quem-${s.id}`} className="h-8" value={quem} onChange={(e) => setQuem(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`ex-meio-${s.id}`} className="text-xs">Meio</Label>
            <select id={`ex-meio-${s.id}`} className={SELECT} value={meio} onChange={(e) => setMeio(e.target.value as MeioConfirmacao | '')}>
              <option value="">Escolha…</option>
              {(Object.keys(MEIOS_CONFIRMACAO) as MeioConfirmacao[]).map((k) => <option key={k} value={k}>{MEIOS_CONFIRMACAO[k]}</option>)}
            </select>
          </div>
          {aceita === 'nao' && (
            <div className="flex flex-col gap-1">
              <Label htmlFor={`ex-mot-${s.id}`} className="text-xs">Motivo da recusa</Label>
              <select id={`ex-mot-${s.id}`} className={SELECT} value={motivo} onChange={(e) => setMotivo(e.target.value as MotivoRecusaDestino | '')}>
                <option value="">Escolha…</option>
                {(Object.keys(MOTIVOS_RECUSA_DESTINO) as MotivoRecusaDestino[]).map((k) => <option key={k} value={k}>{MOTIVOS_RECUSA_DESTINO[k]}</option>)}
              </select>
            </div>
          )}
          <div className={`flex flex-col gap-1 ${aceita === 'nao' ? 'sm:col-span-2' : 'sm:col-span-3'}`}>
            <Label htmlFor={`ex-txt-${s.id}`} className="text-xs">{aceita === 'nao' ? 'Justificativa' : 'Observação (opcional)'}</Label>
            <Input id={`ex-txt-${s.id}`} className="h-8" value={texto} onChange={(e) => setTexto(e.target.value)} />
          </div>
        </div>
        <div><Button size="sm" onClick={() => registrar.mutate()} disabled={registrar.isPending || !pronto}>Registrar resposta</Button></div>
        {registrar.error && <p role="alert" className="text-rotulo text-critico">{(registrar.error as Error).message}</p>}
      </div>
    )
  }
  if (!esperandoChegada(s.status)) return null
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-md border border-acao/30 p-3">
      <span className="w-full font-medium text-tinta">Chegada ao serviço de fora da rede</span>
      <Button size="xs" onClick={() => chegada.mutate(true)} disabled={chegada.isPending}>Paciente chegou</Button>
      <Button size="xs" variant="outline" onClick={() => setFalta(!falta)}>Não chegou</Button>
      {falta && (
        <>
          <Input aria-label="O que aconteceu" className="h-8 min-w-60 flex-1" placeholder="O que aconteceu" value={texto} onChange={(e) => setTexto(e.target.value)} />
          <Button size="xs" variant="destructive" onClick={() => chegada.mutate(false)} disabled={chegada.isPending || texto.trim().length < 10}>Registrar falta</Button>
        </>
      )}
      {chegada.error && <p role="alert" className="w-full text-rotulo text-critico">{(chegada.error as Error).message}</p>}
    </div>
  )
}

type Recebido = PedidoDestino & {
  prioridade: Prioridade; prioridade_regulador: Prioridade | null
  procedimento: string | null; procedimento_nome: string | null; especialidade: string | null
  paciente: { nome: string }; paciente_nao_identificado: boolean; origem: { nome: string }
}

/** Pedidos que a central mandou para esta unidade. */
export function RecebidosDestino({ unidadeId, detalhe }: { unidadeId: string; detalhe: (id: string) => React.ReactNode }) {
  const [aberta, setAberta] = React.useState<string | null>(null)
  const lista = useQuery({
    queryKey: ['regulacao-destino', unidadeId],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('regulacao_destino_lista', { p_unidade: unidadeId })
      if (error) throw error
      return (data ?? []) as unknown as Recebido[]
    },
  })
  const aguardando = (lista.data ?? []).filter((s) => s.status === 'aguardando_destino').length
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Hospital className="size-4" aria-hidden /> Recebidos da central
          {aguardando > 0 && <Badge variant="warning">Aguardando aceite: {aguardando}</Badge>}
        </CardTitle>
        <CardDescription>Pedidos que a central mandou para esta unidade. O médico plantonista ou o gestor aceita ou recusa, e marca a chegada.</CardDescription>
      </CardHeader>
      <CardContent className="text-apoio">
        {lista.isLoading ? <Spinner /> : lista.error ? <p role="alert" className="text-critico">{(lista.error as Error).message}</p>
          : (lista.data ?? []).length === 0 ? (
            <Vazio icone={Hospital} titulo="Nada recebido" texto="Quando a central autorizar um pedido para esta unidade, ele aparece aqui." />
          ) : (
            <ul className="flex flex-col divide-y divide-fio">
              {lista.data!.map((s) => {
                const ef = s.prioridade_regulador ?? s.prioridade
                return (
                  <li key={s.id} className="py-2">
                    <button type="button" aria-expanded={aberta === s.id}
                      className="flex w-full flex-wrap items-center gap-2 rounded-md px-1 py-0.5 text-left hover:bg-campo"
                      onClick={() => setAberta(aberta === s.id ? null : s.id)}>
                      {aberta === s.id ? <ChevronDown className="size-4 text-tinta-sussurro" aria-hidden /> : <ChevronRight className="size-4 text-tinta-sussurro" aria-hidden />}
                      <Badge variant={PRIORIDADES[ef].tom === 'critico' ? 'destructive' : PRIORIDADES[ef].tom === 'atencao' ? 'warning' : 'secondary'}>{PRIORIDADES[ef].rotulo}</Badge>
                      <span className="font-medium text-tinta">{s.paciente.nome}{s.paciente_nao_identificado && ' (não identificado)'}</span>
                      <span className="text-tinta-apoio">{resumoPedido(s)}</span>
                      <span className="text-tinta-sussurro">nº {s.numero} · de {s.origem.nome}</span>
                      <Badge variant={s.status === 'aguardando_destino' ? 'warning' : 'info'}>{STATUS[s.status]}</Badge>
                      <span className="ml-auto text-rotulo text-acao">{aberta === s.id ? 'Fechar' : 'Ver detalhes'}</span>
                    </button>
                    {aberta === s.id && detalhe(s.id)}
                  </li>
                )
              })}
            </ul>
          )}
      </CardContent>
    </Card>
  )
}
