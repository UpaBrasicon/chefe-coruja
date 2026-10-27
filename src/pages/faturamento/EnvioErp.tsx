import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeftRight, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import * as React from 'react'

import { Chip, Chips, TituloSecao, Vazio } from '@/components/monitor/Pagina'
import { TabsPagina } from '@/components/TabsPagina'
import { Aviso } from '@/components/ui/aviso'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Gaveta, GavetaCabeca, GavetaPe } from '@/components/ui/gaveta'
import { Label } from '@/components/ui/label'
import { MensagemErro } from '@/components/ui/mensagem-erro'
import { Spinner } from '@/components/ui/spinner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { useUnidade } from '@/contexts/UnidadeContext'
import {
  baixarArquivo, competenciaDaVersao, competenciaRotulo, contarSituacoes, csvContas, csvPlantoes, FILTROS_SITUACAO, horas,
  nomeArquivoErp, plantoesSemPresenca, porProfissional, ROTULO_FILTRO, ROTULO_SITUACAO, situacaoErp, VARIANTE_SITUACAO,
  type Formato, type PreviaPlantoes, type SituacaoErp, type VersaoConta, type VersaoPlantoes,
} from '@/lib/erp'
import { dataHora, dataIso, diaMesHora, mesAno, moeda } from '@/lib/formato'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

// Fase 5C, tarefa 3, etapa 3.4 — Envio ao ERP (opção A do RT, 27/10/2026:
// lista com filtro e gaveta). O ERP busca as versões pela API e responde o
// lançamento; aqui o faturamento e o gestor conferem o retorno e baixam o
// mesmo conteúdo. Os plantões do mês (com CPF) são só do gestor: prévia,
// fechar e reabrir com motivo.

const MINIMO_MOTIVO = 10
const caixa = 'overflow-x-auto rounded-container border border-fio bg-superficie'
const th = 'px-3 py-2 font-medium'
const td = 'px-3 py-2.5'

function Situacao({ s }: { s: SituacaoErp }) {
  return <Badge variant={VARIANTE_SITUACAO[s]}>{ROTULO_SITUACAO[s]}</Badge>
}

function BotoesBaixar({ onBaixar, desabilitado, titulo, pendente }: {
  onBaixar: (f: Formato) => void; desabilitado?: boolean; titulo?: string; pendente?: boolean
}) {
  return (
    <div className="flex gap-2">
      {(['csv', 'json'] as const).map((f) => (
        <Button key={f} size="sm" variant="outline" disabled={desabilitado || pendente} title={titulo} onClick={() => onBaixar(f)}>
          <Download className="size-4" aria-hidden />{f.toUpperCase()}
        </Button>
      ))}
    </div>
  )
}

