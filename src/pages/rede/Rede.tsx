// ─────────────────────────────────────────────────────────────────────────────
// Rede — papéis de rede como módulo (Fase 4, tarefa 12; decisões do RT de
// 11/10/2026).
//
// • Super admin: liga o módulo por organização e aponta a unidade Secretaria;
//   as pessoas de rede entram por convite na Secretaria (aba Convites).
// • Secretaria: números das unidades liberadas (regulação e mapa de vagas),
//   sem nome de paciente.
// • Regulação regional: também a lista nominal dos pedidos, só leitura; abrir
//   o detalhe fica no registro de acesso ao prontuário.
// • Faturamento da secretaria: produção por unidade e competência e os
//   arquivos fechados (BPA, APAC), só leitura.
// O gestor de cada unidade libera ou retira a unidade (Unidade → Rede). Os
// papéis de rede entram pela escala da Secretaria.
// Migrations 20261116000001/2.
// ─────────────────────────────────────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, Download, Network } from 'lucide-react'
import * as React from 'react'

import { TituloPagina, Vazio } from '@/components/monitor/Pagina'
import { MapaVagas } from '@/components/regulacao/MapaVagas'
import { SeloSla } from '@/components/regulacao/SlaRegulacao'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { useUnidade } from '@/contexts/UnidadeContext'
import { fmtDataHora } from '@/lib/datas'
import { PAPEL_LABEL } from '@/lib/constants'
import { PRIORIDADES, STATUS, TIPOS, TIPOS_LEITO, type Prioridade, type Sla, type StatusRegulacao, type TipoSolicitacao } from '@/lib/regulacao'
import { supabase } from '@/lib/supabase'
import type { Papel } from '@/types/database'

const SELECT = 'h-8 rounded-controle border border-fio bg-campo px-2'
type Ref = { id: string; nome: string }
type Contexto = { eh_secretaria: boolean; modulo_ativo: boolean; papeis: Papel[]; no_plantao: boolean; unidades: (Ref & { cnes: string | null })[] }

export default function Rede() {
  const { unidadeAtiva, ehSuperAdmin } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id ?? ''
  const ctx = useQuery({
    queryKey: ['rede-contexto', unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('rede_contexto', { p_unidade: unidadeId })
      if (error) throw error
      return data as unknown as Contexto
    },
  })
  const c = ctx.data
  const papeis = c?.papeis ?? []
  return (
    <div className="flex w-full max-w-5xl flex-col gap-4">
      <TituloPagina icone={Network} titulo="Rede" descricao="Acompanhamento da rede pelas unidades que os gestores liberaram." />
      {ehSuperAdmin && <ModuloRede />}
      {!unidadeId ? null : ctx.isLoading ? <Spinner /> : ctx.error ? <p role="alert" className="text-critico">{(ctx.error as Error).message}</p>
        : !c?.eh_secretaria ? (!ehSuperAdmin && <Vazio icone={Network} titulo="Esta unidade não é a Secretaria" texto="Os papéis de rede trabalham na unidade Secretaria da organização." />)
        : !c.modulo_ativo ? <Vazio icone={Network} titulo="Módulo de rede desligado" texto="O administrador da plataforma liga o módulo na organização." />
        : papeis.length === 0 ? null
        : !c.no_plantao ? <Vazio icone={Network} titulo="Fora do plantão" texto="Os papéis de rede entram pela escala da Secretaria." />
        : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Unidades liberadas</CardTitle>
                <CardDescription>Só aparecem as unidades cujo gestor liberou o acesso da rede. Seu papel: {papeis.map((p) => PAPEL_LABEL[p]).join(', ')}.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-1.5 text-apoio">
                {c.unidades.length === 0 ? <span className="text-tinta-sussurro">Nenhuma unidade liberada ainda.</span>
                  : c.unidades.map((u) => <Badge key={u.id} variant="secondary">{u.nome}{u.cnes ? ` · CNES ${u.cnes}` : ''}</Badge>)}
              </CardContent>
            </Card>
            {(papeis.includes('secretaria') || papeis.includes('regulacao_regional')) && (
              <>
                <ResumoRegulacao unidadeId={unidadeId} />
                <MapaVagas unidadeId={unidadeId} />
              </>
            )}
            {papeis.includes('regulacao_regional') && <PedidosDaRede unidadeId={unidadeId} unidades={c.unidades} />}
            {papeis.includes('faturamento_rede') && <FaturamentoRede unidadeId={unidadeId} />}
          </>
        )}
    </div>
  )
}

