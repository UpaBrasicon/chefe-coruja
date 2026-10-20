// ─────────────────────────────────────────────────────────────────────────────
// APAC da unidade (Fase 3, tarefa 5; decisões do RT de 10/10/2026).
//
// • Médico regulador: autoriza a APAC solicitada (número de 13 dígitos e
//   validade) ou rejeita com motivo; cancela com motivo.
// • Faturamento: registra a execução de cada competência (procedimentos,
//   executante, tipo de atendimento, motivo de saída) e, na aba Arquivo,
//   fecha a competência e baixa o arquivo do APAC Magnético.
// • Gestor: acompanha e também faz o que o faturamento faz.
// Migration 20261104000001_apac.sql.
// ─────────────────────────────────────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, FileCheck } from 'lucide-react'
import * as React from 'react'

import { TituloPagina, Vazio } from '@/components/monitor/Pagina'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { useUnidade } from '@/contexts/UnidadeContext'
import { competenciaDaData, competenciaNaTela, lerCompetencia } from '@/lib/aih'
import {
  CARATER_APAC, EVENTO_APAC, STATUS_APAC, TIPO_APAC, competenciasDaValidade, numeroApac, numeroApacValido,
  type Apac, type ConferenciaApac, type EventoApac, type FechamentoApac, type StatusApac,
} from '@/lib/apac'
import { codigoSigtapNaTela, competenciasNaJanela, type ProfissionalParaFaturar } from '@/lib/bpa'
import { fmtData, fmtDataHora } from '@/lib/datas'
import { supabase } from '@/lib/supabase'
import { MensagemErro } from '@/components/ui/mensagem-erro'
import { Abas } from '@/components/monitor/Pagina'

type Aba = StatusApac | 'todas' | 'arquivo'
const selectCls = 'h-9 rounded-controle border border-fio bg-campo px-2 text-apoio'

export default function Apac() {
  const { unidadeAtiva, papelAtivo } = useUnidade()
  const unidade = unidadeAtiva?.unidade_id
  const regulador = papelAtivo === 'regulador'
  const faturamento = papelAtivo === 'faturamento' || papelAtivo === 'gestor'
  const abas: (readonly [Aba, string])[] = [
    ['solicitada', 'Solicitadas'], ['autorizada', 'Autorizadas'], ['rejeitada', 'Rejeitadas'], ['cancelada', 'Canceladas'], ['todas', 'Todas'],
    ...(faturamento ? [['arquivo', 'Arquivo do APAC Magnético'] as const] : []),
  ]
  const [aba, setAba] = React.useState<Aba>(regulador ? 'solicitada' : 'autorizada')
  const lista = useQuery({
    queryKey: ['apacs-da-unidade', unidade, aba],
    enabled: !!unidade && aba !== 'arquivo',
    queryFn: async () => {
      const { data, error } = await supabase.rpc('apacs_da_unidade', { p_unidade: unidade!, p_status: aba === 'todas' ? undefined : aba })
      if (error) throw error
      return (data ?? []) as unknown as Apac[]
    },
  })
  return (
    <div className="flex w-full max-w-5xl flex-col">
      <TituloPagina icone={FileCheck} titulo="APAC da unidade"
        descricao={regulador ? 'Autorize com o número e a validade, ou rejeite com o motivo.'
          : 'Registre a execução de cada competência e gere o arquivo do APAC Magnético. Quem autoriza é o médico regulador.'} />
      <Abas abas={abas} valor={aba} onChange={setAba} rotulo="APAC" />
      {!unidade ? <Spinner /> : aba === 'arquivo' ? <AbaArquivo unidade={unidade} /> : lista.isLoading ? <Spinner />
        : lista.error ? <MensagemErro texto={(lista.error as Error).message} /> : (lista.data ?? []).length === 0 ? (
          <Vazio icone={FileCheck} titulo="Nenhuma APAC aqui" texto="Quando o médico solicitar uma APAC, ela aparece em Solicitadas." />
        ) : (
          <div className="flex flex-col gap-3">
            {(lista.data ?? []).map((a) => <CartaoApac key={a.id} a={a} unidade={unidade} regulador={regulador} faturamento={faturamento} />)}
          </div>
        )}
    </div>
  )
}

