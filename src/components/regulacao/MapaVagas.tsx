// ─────────────────────────────────────────────────────────────────────────────
// Mapa simples de vagas da regulação (Fase 4, tarefa 8; decisões do RT de
// 11/10/2026).
//
// • Leitos em tempo real dos setores que o gestor ofertou à regulação, por
//   unidade e por tipo de leito da regulação: livre (a vaga), reservado,
//   higienização, bloqueado e ocupado.
// • Serviços informados pelo gestor da unidade: situação, vagas, observação;
//   "desatualizado" depois de 12 h sem confirmar.
// • Veem a rede: regulador e gestor da central, gestor das unidades. Edita só
//   o gestor da própria unidade. Só consulta: reserva e aceite são da tarefa 9.
// Migration 20261114000001_mapa_vagas.sql.
// ─────────────────────────────────────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BedDouble } from 'lucide-react'
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
  SERVICO_VAZIO, SITUACOES_SERVICO, TIPOS_LEITO, TIPOS_SERVICO, errosServico, servicoParaEnvio,
  type FormServico, type SituacaoServico, type TipoServico,
} from '@/lib/regulacao'
import { supabase } from '@/lib/supabase'
import type { Json } from '@/types/database'

const SELECT = 'h-8 rounded-controle border border-fio bg-campo px-2'
const TOM_SITUACAO = { sucesso: 'success', atencao: 'warning', critico: 'destructive' } as const

type Leitos = { tipo_leito: string; livre: number; reservado: number; higienizacao: number; bloqueado: number; ocupado: number; total: number }
type Servico = {
  id: string; nome: string; tipo: TipoServico; procedimento: string | null; procedimento_nome: string | null
  situacao: SituacaoServico; vagas: number | null; observacao: string | null
  atualizado_em: string; atualizado_por: string | null; confirmado_em: string; desatualizado: boolean
}
type UnidadeMapa = { id: string; nome: string; cnes: string | null; leitos: Leitos[]; servicos: Servico[]; editavel: boolean; minha: boolean }
type Mapa = { unidades: UnidadeMapa[]; totais: { tipo_leito: string; livre: number; higienizacao: number; total: number }[]; agora: string }

export function MapaVagas({ unidadeId, compacto = false }: { unidadeId: string; compacto?: boolean }) {
  const mapa = useQuery({
    queryKey: ['regulacao-mapa', unidadeId],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('regulacao_mapa_vagas', { p_unidade: unidadeId })
      if (error) throw error
      return data as unknown as Mapa
    },
  })
  const m = mapa.data
  const conteudo = mapa.isLoading ? <Spinner /> : mapa.error ? (
    <p role="alert" className="text-critico">{(mapa.error as Error).message}</p>
  ) : !m || m.unidades.length === 0 ? (
    <Vazio icone={BedDouble} titulo="Nada ofertado ainda" texto="O gestor de cada unidade marca os setores e cadastra os serviços ofertados à regulação." />
  ) : (
    <div className="flex flex-col gap-3">
      {m.totais.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-tinta-sussurro">Vagas na rede:</span>
          {m.totais.map((t) => (
            <Badge key={t.tipo_leito} variant={t.livre > 0 ? 'success' : 'secondary'}>
              {TIPOS_LEITO[t.tipo_leito] ?? t.tipo_leito}: {t.livre} livre{t.livre === 1 ? '' : 's'} de {t.total}{t.higienizacao > 0 ? ` · ${t.higienizacao} em higienização` : ''}
            </Badge>
          ))}
        </div>
      )}
      {m.unidades.map((u) => <UnidadeDoMapa key={u.id} u={u} unidadeConsulta={unidadeId} compacto={compacto} />)}
      <span className="text-rotulo text-tinta-sussurro">Leitos em tempo real; atualiza a cada minuto. Só números, sem paciente.</span>
    </div>
  )
  if (compacto) return <div className="flex flex-col gap-2 rounded-md border border-fio bg-superficie p-3 text-apoio">{conteudo}</div>
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><BedDouble className="size-4" aria-hidden /> Mapa de vagas da rede</CardTitle>
        <CardDescription>Leitos dos setores ofertados à regulação e serviços informados pelas unidades. Só consulta: a reserva e o aceite são da unidade destino.</CardDescription>
      </CardHeader>
      <CardContent className="text-apoio">{conteudo}</CardContent>
    </Card>
  )
}

