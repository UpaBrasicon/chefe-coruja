// ─────────────────────────────────────────────────────────────────────────────
// Implantação da unidade (Fase 3, tarefa 10; decisões do RT de 10/10/2026).
//
// • O implantador (super admin) abre a implantação com o tipo e o D0.
// • Itens por fase, com responsável e prazo. O que o sistema confere sozinho
//   aparece com o resultado da conferência; o resto se marca à mão.
// • Treinamento: quem foi treinado em cada papel (não bloqueia acesso).
// • Aceite conjunto da virada e do encerramento (implantador e gestor).
// Roteiro escrito em docs/implantacao/. Migration 20261106000001_implantacao.sql.
// ─────────────────────────────────────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Circle, ClipboardList, Rocket } from 'lucide-react'
import * as React from 'react'

import { TituloPagina, Vazio } from '@/components/monitor/Pagina'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { useUnidade } from '@/contexts/UnidadeContext'
import { fmtData, fmtDataHora } from '@/lib/datas'
import {
  FASES, PAPEIS, RESPONSAVEL, TIPOS, faltamParaAceite, resumoFase, rotuloDia, situacaoPrazo,
  type Item, type TipoUnidade,
} from '@/lib/implantacao'
import { supabase } from '@/lib/supabase'
import { Erro } from '@/pages/farmacia/Farmacia'

type Painel = {
  sou_implantador: boolean
  implantacao: null | {
    id: string; tipo: TipoUnidade; d0: string; situacao: 'em_implantacao' | 'em_operacao' | 'encerrada'
    implantador: string | null; criada_em: string; em_operacao_em: string | null; encerrada_em: string | null
  }
  itens?: Item[]
  pessoas?: { perfil_id: string; nome: string; papel: string; treinado_em: string | null; treinamento_id: string | null; registrado_por: string | null }[]
  aceites?: { etapa: 'virada' | 'encerramento'; lado: 'implantador' | 'gestor'; nome: string | null; pendencias: string | null; em: string }[]
}

const SITUACAO = {
  em_implantacao: { rotulo: 'Em implantação', variante: 'warning' },
  em_operacao: { rotulo: 'Em operação', variante: 'info' },
  encerrada: { rotulo: 'Implantação encerrada', variante: 'success' },
} as const

const hoje = () => new Date().toLocaleDateString('sv-SE')

export default function Implantacao() {
  const { ehSuperAdmin, unidadeAtiva } = useUnidade()
  const todas = useQuery({
    queryKey: ['implantacao-unidades'],
    enabled: ehSuperAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from('unidades').select('id, nome').eq('ativo', true).order('nome')
      if (error) throw error
      return data ?? []
    },
  })
  const [escolhida, setEscolhida] = React.useState('')
  const unidadeId = (ehSuperAdmin ? escolhida || unidadeAtiva?.unidade_id : unidadeAtiva?.unidade_id) ?? ''
  const painel = useQuery({
    queryKey: ['implantacao', unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('implantacao_painel', { p_unidade: unidadeId })
      if (error) throw error
      return data as unknown as Painel
    },
  })
  const p = painel.data
  const imp = p?.implantacao

  return (
    <div className="flex w-full max-w-5xl flex-col gap-4">
      <TituloPagina icone={Rocket} titulo="Implantação"
        descricao="Roteiro da unidade: preparação, virada, operação assistida e encerramento. O que o sistema confere sozinho já aparece marcado." />
      {ehSuperAdmin && (
        <div className="flex max-w-sm flex-col gap-1 text-apoio">
          <Label htmlFor="imp-unidade" className="text-xs">Unidade</Label>
          <select id="imp-unidade" className="h-8 rounded-controle border border-fio bg-campo px-2" value={unidadeId}
            onChange={(e) => setEscolhida(e.target.value)}>
            <option value="">Escolha…</option>
            {(todas.data ?? []).map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        </div>
      )}
      {!unidadeId ? null : painel.isLoading ? <Spinner /> : painel.error ? <Erro texto={(painel.error as Error).message} /> : !imp ? (
        p?.sou_implantador ? <AbrirImplantacao unidadeId={unidadeId} /> : (
          <Vazio icone={Rocket} titulo="Sem implantação aberta" texto="A implantação é aberta pela equipe Chefe Coruja, com a data da virada." />
        )
      ) : (
        <>
          <Cabecalho p={p as Required<Painel>} unidadeId={unidadeId} />
          {FASES.map((f) => <FaseCard key={f.fase} fase={f} p={p as Required<Painel>} unidadeId={unidadeId} />)}
          <Treinamento p={p as Required<Painel>} unidadeId={unidadeId} />
          <Aceites p={p as Required<Painel>} unidadeId={unidadeId} />
        </>
      )}
    </div>
  )
}

