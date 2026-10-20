// ─────────────────────────────────────────────────────────────────────────────
// Prazos (SLA) da regulação (Fase 4, tarefa 7; decisões do RT de 11/10/2026).
//
// • Painel: a central vê os pedidos da rede esperando decisão; a origem (médico
//   e gestor) vê os da própria unidade. Atrasados no topo; filtros por tipo,
//   prioridade e só atrasados.
// • Relógios: prazo da fila por prioridade (só o tempo com a central), resposta
//   à pendência em 3 h, evolução em 12 h e 72 h (leito e transferência).
//   Só alerta: nada é cancelado pelo sistema.
// • Prazos da central: o regulador ou o gestor da central ajusta.
// • Atualizar evolução: a origem escreve a evolução e o relógio recomeça.
// Migration 20261113000001_sla_regulacao.sql.
// ─────────────────────────────────────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, Timer } from 'lucide-react'
import * as React from 'react'

import { Vazio } from '@/components/monitor/Pagina'
import { Badge } from '@/components/ui/badge'
import { BotaoLinha } from '@/components/ui/botao-linha'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { fmtDataHora } from '@/lib/datas'
import {
  NIVEIS_FILA, PRIORIDADES, STATUS, TIPOS, alertasSla, errosPrazos, formatarEspera, prazosParaEnvio, prazosParaForm, resumoPedido,
  type FormPrazos, type Prazos, type Prioridade, type Sla, type StatusRegulacao, type TipoSolicitacao,
} from '@/lib/regulacao'
import { supabase } from '@/lib/supabase'
import type { Json } from '@/types/database'
import { CampoSelecao } from '@/components/ui/campo-selecao'

const TOM = { critico: 'destructive', atencao: 'warning', neutro: 'secondary' } as const

/** Selos dos relógios do pedido. */
export function SeloSla({ sla }: { sla: Sla | null | undefined }) {
  const [agora] = React.useState(() => Date.now())
  const alertas = alertasSla(sla, agora)
  if (alertas.length === 0) return null
  return <>{alertas.map((a) => <Badge key={a.texto} variant={TOM[a.tom]}>{a.texto}</Badge>)}</>
}

type ItemPainel = {
  id: string; numero: number; status: StatusRegulacao; tipo: TipoSolicitacao; prioridade: Prioridade; prioridade_regulador: Prioridade | null
  procedimento: string | null; procedimento_nome: string | null; especialidade: string | null; tipo_leito: string | null
  paciente: { nome: string }; paciente_nao_identificado: boolean; origem: { nome: string }; assumida_por: string | null
  criada_em: string; sla: Sla | null
}
type Resumo = { abertos: number; fila_atrasada: number; fila_sem_prazo: number; pendencia_atrasada: number; evolucao_atrasada: number; risco_cancelamento: number; destino_atrasado?: number }
type RespostaPainel = { central: boolean; dados: ItemPainel[]; resumo: Resumo; prazos: Prazos | null; agora: string }
type Filtros = { tipo?: TipoSolicitacao; prioridade?: Prioridade; so_atrasados?: boolean }