// ── Contas ──────────────────────────────────────────────────────────────────
function AbaContas({ unidadeId, unidadeNome }: { unidadeId: string; unidadeNome: string }) {
  const [filtro, setFiltro] = React.useState<SituacaoErp | null>(null)
  const [aberta, setAberta] = React.useState<VersaoConta | null>(null)
  const lista = useQuery({
    queryKey: ['erp-contas', unidadeId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('erp_contas_da_unidade', { p_unidade: unidadeId })
      if (error) throw error
      return data as unknown as VersaoConta[]
    },
  })
  const baixar = useMutation({
    mutationFn: async (f: Formato) => {
      const { data, error } = await supabase.rpc('erp_baixar', { p_unidade: unidadeId, p_conjunto: 'contas', p_formato: f })
      if (error) throw error
      const vs = data as unknown as VersaoConta[]
      const conteudo = f === 'csv' ? csvContas(vs, unidadeNome, dataHora(Date.now())) : JSON.stringify(vs, null, 2)
      baixarArquivo(nomeArquivoErp('contas', f, dataIso()), conteudo, f)
    },
  })

  const versoes = lista.data ?? []
  const n = contarSituacoes(versoes)
  const linhas = filtro ? versoes.filter((v) => situacaoErp(v) === filtro) : versoes
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Chips rotulo="Situação no ERP">
          {FILTROS_SITUACAO.map((s) => (
            <Chip key={s} ativo={filtro === s} onClick={() => setFiltro(s)} contagem={n[s] ?? 0} tom={s === 'divergente' ? 'critico' : 'acao'}>
              {ROTULO_FILTRO[s]}
            </Chip>
          ))}
          <Chip ativo={filtro === null} onClick={() => setFiltro(null)} contagem={versoes.length}>todas</Chip>
        </Chips>
        <BotoesBaixar onBaixar={(f) => baixar.mutate(f)} pendente={baixar.isPending} desabilitado={versoes.length === 0}
          titulo={versoes.length === 0 ? 'Nenhuma versão para baixar' : 'Baixa o mesmo conteúdo que o ERP recebe (fica na auditoria)'} />
      </div>
      <MensagemErro texto={((lista.error ?? baixar.error) as Error | null)?.message ?? null} />
      {lista.isLoading ? <Spinner /> : linhas.length === 0 ? (
        <Vazio icone={ArrowLeftRight} titulo={filtro ? 'Nenhuma versão nesta situação' : 'Nenhuma conta foi para o ERP ainda'}
          texto="A versão para o ERP nasce quando o faturamento marca a conta como faturada." />
      ) : (
        <div className={caixa}>
          <Table variante="referencia" className="w-full min-w-[820px] text-apoio">
            <TableHeader className="border-b border-fio text-left text-rotulo text-tinta-sussurro">
              <TableRow>
                <TableHead className={th}>Conta</TableHead><TableHead className={th}>Competência</TableHead><TableHead className={th}>Versão</TableHead>
                <TableHead className={cn(th, 'text-right')}>Total</TableHead><TableHead className={cn(th, 'text-right')}>Lançado no ERP</TableHead>
                <TableHead className={th}>Situação</TableHead><TableHead className={th}>Última mudança</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((v) => {
                const s = situacaoErp(v)
                return (
                  <TableRow key={v.id} className="cursor-pointer border-b border-trilha last:border-0 hover:bg-trilha/60" onClick={() => setAberta(v)}>
                    <TableCell className={cn(td, 'font-medium text-tinta')}>
                      {v.numero}<span className="font-normal text-tinta-sussurro"> · {v.tipo === 'internacao' ? 'Internação' : 'Porta'}</span>
                    </TableCell>
                    <TableCell className={cn(td, 'tabular')}>{competenciaDaVersao(v)}</TableCell>
                    <TableCell className={td}>{v.versao}{v.situacao === 'substituida' && <span className="text-tinta-sussurro"> · substituída</span>}</TableCell>
                    <TableCell className={cn(td, 'tabular text-right')}>{moeda(v.total)}</TableCell>
                    <TableCell className={cn(td, 'tabular text-right', s === 'divergente' && 'font-semibold text-critico')}>
                      {v.retorno?.valor_lancado == null ? '—' : moeda(v.retorno.valor_lancado)}
                    </TableCell>
                    <TableCell className={td}><Situacao s={s} /></TableCell>
                    <TableCell className={cn(td, 'tabular text-tinta-apoio')}>{diaMesHora(v.alterada_em)}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
      <GavetaConta v={aberta} todas={versoes} onFechar={() => setAberta(null)} />
    </div>
  )
}

function AvisoDaVersao({ v }: { v: VersaoConta }) {
  const s = situacaoErp(v)
  const lancado = v.retorno?.valor_lancado ?? 0
  if (s === 'divergente') {
    return (
      <Aviso tom="critico" titulo={`Divergente na versão ${v.versao}`}>
        O ERP lançou {moeda(lancado)}{v.retorno?.erp_id ? ` (${v.retorno.erp_id})` : ''}; o total da versão é {moeda(v.total)}. Corrija no ERP: o novo retorno concilia.
      </Aviso>
    )
  }
  if (s === 'estornar') {
    return (
      <Aviso tom="atencao" titulo={`Estornar a versão ${v.versao} no ERP`}>
        A conta foi reaberta{v.substituida_em ? ` em ${diaMesHora(v.substituida_em)}` : ''} e esta versão não vale mais. O ERP lançou {moeda(lancado)}
        {v.retorno?.erp_id ? ` (${v.retorno.erp_id})` : ''}: o estorno lá fecha a versão.
      </Aviso>
    )
  }
  if (s === 'aguardando') return <Aviso tom="informacao" titulo="Aguardando o ERP">O ERP ainda não respondeu o lançamento desta versão.</Aviso>
  return null
}

function GavetaConta({ v, todas, onFechar }: { v: VersaoConta | null; todas: VersaoConta[]; onFechar: () => void }) {
  const versoes = v ? todas.filter((x) => x.conta_id === v.conta_id).sort((a, b) => b.versao - a.versao) : []
  return (
    <Gaveta aberta={!!v} onAbertaChange={(a) => !a && onFechar()} rotulo={v ? `Conta ${v.numero}` : 'Conta'}>
      {v && (
        <>
          <GavetaCabeca
            sobre={`${v.tipo === 'internacao' ? 'Conta da internação' : 'Conta da porta'} · ${competenciaDaVersao(v)}`}
            titulo={v.numero}
            detalhe={`Prontuário ${v.prontuario ?? '—'} · faturada em ${diaMesHora(v.faturada_em)}`}
          />
          <div className="flex flex-col gap-4 px-[22px] py-4 text-apoio">
            <AvisoDaVersao v={v} />
            <section>
              <TituloSecao>Versões</TituloSecao>
              <ol className="flex flex-col gap-2">
                {versoes.map((x) => (
                  <li key={x.id} className={cn('flex items-start justify-between gap-2', x.id !== v.id && 'text-tinta-apoio')}>
                    <span>
                      <b className="text-tinta">{x.versao}</b> · {x.situacao === 'vigente' ? 'vigente' : `substituída${x.substituida_em ? ' em ' + diaMesHora(x.substituida_em) : ''}`} · {moeda(x.total)}
                      {x.retorno?.erp_id && <span className="text-tinta-sussurro"> · {x.retorno.erp_id}</span>}
                    </span>
                    <Situacao s={situacaoErp(x)} />
                  </li>
                ))}
              </ol>
            </section>
            <section>
              <TituloSecao extra={`total ${moeda(v.total)}`}>Itens da versão {v.versao}</TituloSecao>
              <ul className="flex flex-col gap-1.5">
                {v.itens.map((i, k) => (
                  <li key={k} className={cn('flex justify-between gap-3', !i.faturavel && 'text-tinta-sussurro')}>
                    <span>{i.procedimento} {i.nome ?? ''} · {i.faturavel ? i.quantidade : 'fora do arquivo'}</span>
                    <span className="tabular">{i.valor_total == null ? '—' : moeda(i.valor_total)}</span>
                  </li>
                ))}
              </ul>
              {v.medicamentos.length > 0 && (
                <p className="mt-2 text-tinta-sussurro">
                  Medicamentos (sem valor): {v.medicamentos.map((m) => `${m.medicamento} · ${m.liquido}${m.unidade_consumo ? ' ' + m.unidade_consumo : ''}${m.fora_da_conta ? ' (fora da conta)' : ''}`).join('; ')}
                </p>
              )}
            </section>
            {v.glosas.length > 0 && (
              <section>
                <TituloSecao>Glosas</TituloSecao>
                <ul className="flex flex-col gap-1.5">
                  {v.glosas.map((g) => (
                    <li key={g.id} className="flex justify-between gap-3"><span>{g.item} · {g.situacao.replace('_', ' ')}</span><span className="tabular">{moeda(g.valor)}</span></li>
                  ))}
                </ul>
              </section>
            )}
          </div>
          <GavetaPe>O ERP busca esta versão pela API e responde por ela. Nada aqui muda a conta: para corrigir, o gestor reabre.</GavetaPe>
        </>
      )}
    </Gaveta>
  )
}

// ── Plantões do mês (gestor) ────────────────────────────────────────────────
const compDe = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`
function mesAnterior(c: string, delta: number) {
  const d = new Date(Number(c.slice(0, 4)), Number(c.slice(4, 6)) - 1 + delta, 15)
  return compDe(d)
}

function AbaPlantoes({ unidadeId, unidadeNome }: { unidadeId: string; unidadeNome: string }) {
  const qc = useQueryClient()
  const atual = compDe(new Date())
  const [comp, setComp] = React.useState(() => mesAnterior(atual, -1))
  const [acao, setAcao] = React.useState<'fechar' | 'reabrir' | null>(null)
  const [motivo, setMotivo] = React.useState('')
  const nomeMes = mesAno(Number(comp.slice(0, 4)), Number(comp.slice(4, 6)))
  const mesCurto = nomeMes.split(' de ')[0]

  const previa = useQuery({
    queryKey: ['erp-plantoes', unidadeId, comp],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('plantoes_erp_previa', { p_unidade: unidadeId, p_competencia: comp })
      if (error) throw error
      return data as unknown as PreviaPlantoes
    },
  })
  const mudar = useMutation({
    mutationFn: async (a: 'fechar' | 'reabrir') => {
      const { error } = a === 'fechar'
        ? await supabase.rpc('fechar_plantoes_erp', { p_unidade: unidadeId, p_competencia: comp })
        : await supabase.rpc('reabrir_plantoes_erp', { p_unidade: unidadeId, p_competencia: comp, p_motivo: motivo.trim() })
      if (error) throw error
    },
    onSuccess: () => { setAcao(null); setMotivo(''); void qc.invalidateQueries({ queryKey: ['erp-plantoes', unidadeId, comp] }) },
  })
  const baixar = useMutation({
    mutationFn: async (f: Formato) => {
      const { data, error } = await supabase.rpc('erp_baixar', { p_unidade: unidadeId, p_conjunto: 'plantoes', p_formato: f, p_competencia: comp })
      if (error) throw error
      const vs = data as unknown as VersaoPlantoes[]
      const conteudo = f === 'csv' ? csvPlantoes(vs, unidadeNome, dataHora(Date.now())) : JSON.stringify(vs, null, 2)
      baixarArquivo(nomeArquivoErp('plantoes', f, dataIso(), comp), conteudo, f)
    },
  })

  const p = previa.data
  const vigente = p?.versoes.find((v) => v.situacao === 'vigente')
  const resumo = p ? porProfissional(p.plantoes) : []
  const total = resumo.reduce((t, r) => ({
    plantoes: t.plantoes + r.plantoes, realizados: t.realizados + r.realizados, faltas: t.faltas + r.faltas,
    semPresenca: t.semPresenca + r.semPresenca, semCheckout: t.semCheckout + r.semCheckout, minutos: t.minutos + r.minutos,
  }), { plantoes: 0, realizados: 0, faltas: 0, semPresenca: 0, semCheckout: 0, minutos: 0 })
  const atencao = (r: { faltas: number; semPresenca: number; semCheckout: number }) => {
    const partes: React.ReactNode[] = []
    if (r.faltas) partes.push(`${r.faltas} falta${r.faltas > 1 ? 's' : ''} justificada${r.faltas > 1 ? 's' : ''}`)
    if (r.semPresenca) partes.push(<span key="p" className="font-medium text-atencao">{r.semPresenca} sem presença</span>)
    if (r.semCheckout) partes.push(`${r.semCheckout} sem saída`)
    return partes.length ? partes.reduce<React.ReactNode[]>((a, x, i) => (i ? [...a, ' · ', x] : [x]), []) : <span className="text-tinta-sussurro">—</span>
  }

  const situacao = !p ? null : p.fechado && vigente
    ? <Situacao s={situacaoErp({ situacao: 'vigente', conciliacao: vigente.conciliacao, retorno: vigente.valor_lancado == null ? null : { erp_id: null, recebida_em: '', valor_lancado: vigente.valor_lancado, em: '' } })} />
    : <Badge variant="secondary">{p.mes_encerrado ? 'Aberto' : 'Em andamento'}</Badge>

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button size="icon-sm" variant="ghost" aria-label="Mês anterior" onClick={() => { setComp(mesAnterior(comp, -1)); setAcao(null) }}>
            <ChevronLeft className="size-4" aria-hidden />
          </Button>
          <span className="min-w-40 text-center text-corpo font-semibold text-tinta">{nomeMes}</span>
          <Button size="icon-sm" variant="ghost" aria-label="Mês seguinte" disabled={comp >= atual} onClick={() => { setComp(mesAnterior(comp, 1)); setAcao(null) }}>
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        </div>
        {p && !acao && (
          <div className="flex flex-wrap items-center gap-2">
            {situacao}
            <BotoesBaixar onBaixar={(f) => baixar.mutate(f)} pendente={baixar.isPending} desabilitado={!p.versoes.length}
              titulo={p.versoes.length ? 'Baixa o mesmo conteúdo que o ERP recebe (fica na auditoria)' : 'O arquivo sai depois de fechar o mês'} />
            {p.fechado
              ? <Button size="sm" variant="outline" onClick={() => setAcao('reabrir')}>Reabrir {mesCurto}</Button>
              : <Button size="sm" disabled={!p.mes_encerrado || !p.totais.plantoes} title={!p.mes_encerrado ? 'O mês só fecha depois de acabar' : undefined}
                  onClick={() => setAcao('fechar')}>Fechar {mesCurto}</Button>}
          </div>
        )}
      </div>
      <MensagemErro texto={((previa.error ?? mudar.error ?? baixar.error) as Error | null)?.message ?? null} />
      {acao === 'fechar' && p && (
        <Aviso tom="informacao" titulo={`Fechar ${nomeMes} para o ERP?`}
          acao={<div className="flex gap-2"><Button size="sm" variant="ghost" onClick={() => setAcao(null)}>Voltar</Button>
            <Button size="sm" disabled={mudar.isPending} onClick={() => mudar.mutate('fechar')}>Fechar {mesCurto}</Button></div>}>
          {p.totais.realizados} plantões realizados, {moeda(p.total)}. Gera a versão {p.versoes.length + 1} para o ERP; depois, só reabrindo com motivo.
          {p.totais.sem_presenca > 0 && ` ${plantoesSemPresenca(p.totais.sem_presenca)} com valor zero.`}
        </Aviso>
      )}
      {acao === 'reabrir' && (
        <div className="flex flex-col gap-1.5 rounded-controle border border-fio bg-superficie p-3">
          <Label htmlFor="erp-motivo">Reabrir {nomeMes}: motivo</Label>
          <Textarea id="erp-motivo" rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <p className="text-rotulo text-tinta-sussurro">A versão {vigente?.versao} fica substituída; o ERP deve estorná-la. Fechar de novo gera a próxima.</p>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setAcao(null)}>Voltar</Button>
            <Button size="sm" disabled={motivo.trim().length < MINIMO_MOTIVO || mudar.isPending} onClick={() => mudar.mutate('reabrir')}>Reabrir {mesCurto}</Button>
          </div>
        </div>
      )}
      {previa.isLoading ? <Spinner /> : !p ? null : resumo.length === 0 ? (
        <Vazio icone={ArrowLeftRight} titulo="Nenhum plantão na escala deste mês" texto="Os plantões vêm da escala da unidade, com a presença de cada um." />
      ) : (
        <div className={caixa}>
          <Table variante="referencia" className="w-full min-w-[820px] text-apoio">
            <TableHeader className="border-b border-fio text-left text-rotulo text-tinta-sussurro">
              <TableRow>
                <TableHead className={th}>Profissional</TableHead><TableHead className={cn(th, 'text-right')}>Plantões</TableHead>
                <TableHead className={cn(th, 'text-right')}>Realizados</TableHead><TableHead className={th}>Atenção</TableHead>
                <TableHead className={cn(th, 'text-right')}>Horas</TableHead><TableHead className={cn(th, 'text-right')}>Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resumo.map((r) => (
                <TableRow key={r.id} className="border-b border-trilha last:border-0">
                  <TableCell className={td}><span className="font-medium text-tinta">{r.nome}</span>{r.conselho && <span className="text-tinta-sussurro"> · {r.conselho}</span>}</TableCell>
                  <TableCell className={cn(td, 'tabular text-right')}>{r.plantoes}</TableCell>
                  <TableCell className={cn(td, 'tabular text-right')}>{r.realizados}</TableCell>
                  <TableCell className={cn(td, 'text-tinta-apoio')}>{atencao(r)}</TableCell>
                  <TableCell className={cn(td, 'tabular text-right')}>{horas(r.minutos)}</TableCell>
                  <TableCell className={cn(td, 'tabular text-right font-medium text-tinta')}>
                    {moeda(r.valor)}{r.semValor > 0 && <span className="block text-rotulo font-normal text-atencao">{r.semValor} sem valor na tabela</span>}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-campo">
                <TableCell className={cn(td, 'font-semibold text-tinta')}>Total do mês</TableCell>
                <TableCell className={cn(td, 'tabular text-right')}>{total.plantoes}</TableCell>
                <TableCell className={cn(td, 'tabular text-right')}>{total.realizados}</TableCell>
                <TableCell className={cn(td, 'text-tinta-apoio')}>{atencao(total)}</TableCell>
                <TableCell className={cn(td, 'tabular text-right')}>{horas(total.minutos)}</TableCell>
                <TableCell className={cn(td, 'tabular text-right font-semibold text-tinta')}>{moeda(p.total)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
      {p && p.versoes.length > 0 && (
        <ul className="flex flex-col gap-1 text-apoio text-tinta-apoio">
          {[...p.versoes].reverse().map((v) => (
            <li key={v.versao}>
              Versão {v.versao}: fechada em {diaMesHora(v.gerada_em)}{v.gerada_por ? ` por ${v.gerada_por}` : ''} · {moeda(v.total)}
              {v.situacao === 'substituida'
                ? ` · reaberta${v.substituida_em ? ' em ' + diaMesHora(v.substituida_em) : ''}${v.substituida_por ? ' por ' + v.substituida_por : ''}: ${v.motivo_reabertura ?? ''}`
                : ''}
            </li>
          ))}
        </ul>
      )}
      <p className="text-rotulo text-tinta-sussurro">
        Valor da tabela de remuneração da unidade (Configuração); parte de plantão fracionado vale a proporção das horas. Competência {competenciaRotulo(comp)}.
      </p>
    </div>
  )
}

export default function EnvioErp() {
  const { unidadeAtiva, ehGestor, ehSuperAdmin } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  const unidadeNome = unidadeAtiva?.unidade?.nome ?? ''
  if (!unidadeId) return null
  return (
    <TabsPagina
      titulo="Envio ao ERP"
      descricao="O ERP busca as contas faturadas e os plantões do mês pela API e responde o lançamento. Aqui você confere o retorno e baixa o mesmo conteúdo."
      icone={ArrowLeftRight}
      abas={[
        { valor: 'contas', rotulo: 'Contas', conteudo: () => <AbaContas unidadeId={unidadeId} unidadeNome={unidadeNome} /> },
        ...(ehGestor || ehSuperAdmin
          ? [{ valor: 'plantoes', rotulo: 'Plantões do mês', conteudo: () => <AbaPlantoes unidadeId={unidadeId} unidadeNome={unidadeNome} /> }]
          : []),
      ]}
    />
  )
}