function UnidadeDoMapa({ u, unidadeConsulta, compacto }: { u: UnidadeMapa; unidadeConsulta: string; compacto: boolean }) {
  const [novo, setNovo] = React.useState(false)
  return (
    <section className="flex flex-col gap-2 rounded-md border border-fio p-3" aria-label={u.nome}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-tinta">{u.nome}</span>
        {u.cnes && <span className="text-rotulo text-tinta-sussurro">CNES {u.cnes}</span>}
        {u.minha && <Badge variant="info">sua unidade</Badge>}
        {u.editavel && !compacto && !novo && <Button size="xs" variant="outline" className="ml-auto" onClick={() => setNovo(true)}>Novo serviço</Button>}
      </div>
      {u.leitos.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[30rem] text-left">
            <thead className="text-rotulo text-tinta-sussurro">
              <tr><th className="py-1 font-normal">Leito</th><th className="font-normal">Livre</th><th className="font-normal">Reservado</th><th className="font-normal">Higienização</th><th className="font-normal">Bloqueado</th><th className="font-normal">Ocupado</th><th className="font-normal">Total</th></tr>
            </thead>
            <tbody className="tabular-nums">
              {u.leitos.map((l) => (
                <tr key={l.tipo_leito} className="border-t border-fio">
                  <td className="py-1 text-tinta">{TIPOS_LEITO[l.tipo_leito] ?? l.tipo_leito}</td>
                  <td className={l.livre > 0 ? 'font-semibold text-conforme' : 'text-tinta-sussurro'}>{l.livre}</td>
                  <td>{l.reservado}</td><td>{l.higienizacao}</td><td>{l.bloqueado}</td><td>{l.ocupado}</td><td>{l.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <span className="text-rotulo text-tinta-sussurro">Nenhum setor ofertado à regulação.</span>}
      {novo && <FormularioServico unidadeId={u.id} unidadeConsulta={unidadeConsulta} aoFim={() => setNovo(false)} />}
      {u.servicos.length > 0 && (
        <ul className="flex flex-col divide-y divide-fio">
          {u.servicos.map((s) => <LinhaServico key={s.id} s={s} unidadeId={u.id} unidadeConsulta={unidadeConsulta} editavel={u.editavel && !compacto} />)}
        </ul>
      )}
    </section>
  )
}

function LinhaServico({ s, unidadeId, unidadeConsulta, editavel }: { s: Servico; unidadeId: string; unidadeConsulta: string; editavel: boolean }) {
  const qc = useQueryClient()
  const [editando, setEditando] = React.useState(false)
  const recarregar = () => void qc.invalidateQueries({ queryKey: ['regulacao-mapa', unidadeConsulta] })
  const acao = useMutation({
    mutationFn: async (qual: 'confirmar' | 'desativar') => {
      const { error } = qual === 'confirmar'
        ? await supabase.rpc('regulacao_confirmar_servico', { p_id: s.id })
        : await supabase.rpc('regulacao_desativar_servico', { p_id: s.id })
      if (error) throw error
    },
    onSuccess: recarregar,
  })
  if (editando) {
    return (
      <li className="py-2">
        <FormularioServico unidadeId={unidadeId} unidadeConsulta={unidadeConsulta} servico={s} aoFim={() => setEditando(false)} />
      </li>
    )
  }
  const sit = SITUACOES_SERVICO[s.situacao]
  return (
    <li className="flex flex-wrap items-center gap-2 py-1.5">
      <span className="text-tinta">{s.nome}</span>
      <span className="text-rotulo text-tinta-sussurro">{TIPOS_SERVICO[s.tipo]}{s.procedimento ? ` · ${s.procedimento}` : ''}</span>
      <Badge variant={TOM_SITUACAO[sit.tom]}>{sit.rotulo}</Badge>
      {s.vagas != null && <span className="tabular-nums text-tinta">{s.vagas} vaga{s.vagas === 1 ? '' : 's'}</span>}
      {s.observacao && <span className="text-tinta-apoio">{s.observacao}</span>}
      {s.desatualizado && <Badge variant="warning">desatualizado</Badge>}
      <span className="text-rotulo text-tinta-sussurro">{s.atualizado_por ?? '—'} · confirmado {fmtDataHora(s.confirmado_em)}</span>
      {editavel && (
        <span className="ml-auto flex gap-1">
          <Button size="xs" variant="outline" onClick={() => acao.mutate('confirmar')} disabled={acao.isPending}>Confirmar</Button>
          <Button size="xs" variant="ghost" onClick={() => setEditando(true)}>Editar</Button>
          <Button size="xs" variant="ghost" onClick={() => acao.mutate('desativar')} disabled={acao.isPending}>Tirar do mapa</Button>
        </span>
      )}
      {acao.error && <span role="alert" className="w-full text-rotulo text-critico">{(acao.error as Error).message}</span>}
    </li>
  )
}

function FormularioServico({ unidadeId, unidadeConsulta, servico, aoFim }: {
  unidadeId: string; unidadeConsulta: string; servico?: Servico; aoFim: () => void
}) {
  const qc = useQueryClient()
  const [f, setF] = React.useState<FormServico>(servico ? {
    nome: servico.nome, tipo: servico.tipo, procedimento: servico.procedimento ?? '', situacao: servico.situacao,
    vagas: servico.vagas == null ? '' : String(servico.vagas), observacao: servico.observacao ?? '',
  } : SERVICO_VAZIO)
  const [tentou, setTentou] = React.useState(false)
  const erros = errosServico(f)
  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('regulacao_salvar_servico', {
        p_unidade: unidadeId, p_id: servico?.id ?? null, p_dados: servicoParaEnvio(f) as unknown as Json,
      })
      if (error) throw error
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['regulacao-mapa', unidadeConsulta] }); aoFim() },
  })
  const id = servico?.id ?? 'novo'
  const set = <K extends keyof FormServico>(k: K, v: FormServico[K]) => setF((x) => ({ ...x, [k]: v }))
  return (
    <div className="flex flex-col gap-2 rounded-md border border-acao/30 p-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="flex flex-col gap-1 sm:col-span-2">
          <Label htmlFor={`sv-nome-${id}`} className="text-xs">Serviço</Label>
          <Input id={`sv-nome-${id}`} className="h-8" placeholder="ex.: Tomografia, Hemodinâmica, Consulta de cardiologia" value={f.nome} onChange={(e) => set('nome', e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`sv-tipo-${id}`} className="text-xs">Tipo</Label>
          <select id={`sv-tipo-${id}`} className={SELECT} value={f.tipo} onChange={(e) => set('tipo', e.target.value as TipoServico | '')}>
            <option value="">Escolha…</option>
            {(Object.keys(TIPOS_SERVICO) as TipoServico[]).map((k) => <option key={k} value={k}>{TIPOS_SERVICO[k]}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`sv-sit-${id}`} className="text-xs">Situação</Label>
          <select id={`sv-sit-${id}`} className={SELECT} value={f.situacao} onChange={(e) => set('situacao', e.target.value as SituacaoServico | '')}>
            <option value="">Escolha…</option>
            {(Object.keys(SITUACOES_SERVICO) as SituacaoServico[]).map((k) => <option key={k} value={k}>{SITUACOES_SERVICO[k].rotulo}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`sv-vagas-${id}`} className="text-xs">Vagas (opcional)</Label>
          <Input id={`sv-vagas-${id}`} className="h-8" inputMode="numeric" value={f.vagas} onChange={(e) => set('vagas', e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`sv-proc-${id}`} className="text-xs">Procedimento SIGTAP (opcional)</Label>
          <Input id={`sv-proc-${id}`} className="h-8" inputMode="numeric" placeholder="10 dígitos" value={f.procedimento} onChange={(e) => set('procedimento', e.target.value)} />
        </div>
        <div className="flex flex-col gap-1 sm:col-span-3">
          <Label htmlFor={`sv-obs-${id}`} className="text-xs">Observação (opcional)</Label>
          <Input id={`sv-obs-${id}`} className="h-8" placeholder="ex.: até 22h; só adulto" value={f.observacao} onChange={(e) => set('observacao', e.target.value)} />
        </div>
      </div>
      {tentou && erros.length > 0 && <ul role="alert" className="text-rotulo text-critico">{erros.map((e) => <li key={e}>{e}</li>)}</ul>}
      <div className="flex gap-2">
        <Button size="sm" onClick={() => { setTentou(true); if (erros.length === 0) salvar.mutate() }} disabled={salvar.isPending}>Salvar</Button>
        <Button size="sm" variant="ghost" onClick={aoFim}>Cancelar</Button>
      </div>
      {salvar.error && <p role="alert" className="text-rotulo text-critico">{(salvar.error as Error).message}</p>}
    </div>
  )
}

type SetorOferta = {
  id: string; nome: string; tipo: string; especialidade: string | null; publico: string
  regulacao_tipo_leito: string | null; ofertado_em: string | null; ofertado_por: string | null; leitos: number
}

/** O gestor marca os setores da unidade ofertados à regulação. */
export function OfertaSetores({ unidadeId }: { unidadeId: string }) {
  const qc = useQueryClient()
  const setores = useQuery({
    queryKey: ['regulacao-setores-oferta', unidadeId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('regulacao_setores_oferta', { p_unidade: unidadeId })
      if (error) throw error
      return (data ?? []) as unknown as SetorOferta[]
    },
  })
  const ofertar = useMutation({
    mutationFn: async ({ setor, tipo }: { setor: string; tipo: string | null }) => {
      const { error } = await supabase.rpc('regulacao_ofertar_setor', { p_setor: setor, p_tipo_leito: tipo })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['regulacao-setores-oferta', unidadeId] })
      void qc.invalidateQueries({ queryKey: ['regulacao-mapa', unidadeId] })
    },
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Setores ofertados à regulação</CardTitle>
        <CardDescription>Marque o tipo de leito da regulação de cada setor que recebe pacientes regulados. Setor sem marca não aparece no mapa de vagas.</CardDescription>
      </CardHeader>
      <CardContent className="text-apoio">
        {setores.isLoading ? <Spinner /> : setores.error ? <p role="alert" className="text-critico">{(setores.error as Error).message}</p> : (
          <ul className="flex flex-col divide-y divide-fio">
            {(setores.data ?? []).map((st) => (
              <li key={st.id} className="flex flex-wrap items-center gap-2 py-1.5">
                <span className="text-tinta">{st.nome}</span>
                <span className="text-rotulo text-tinta-sussurro">{st.leitos} leito{st.leitos === 1 ? '' : 's'}{st.especialidade ? ` · ${st.especialidade}` : ''}</span>
                <select aria-label={`Tipo de leito da regulação — ${st.nome}`} className={`${SELECT} ml-auto`} value={st.regulacao_tipo_leito ?? ''}
                  disabled={ofertar.isPending} onChange={(e) => ofertar.mutate({ setor: st.id, tipo: e.target.value || null })}>
                  <option value="">Não ofertado</option>
                  {Object.entries(TIPOS_LEITO).map(([k, x]) => <option key={k} value={k}>{x}</option>)}
                </select>
                {st.ofertado_em && <span className="w-full text-rotulo text-tinta-sussurro">{st.ofertado_por ?? '—'} · {fmtDataHora(st.ofertado_em)}</span>}
              </li>
            ))}
          </ul>
        )}
        {ofertar.error && <p role="alert" className="text-rotulo text-critico">{(ofertar.error as Error).message}</p>}
      </CardContent>
    </Card>
  )
}
