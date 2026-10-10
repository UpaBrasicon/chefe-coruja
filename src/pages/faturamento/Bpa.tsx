// ─────────────────────────────────────────────────────────────────────────────
// Faturamento — BPA individualizado (Fase 3, tarefa 3; decisões do RT de
// 09/10/2026 no BACKLOG).
//
// Abas da tela:
// • Competência: conferência (linhas prontas, com crítica e com aviso),
//   fechamento que congela o arquivo do BPA Magnético 05.00, reabertura com
//   motivo e download.
// • Lançar: procedimento em nome de quem fez, a partir dos atendimentos da
//   competência; também corrige o endereço do SUS do paciente.
// • Configuração: cabeçalho do arquivo, códigos SIGTAP de cada fonte
//   automática e lista curta registrável.
// • Histórico: fechamentos e reaberturas.
// Quem usa: o papel faturamento (sem escala) e o gestor.
// Migration 20261103000002_bpa_i.sql.
// ─────────────────────────────────────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, Receipt } from 'lucide-react'
import * as React from 'react'

import { TituloPagina, Vazio } from '@/components/monitor/Pagina'
import { EnderecoSus } from '@/components/paciente/EnderecoSus'
import { ProcedimentosRealizados } from '@/components/paciente/ProcedimentosRealizados'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { useUnidade } from '@/contexts/UnidadeContext'
import { competenciaDaData, competenciaNaTela, lerCompetencia } from '@/lib/aih'
import {
  codigoSigtapNaTela, competenciasNaJanela, CRITICA_BPA, ORIGEM_BPA, SUGESTAO_SIGTAP, USO_PROCEDIMENTO, foraDaJanela,
  type AtendimentoParaFaturar, type Conferencia, type ConfigBpa, type FechamentoBpa, type OrigemBpa,
  type ProfissionalParaFaturar, type UsoProcedimento,
} from '@/lib/bpa'
import { fmtDataHora } from '@/lib/datas'
import { supabase } from '@/lib/supabase'
import { Abas, Erro } from '@/pages/farmacia/Farmacia'

type Aba = 'competencia' | 'lancar' | 'configuracao' | 'historico'
const ABAS: readonly (readonly [Aba, string])[] = [
  ['competencia', 'Competência'], ['lancar', 'Lançar procedimento'], ['configuracao', 'Configuração'], ['historico', 'Histórico'],
]
const selectCls = 'h-9 rounded-controle border border-fio bg-campo px-2 text-apoio'
const MINIMO_REABERTURA = 10

function baixar(nome: string, conteudo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: 'text/plain' }))
  const a = document.createElement('a')
  a.href = url; a.download = nome
  document.body.appendChild(a); a.click(); a.remove()
  URL.revokeObjectURL(url)
}

async function baixarFechamento(id: string) {
  const { data, error } = await supabase.rpc('arquivo_bpa', { p_fechamento: id })
  if (error) throw error
  const a = data as unknown as { nome: string; conteudo: string }
  baixar(a.nome, a.conteudo)
}

export default function Bpa() {
  const { unidadeAtiva } = useUnidade()
  const unidade = unidadeAtiva?.unidade_id
  const atual = competenciaDaData(new Date().toISOString())!
  const [aba, setAba] = React.useState<Aba>('competencia')
  const [competencia, setCompetencia] = React.useState(() => competenciasNaJanela(atual)[1])

  return (
    <div className="flex w-full max-w-5xl flex-col">
      <TituloPagina icone={Receipt} titulo="Faturamento — BPA"
        descricao="BPA individualizado da unidade: confira a competência, corrija o que tem crítica, feche e baixe o arquivo para importar no BPA Magnético." />
      <Abas abas={ABAS} valor={aba} onChange={setAba} rotulo="Faturamento" />
      {!unidade ? <Spinner /> : (
        <>
          {(aba === 'competencia' || aba === 'lancar') && (
            <SeletorCompetencia atual={atual} valor={competencia} onChange={setCompetencia} />
          )}
          {aba === 'competencia' && <AbaCompetencia unidade={unidade} competencia={competencia} atual={atual} />}
          {aba === 'lancar' && <AbaLancar key={competencia} unidade={unidade} competencia={competencia} />}
          {aba === 'configuracao' && <AbaConfiguracao unidade={unidade} />}
          {aba === 'historico' && <AbaHistorico unidade={unidade} />}
        </>
      )}
    </div>
  )
}