function useRecarregar(unidadeId: string) {
  const qc = useQueryClient()
  return () => void qc.invalidateQueries({ queryKey: ['implantacao', unidadeId] })
}

function AbrirImplantacao({ unidadeId }: { unidadeId: string }) {
  const recarregar = useRecarregar(unidadeId)
  const [tipo, setTipo] = React.useState<TipoUnidade | 'ambulatorio'>('upa')
  const [d0, setD0] = React.useState('')
  const abrir = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('implantacao_abrir', { p_unidade: unidadeId, p_tipo: tipo, p_d0: d0 })
      if (error) throw error
    },
    onSuccess: recarregar,
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Abrir a implantação</CardTitle>
        <CardDescription>Escolha o tipo da unidade e a data da virada (D0). Os itens e os prazos saem do roteiro.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-apoio">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="imp-tipo" className="text-xs">Tipo</Label>
            <select id="imp-tipo" className="h-8 rounded-controle border border-fio bg-campo px-2" value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoUnidade)}>
              {(Object.keys(TIPOS) as TipoUnidade[]).map((k) => <option key={k} value={k}>{TIPOS[k]}</option>)}
              <option value="ambulatorio" disabled>Ambulatório / policlínica (a construir)</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="imp-d0" className="text-xs">Data da virada (D0)</Label>
            <Input id="imp-d0" type="date" className="h-8" value={d0} onChange={(e) => setD0(e.target.value)} />
          </div>
        </div>
        <Erro texto={abrir.error ? (abrir.error as Error).message : null} />
        <div><Button onClick={() => abrir.mutate()} disabled={!d0 || abrir.isPending}>{abrir.isPending ? <Spinner /> : <Rocket className="size-4" />} Abrir</Button></div>
      </CardContent>
    </Card>
  )
}

function Cabecalho({ p, unidadeId }: { p: Required<Painel>; unidadeId: string }) {
  const recarregar = useRecarregar(unidadeId)
  const imp = p.implantacao!
  const s = SITUACAO[imp.situacao]
  const [mudar, setMudar] = React.useState(false)
  const [novo, setNovo] = React.useState(imp.d0)
  const [motivo, setMotivo] = React.useState('')
  const mudarD0 = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('implantacao_mudar_d0', { p_id: imp.id, p_d0: novo, p_motivo: motivo.trim() })
      if (error) throw error
    },
    onSuccess: () => { setMudar(false); setMotivo(''); recarregar() },
  })
  const dia = rotuloDia(imp.d0, hoje())
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 pt-5 text-apoio">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-corpo font-semibold text-tinta">{TIPOS[imp.tipo]}</span>
          <Badge variant={s.variante}>{s.rotulo}</Badge>
          <span className="text-tinta-apoio">Virada em {fmtData(imp.d0)} · hoje é {dia}</span>
          <span className="ml-auto text-tinta-sussurro">Implantador: {imp.implantador ?? '—'}</span>
        </div>
        {p.sou_implantador && imp.situacao === 'em_implantacao' && (
          mudar ? (
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor="imp-novo-d0" className="text-xs">Nova data da virada</Label>
                <Input id="imp-novo-d0" type="date" className="h-8" value={novo} onChange={(e) => setNovo(e.target.value)} />
              </div>
              <div className="flex min-w-60 flex-1 flex-col gap-1">
                <Label htmlFor="imp-motivo-d0" className="text-xs">Motivo</Label>
                <Input id="imp-motivo-d0" className="h-8" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
              </div>
              <Button size="sm" onClick={() => mudarD0.mutate()} disabled={motivo.trim().length < 10 || mudarD0.isPending}>Salvar</Button>
              <Button size="sm" variant="ghost" onClick={() => setMudar(false)}>Voltar</Button>
              <Erro texto={mudarD0.error ? (mudarD0.error as Error).message : null} />
            </div>
          ) : (
            <div><Button size="xs" variant="outline" onClick={() => setMudar(true)}>Mudar a data da virada</Button></div>
          )
        )}
      </CardContent>
    </Card>
  )
}

const TOM_PRAZO = { feito: 'text-sucesso', atrasado: 'text-critico', perto: 'text-atencao', no_prazo: 'text-tinta-sussurro' } as const

function FaseCard({ fase, p, unidadeId }: { fase: (typeof FASES)[number]; p: Required<Painel>; unidadeId: string }) {
  const itens = p.itens.filter((i) => i.fase === fase.fase)
  const r = resumoFase(p.itens, fase.fase)
  const imp = p.implantacao!
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          {fase.rotulo} <span className="text-apoio font-normal text-tinta-sussurro">{fase.janela}</span>
          <Badge variant={r.feitos === r.obrigatorios ? 'success' : 'secondary'} className="ml-auto">
            {r.feitos} de {r.obrigatorios} obrigatórios
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col divide-y divide-fio">
          {itens.map((it) => <LinhaItem key={it.id} it={it} d0={imp.d0} encerrada={imp.situacao === 'encerrada'} unidadeId={unidadeId} />)}
        </ul>
      </CardContent>
    </Card>
  )
}

