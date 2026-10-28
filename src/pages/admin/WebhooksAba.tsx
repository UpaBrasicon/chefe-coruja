// ─────────────────────────────────────────────────────────────────────────────
// Integrações › Webhooks (Fase 5C, tarefa 4, etapa 4.3; escolha do RT de
// 27/10/2026: opção A, lista com gaveta). Referências do Refero em
// docs/frontend/revisao-visual/app/PLANO.md.
//
// • Super admin: cadastra o destino (o segredo aparece uma vez só), troca o
//   segredo e religa.
// • Gestor: vê os destinos das unidades dele, as entregas, desliga com motivo e
//   reenvia.
// Regras em src/lib/webhooks.ts; banco em 20270201000001_webhooks.sql.
// ─────────────────────────────────────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, KeyRound, Plus, RotateCw, Webhook } from 'lucide-react'
import * as React from 'react'

import { Vazio } from '@/components/monitor/Pagina'
import { Aviso } from '@/components/ui/aviso'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CaixaMarcar } from '@/components/ui/caixa-marcar'
import { CampoSelecao } from '@/components/ui/campo-selecao'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Gaveta, GavetaCabeca, GavetaPe } from '@/components/ui/gaveta'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MensagemErro } from '@/components/ui/mensagem-erro'
import { Spinner } from '@/components/ui/spinner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { useUnidade } from '@/contexts/UnidadeContext'
import { data as dataCurta, dataHora, diaMesHora, hora } from '@/lib/formato'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import {
  enderecoValido, EVENTOS, podeReenviar, respostaEntrega, resumo24h, ROTULO_DESTINO, ROTULO_ENTREGA, rotuloEvento,
  situacaoDestino, VARIANTE_DESTINO, VARIANTE_ENTREGA, type DestinoWebhook, type EntregaWebhook, type EventoWebhook,
} from '@/lib/webhooks'

type ChaveResumo = { id: string; nome: string; prefixo: string; ambiente: 'live' | 'test'; unidades: { id: string; nome: string }[]; revogada_em: string | null; vencida: boolean; expira_em: string }

const th = 'px-3 py-2 font-medium'
const td = 'px-3 py-2.5'

function Resumo({ d }: { d: DestinoWebhook }) {
  if (!d.ligado) return <span className="text-tinta-sussurro">{d.desligado_automatico ? 'desligado sozinho' : 'desligado'} em {diaMesHora(d.desligado_em!)}</span>
  return (
    <span className="tabular text-tinta-apoio">
      {resumo24h(d.entregas_24h).map((p, i) => (
        <React.Fragment key={i}>{i > 0 && ' · '}<span className={cn(p.tom === 'atencao' && 'font-semibold text-atencao', p.tom === 'critico' && 'font-semibold text-critico')}>{p.texto}</span></React.Fragment>
      ))}
    </span>
  )
}