// ── super admin ──────────────────────────────────────────────────────────────
type Modulo = {
  organizacao: Ref; ativo: boolean; secretaria: Ref | null; alterado_em: string | null; alterado_por: string | null
  unidades: (Ref & { liberada: boolean })[]; pessoas: { nome: string; papel: Papel }[]
}

function ModuloRede() {
  const qc = useQueryClient()
  const modulos = useQuery({
    queryKey: ['rede-modulos'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('rede_modulos')
      if (error) throw error
      return (data ?? []) as unknown as Modulo[]
    },
  })
  const [secretaria, setSecretaria] = React.useState<Record<string, string>>({})
  const definir = useMutation({
    mutationFn: async ({ org, ativo, sec }: { org: string; ativo: boolean; sec: string | null }) => {
      const { error } = await supabase.rpc('rede_definir_modulo', { p_org: org, p_ativo: ativo, p_secretaria: sec })
      if (error) throw error
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['rede-modulos'] }),
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Módulo de papéis de rede</CardTitle>
        <CardDescription>
          Ligue por organização e aponte a unidade administrativa "Secretaria" (cadastre-a antes, como a central). As pessoas de rede entram por
          convite na Secretaria (Unidade → Convites) e são escaladas nela. O gestor de cada unidade decide se a unidade dele entra.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-apoio">
        {modulos.isLoading ? <Spinner /> : (modulos.data ?? []).map((m) => {
          const escolhida = secretaria[m.organizacao.id] ?? m.secretaria?.id ?? ''
          return (
            <div key={m.organizacao.id} className="flex flex-col gap-2 rounded-md border border-fio p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-tinta">{m.organizacao.nome}</span>
                <Badge variant={m.ativo ? 'success' : 'secondary'}>{m.ativo ? 'ligado' : 'desligado'}</Badge>
                {m.alterado_em && <span className="text-rotulo text-tinta-sussurro">{m.alterado_por ?? '—'} · {fmtDataHora(m.alterado_em)}</span>}
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex flex-col gap-1">
                  <Label htmlFor={`sec-${m.organizacao.id}`} className="text-xs">Unidade Secretaria</Label>
                  <select id={`sec-${m.organizacao.id}`} className={SELECT} value={escolhida}
                    onChange={(e) => setSecretaria((x) => ({ ...x, [m.organizacao.id]: e.target.value }))}>
                    <option value="">Escolha…</option>
                    {m.unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                  </select>
                </div>
                <Button size="sm" onClick={() => definir.mutate({ org: m.organizacao.id, ativo: true, sec: escolhida || null })}
                  disabled={definir.isPending || !escolhida}>{m.ativo ? 'Salvar' : 'Ligar'}</Button>
                {m.ativo && <Button size="sm" variant="outline" onClick={() => definir.mutate({ org: m.organizacao.id, ativo: false, sec: m.secretaria?.id ?? null })}
                  disabled={definir.isPending}>Desligar</Button>}
              </div>
              {m.secretaria && (
                <p className="text-rotulo text-tinta-apoio">
                  Pessoas de rede: {m.pessoas.length === 0 ? 'nenhuma ainda' : m.pessoas.map((p) => `${p.nome} (${PAPEL_LABEL[p.papel]})`).join(', ')}.
                  {' '}Unidades liberadas: {m.unidades.filter((u) => u.liberada).map((u) => u.nome).join(', ') || 'nenhuma'}.
                </p>
              )}
            </div>
          )
        })}
        {definir.error && <p role="alert" className="text-rotulo text-critico">{(definir.error as Error).message}</p>}
      </CardContent>
    </Card>
  )
}

// ── Secretaria e Regulação regional: números por unidade ─────────────────────
type ResumoUnidade = {
  unidade: Ref
  como_origem: { esperando_central: number; aguardando_destino: number; a_caminho: number; atrasados: number; realizados_30d: number }
  como_destino: { aguardando_aceite: number; a_caminho: number; recebidos_30d: number }
}

function ResumoRegulacao({ unidadeId }: { unidadeId: string }) {
  const resumo = useQuery({
    queryKey: ['rede-resumo', unidadeId],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('rede_regulacao_resumo', { p_unidade: unidadeId })
      if (error) throw error
      return (data ?? []) as unknown as ResumoUnidade[]
    },
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Regulação por unidade</CardTitle>
        <CardDescription>Pedidos em aberto, atrasados e concluídos nos últimos 30 dias. Só números.</CardDescription>
      </CardHeader>
      <CardContent className="text-apoio">
        {resumo.isLoading ? <Spinner /> : resumo.error ? <p role="alert" className="text-critico">{(resumo.error as Error).message}</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left">
              <thead className="text-rotulo text-tinta-sussurro">
                <tr>
                  <th className="py-1 font-normal">Unidade</th>
                  <th className="font-normal">Esperando a central</th><th className="font-normal">Esperando o destino</th>
                  <th className="font-normal">A caminho</th><th className="font-normal">Atrasados</th><th className="font-normal">Realizados (30 d)</th>
                  <th className="font-normal">Para aceitar</th><th className="font-normal">Recebidos (30 d)</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {(resumo.data ?? []).map((r) => (
                  <tr key={r.unidade.id} className="border-t border-fio">
                    <td className="py-1 text-tinta">{r.unidade.nome}</td>
                    <td>{r.como_origem.esperando_central}</td><td>{r.como_origem.aguardando_destino}</td><td>{r.como_origem.a_caminho}</td>
                    <td className={r.como_origem.atrasados > 0 ? 'font-semibold text-critico' : ''}>{r.como_origem.atrasados}</td>
                    <td>{r.como_origem.realizados_30d}</td><td>{r.como_destino.aguardando_aceite}</td><td>{r.como_destino.recebidos_30d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Regulação regional: lista nominal, só leitura ────────────────────────────
type PedidoRede = {
  id: string; numero: number; status: StatusRegulacao; tipo: TipoSolicitacao; tipo_leito: string | null
  prioridade: Prioridade; prioridade_regulador: Prioridade | null
  paciente: { nome: string } | null; paciente_nao_identificado: boolean
  origem: Ref; destino: Ref | null; destino_externo: string | null; criada_em: string; sla: Sla | null
}

function PedidosDaRede({ unidadeId, unidades }: { unidadeId: string; unidades: Ref[] }) {
  const [soAbertos, setSoAbertos] = React.useState(true)
  const [unidade, setUnidade] = React.useState('')
  const [aberto, setAberto] = React.useState<string | null>(null)
  const lista = useQuery({
    queryKey: ['rede-regulacoes', unidadeId, soAbertos, unidade],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('rede_regulacoes', {
        p_unidade: unidadeId, p_filtros: { so_abertos: soAbertos, ...(unidade ? { unidade_id: unidade } : {}) },
      })
      if (error) throw error
      return (data ?? []) as unknown as PedidoRede[]
    },
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pedidos de regulação da rede</CardTitle>
        <CardDescription>Só leitura. Abrir o detalhe fica registrado no acesso ao prontuário do paciente.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-apoio">
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Unidade" className={SELECT} value={unidade} onChange={(e) => setUnidade(e.target.value)}>
            <option value="">Todas as unidades liberadas</option>
            {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" className="size-4" checked={soAbertos} onChange={(e) => setSoAbertos(e.target.checked)} /> Só em andamento
          </label>
        </div>
        {lista.isLoading ? <Spinner /> : lista.error ? <p role="alert" className="text-critico">{(lista.error as Error).message}</p>
          : (lista.data ?? []).length === 0 ? <Vazio icone={Network} titulo="Nenhum pedido" texto="Nenhum pedido com esses filtros." /> : (
            <ul className="flex flex-col divide-y divide-fio">
              {lista.data!.map((s) => {
                const ef = s.prioridade_regulador ?? s.prioridade
                return (
                  <li key={s.id} className="py-2">
                    <button type="button" aria-expanded={aberto === s.id}
                      className="flex w-full flex-wrap items-center gap-2 rounded-md px-1 py-0.5 text-left hover:bg-campo"
                      onClick={() => setAberto(aberto === s.id ? null : s.id)}>
                      {aberto === s.id ? <ChevronDown className="size-4 text-tinta-sussurro" aria-hidden /> : <ChevronRight className="size-4 text-tinta-sussurro" aria-hidden />}
                      <Badge variant={PRIORIDADES[ef].tom === 'critico' ? 'destructive' : PRIORIDADES[ef].tom === 'atencao' ? 'warning' : 'secondary'}>{PRIORIDADES[ef].rotulo}</Badge>
                      <span className="font-medium text-tinta">{s.paciente?.nome ?? '—'}{s.paciente_nao_identificado && ' (não identificado)'}</span>
                      <span className="text-tinta-apoio">{TIPOS[s.tipo]}{s.tipo_leito ? ` · ${TIPOS_LEITO[s.tipo_leito] ?? s.tipo_leito}` : ''}</span>
                      <span className="text-tinta-sussurro">nº {s.numero} · de {s.origem.nome}{s.destino ? ` para ${s.destino.nome}` : s.destino_externo ? ` para ${s.destino_externo}` : ''}</span>
                      <Badge variant="info">{STATUS[s.status]}</Badge>
                      <SeloSla sla={s.sla} />
                      <span className="ml-auto text-rotulo text-acao">{aberto === s.id ? 'Fechar' : 'Ver detalhes'}</span>
                    </button>
                    {aberto === s.id && <DetalheRede unidadeId={unidadeId} id={s.id} />}
                  </li>
                )
              })}
            </ul>
          )}
      </CardContent>
    </Card>
  )
}

type Detalhe = {
  numero: number; status: StatusRegulacao; quadro_clinico: string; cid: string; cid_descricao: string | null
  procedimento: string; procedimento_nome: string | null; solicitante: string | null; criada_em: string
  eventos: { evento: string; por: string | null; em: string }[]
}

function DetalheRede({ unidadeId, id }: { unidadeId: string; id: string }) {
  const d = useQuery({
    queryKey: ['rede-regulacao-detalhe', id],
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('rede_regulacao_detalhe', { p_unidade: unidadeId, p_id: id })
      if (error) throw error
      return data as unknown as Detalhe
    },
  })
  if (d.isLoading) return <Spinner />
  if (d.error || !d.data) return <p role="alert" className="text-critico">{d.error ? (d.error as Error).message : 'Não encontrado.'}</p>
  const s = d.data
  return (
    <div className="mt-2 flex flex-col gap-2 rounded-md border border-fio bg-campo p-3 text-tinta">
      <p><span className="text-tinta-sussurro">Procedimento: </span>{s.procedimento} {s.procedimento_nome ?? ''}</p>
      <p><span className="text-tinta-sussurro">CID: </span>{s.cid} {s.cid_descricao ?? ''}</p>
      <p><span className="text-tinta-sussurro">Solicitante: </span>{s.solicitante ?? '—'} · {fmtDataHora(s.criada_em)}</p>
      <p className="whitespace-pre-wrap"><span className="text-tinta-sussurro">Quadro clínico: </span>{s.quadro_clinico}</p>
      <ul className="text-rotulo text-tinta-sussurro">
        {s.eventos.map((e, i) => <li key={i}>{fmtDataHora(e.em)} · {e.evento.replace(/_/g, ' ')} · {e.por ?? '—'}</li>)}
      </ul>
    </div>
  )
}

// ── Faturamento da secretaria ────────────────────────────────────────────────
type FaturamentoUnidade = {
  unidade: Ref & { cnes: string | null }
  bpa: { id: string; situacao: string; linhas: number | null; linhas_bpa_c: number | null; folhas: number | null; fechado_em: string; tem_arquivo: boolean } | null
  apac: { id: string; situacao: string; apacs: number | null; fechado_em: string; tem_arquivo: boolean } | null
  aih: Record<string, number>; apacs_status: Record<string, number>
}

const competenciaAtual = () => new Date().toLocaleDateString('sv-SE').slice(0, 7).replace('-', '')

function FaturamentoRede({ unidadeId }: { unidadeId: string }) {
  const [competencia, setCompetencia] = React.useState(competenciaAtual)
  const valida = /^\d{4}(0[1-9]|1[0-2])$/.test(competencia)
  const dados = useQuery({
    queryKey: ['rede-faturamento', unidadeId, competencia],
    enabled: valida,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('rede_faturamento', { p_unidade: unidadeId, p_competencia: competencia })
      if (error) throw error
      return (data ?? []) as unknown as FaturamentoUnidade[]
    },
  })
  const baixar = useMutation({
    mutationFn: async ({ tipo, id }: { tipo: 'bpa' | 'apac'; id: string }) => {
      const { data, error } = await supabase.rpc('rede_baixar_arquivo', { p_unidade: unidadeId, p_tipo: tipo, p_fechamento: id })
      if (error) throw error
      const r = data as unknown as { nome: string; conteudo: string }
      const url = URL.createObjectURL(new Blob([r.conteudo], { type: 'text/plain' }))
      const a = document.createElement('a')
      a.href = url; a.download = r.nome; a.click()
      URL.revokeObjectURL(url)
    },
  })
  const contagem = (x: Record<string, number>) => Object.entries(x).map(([k, n]) => `${k}: ${n}`).join(' · ') || '—'
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Produção das unidades liberadas</CardTitle>
        <CardDescription>Por competência, só leitura. Baixar o arquivo fechado fica na auditoria.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-apoio">
        <div className="flex items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="rede-comp" className="text-xs">Competência (AAAAMM)</Label>
            <Input id="rede-comp" className="h-8 w-32" inputMode="numeric" value={competencia} onChange={(e) => setCompetencia(e.target.value.trim())} />
          </div>
        </div>
        {!valida ? <span className="text-rotulo text-critico">Competência no formato AAAAMM.</span>
          : dados.isLoading ? <Spinner /> : dados.error ? <p role="alert" className="text-critico">{(dados.error as Error).message}</p> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] text-left">
                <thead className="text-rotulo text-tinta-sussurro">
                  <tr><th className="py-1 font-normal">Unidade</th><th className="font-normal">BPA</th><th className="font-normal">APAC (fechamento)</th>
                    <th className="font-normal">AIH por situação</th><th className="font-normal">APAC por situação</th></tr>
                </thead>
                <tbody>
                  {(dados.data ?? []).map((u) => (
                    <tr key={u.unidade.id} className="border-t border-fio align-top">
                      <td className="py-1 text-tinta">{u.unidade.nome}{u.unidade.cnes ? <span className="block text-rotulo text-tinta-sussurro">CNES {u.unidade.cnes}</span> : null}</td>
                      <td>
                        {u.bpa ? <>{u.bpa.situacao} · {u.bpa.linhas ?? 0} linhas
                          {u.bpa.situacao === 'fechada' && u.bpa.tem_arquivo && (
                            <Button size="xs" variant="ghost" onClick={() => baixar.mutate({ tipo: 'bpa', id: u.bpa!.id })}><Download className="size-3.5" /> arquivo</Button>
                          )}</> : <span className="text-tinta-sussurro">sem fechamento</span>}
                      </td>
                      <td>
                        {u.apac ? <>{u.apac.situacao} · {u.apac.apacs ?? 0} APAC
                          {u.apac.situacao === 'fechada' && u.apac.tem_arquivo && (
                            <Button size="xs" variant="ghost" onClick={() => baixar.mutate({ tipo: 'apac', id: u.apac!.id })}><Download className="size-3.5" /> arquivo</Button>
                          )}</> : <span className="text-tinta-sussurro">sem fechamento</span>}
                      </td>
                      <td className="text-rotulo">{contagem(u.aih)}</td>
                      <td className="text-rotulo">{contagem(u.apacs_status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        {baixar.error && <p role="alert" className="text-rotulo text-critico">{(baixar.error as Error).message}</p>}
      </CardContent>
    </Card>
  )
}