function SeletorCompetencia({ atual, valor, onChange }: { atual: string; valor: string; onChange: (c: string) => void }) {
  const [outra, setOutra] = React.useState('')
  const lida = lerCompetencia(outra)
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 text-apoio">
      <span className="text-tinta-apoio">Competência:</span>
      {competenciasNaJanela(atual).map((c) => (
        <Button key={c} size="sm" variant={c === valor ? 'default' : 'outline'} onClick={() => onChange(c)}>
          {competenciaNaTela(c)}{c === atual ? ' (atual)' : ''}
        </Button>
      ))}
      <Input className="h-8 w-28" placeholder="MM/AAAA" value={outra} onChange={(e) => setOutra(e.target.value)} aria-label="Outra competência" />
      <Button size="sm" variant="ghost" disabled={!lida || lida > atual} onClick={() => { onChange(lida!); setOutra('') }}>Abrir</Button>
      {foraDaJanela(valor, atual) && <Badge variant="warning">fora da janela do SIA</Badge>}
    </div>
  )
}

// ── competência ─────────────────────────────────────────────────────────────
function AbaCompetencia({ unidade, competencia, atual }: { unidade: string; competencia: string; atual: string }) {
  const qc = useQueryClient()
  const conf = useQuery({
    queryKey: ['bpa-conferencia', unidade, competencia],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('bpa_conferencia', { p_unidade: unidade, p_competencia: competencia })
      if (error) throw error
      return data as unknown as Conferencia
    },
  })
  const [processamento, setProcessamento] = React.useState(competenciaNaTela(atual))
  const [motivo, setMotivo] = React.useState('')
  const [reabrindo, setReabrindo] = React.useState(false)
  const invalidar = () => {
    void qc.invalidateQueries({ queryKey: ['bpa-conferencia', unidade, competencia] })
    void qc.invalidateQueries({ queryKey: ['bpa-fechamentos', unidade] })
  }
  const fechar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('fechar_competencia_bpa', {
        p_unidade: unidade, p_competencia: competencia, p_processamento: lerCompetencia(processamento) ?? undefined,
      })
      if (error) throw error
    },
    onSuccess: invalidar,
  })
  const reabrir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('reabrir_competencia_bpa', { p_fechamento: id, p_motivo: motivo.trim() })
      if (error) throw error
    },
    onSuccess: () => { setReabrindo(false); setMotivo(''); invalidar() },
  })
  const download = useMutation({ mutationFn: baixarFechamento })

  if (conf.isLoading) return <Spinner />
  if (conf.error) return <Erro texto={(conf.error as Error).message} />
  const c = conf.data!
  const bloqueios = c.globais.filter((g) => g.tipo === 'bloqueio')
  const avisos = c.globais.filter((g) => g.tipo === 'aviso')
  const fechada = c.fechamento?.situacao === 'fechada'

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-2 sm:grid-cols-4">
        <Numero rotulo="Linhas na competência" valor={c.total} />
        <Numero rotulo="Prontas para o arquivo" valor={c.prontas} />
        <Numero rotulo="Com crítica (ficam fora)" valor={c.com_critica} tom={c.com_critica > 0 ? 'critico' : undefined} />
        <Numero rotulo="Com aviso (vão com campo vazio)" valor={c.com_aviso} tom={c.com_aviso > 0 ? 'atencao' : undefined} />
      </div>
      <div className="flex flex-wrap gap-2 text-xs text-tinta-apoio">
        {(Object.keys(ORIGEM_BPA) as OrigemBpa[]).map((o) => (
          <span key={o} className="rounded-capsula border border-fio px-2.5 py-1">{ORIGEM_BPA[o]}: {c.por_origem[o] ?? 0}</span>
        ))}
      </div>
      {(bloqueios.length > 0 || avisos.length > 0) && (
        <ul className="flex flex-col gap-1 text-apoio">
          {bloqueios.map((g) => <li key={g.codigo} className="text-critico">Impede o fechamento: {g.texto}</li>)}
          {avisos.map((g) => <li key={g.codigo} className="text-atencao">Aviso: {g.texto}</li>)}
        </ul>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fechamento</CardTitle>
          <CardDescription>Fechar congela o arquivo e trava novos registros desta competência. Reabrir pede motivo e fica no histórico.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-apoio">
          {c.fechamento && (
            <p className="text-tinta-apoio">
              {fechada ? 'Fechada' : 'Reaberta'} · {c.fechamento.linhas} linhas em {c.fechamento.folhas} folhas · controle {c.fechamento.controle}
              {' '}· processamento {competenciaNaTela(c.fechamento.processamento)} · por {c.fechamento.fechado_por ?? '—'} em {fmtDataHora(c.fechamento.fechado_em)}
              {c.fechamento.reaberto_em && <> · reaberta por {c.fechamento.reaberto_por ?? '—'} em {fmtDataHora(c.fechamento.reaberto_em)}: “{c.fechamento.motivo_reabertura}”</>}
            </p>
          )}
          {fechada ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={() => download.mutate(c.fechamento!.id)} disabled={download.isPending}>
                <Download className="size-4" /> Baixar arquivo
              </Button>
              {!reabrindo ? (
                <Button size="sm" variant="outline" onClick={() => setReabrindo(true)}>Reabrir competência</Button>
              ) : (
                <>
                  <Input className="h-8 flex-1" placeholder="Motivo da reabertura (mínimo de 10 letras)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                  <Button size="sm" variant="destructive" disabled={motivo.trim().length < MINIMO_REABERTURA || reabrir.isPending}
                    onClick={() => reabrir.mutate(c.fechamento!.id)}>Reabrir</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setReabrindo(false); reabrir.reset() }}>Voltar</Button>
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor="bpa-proc" className="text-xs">Competência de processamento</Label>
                <Input id="bpa-proc" className="h-8 w-28" value={processamento} onChange={(e) => setProcessamento(e.target.value)} placeholder="MM/AAAA" />
              </div>
              <Button size="sm" disabled={bloqueios.length > 0 || c.prontas === 0 || !lerCompetencia(processamento) || fechar.isPending}
                onClick={() => fechar.mutate()}>
                Fechar {competenciaNaTela(competencia)} e gerar o arquivo ({c.prontas} linhas)
              </Button>
            </div>
          )}
          {[fechar.error, reabrir.error, download.error].filter(Boolean).map((e, i) => <Erro key={i} texto={(e as Error).message} />)}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Para corrigir</CardTitle>
          <CardDescription>Linha com crítica fica fora do arquivo; com aviso, vai com o campo vazio. Até 500 linhas, as com crítica primeiro.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-apoio">
          {Object.keys(c.por_critica).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(c.por_critica).map(([k, n]) => (
                <Badge key={k} variant="secondary">{CRITICA_BPA[k] ?? k}: {n}</Badge>
              ))}
            </div>
          )}
          {c.linhas.length === 0 ? (
            <p className="text-tinta-sussurro">Nada para corrigir nesta competência.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {c.linhas.map((l) => (
                <li key={`${l.origem}-${l.origem_id}`} className="flex flex-col gap-0.5 rounded-md border border-fio px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-tinta">{l.paciente}</span>
                    <span className="text-xs text-tinta-sussurro">
                      {ORIGEM_BPA[l.origem]} · {codigoSigtapNaTela(l.procedimento)}{l.quantidade > 1 ? ` × ${l.quantidade}` : ''} · {fmtDataHora(l.em)} · {l.profissional ?? '—'}
                    </span>
                  </div>
                  {l.criticas.map((k) => <span key={k.codigo} className="text-xs text-critico">{k.texto}</span>)}
                  {l.avisos.map((k) => <span key={k.codigo} className="text-xs text-atencao">{k.texto}</span>)}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Numero({ rotulo, valor, tom }: { rotulo: string; valor: number; tom?: 'critico' | 'atencao' }) {
  return (
    <div className="rounded-container border border-fio bg-superficie px-3 py-2.5">
      <p className="text-xs text-tinta-sussurro">{rotulo}</p>
      <p className={`text-xl font-semibold ${tom === 'critico' ? 'text-critico' : tom === 'atencao' ? 'text-atencao' : 'text-tinta'}`}>{valor}</p>
    </div>
  )
}

// ── lançar ──────────────────────────────────────────────────────────────────
function AbaLancar({ unidade, competencia }: { unidade: string; competencia: string }) {
  const [busca, setBusca] = React.useState('')
  const [escolhido, setEscolhido] = React.useState<AtendimentoParaFaturar | null>(null)
  const [profissional, setProfissional] = React.useState('')
  const atendimentos = useQuery({
    queryKey: ['atendimentos-para-faturar', unidade, competencia, busca.trim()],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('atendimentos_para_faturar', { p_unidade: unidade, p_competencia: competencia, p_busca: busca.trim() || undefined })
      if (error) throw error
      return (data ?? []) as unknown as AtendimentoParaFaturar[]
    },
  })
  const profissionais = useQuery({
    queryKey: ['profissionais-para-faturar', unidade],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('profissionais_para_faturar', { p_unidade: unidade })
      if (error) throw error
      return (data ?? []) as unknown as ProfissionalParaFaturar[]
    },
  })
  const prof = (profissionais.data ?? []).find((p) => p.id === profissional)

  if (escolhido) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => setEscolhido(null)}>← Atendimentos</Button>
          <span className="font-medium text-tinta">{escolhido.paciente}</span>
          <span className="text-xs text-tinta-sussurro">chegada {fmtDataHora(escolhido.chegada_em)} · médico {escolhido.medico ?? '—'}</span>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lançar em nome de quem fez</CardTitle>
            <CardDescription>O CNS e o CBO da linha são os de quem fez; você fica registrado como quem lançou.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="bpa-prof" className="text-xs">Quem fez</Label>
              <select id="bpa-prof" className={selectCls} value={profissional} onChange={(e) => setProfissional(e.target.value)}>
                <option value="">Escolha…</option>
                {(profissionais.data ?? []).map((p) => (
                  <option key={p.id} value={p.id}>{p.nome}{p.cbo ? ` · CBO ${p.cbo}` : ' · sem CBO'}{p.cns_ok ? '' : ' · sem CNS'}</option>
                ))}
              </select>
              {prof && (!prof.cns_ok || !prof.cbo) && (
                <span className="text-xs text-atencao">Sem {[!prof.cns_ok && 'CNS', !prof.cbo && 'CBO'].filter(Boolean).join(' e ')} no perfil: a linha terá crítica até o profissional completar.</span>
              )}
            </div>
            <ProcedimentosRealizados key={escolhido.episodio_id} pacienteId={escolhido.paciente_id} unidadeId={unidade} episodioId={escolhido.episodio_id}
              profissionalId={profissional || null} realizadoEmPadrao={escolhido.chegada_em} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <EnderecoSus pacienteId={escolhido.paciente_id} />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <Input placeholder="Buscar paciente pelo nome" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar paciente" />
      {atendimentos.isLoading ? <Spinner /> : atendimentos.error ? <Erro texto={(atendimentos.error as Error).message} /> : (atendimentos.data ?? []).length === 0 ? (
        <Vazio icone={Receipt} titulo="Nenhum atendimento" texto={`Nenhuma chegada em ${competenciaNaTela(competencia)}${busca.trim() ? ' com esse nome' : ''}.`} />
      ) : (
        <ul className="flex flex-col gap-1.5">
          {(atendimentos.data ?? []).map((a) => (
            <li key={a.episodio_id}>
              <button type="button" onClick={() => setEscolhido(a)}
                className="flex w-full flex-wrap items-center gap-2 rounded-md border border-fio px-3 py-2 text-left text-apoio hover:border-acao">
                <span className="font-medium text-tinta">{a.paciente}</span>
                <span className="text-xs text-tinta-sussurro">{fmtDataHora(a.chegada_em)} · médico {a.medico ?? '—'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── configuração ────────────────────────────────────────────────────────────
function AbaConfiguracao({ unidade }: { unidade: string }) {
  const cfg = useQuery({
    queryKey: ['bpa-config', unidade],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('bpa_config', { p_unidade: unidade })
      if (error) throw error
      return data as unknown as ConfigBpa
    },
  })
  if (cfg.isLoading) return <Spinner />
  if (cfg.error) return <Erro texto={(cfg.error as Error).message} />
  const c = cfg.data!
  return (
    <div className="flex flex-col gap-4">
      <Cabecalho unidade={unidade} c={c} />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Códigos SIGTAP das fontes automáticas</CardTitle>
          <CardDescription>
            Cada atendimento médico, primeira classificação de risco e medicação checada vira linha com o código escolhido aqui.
            Tabela SIGTAP carregada: {competenciaNaTela(c.sigtap_competencia)}.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {(['atendimento_medico', 'classificacao', 'medicacao'] as UsoProcedimento[]).map((u) => (
            <FonteCodigo key={u} unidade={unidade} uso={u} atual={c.procedimentos.find((p) => p.uso === u) ?? null} />
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lista de procedimentos registráveis</CardTitle>
          <CardDescription>O que a enfermagem e os médicos registram na hora, e o que o faturamento lança. Mantenha a lista curta.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {c.procedimentos.filter((p) => p.uso === 'lista').map((p) => <ItemLista key={p.id} unidade={unidade} id={p.id} codigo={p.procedimento} nome={p.nome} />)}
          <BuscaSigtap rotulo="Acrescentar à lista" onEscolher={async (codigo) => {
            const { error } = await supabase.rpc('associar_procedimento_bpa', { p_unidade: unidade, p_procedimento: codigo, p_uso: 'lista' })
            if (error) throw error
          }} invalidar={['bpa-config', unidade]} />
        </CardContent>
      </Card>
    </div>
  )
}

function Cabecalho({ unidade, c }: { unidade: string; c: ConfigBpa }) {
  const qc = useQueryClient()
  const [f, setF] = React.useState({
    orgao_origem: c.orgao_origem ?? '', sigla: c.sigla ?? '', cnpj: c.cnpj ?? '', orgao_destino: c.orgao_destino ?? '',
    destino: c.destino ?? '', carater_atendimento: c.carater_atendimento ?? '', ine: c.ine ?? '',
  })
  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('definir_bpa_config', { p_unidade: unidade, p_dados: f })
      if (error) throw error
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['bpa-config', unidade] }),
  })
  const campo = (k: keyof typeof f, rotulo: string, max: number, dica?: string) => (
    <div className="flex flex-col gap-1">
      <Label htmlFor={`bpa-${k}`} className="text-xs">{rotulo}</Label>
      <Input id={`bpa-${k}`} className="h-8" maxLength={max} placeholder={dica} value={f[k]} onChange={(e) => setF((v) => ({ ...v, [k]: e.target.value }))} />
    </div>
  )
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Cabeçalho do arquivo</CardTitle>
        <CardDescription>
          CNES da unidade: {c.cnes ?? 'não preenchido'} (o gestor preenche em Unidade › Configurações).
          {c.atualizado_em && <> Alterado por {c.atualizado_por ?? '—'} em {fmtDataHora(c.atualizado_em)}.</>}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid gap-2 sm:grid-cols-2">
          {campo('orgao_origem', 'Órgão de origem (responsável)', 30)}
          {campo('sigla', 'Sigla do órgão de origem', 6)}
          {campo('cnpj', 'CNPJ (ou CPF) do prestador', 18)}
          {campo('orgao_destino', 'Órgão de saúde de destino', 40, 'ex.: Secretaria Municipal de Saúde')}
          <div className="flex flex-col gap-1">
            <Label htmlFor="bpa-destino" className="text-xs">Destino</Label>
            <select id="bpa-destino" className={selectCls} value={f.destino} onChange={(e) => setF((v) => ({ ...v, destino: e.target.value }))}>
              <option value="">Escolha…</option>
              <option value="M">Municipal</option>
              <option value="E">Estadual</option>
            </select>
          </div>
          {campo('carater_atendimento', 'Caráter do atendimento (código)', 2, 'tabela do SIA')}
          {campo('ine', 'INE da equipe (se houver)', 10)}
        </div>
        <p className="text-xs text-tinta-sussurro">
          Caráter do atendimento e INE: confira o código com a Secretaria. Sem eles, o campo sai em branco e a conferência avisa.
        </p>
        <div className="flex gap-2">
          <Button size="sm" disabled={salvar.isPending} onClick={() => salvar.mutate()}>Salvar cabeçalho</Button>
          {salvar.isSuccess && <span className="text-xs text-tinta-sussurro">Salvo.</span>}
        </div>
        {salvar.error && <Erro texto={(salvar.error as Error).message} />}
      </CardContent>
    </Card>
  )
}

function FonteCodigo({ unidade, uso, atual }: { unidade: string; uso: UsoProcedimento; atual: ConfigBpa['procedimentos'][number] | null }) {
  const qc = useQueryClient()
  const sugestao = SUGESTAO_SIGTAP[uso]
  const associar = useMutation({
    mutationFn: async (codigo: string) => {
      const { error } = await supabase.rpc('associar_procedimento_bpa', { p_unidade: unidade, p_procedimento: codigo, p_uso: uso })
      if (error) throw error
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['bpa-config', unidade] }),
  })
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-fio px-3 py-2 text-apoio">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-tinta">{USO_PROCEDIMENTO[uso]}</span>
        {atual ? (
          <span className="text-tinta-apoio">
            {codigoSigtapNaTela(atual.procedimento)} · {atual.nome ?? 'fora do SIGTAP carregado'}
            <span className="text-xs text-tinta-sussurro"> · por {atual.definido_por ?? '—'}, {fmtDataHora(atual.definido_em)}</span>
          </span>
        ) : <Badge variant="warning">sem código: estas linhas ficam fora</Badge>}
      </div>
      {!atual && sugestao && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-tinta-sussurro">Na pesquisa do SIGTAP (09/2026), o código desta fonte é {codigoSigtapNaTela(sugestao)}.</span>
          <Button size="xs" variant="outline" disabled={associar.isPending} onClick={() => associar.mutate(sugestao)}>Usar {codigoSigtapNaTela(sugestao)}</Button>
        </div>
      )}
      <BuscaSigtap rotulo={atual ? 'Trocar o código' : 'Escolher outro código'} onEscolher={(codigo) => associar.mutateAsync(codigo)} invalidar={['bpa-config', unidade]} />
      {associar.error && <span role="alert" className="text-xs text-critico">{(associar.error as Error).message}</span>}
    </div>
  )
}

function ItemLista({ unidade, id, codigo, nome }: { unidade: string; id: string; codigo: string; nome: string | null }) {
  const qc = useQueryClient()
  const retirar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('retirar_procedimento_bpa', { p_id: id })
      if (error) throw error
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['bpa-config', unidade] }),
  })
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-fio px-3 py-1.5 text-apoio">
      <span className="text-tinta">{codigoSigtapNaTela(codigo)} · {nome ?? 'fora do SIGTAP carregado'}</span>
      <Button size="xs" variant="ghost" className="ml-auto" disabled={retirar.isPending} onClick={() => retirar.mutate()}>Retirar</Button>
      {retirar.error && <span role="alert" className="basis-full text-xs text-critico">{(retirar.error as Error).message}</span>}
    </div>
  )
}