function CartaoApac({ a, unidade, regulador, faturamento }: { a: Apac; unidade: string; regulador: boolean; faturamento: boolean }) {
  const qc = useQueryClient()
  const [acao, setAcao] = React.useState<'autorizar' | 'rejeitar' | 'cancelar' | 'execucao' | null>(null)
  const [hist, setHist] = React.useState(false)
  const invalidar = () => {
    void qc.invalidateQueries({ queryKey: ['apacs-da-unidade', unidade] })
    void qc.invalidateQueries({ queryKey: ['eventos-apac', a.id] })
  }
  const eventos = useQuery({
    queryKey: ['eventos-apac', a.id],
    enabled: hist,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('eventos_apac', { p_apac: a.id })
      if (error) throw error
      return (data ?? []) as unknown as EventoApac[]
    },
  })
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 pt-4 text-apoio">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-tinta">{a.paciente}</span>
          <span className="text-xs text-tinta-sussurro">{a.nascimento ? `nasc. ${fmtData(a.nascimento)}` : ''} {a.sexo ?? ''}</span>
          <Badge variant={a.status === 'autorizada' ? 'success' : a.status === 'solicitada' ? 'info' : 'secondary'} className="ml-auto">{STATUS_APAC[a.status]}</Badge>
        </div>
        <span>Procedimento: {codigoSigtapNaTela(a.procedimento)} · {a.procedimento_nome ?? '—'}</span>
        <span className="text-tinta-apoio">
          {TIPO_APAC[a.tipo]} · CID {a.cid_principal}{a.cid_secundario ? ` / ${a.cid_secundario}` : ''} · caráter {a.carater} ({CARATER_APAC[a.carater]})
          {a.apac_anterior ? ` · APAC anterior ${a.apac_anterior}` : ''}
        </span>
        {a.justificativa?.justificativa && <span className="text-tinta-apoio">Justificativa: {a.justificativa.justificativa}</span>}
        {a.justificativa?.exames && <span className="text-tinta-apoio">Exames: {a.justificativa.exames}</span>}
        {a.criticas.filter((c) => !c.bloqueante).map((c, i) => <span key={i} className="text-xs text-atencao">Aviso: {c.texto}</span>)}
        <span className="text-xs text-tinta-sussurro">
          Solicitada por {a.solicitada_por ?? '—'}, {fmtDataHora(a.solicitada_em)}
          {a.decidida_em && <> · decidida por {a.decidida_por ?? '—'}, {fmtDataHora(a.decidida_em)}</>}
        </span>
        {a.numero && <span className="text-tinta">APAC nº {a.numero} · validade {fmtData(a.validade_inicio!)} a {fmtData(a.validade_fim!)}</span>}
        {a.motivo && <span className="text-tinta-apoio">Motivo: {a.motivo}</span>}
        {a.execucoes.length > 0 && (
          <ul className="flex flex-col gap-1">
            {a.execucoes.map((e) => <LinhaExecucao key={e.id} e={e} podeCancelar={faturamento} aoMudar={invalidar} />)}
          </ul>
        )}

        <div className="flex flex-wrap gap-2">
          {regulador && a.status === 'solicitada' && !acao && <>
            <Button size="sm" onClick={() => setAcao('autorizar')}>Autorizar</Button>
            <Button size="sm" variant="outline" onClick={() => setAcao('rejeitar')}>Rejeitar</Button>
          </>}
          {faturamento && a.status === 'autorizada' && !acao && <Button size="sm" onClick={() => setAcao('execucao')}>Registrar execução</Button>}
          {(regulador && ['solicitada', 'autorizada'].includes(a.status)) || (a.solicitada_por_mim && a.status === 'solicitada') ? (
            !acao && <Button size="sm" variant="ghost" onClick={() => setAcao('cancelar')}>Cancelar APAC</Button>
          ) : null}
          <Button size="sm" variant="ghost" onClick={() => setHist((v) => !v)}>{hist ? 'Esconder histórico' : 'Ver histórico'}</Button>
        </div>
        {acao === 'autorizar' && <Autorizar a={a} fechar={() => setAcao(null)} aoMudar={invalidar} />}
        {(acao === 'rejeitar' || acao === 'cancelar') && <ComMotivo a={a} tipo={acao} fechar={() => setAcao(null)} aoMudar={invalidar} />}
        {acao === 'execucao' && <Execucao a={a} unidade={unidade} fechar={() => setAcao(null)} aoMudar={invalidar} />}
        {hist && (eventos.isLoading ? <Spinner /> : (
          <ul className="flex flex-col gap-0.5 text-xs text-tinta-apoio">
            {(eventos.data ?? []).map((ev, i) => (
              <li key={i}>{EVENTO_APAC[ev.evento] ?? ev.evento} · {ev.por ?? '—'}, {fmtDataHora(ev.em)}{ev.motivo ? ` — “${ev.motivo}”` : ''}</li>
            ))}
          </ul>
        ))}
      </CardContent>
    </Card>
  )
}