export function WebhooksAba() {
  const { ehSuperAdmin } = useUnidade()
  const [abertoId, setAbertoId] = React.useState<string | null>(null)
  const [novo, setNovo] = React.useState(false)
  const lista = useQuery({
    queryKey: ['webhook-destinos'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('webhook_destinos_lista')
      if (error) throw error
      return (data ?? []) as unknown as DestinoWebhook[]
    },
  })
  const destinos = lista.data ?? []
  const aberto = destinos.find((d) => d.id === abertoId) ?? null
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-apoio text-tinta-apoio">
          O Chefe Coruja avisa o sistema de cada destino quando algo acontece. O aviso leva só os ids; o detalhe é lido pela API, com a chave do destino.
        </p>
        {ehSuperAdmin && <Button size="sm" onClick={() => setNovo(true)}><Plus className="size-4" aria-hidden />Novo destino</Button>}
      </div>
      {lista.isLoading ? <Spinner /> : lista.error ? <MensagemErro texto={(lista.error as Error).message} /> : destinos.length === 0 ? (
        <Vazio icone={Webhook} titulo="Nenhum destino" texto={ehSuperAdmin ? 'Cadastre o primeiro destino quando um sistema parceiro pedir os avisos.' : 'Nenhum sistema recebe avisos das suas unidades.'} />
      ) : (
        <div className="overflow-x-auto rounded-container border border-fio bg-superficie">
          <Table variante="referencia" className="w-full min-w-[820px] text-apoio">
            <TableHeader className="border-b border-fio text-left text-rotulo text-tinta-sussurro">
              <TableRow>
                <TableHead className={th}>Destino</TableHead><TableHead className={th}>Eventos</TableHead><TableHead className={th}>Unidades</TableHead>
                <TableHead className={th}>Últimas 24 h</TableHead><TableHead className={th}>Situação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {destinos.map((d) => {
                const s = situacaoDestino(d)
                return (
                  <TableRow key={d.id} className="cursor-pointer border-b border-trilha last:border-0 hover:bg-trilha/60" onClick={() => setAbertoId(d.id)}>
                    <TableCell className={td}>
                      <Button variant="link" className="h-auto p-0 font-medium text-tinta" onClick={(e) => { e.stopPropagation(); setAbertoId(d.id) }}>{d.nome}</Button>
                      <div className="max-w-[340px] truncate text-tinta-sussurro">{d.url}</div>
                    </TableCell>
                    <TableCell className={cn(td, 'tabular')}>{d.eventos.length} {d.eventos.length === 1 ? 'evento' : 'eventos'}</TableCell>
                    <TableCell className={td}>{d.unidades.map((u) => u.nome).join(', ')}</TableCell>
                    <TableCell className={td}><Resumo d={d} /></TableCell>
                    <TableCell className={td}><Badge variant={VARIANTE_DESTINO[s]}>{ROTULO_DESTINO[s]}</Badge></TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
      {aberto && <GavetaDestino d={aberto} onFechar={() => setAbertoId(null)} />}
      {ehSuperAdmin && <NovoDestino aberto={novo} onFechar={() => setNovo(false)} />}
    </div>
  )
}

function SegredoUmaVez({ segredo, onFechar }: { segredo: string; onFechar: () => void }) {
  return (
    <div role="status" className="flex flex-col gap-2 text-apoio">
      <div className="flex items-center gap-2 rounded-controle border border-fio bg-campo px-3 py-2">
        <code className="min-w-0 flex-1 break-all text-rotulo">{segredo}</code>
        <Button size="xs" variant="outline" onClick={() => void navigator.clipboard?.writeText(segredo)}><Copy className="size-3.5" aria-hidden />Copiar</Button>
      </div>
      <Aviso tom="informacao" titulo="Como o sistema confere">
        Cada aviso traz webhook-id, webhook-timestamp e webhook-signature, no padrão Standard Webhooks. O passo a passo está na página da API.
      </Aviso>
      <Button size="sm" className="self-end" onClick={onFechar}>Já guardei</Button>
    </div>
  )
}

function GavetaDestino({ d, onFechar }: { d: DestinoWebhook; onFechar: () => void }) {
  const qc = useQueryClient()
  const { ehSuperAdmin } = useUnidade()
  const [acao, setAcao] = React.useState<'desligar' | null>(null)
  const [motivo, setMotivo] = React.useState('')
  const [segredo, setSegredo] = React.useState<string | null>(null)
  const s = situacaoDestino(d)
  const entregas = useQuery({
    queryKey: ['webhook-entregas', d.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('webhook_entregas_do_destino', { p_destino: d.id })
      if (error) throw error
      return (data ?? []) as unknown as EntregaWebhook[]
    },
  })
  const recarregar = () => {
    void qc.invalidateQueries({ queryKey: ['webhook-destinos'] })
    void qc.invalidateQueries({ queryKey: ['webhook-entregas', d.id] })
  }
  const desligar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('webhook_desligar_destino', { p_destino: d.id, p_motivo: motivo.trim() })
      if (error) throw error
    },
    onSuccess: () => { setAcao(null); setMotivo(''); recarregar() },
  })
  const religar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('webhook_religar_destino', { p_destino: d.id })
      if (error) throw error
    },
    onSuccess: recarregar,
  })
  const girar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('webhook_girar_segredo', { p_destino: d.id })
      if (error) throw error
      return (data as unknown as { segredo: string }).segredo
    },
    onSuccess: (v) => { setSegredo(v); recarregar() },
  })
  const reenviar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('webhook_reenviar', { p_entrega: id })
      if (error) throw error
    },
    onSuccess: recarregar,
  })
  const erro = desligar.error ?? religar.error ?? girar.error ?? reenviar.error
  return (
    <Gaveta aberta onAbertaChange={(v) => { if (!v) onFechar() }} rotulo={`Destino ${d.nome}`}>
      <GavetaCabeca sobre="Destino de webhook" titulo={d.nome} detalhe={d.url} />
      <div className="flex flex-col gap-4 px-5 py-4 text-apoio">
        {s === 'falhando' && (
          <Aviso tom="atencao" titulo={`Falhando desde ${dataHora(d.falhando_desde!)}`}>
            {d.entregas_24h.pendente ? `${d.entregas_24h.pendente} na fila, com nova tentativa marcada. ` : ''}Se ficar 3 dias sem nenhuma entrega, o destino é desligado sozinho.
          </Aviso>
        )}
        {s === 'sem_chave' && <Aviso tom="critico" titulo="A chave da API venceu ou foi revogada">Os avisos pararam. Crie uma chave nova e cadastre o destino de novo.</Aviso>}
        {s === 'desligado' && (
          <Aviso tom="informacao" titulo={d.desligado_automatico ? `Desligado sozinho em ${dataHora(d.desligado_em!)}` : `Desligado em ${dataHora(d.desligado_em!)}${d.desligado_por ? ` por ${d.desligado_por}` : ''}`}>
            {d.motivo_desligamento}
          </Aviso>
        )}
        {segredo && <SegredoUmaVez segredo={segredo} onFechar={() => setSegredo(null)} />}
        <dl className="grid grid-cols-[110px_1fr] gap-x-4 gap-y-1.5">
          <dt className="text-tinta-sussurro">Chave da API</dt><dd><code className="text-rotulo">{d.chave.prefixo}…</code> {d.chave.nome}</dd>
          <dt className="text-tinta-sussurro">Unidades</dt><dd>{d.unidades.map((u) => u.nome).join(', ')}</dd>
          <dt className="text-tinta-sussurro">Eventos</dt><dd>{d.eventos.map(rotuloEvento).join(', ')}</dd>
          <dt className="text-tinta-sussurro">Segredo</dt><dd>{d.segredo_girado_em ? `trocado em ${dataHora(d.segredo_girado_em)}` : `desde o cadastro, em ${dataHora(d.criado_em)}`}</dd>
          <dt className="text-tinta-sussurro">Cadastro</dt><dd>{d.criado_por ?? '—'}, {dataHora(d.criado_em)}</dd>
        </dl>
        <section className="flex flex-col gap-2">
          <h3 className="text-rotulo font-semibold uppercase tracking-[0.04em] text-tinta-sussurro">Entregas recentes</h3>
          {entregas.isLoading ? <Spinner /> : entregas.error ? <MensagemErro texto={(entregas.error as Error).message} /> : (entregas.data ?? []).length === 0 ? (
            <span className="text-tinta-sussurro">Nenhum aviso ainda.</span>
          ) : (
            <ul className="flex max-h-[420px] flex-col divide-y divide-trilha overflow-y-auto rounded-container border border-fio">
              {(entregas.data ?? []).map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="min-w-0">
                    <span className="text-tinta">{rotuloEvento(e.tipo)}</span>
                    <span className="block text-tinta-sussurro"><span className="tabular">{diaMesHora(e.ocorrido_em)}</span>{respostaEntrega(e) ? ` · ${respostaEntrega(e)}` : ''}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Badge variant={VARIANTE_ENTREGA[e.situacao]}>{e.situacao === 'pendente' && e.tentativas > 0 ? `Nova tentativa ${hora(e.proxima_em)}` : ROTULO_ENTREGA[e.situacao]}</Badge>
                    {podeReenviar(e, d.ligado) && (
                      <Button size="xs" variant="ghost" disabled={reenviar.isPending} onClick={() => reenviar.mutate(e.id)}><RotateCw className="size-3.5" aria-hidden />Reenviar</Button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        {acao === 'desligar' && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="wh-motivo" className="text-rotulo">Motivo do desligamento</Label>
            <Textarea id="wh-motivo" rows={2} placeholder="ex.: o sistema do hospital está em manutenção até sexta" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            <span className="text-rotulo text-tinta-sussurro">Os avisos na fila são cancelados. Só a administração da plataforma religa.</span>
            <div className="flex gap-2">
              <Button size="sm" variant="destructive" disabled={motivo.trim().length < 10 || desligar.isPending} onClick={() => desligar.mutate()}>Desligar agora</Button>
              <Button size="sm" variant="ghost" onClick={() => setAcao(null)}>Voltar</Button>
            </div>
          </div>
        )}
        {erro && <MensagemErro texto={(erro as Error).message} />}
      </div>
      <GavetaPe>
        <div className="flex flex-wrap gap-2">
          {d.ligado && acao !== 'desligar' && <Button size="sm" variant="outline" onClick={() => setAcao('desligar')}>Desligar</Button>}
          {!d.ligado && ehSuperAdmin && <Button size="sm" variant="outline" disabled={religar.isPending} onClick={() => religar.mutate()}>Religar</Button>}
          {ehSuperAdmin && <Button size="sm" variant="outline" disabled={girar.isPending} onClick={() => girar.mutate()}><KeyRound className="size-4" aria-hidden />Trocar segredo</Button>}
        </div>
      </GavetaPe>
    </Gaveta>
  )
}

function NovoDestino({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const qc = useQueryClient()
  const [nome, setNome] = React.useState('')
  const [url, setUrl] = React.useState('')
  const [chaveId, setChaveId] = React.useState('')
  const [unidades, setUnidades] = React.useState<string[]>([])
  const [eventos, setEventos] = React.useState<EventoWebhook[]>([])
  const [segredo, setSegredo] = React.useState<string | null>(null)
  const chaves = useQuery({
    queryKey: ['api-chaves'],
    enabled: aberto,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('api_chaves_lista')
      if (error) throw error
      return (data ?? []) as unknown as ChaveResumo[]
    },
  })
  const validas = (chaves.data ?? []).filter((c) => !c.revogada_em && !c.vencida)
  const chave = validas.find((c) => c.id === chaveId)
  const criar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('webhook_criar_destino', {
        p_nome: nome.trim(), p_url: url.trim(), p_chave: chaveId, p_unidades: unidades, p_eventos: eventos,
      })
      if (error) throw error
      return (data as unknown as { segredo: string }).segredo
    },
    onSuccess: (v) => { setSegredo(v); void qc.invalidateQueries({ queryKey: ['webhook-destinos'] }) },
  })
  const fechar = () => {
    setNome(''); setUrl(''); setChaveId(''); setUnidades([]); setEventos([]); setSegredo(null); criar.reset(); onFechar()
  }
  const alternar = <T,>(lista: T[], v: T) => (lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v])
  const urlRuim = url.trim() !== '' && !enderecoValido(url)
  const pronto = nome.trim().length >= 3 && enderecoValido(url) && !!chave && unidades.length > 0 && eventos.length > 0
  return (
    <Dialog open={aberto} onOpenChange={(o) => { if (!o) fechar() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{segredo ? 'Destino criado' : 'Novo destino de webhook'}</DialogTitle>
          <DialogDescription>{segredo ? 'Guarde o segredo agora: ele não aparece de novo. Entregue ao responsável pelo sistema.' : 'O endereço precisa ser https, com nome público. A chave define as unidades que o destino pode receber.'}</DialogDescription>
        </DialogHeader>
        {segredo ? <SegredoUmaVez segredo={segredo} onFechar={fechar} /> : (
          <>
            <div className="flex flex-col gap-3 text-apoio">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="wh-nome">Nome</Label>
                <Input id="wh-nome" placeholder="ex.: Regulação estadual" value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="wh-url">Endereço (https)</Label>
                <Input id="wh-url" inputMode="url" placeholder="https://sistema.exemplo.gov.br/webhooks" aria-invalid={urlRuim} value={url} onChange={(e) => setUrl(e.target.value)} />
                {urlRuim && <span className="text-rotulo text-critico">Use https com um nome público (sem IP, localhost ou rede interna).</span>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="wh-chave">Chave da API</Label>
                <CampoSelecao id="wh-chave" value={chaveId} onChange={(e) => { setChaveId(e.target.value); setUnidades([]) }}>
                  <option value="">{chaves.isLoading ? 'Carregando…' : validas.length ? 'Escolha a chave do sistema' : 'Nenhuma chave válida: crie na aba Chaves da API'}</option>
                  {validas.map((c) => <option key={c.id} value={c.id}>{c.nome} · {c.prefixo}… · vale até {dataCurta(c.expira_em)}</option>)}
                </CampoSelecao>
              </div>
              {chave && (
                <fieldset className="flex flex-col gap-1.5">
                  <legend className="mb-1 font-medium">Unidades (da chave)</legend>
                  {chave.unidades.map((u) => <CaixaMarcar key={u.id} marcado={unidades.includes(u.id)} onChange={() => setUnidades((v) => alternar(v, u.id))}>{u.nome}</CaixaMarcar>)}
                </fieldset>
              )}
              <fieldset className="grid gap-1.5 sm:grid-cols-2">
                <legend className="mb-1 font-medium">Eventos</legend>
                {EVENTOS.map((e) => <CaixaMarcar key={e.valor} marcado={eventos.includes(e.valor)} onChange={() => setEventos((v) => alternar(v, e.valor))}>{e.rotulo}</CaixaMarcar>)}
              </fieldset>
              {criar.error && <MensagemErro texto={(criar.error as Error).message} />}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={fechar}>Cancelar</Button>
              <Button disabled={!pronto || criar.isPending} onClick={() => criar.mutate()}>Criar destino</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