function BuscaSigtap({ rotulo, onEscolher, invalidar }: { rotulo: string; onEscolher: (codigo: string) => Promise<unknown>; invalidar: unknown[] }) {
  const qc = useQueryClient()
  const [termo, setTermo] = React.useState('')
  const [erro, setErro] = React.useState<string | null>(null)
  const busca = useQuery({
    queryKey: ['buscar-sigtap', termo.trim()],
    enabled: termo.trim().length >= 3,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('buscar_sigtap', { p_termo: termo.trim() })
      if (error) throw error
      return (data ?? []) as unknown as { codigo: string; nome: string }[]
    },
  })
  async function escolher(codigo: string) {
    try { await onEscolher(codigo); setErro(null); setTermo(''); void qc.invalidateQueries({ queryKey: invalidar }) }
    catch (e) { setErro((e as Error).message) }
  }
  return (
    <div className="flex flex-col gap-1">
      <Input className="h-8" placeholder={`${rotulo}: código ou nome no SIGTAP`} value={termo} onChange={(e) => setTermo(e.target.value)} aria-label={rotulo} />
      {(busca.data ?? []).length > 0 && (
        <div className="flex max-h-48 flex-col overflow-y-auto rounded-md border border-fio">
          {(busca.data ?? []).map((p) => (
            <Button key={p.codigo} type="button" variant="ghost" size="sm" className="justify-start" onClick={() => void escolher(p.codigo)}>
              {codigoSigtapNaTela(p.codigo)} · {p.nome}
            </Button>
          ))}
        </div>
      )}
      {termo.trim().length >= 3 && busca.data && busca.data.length === 0 && <span className="text-xs text-tinta-sussurro">Nada no SIGTAP carregado.</span>}
      {erro && <span role="alert" className="text-xs text-critico">{erro}</span>}
    </div>
  )
}