function Autorizar({ a, fechar, aoMudar }: { a: Apac; fechar: () => void; aoMudar: () => void }) {
  const [numero, setNumero] = React.useState('')
  const [ini, setIni] = React.useState(new Date().toISOString().slice(0, 10))
  const [fim, setFim] = React.useState('')
  const [obs, setObs] = React.useState('')
  const m = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('decidir_apac', {
        p_apac: a.id, p_autorizar: true, p_numero: numeroApac(numero), p_validade_inicio: ini, p_validade_fim: fim, p_motivo: obs.trim() || undefined,
      })
      if (error) throw error
    },
    onSuccess: () => { fechar(); aoMudar() },
  })
  return (
    <div className="flex flex-col gap-2 rounded-md border border-fio p-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor={`apac-num-${a.id}`} className="text-xs">Número da APAC (13 dígitos)</Label>
          <Input id={`apac-num-${a.id}`} className="h-8" inputMode="numeric" value={numero} onChange={(e) => setNumero(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`apac-ini-${a.id}`} className="text-xs">Validade: início</Label>
          <Input id={`apac-ini-${a.id}`} className="h-8" type="date" value={ini} onChange={(e) => setIni(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`apac-fim-${a.id}`} className="text-xs">Validade: fim</Label>
          <Input id={`apac-fim-${a.id}`} className="h-8" type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
        </div>
      </div>
      <Input className="h-8" placeholder="Observação (opcional)" value={obs} onChange={(e) => setObs(e.target.value)} />
      <div className="flex gap-2">
        <Button size="sm" disabled={!numeroApacValido(numero) || !ini || !fim || fim < ini || m.isPending} onClick={() => m.mutate()}>Autorizar APAC</Button>
        <Button size="sm" variant="ghost" onClick={fechar}>Voltar</Button>
      </div>
      {m.error && <MensagemErro texto={(m.error as Error).message} />}
    </div>
  )
}

function ComMotivo({ a, tipo, fechar, aoMudar }: { a: Apac; tipo: 'rejeitar' | 'cancelar'; fechar: () => void; aoMudar: () => void }) {
  const [motivo, setMotivo] = React.useState('')
  const m = useMutation({
    mutationFn: async () => {
      const { error } = tipo === 'rejeitar'
        ? await supabase.rpc('decidir_apac', { p_apac: a.id, p_autorizar: false, p_motivo: motivo.trim() })
        : await supabase.rpc('cancelar_apac', { p_apac: a.id, p_motivo: motivo.trim() })
      if (error) throw error
    },
    onSuccess: () => { fechar(); aoMudar() },
  })
  return (
    <div className="flex flex-wrap gap-2 rounded-md border border-fio p-3">
      <Input className="h-8 flex-1" placeholder="Motivo (mínimo de 10 letras)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      <Button size="sm" variant="destructive" disabled={motivo.trim().length < 10 || m.isPending} onClick={() => m.mutate()}>
        {tipo === 'rejeitar' ? 'Rejeitar' : 'Cancelar APAC'}
      </Button>
      <Button size="sm" variant="ghost" onClick={fechar}>Voltar</Button>
      {m.error && <span role="alert" className="basis-full text-xs text-critico">{(m.error as Error).message}</span>}
    </div>
  )
}

function Execucao({ a, unidade, fechar, aoMudar }: { a: Apac; unidade: string; fechar: () => void; aoMudar: () => void }) {
  const comps = competenciasDaValidade(a.validade_inicio, a.validade_fim)
  const [comp, setComp] = React.useState(comps[0] ?? '')
  const [tipoAt, setTipoAt] = React.useState('')
  const [motivo, setMotivo] = React.useState('')
  const [data, setData] = React.useState('')
  const [exec, setExec] = React.useState('')
  const [procs, setProcs] = React.useState<{ procedimento: string; quantidade: string }[]>([{ procedimento: a.procedimento, quantidade: '1' }])
  const profissionais = useQuery({
    queryKey: ['profissionais-para-faturar', unidade],
    queryFn: async () => {
      const { data: d, error } = await supabase.rpc('profissionais_para_faturar', { p_unidade: unidade })
      if (error) throw error
      return (d ?? []) as unknown as ProfissionalParaFaturar[]
    },
  })
  const m = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('registrar_execucao_apac', {
        p_apac: a.id, p_competencia: comp, p_tipo_atendimento: tipoAt, p_motivo_saida: motivo,
        p_data_ocorrencia: data || null, p_executante: exec,
        p_procedimentos: procs.map((p) => ({ procedimento: p.procedimento.replace(/\D/g, ''), quantidade: Number(p.quantidade) })),
      })
      if (error) throw error
    },
    onSuccess: () => { fechar(); aoMudar() },
  })
  const ok = comp && /^\d{2}$/.test(tipoAt) && /^\d{2}$/.test(motivo) && exec
    && procs.every((p) => /^\d{10}$/.test(p.procedimento.replace(/\D/g, '')) && Number(p.quantidade) >= 1)
  return (
    <div className="flex flex-col gap-2 rounded-md border border-fio p-3">
      <div className="grid gap-2 sm:grid-cols-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor={`ex-comp-${a.id}`} className="text-xs">Competência</Label>
          <select id={`ex-comp-${a.id}`} className={selectCls} value={comp} onChange={(e) => setComp(e.target.value)}>
            {comps.map((c) => <option key={c} value={c}>{competenciaNaTela(c)}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`ex-tipo-${a.id}`} className="text-xs">Tipo de atendimento (código)</Label>
          <Input id={`ex-tipo-${a.id}`} className="h-8" maxLength={2} inputMode="numeric" placeholder="2 dígitos" value={tipoAt} onChange={(e) => setTipoAt(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`ex-mot-${a.id}`} className="text-xs">Motivo de saída (Port. SAS 719/2007)</Label>
          <Input id={`ex-mot-${a.id}`} className="h-8" maxLength={2} inputMode="numeric" placeholder="2 dígitos" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`ex-data-${a.id}`} className="text-xs">Data da alta/óbito/transferência</Label>
          <Input id={`ex-data-${a.id}`} className="h-8" type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`ex-prof-${a.id}`} className="text-xs">Executante</Label>
        <select id={`ex-prof-${a.id}`} className={selectCls} value={exec} onChange={(e) => setExec(e.target.value)}>
          <option value="">Escolha…</option>
          {(profissionais.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.nome}{p.cbo ? ` · CBO ${p.cbo}` : ' · sem CBO'}{p.cns_ok ? '' : ' · sem CNS'}</option>)}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-tinta-apoio">Procedimentos (o principal é obrigatório; secundários de APAC no SIGTAP)</span>
        {procs.map((p, i) => (
          <div key={i} className="flex flex-wrap gap-2">
            <Input className="h-8 w-40" placeholder="Código SIGTAP" disabled={i === 0} value={i === 0 ? codigoSigtapNaTela(p.procedimento) : p.procedimento}
              onChange={(e) => setProcs((v) => v.map((x, j) => (j === i ? { ...x, procedimento: e.target.value } : x)))} />
            <Input className="h-8 w-24" inputMode="numeric" placeholder="Qtd." value={p.quantidade}
              onChange={(e) => setProcs((v) => v.map((x, j) => (j === i ? { ...x, quantidade: e.target.value } : x)))} />
            {i > 0 && <Button size="xs" variant="ghost" onClick={() => setProcs((v) => v.filter((_, j) => j !== i))}>Tirar</Button>}
          </div>
        ))}
        <Button size="xs" variant="outline" className="self-start" onClick={() => setProcs((v) => [...v, { procedimento: '', quantidade: '1' }])}>+ Secundário</Button>
      </div>
      <div className="flex gap-2">
        <Button size="sm" disabled={!ok || m.isPending} onClick={() => m.mutate()}>Registrar execução</Button>
        <Button size="sm" variant="ghost" onClick={fechar}>Voltar</Button>
      </div>
      {m.error && <MensagemErro texto={(m.error as Error).message} />}
    </div>
  )
}