function LinhaItem({ it, d0, encerrada, unidadeId }: { it: Item; d0: string; encerrada: boolean; unidadeId: string }) {
  const recarregar = useRecarregar(unidadeId)
  const [obs, setObs] = React.useState(it.observacao ?? '')
  const [aberto, setAberto] = React.useState(false)
  const marcar = useMutation({
    mutationFn: async (feito: boolean) => {
      const { error } = await supabase.rpc('implantacao_marcar', { p_item: it.id, p_feito: feito, p_observacao: obs.trim() || null })
      if (error) throw error
    },
    onSuccess: () => { setAberto(false); recarregar() },
  })
  const prazo = situacaoPrazo(it, hoje())
  return (
    <li className="flex flex-col gap-1.5 py-2.5 text-apoio">
      <div className="flex flex-wrap items-start gap-2">
        {it.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-sucesso" aria-label="feito" /> : <Circle className="mt-0.5 size-4 shrink-0 text-tinta-sussurro" aria-label="pendente" />}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-medium text-tinta">
            {it.codigo} · {it.titulo}
            {!it.obrigatorio && <span className="ml-1.5 text-rotulo font-normal text-tinta-sussurro">(recomendado)</span>}
          </span>
          {it.descricao && <span className="text-tinta-apoio">{it.descricao}</span>}
          <span className="text-rotulo text-tinta-sussurro">
            {RESPONSAVEL[it.responsavel]} · prazo {fmtData(it.prazo)} ({rotuloDia(d0, it.prazo)})
            {' · '}<span className={TOM_PRAZO[prazo]}>{prazo === 'feito' ? 'feito' : prazo === 'atrasado' ? 'atrasado' : prazo === 'perto' ? 'vence em breve' : 'no prazo'}</span>
            {it.automatico ? ` · conferido pelo sistema: ${it.detalhe ?? ''}` : it.feito_em ? ` · marcado por ${it.feito_por ?? '—'} em ${fmtDataHora(it.feito_em)}` : ''}
          </span>
          {it.observacao && <span className="text-rotulo text-tinta-apoio">Observação: {it.observacao}</span>}
        </div>
        {!it.automatico && !encerrada && (
          it.ok
            ? <Button size="xs" variant="ghost" onClick={() => marcar.mutate(false)} disabled={marcar.isPending}>Reabrir</Button>
            : <Button size="xs" variant="outline" onClick={() => setAberto(!aberto)}>Marcar feito</Button>
        )}
      </div>
      {aberto && (
        <div className="flex flex-wrap items-end gap-2 pl-6">
          <div className="flex min-w-60 flex-1 flex-col gap-1">
            <Label htmlFor={`obs-${it.id}`} className="text-xs">Observação (opcional)</Label>
            <Input id={`obs-${it.id}`} className="h-8" value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>
          <Button size="sm" onClick={() => marcar.mutate(true)} disabled={marcar.isPending}>Confirmar</Button>
        </div>
      )}
      <Erro texto={marcar.error ? (marcar.error as Error).message : null} />
    </li>
  )
}

function Treinamento({ p, unidadeId }: { p: Required<Painel>; unidadeId: string }) {
  const recarregar = useRecarregar(unidadeId)
  const imp = p.implantacao!
  const [data, setData] = React.useState(hoje())
  const treinar = useMutation({
    mutationFn: async (x: { perfil: string; papel: string }) => {
      const { error } = await supabase.rpc('implantacao_treinar', { p_implantacao: imp.id, p_perfil: x.perfil, p_papel: x.papel, p_data: data })
      if (error) throw error
    },
    onSuccess: recarregar,
  })
  const desfazer = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('implantacao_destreinar', { p_treinamento: id })
      if (error) throw error
    },
    onSuccess: recarregar,
  })
  const faltam = p.pessoas.filter((x) => !x.treinado_em).length
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          Treinamento por papel
          <Badge variant={faltam === 0 && p.pessoas.length > 0 ? 'success' : 'secondary'} className="ml-auto">
            {p.pessoas.length - faltam} de {p.pessoas.length} treinados
          </Badge>
        </CardTitle>
        <CardDescription>Roteiro de cada papel em docs/implantacao/treinamento. O acesso não depende do registro.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-apoio">
        <div className="flex items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="imp-data-trein" className="text-xs">Data do treinamento</Label>
            <Input id="imp-data-trein" type="date" className="h-8" value={data} max={hoje()} onChange={(e) => setData(e.target.value)} />
          </div>
        </div>
        {p.pessoas.length === 0 ? <Vazio icone={ClipboardList} titulo="Ninguém com vínculo" texto="Vincule as pessoas à unidade para registrar o treinamento." /> : (
          <ul className="flex flex-col divide-y divide-fio">
            {p.pessoas.map((x) => (
              <li key={`${x.perfil_id}-${x.papel}`} className="flex flex-wrap items-center gap-2 py-2">
                <span className="font-medium text-tinta">{x.nome}</span>
                <Badge variant="secondary">{PAPEIS[x.papel] ?? x.papel}</Badge>
                {x.treinado_em ? (
                  <>
                    <span className="text-sucesso">treinado em {fmtData(x.treinado_em)}</span>
                    <span className="text-rotulo text-tinta-sussurro">registrado por {x.registrado_por ?? '—'}</span>
                    {imp.situacao !== 'encerrada' && (
                      <Button size="xs" variant="ghost" className="ml-auto" onClick={() => x.treinamento_id && desfazer.mutate(x.treinamento_id)}
                        disabled={desfazer.isPending}>Desfazer</Button>
                    )}
                  </>
                ) : (
                  <>
                    <span className="text-atencao">falta treinar</span>
                    {imp.situacao !== 'encerrada' && (
                      <Button size="xs" variant="outline" className="ml-auto" onClick={() => treinar.mutate({ perfil: x.perfil_id, papel: x.papel })}
                        disabled={treinar.isPending}>Registrar treinamento</Button>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        <Erro texto={(treinar.error ?? desfazer.error) ? ((treinar.error ?? desfazer.error) as Error).message : null} />
      </CardContent>
    </Card>
  )
}

function Aceites({ p, unidadeId }: { p: Required<Painel>; unidadeId: string }) {
  const recarregar = useRecarregar(unidadeId)
  const imp = p.implantacao!
  const etapa: 'virada' | 'encerramento' | null = imp.situacao === 'em_implantacao' ? 'virada' : imp.situacao === 'em_operacao' ? 'encerramento' : null
  const [pendencias, setPendencias] = React.useState('')
  const aceitar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('implantacao_aceitar', { p_id: imp.id, p_etapa: etapa!, p_pendencias: pendencias.trim() || null })
      if (error) throw error
    },
    onSuccess: () => { setPendencias(''); recarregar() },
  })
  const meuLado = p.sou_implantador ? 'implantador' : 'gestor'
  const jaAceitei = etapa ? p.aceites.some((a) => a.etapa === etapa && a.lado === meuLado) : true
  const faltam = etapa ? faltamParaAceite(p.itens, etapa) : []
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Aceite</CardTitle>
        <CardDescription>
          A virada põe a unidade "em operação"; o encerramento fecha a implantação. Cada etapa precisa do aceite do implantador e do gestor,
          com os itens obrigatórios cumpridos. O sistema não trava nada.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-apoio">
        {p.aceites.length > 0 && (
          <ul className="flex flex-col gap-1">
            {p.aceites.map((a) => (
              <li key={`${a.etapa}-${a.lado}`}>
                <span className="font-medium text-tinta">{a.etapa === 'virada' ? 'Virada' : 'Encerramento'}</span>
                {' · '}{a.lado === 'implantador' ? 'implantador' : 'gestor'}: {a.nome ?? '—'} em {fmtDataHora(a.em)}
                {a.pendencias && <span className="block text-rotulo text-tinta-apoio">Pendências aceitas: {a.pendencias}</span>}
              </li>
            ))}
          </ul>
        )}
        {etapa && !jaAceitei && (
          faltam.length > 0 ? (
            <p className="text-atencao">
              Para o aceite {etapa === 'virada' ? 'da virada' : 'do encerramento'} faltam: {faltam.map((i) => i.codigo).join(', ')}.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor="imp-pend" className="text-xs">Pendências aceitas (itens recomendados em aberto, combinados)</Label>
                <Input id="imp-pend" className="h-8" value={pendencias} onChange={(e) => setPendencias(e.target.value)} />
              </div>
              <div>
                <Button onClick={() => aceitar.mutate()} disabled={aceitar.isPending}>
                  {aceitar.isPending ? <Spinner /> : <CheckCircle2 className="size-4" />}
                  Registrar o aceite {etapa === 'virada' ? 'da virada' : 'do encerramento'} como {meuLado}
                </Button>
              </div>
            </div>
          )
        )}
        {etapa && jaAceitei && <p className="text-tinta-apoio">Seu aceite está registrado. Falta o do {meuLado === 'implantador' ? 'gestor' : 'implantador'}.</p>}
        <Erro texto={aceitar.error ? (aceitar.error as Error).message : null} />
      </CardContent>
    </Card>
  )
}