export function PainelSla({ unidadeId, central, detalhe }: {
  unidadeId: string; central: boolean; detalhe: (id: string) => React.ReactNode
}) {
  const [filtros, setFiltros] = React.useState<Filtros>({})
  const [aberta, setAberta] = React.useState<string | null>(null)
  const painel = useQuery({
    queryKey: ['regulacao-sla', unidadeId, filtros],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('regulacao_sla_painel', { p_unidade: unidadeId, p_filtros: filtros as unknown as Json })
      if (error) throw error
      return data as unknown as RespostaPainel
    },
  })
  const setF = <K extends keyof Filtros>(k: K, v: Filtros[K] | '') =>
    setFiltros((x) => { const n = { ...x }; if (v === '' || v === undefined || v === false) delete n[k]; else n[k] = v as Filtros[K]; return n })
  const r = painel.data
  const res = r?.resumo
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-corpo">
          <Timer className="size-4" aria-hidden /> Prazos da regulação
          {res && res.fila_atrasada > 0 && <Badge variant="destructive">Fila vencida: {res.fila_atrasada}</Badge>}
          {res && res.pendencia_atrasada > 0 && <Badge variant="destructive">Pendência vencida: {res.pendencia_atrasada}</Badge>}
          {res && res.evolucao_atrasada > 0 && <Badge variant="warning">Evolução vencida: {res.evolucao_atrasada}</Badge>}
          {res && res.risco_cancelamento > 0 && <Badge variant="destructive">Risco de cancelamento: {res.risco_cancelamento}</Badge>}
          {res && (res.destino_atrasado ?? 0) > 0 && <Badge variant="destructive">Destino sem resposta: {res.destino_atrasado}</Badge>}
        </CardTitle>
        <CardDescription>
          {central
            ? 'Pedidos da rede esperando decisão. O prazo da fila conta só o tempo com a central; com a origem, pausa.'
            : 'Pedidos da unidade esperando decisão: responder à central e atualizar a evolução no prazo.'}
          {' '}Só alerta: o sistema não cancela nada. Atualiza a cada minuto.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-apoio">
        <div className="flex flex-wrap items-center gap-2">
          <CampoSelecao aria-label="Tipo" tamanho="compacto" value={filtros.tipo ?? ''} onChange={(e) => setF('tipo', e.target.value as TipoSolicitacao | '')}>
            <option value="">Todos os tipos</option>
            {(Object.keys(TIPOS) as TipoSolicitacao[]).map((k) => <option key={k} value={k}>{TIPOS[k]}</option>)}
          </CampoSelecao>
          <CampoSelecao aria-label="Prioridade" tamanho="compacto" value={filtros.prioridade ?? ''} onChange={(e) => setF('prioridade', e.target.value as Prioridade | '')}>
            <option value="">Todas as prioridades</option>
            {(Object.keys(PRIORIDADES) as Prioridade[]).map((k) => <option key={k} value={k}>{PRIORIDADES[k].rotulo}</option>)}
          </CampoSelecao>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" className="size-4" checked={!!filtros.so_atrasados} onChange={(e) => setF('so_atrasados', e.target.checked)} />
            Só atrasados
          </label>
          {res && <span className="ml-auto text-tinta-sussurro">{res.abertos} esperando decisão</span>}
        </div>
        {painel.error && <p role="alert" className="text-critico">{(painel.error as Error).message}</p>}
        {painel.isLoading ? <Spinner /> : (r?.dados ?? []).length === 0 ? (
          <Vazio icone={Timer} titulo="Nada esperando decisão" texto="Nenhum pedido com esses filtros." />
        ) : (
          <ul className="flex flex-col divide-y divide-fio">
            {r!.dados.map((s) => {
              const ef = s.prioridade_regulador ?? s.prioridade
              return (
                <li key={s.id} className="py-2">
                  <BotaoLinha variante="linha" aria-expanded={aberta === s.id}
                    className="flex-wrap items-center gap-2 rounded-controle border-0 px-1 py-0.5 hover:bg-campo"
                    onClick={() => setAberta(aberta === s.id ? null : s.id)}>
                    {aberta === s.id ? <ChevronDown className="size-4 text-tinta-sussurro" aria-hidden /> : <ChevronRight className="size-4 text-tinta-sussurro" aria-hidden />}
                    <Badge variant={PRIORIDADES[ef].tom === 'critico' ? 'destructive' : PRIORIDADES[ef].tom === 'atencao' ? 'warning' : PRIORIDADES[ef].tom === 'info' ? 'info' : 'secondary'}>
                      {PRIORIDADES[ef].rotulo}
                    </Badge>
                    <span className="font-medium text-tinta">{s.paciente.nome}{s.paciente_nao_identificado && ' (não identificado)'}</span>
                    <span className="text-tinta-apoio">{resumoPedido(s)}</span>
                    <span className="text-tinta-sussurro">nº {s.numero}{central ? ` · de ${s.origem.nome}` : ''}{s.assumida_por ? ` · com ${s.assumida_por}` : ''}</span>
                    <Badge variant="info">{STATUS[s.status]}</Badge>
                    <SeloSla sla={s.sla} />
                    <span className="ml-auto text-rotulo text-acao">{aberta === s.id ? 'Fechar' : 'Ver detalhes'}</span>
                  </BotaoLinha>
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

/** Prazos da central: valores de partida 12 h / 3 h / 72 h; fila por prioridade começa vazia. */
export function PrazosCentral({ unidadeId, editavel }: { unidadeId: string; editavel: boolean }) {
  const qc = useQueryClient()
  const prazos = useQuery({
    queryKey: ['regulacao-prazos', unidadeId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('regulacao_prazos', { p_unidade: unidadeId })
      if (error) throw error
      return data as unknown as Prazos | null
    },
  })
  const [form, setForm] = React.useState<FormPrazos | null>(null)
  const salvar = useMutation({
    mutationFn: async (f: FormPrazos) => {
      const { error } = await supabase.rpc('regulacao_definir_prazos', { p_central: unidadeId, p_dados: prazosParaEnvio(f) as unknown as Json })
      if (error) throw error
    },
    onSuccess: () => {
      setForm(null)
      void qc.invalidateQueries({ queryKey: ['regulacao-prazos', unidadeId] })
      void qc.invalidateQueries({ queryKey: ['regulacao-sla', unidadeId] })
      void qc.invalidateQueries({ queryKey: ['regulacao-fila', unidadeId] })
    },
  })
  if (prazos.isLoading) return <Spinner />
  if (!prazos.data) return null
  const p = prazos.data
  const f = form ?? prazosParaForm(p)
  const erros = errosPrazos(f)
  const mudar = (x: Partial<FormPrazos>) => setForm({ ...f, ...x })
  const campoHoras = (k: 'evolucao_h' | 'pendencia_h' | 'sem_evolucao_h' | 'destino_h', rotulo: string) => (
    <div className="flex flex-col gap-1">
      <Label htmlFor={`prazo-${k}`} className="text-rotulo">{rotulo}</Label>
      <Input id={`prazo-${k}`} className="h-8 w-24" inputMode="numeric" disabled={!editavel} value={f[k]} onChange={(e) => mudar({ [k]: e.target.value })} />
    </div>
  )
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-corpo">Prazos da central</CardTitle>
        <CardDescription>
          Prazo da fila por prioridade, em minutos (vazio = sem prazo; não há regra nacional). Relógios da origem, em horas: partem de
          12 h, 3 h e 72 h (Nota Técnica SES-MG 15/2008; Deliberação CIB-SP 35/2022). Valem para a rede inteira; só alertam.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-apoio">
        <div className="flex flex-wrap gap-3">
          {NIVEIS_FILA.map((k) => (
            <div key={k} className="flex flex-col gap-1">
              <Label htmlFor={`prazo-fila-${k}`} className="text-rotulo">Fila · {PRIORIDADES[k].rotulo} (min)</Label>
              <Input id={`prazo-fila-${k}`} className="h-8 w-28" inputMode="numeric" placeholder="sem prazo" disabled={!editavel}
                value={f.fila[k]} onChange={(e) => mudar({ fila: { ...f.fila, [k]: e.target.value } })} />
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          {campoHoras('evolucao_h', 'Evolução do pedido (h)')}
          {campoHoras('pendencia_h', 'Resposta à pendência (h)')}
          {campoHoras('sem_evolucao_h', 'Sem evolução (h)')}
          {campoHoras('destino_h', 'Resposta do destino (h)')}
        </div>
        <span className="text-rotulo text-tinta-sussurro">
          {p.ajustado ? `Ajustado por ${p.atualizado_por ?? '—'} em ${p.atualizado_em ? fmtDataHora(p.atualizado_em) : '—'}.` : 'Valores de partida.'}
          {' '}Cada ajuste fica guardado com o antes e o depois.
        </span>
        {editavel && form && erros.length > 0 && <ul role="alert" className="text-rotulo text-critico">{erros.map((e) => <li key={e}>{e}</li>)}</ul>}
        {editavel && (
          <div className="flex gap-2">
            <Button size="sm" onClick={() => salvar.mutate(f)} disabled={!form || erros.length > 0 || salvar.isPending}>Salvar prazos</Button>
            {form && <Button size="sm" variant="ghost" onClick={() => setForm(null)}>Desfazer</Button>}
          </div>
        )}
        {salvar.error && <p role="alert" className="text-rotulo text-critico">{(salvar.error as Error).message}</p>}
      </CardContent>
    </Card>
  )
}

type Tempo = { status: StatusRegulacao; segundos: number; vezes: number; atual: boolean }
export type Evolucao = { texto: string; sinais_vitais: string | null; em: string; autor: string | null }

/** Tempo em cada status, evoluções e, para a origem, "Atualizar evolução". */
export function PrazosDoPedido({ id, sla, tempos, evolucoes, podeEvoluir, aoFim }: {
  id: string; sla: Sla | null; tempos: Tempo[]; evolucoes: Evolucao[]; podeEvoluir: boolean; aoFim: () => void
}) {
  const [texto, setTexto] = React.useState('')
  const [sinais, setSinais] = React.useState('')
  const [abrir, setAbrir] = React.useState(false)
  const evoluir = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('regulacao_atualizar_evolucao', { p_id: id, p_texto: texto.trim(), p_sinais_vitais: sinais.trim() || undefined })
      if (error) throw error
    },
    onSuccess: () => { setTexto(''); setSinais(''); setAbrir(false); aoFim() },
  })
  return (
    <div className="flex flex-col gap-2 rounded-controle border border-fio bg-superficie p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 font-medium text-tinta"><Timer className="size-4" aria-hidden /> Prazos</span>
        <SeloSla sla={sla} />
        {podeEvoluir && !abrir && <Button size="xs" variant="outline" className="ml-auto" onClick={() => setAbrir(true)}>Atualizar evolução</Button>}
      </div>
      {tempos.length > 0 && (
        <p className="text-rotulo text-tinta-apoio">
          Tempo em cada status: {tempos.map((t) => `${STATUS[t.status]} ${formatarEspera(t.segundos)}${t.vezes > 1 ? ` (${t.vezes}×)` : ''}${t.atual ? ' — atual' : ''}`).join(' · ')}
        </p>
      )}
      {abrir && (
        <div className="flex flex-col gap-2">
          <Label htmlFor={`evol-${id}`} className="text-rotulo">Evolução do paciente (a central vê; o relógio recomeça)</Label>
          <textarea id={`evol-${id}`} rows={3} className="rounded-controle border border-fio bg-campo px-2 py-1.5" value={texto} onChange={(e) => setTexto(e.target.value)} />
          <Label htmlFor={`evol-sv-${id}`} className="text-rotulo">Sinais vitais, com hora (opcional)</Label>
          <Input id={`evol-sv-${id}`} className="h-8" value={sinais} onChange={(e) => setSinais(e.target.value)} />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => evoluir.mutate()} disabled={evoluir.isPending || texto.trim().length < 10}>Registrar evolução</Button>
            <Button size="sm" variant="ghost" onClick={() => setAbrir(false)}>Voltar</Button>
          </div>
          {evoluir.error && <p role="alert" className="text-rotulo text-critico">{(evoluir.error as Error).message}</p>}
        </div>
      )}
      {evolucoes.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {evolucoes.map((e, i) => (
            <li key={i} className="text-tinta">
              <span className="text-rotulo text-tinta-sussurro">{fmtDataHora(e.em)} · {e.autor ?? '—'}</span>
              <p className="whitespace-pre-wrap">{e.texto}</p>
              {e.sinais_vitais && <p className="text-tinta-apoio">Sinais vitais: {e.sinais_vitais}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