function LinhaExecucao({ e, podeCancelar, aoMudar }: { e: Apac['execucoes'][number]; podeCancelar: boolean; aoMudar: () => void }) {
  const [abrindo, setAbrindo] = React.useState(false)
  const [motivo, setMotivo] = React.useState('')
  const m = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('cancelar_execucao_apac', { p_execucao: e.id, p_motivo: motivo.trim() })
      if (error) throw error
    },
    onSuccess: () => { setAbrindo(false); aoMudar() },
  })
  return (
    <li className="flex flex-col gap-1 rounded-md border border-fio px-2.5 py-1.5 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-tinta">Execução {competenciaNaTela(e.competencia)}</span>
        <span className="text-tinta-sussurro">
          {e.procedimentos.map((p) => `${codigoSigtapNaTela(p.procedimento)} × ${p.quantidade}`).join(', ')} · executante {e.executante ?? '—'}
          {' '}· tipo {e.tipo_atendimento} · motivo de saída {e.motivo_saida}
        </span>
        {podeCancelar && !abrindo && <Button size="xs" variant="ghost" className="ml-auto" onClick={() => setAbrindo(true)}>Cancelar</Button>}
      </div>
      {abrindo && (
        <div className="flex flex-wrap gap-2">
          <Input className="h-7 flex-1" placeholder="Motivo (mínimo de 10 letras)" value={motivo} onChange={(ev) => setMotivo(ev.target.value)} />
          <Button size="xs" variant="destructive" disabled={motivo.trim().length < 10 || m.isPending} onClick={() => m.mutate()}>Cancelar execução</Button>
          <Button size="xs" variant="ghost" onClick={() => setAbrindo(false)}>Voltar</Button>
          {m.error && <span role="alert" className="basis-full text-critico">{(m.error as Error).message}</span>}
        </div>
      )}
    </li>
  )
}