// ── histórico ───────────────────────────────────────────────────────────────
function AbaHistorico({ unidade }: { unidade: string }) {
  const lista = useQuery({
    queryKey: ['bpa-fechamentos', unidade],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('bpa_fechamentos_da_unidade', { p_unidade: unidade })
      if (error) throw error
      return (data ?? []) as unknown as FechamentoBpa[]
    },
  })
  const download = useMutation({ mutationFn: baixarFechamento })
  if (lista.isLoading) return <Spinner />
  if (lista.error) return <Erro texto={(lista.error as Error).message} />
  if ((lista.data ?? []).length === 0) return <Vazio icone={Receipt} titulo="Nenhum fechamento" texto="Quando o faturamento fechar uma competência, ela aparece aqui." />
  return (
    <div className="flex flex-col gap-2">
      {download.error && <Erro texto={(download.error as Error).message} />}
      {(lista.data ?? []).map((f) => (
        <div key={f.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-fio px-3 py-2 text-apoio">
          <span className="font-medium text-tinta">{competenciaNaTela(f.competencia)}</span>
          <Badge variant={f.situacao === 'fechada' ? 'success' : 'secondary'}>{f.situacao}</Badge>
          <span className="text-xs text-tinta-sussurro">
            {f.linhas} linhas · {f.folhas} folhas · controle {f.controle} · {f.excluidas} fora por crítica · processamento {competenciaNaTela(f.processamento)}
            {' '}· fechada por {f.fechado_por ?? '—'} em {fmtDataHora(f.fechado_em)}
            {f.reaberto_em && <> · reaberta por {f.reaberto_por ?? '—'} em {fmtDataHora(f.reaberto_em)}: “{f.motivo_reabertura}”</>}
          </span>
          <Button size="xs" variant="outline" className="ml-auto" disabled={download.isPending} onClick={() => download.mutate(f.id)}>
            <Download className="size-3.5" /> Arquivo
          </Button>
        </div>
      ))}
    </div>
  )
}