// ── arquivo ─────────────────────────────────────────────────────────────────
function baixar(nome: string, conteudo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: 'text/plain' }))
  const el = document.createElement('a')
  el.href = url; el.download = nome
  document.body.appendChild(el); el.click(); el.remove()
  URL.revokeObjectURL(url)
}

function AbaArquivo({ unidade }: { unidade: string }) {
  const qc = useQueryClient()
  const atual = competenciaDaData(new Date().toISOString())!
  const [comp, setComp] = React.useState(competenciasNaJanela(atual)[1])
  const [outra, setOutra] = React.useState('')
  const [motivo, setMotivo] = React.useState('')
  const [reabrindo, setReabrindo] = React.useState(false)
  const conf = useQuery({
    queryKey: ['apac-conferencia', unidade, comp],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('apac_conferencia', { p_unidade: unidade, p_competencia: comp })
      if (error) throw error
      return data as unknown as ConferenciaApac
    },
  })
  const hist = useQuery({
    queryKey: ['apac-fechamentos', unidade],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('apac_fechamentos_da_unidade', { p_unidade: unidade })
      if (error) throw error
      return (data ?? []) as unknown as FechamentoApac[]
    },
  })
  const invalidar = () => {
    void qc.invalidateQueries({ queryKey: ['apac-conferencia', unidade, comp] })
    void qc.invalidateQueries({ queryKey: ['apac-fechamentos', unidade] })
  }
  const fechar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('fechar_competencia_apac', { p_unidade: unidade, p_competencia: comp })
      if (error) throw error
    },
    onSuccess: invalidar,
  })
  const reabrir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('reabrir_competencia_apac', { p_fechamento: id, p_motivo: motivo.trim() })
      if (error) throw error
    },
    onSuccess: () => { setReabrindo(false); setMotivo(''); invalidar() },
  })
  const download = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc('arquivo_apac', { p_fechamento: id })
      if (error) throw error
      const a = data as unknown as { nome: string; conteudo: string }
      baixar(a.nome, a.conteudo)
    },
  })
  const lida = lerCompetencia(outra)
  const c = conf.data
  const fechada = c?.fechamento?.situacao === 'fechada'
  const prontas = (c?.linhas ?? []).filter((l) => l.criticas.length === 0).length
  const bloqueios = (c?.globais ?? []).filter((g) => g.tipo === 'bloqueio')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 text-apoio">
        <span className="text-tinta-apoio">Competência:</span>
        {competenciasNaJanela(atual).map((x) => (
          <Button key={x} size="sm" variant={x === comp ? 'default' : 'outline'} onClick={() => setComp(x)}>{competenciaNaTela(x)}</Button>
        ))}
        <Input className="h-8 w-28" placeholder="MM/AAAA" value={outra} onChange={(e) => setOutra(e.target.value)} aria-label="Outra competência" />
        <Button size="sm" variant="ghost" disabled={!lida || lida > atual} onClick={() => { setComp(lida!); setOutra('') }}>Abrir</Button>
      </div>
      {conf.isLoading ? <Spinner /> : conf.error ? <MensagemErro texto={(conf.error as Error).message} /> : c && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Competência {competenciaNaTela(comp)}</CardTitle>
            <CardDescription>
              Entram as APAC autorizadas com execução registrada nesta competência. APAC com falta de cadastro fica fora até corrigir.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-apoio">
            {bloqueios.map((g) => <span key={g.codigo} className="text-critico">Impede o fechamento: {g.texto}</span>)}
            <span>{c.linhas.length} APAC com execução · {prontas} prontas · {c.linhas.length - prontas} com crítica</span>
            {c.linhas.filter((l) => l.criticas.length > 0).map((l) => (
              <div key={l.execucao_id} className="flex flex-col rounded-md border border-fio px-2.5 py-1.5">
                <span className="text-tinta">{l.paciente} · APAC {l.numero}</span>
                {l.criticas.map((k) => <span key={k.codigo} className="text-xs text-critico">{k.texto}</span>)}
              </div>
            ))}
            {c.fechamento && (
              <span className="text-tinta-apoio">
                {fechada ? 'Fechada' : 'Reaberta'} · {c.fechamento.apacs} APAC · controle {c.fechamento.controle} · por {c.fechamento.fechado_por ?? '—'} em {fmtDataHora(c.fechamento.fechado_em)}
                {c.fechamento.reaberto_em && <> · reaberta em {fmtDataHora(c.fechamento.reaberto_em)}: “{c.fechamento.motivo_reabertura}”</>}
              </span>
            )}
            {fechada ? (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={download.isPending} onClick={() => download.mutate(c.fechamento!.id)}><Download className="size-4" /> Baixar arquivo</Button>
                {!reabrindo ? <Button size="sm" variant="outline" onClick={() => setReabrindo(true)}>Reabrir competência</Button> : <>
                  <Input className="h-8 flex-1" placeholder="Motivo da reabertura (mínimo de 10 letras)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                  <Button size="sm" variant="destructive" disabled={motivo.trim().length < 10 || reabrir.isPending} onClick={() => reabrir.mutate(c.fechamento!.id)}>Reabrir</Button>
                  <Button size="sm" variant="ghost" onClick={() => setReabrindo(false)}>Voltar</Button>
                </>}
              </div>
            ) : (
              <Button size="sm" className="self-start" disabled={bloqueios.length > 0 || prontas === 0 || fechar.isPending} onClick={() => fechar.mutate()}>
                Fechar {competenciaNaTela(comp)} e gerar o arquivo ({prontas} APAC)
              </Button>
            )}
            {[fechar.error, reabrir.error, download.error].filter(Boolean).map((e, i) => <MensagemErro key={i} texto={(e as Error).message} />)}
          </CardContent>
        </Card>
      )}
      {(hist.data ?? []).length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-apoio font-medium text-tinta">Histórico</span>
          {(hist.data ?? []).map((f) => (
            <div key={f.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-fio px-3 py-2 text-apoio">
              <span className="font-medium text-tinta">{competenciaNaTela(f.competencia)}</span>
              <Badge variant={f.situacao === 'fechada' ? 'success' : 'secondary'}>{f.situacao}</Badge>
              <span className="text-xs text-tinta-sussurro">
                {f.apacs} APAC · controle {f.controle} · {f.excluidas} fora por crítica · fechada por {f.fechado_por ?? '—'} em {fmtDataHora(f.fechado_em)}
                {f.reaberto_em && <> · reaberta: “{f.motivo_reabertura}”</>}
              </span>
              <Button size="xs" variant="outline" className="ml-auto" disabled={download.isPending} onClick={() => download.mutate(f.id)}>
                <Download className="size-3.5" /> Arquivo
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
