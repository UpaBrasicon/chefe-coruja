// ─────────────────────────────────────────────────────────────────────────────
// Faturamento — glosas (Fase 5B, tarefa 6; decisões do RT de 17/10/2026 no
// BACKLOG).
//
// O faturamento registra à mão a glosa que veio no relatório de rejeição do
// SIA/SIH ou do gestor municipal, de um item da conta fechada ou da conta
// inteira. Valor de referência do SIGTAP, que pode ser mudado; motivo de uma
// lista. Acompanhamento: aberta → em recurso (com a competência da
// reapresentação) → recuperada ou perdida; só o gestor marca como perdida.
// Painel com o total por competência e por motivo. Migration
// 20261204000001_conta_glosas.sql.
// ─────────────────────────────────────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileX } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'

import { TituloPagina, TituloSecao, Vazio } from '@/components/monitor/Pagina'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CampoSelecao } from '@/components/ui/campo-selecao'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useUnidade } from '@/contexts/UnidadeContext'
import { competenciaNaTela, lerCompetencia } from '@/lib/aih'
import { reais } from '@/lib/contas'
import { fmtDataHora } from '@/lib/datas'
import {
  acoesDaGlosa, ETAPA_GLOSA, EVENTO_GLOSA, lerValor, MOTIVO_GLOSA,
  type AcaoGlosa, type EtapaGlosa, type Glosa, type Glosavel, type MotivoGlosa, type PainelGlosas,
} from '@/lib/glosas'
import { supabase } from '@/lib/supabase'
import { MensagemErro } from '@/components/ui/mensagem-erro'

const MINIMO_MOTIVO = 10
const diasDesde = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000))
const VARIANTE: Record<EtapaGlosa, 'destructive' | 'warning' | 'success' | 'secondary'> = {
  aberta: 'destructive', em_recurso: 'warning', recuperada: 'success', perdida: 'secondary',
}

// Revisão de perfis (Gestor, item 19, M1): os quatro cartões viram abas com os
// mesmos nomes; "Em andamento" junta aberta e em recurso, abertas primeiro.
type AbaGlosa = 'glosado' | 'andamento' | 'recuperado' | 'perdido'
const NA_ABA: Record<AbaGlosa, EtapaGlosa[] | null> = {
  glosado: null, andamento: ['aberta', 'em_recurso'], recuperado: ['recuperada'], perdido: ['perdida'],
}
const ORDEM_ETAPA: EtapaGlosa[] = ['aberta', 'em_recurso', 'recuperada', 'perdida']

export default function Glosas() {
  const { unidadeAtiva } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  const [aba, setAba] = React.useState<AbaGlosa | null>(null)
  const [competencia, setCompetencia] = React.useState<string | null>(null)
  const qc = useQueryClient()

  const painel = useQuery({
    queryKey: ['glosas', unidadeId, competencia],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('glosas_da_unidade', {
        p_unidade: unidadeId!, p_competencia: competencia ?? undefined,
      })
      if (error) throw error
      return data as unknown as PainelGlosas
    },
  })
  const p = painel.data
  const recarregar = () => { void qc.invalidateQueries({ queryKey: ['glosas'] }); void qc.invalidateQueries({ queryKey: ['conta'] }) }
  // abre em "Em andamento" quando há glosa pedindo recurso
  const abaAtiva: AbaGlosa = aba ?? (p && p.totais.em_andamento > 0 ? 'andamento' : 'glosado')
  const etapas = NA_ABA[abaAtiva]
  const glosas = (p?.glosas ?? [])
    .filter((g) => !etapas || etapas.includes(g.status))
    .map((g, i) => ({ g, i })).sort((a, b) => ORDEM_ETAPA.indexOf(a.g.status) - ORDEM_ETAPA.indexOf(b.g.status) || a.i - b.i).map((x) => x.g)
  const taxa = p && p.totais.glosado > 0 ? Math.round((p.totais.recuperado / p.totais.glosado) * 100) : null
  // CT2 (revisão do perfil Faturamento, RT 24/11/2026): sem glosa nenhuma, só o vazio, sem as abas em R$ 0,00
  const semNenhuma = !!p && competencia === null && p.totais.quantidade === 0

  return (
    <div className="flex w-full flex-col gap-4">
      <TituloPagina
        icone={FileX}
        titulo="Glosas"
        descricao="Produção recusada pelo SIA/SIH ou pelo gestor municipal, registrada a partir do relatório de rejeição. O faturamento acompanha o recurso; só o gestor marca como perdida."
      />
      <MensagemErro texto={painel.error ? (painel.error as Error).message : null} />
      {painel.isLoading || !p ? <Spinner /> : semNenhuma ? (
        <Vazio icone={FileX} titulo="Nenhuma glosa registrada"
          texto={<>Quando chegar o relatório de rejeição do SIA/SIH ou do gestor municipal, abra a conta fechada em{' '}
            <Link to="/faturamento/contas" className="text-acao underline-offset-2 hover:underline">Contas do atendimento</Link> e use Registrar glosa.</>} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-apoio text-tinta-apoio">
            <span>{competencia ? `Competência ${competenciaNaTela(competencia)}` : 'Todas as competências'}</span>
            {competencia && <Button size="xs" variant="ghost" onClick={() => setCompetencia(null)}>Ver todas</Button>}
            {taxa !== null && <span>Taxa de recuperação: <b className="text-tinta tabular-nums">{taxa}%</b> do glosado ({reais(p.totais.recuperado)} de {reais(p.totais.glosado)})</span>}
          </div>
          <Tabs value={abaAtiva} onValueChange={(v) => setAba(v as AbaGlosa)}>
            <TabsList aria-label="Glosas por etapa" className="gap-5">
              {([['glosado', 'Glosado', p.totais.glosado], ['andamento', 'Em andamento', p.totais.em_andamento], ['recuperado', 'Recuperado', p.totais.recuperado], ['perdido', 'Perdido', p.totais.perdido]] as const).map(([k, r, v]) => (
                <TabsTrigger key={k} value={k}>{r} <span className={`text-rotulo font-semibold tabular-nums ${k === 'andamento' && v > 0 ? 'text-atencao' : 'text-acao'}`}>{reais(v)}</span></TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {p.por_competencia.length > 0 && (
            <section className="flex flex-col gap-2">
              <TituloSecao className="mb-0" extra="clique para filtrar">Por competência da produção</TituloSecao>
              <div className="overflow-x-auto rounded-container border border-fio bg-superficie">
                <Table variante="referencia" className="w-full min-w-[560px] text-apoio">
                  <TableHeader className="border-b border-fio text-left text-rotulo text-tinta-sussurro">
                    <TableRow><TableHead className="px-3 py-2 font-medium">Competência</TableHead><TableHead className="px-3 py-2 font-medium">Glosas</TableHead>
                      <TableHead className="px-3 py-2 text-right font-medium">Glosado</TableHead><TableHead className="px-3 py-2 text-right font-medium">Em andamento</TableHead>
                      <TableHead className="px-3 py-2 text-right font-medium">Recuperado</TableHead><TableHead className="px-3 py-2 text-right font-medium">Perdido</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {p.por_competencia.map((k) => (
                      <TableRow key={k.competencia} className={`cursor-pointer border-b border-trilha last:border-0 hover:bg-trilha/60${competencia === k.competencia ? ' bg-trilha' : ''}`}
                        onClick={() => setCompetencia(competencia === k.competencia ? null : k.competencia)}>
                        <TableCell className="px-3 py-2 font-medium text-tinta">{competenciaNaTela(k.competencia)}</TableCell>
                        <TableCell className="px-3 py-2">{k.quantidade}</TableCell>
                        <TableCell className="px-3 py-2 text-right">{reais(k.glosado)}</TableCell>
                        <TableCell className="px-3 py-2 text-right">{reais(k.em_andamento)}</TableCell>
                        <TableCell className="px-3 py-2 text-right">{reais(k.recuperado)}</TableCell>
                        <TableCell className="px-3 py-2 text-right">{reais(k.perdido)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
          )}

          {p.por_motivo.length > 0 && (
            <section className="flex flex-col gap-1">
              <TituloSecao className="mb-0">Por motivo{competencia ? ` · ${competenciaNaTela(competencia)}` : ''}</TituloSecao>
              <ul className="flex flex-col gap-0.5">
                {p.por_motivo.map((m) => (
                  <li key={m.motivo} className="text-tinta-apoio">
                    {MOTIVO_GLOSA[m.motivo]}: {m.quantidade} {m.quantidade === 1 ? 'glosa' : 'glosas'}, {reais(m.glosado)} glosado, {reais(m.recuperado)} recuperado
                  </li>
                ))}
              </ul>
            </section>
          )}

          {glosas.length === 0 ? (
            <Vazio icone={FileX} titulo={p.totais.quantidade === 0 ? 'Nenhuma glosa nesta competência' : 'Nenhuma glosa nesta aba'}
              texto={p.totais.quantidade === 0 ? 'Escolha outra competência ou veja todas.' : 'As glosas das outras etapas estão nas outras abas.'} />
          ) : (
            <ul className="flex flex-col gap-2">
              {glosas.map((g) => (
                <li key={g.id}><CartaoGlosa g={g} mostrarConta quem={{ pode_conduzir: p.pode_conduzir, pode_perder: p.pode_perder }} aoMudar={recarregar} /></li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

/** Uma glosa, com o histórico e as ações da etapa (usada aqui e no detalhe da conta). */
export function CartaoGlosa({ g, quem, aoMudar, mostrarConta = false }: {
  g: Glosa; quem: { pode_conduzir: boolean; pode_perder: boolean }; aoMudar: () => void; mostrarConta?: boolean
}) {
  const [acao, setAcao] = React.useState<AcaoGlosa | null>(null)
  const [motivo, setMotivo] = React.useState('')
  const [comp, setComp] = React.useState('')
  const [valor, setValor] = React.useState('')
  const [historico, setHistorico] = React.useState(false)
  const mudar = useMutation({
    mutationFn: async (a: AcaoGlosa) => {
      const { error } = await supabase.rpc('mudar_glosa', {
        p_glosa: g.id, p_para: a.para, p_motivo: motivo.trim(),
        p_competencia: a.pedeCompetencia ? lerCompetencia(comp) ?? comp : undefined,
        p_valor_recuperado: a.pedeValor && valor.trim() ? lerValor(valor) ?? undefined : undefined,
      })
      if (error) throw error
    },
    onSuccess: () => { setAcao(null); setMotivo(''); setComp(''); setValor(''); aoMudar() },
  })
  const acoes = acoesDaGlosa(g, quem)
  const valorInvalido = !!acao?.pedeValor && valor.trim() !== '' && lerValor(valor) === null
  return (
    <div className="flex flex-col gap-1 rounded-controle border border-fio bg-superficie px-3 py-2 text-apoio">
      <span className="flex flex-wrap items-center gap-1.5">
        <Badge variant={VARIANTE[g.status]}>{ETAPA_GLOSA[g.status]}</Badge>
        <span className="font-medium text-tinta">{g.item_rotulo}</span>
        <span className="text-tinta-apoio">· {reais(g.valor)}</span>
        {g.status === 'recuperada' && <span className="text-conforme">· recuperado {reais(g.valor_recuperado)}</span>}
        {/* M3: o prazo em destaque: há quanto tempo está aberta e em que competência vai o recurso */}
        {g.status === 'aberta' && (
          <span className="ml-auto rounded-capsula bg-alerta-critico px-2 text-rotulo font-medium text-critico">
            aberta há {diasDesde(g.registrada_em)} {diasDesde(g.registrada_em) === 1 ? 'dia' : 'dias'}: sem recurso
          </span>
        )}
        {g.status === 'em_recurso' && g.competencia_recurso && (
          <span className="ml-auto rounded-capsula bg-alerta-atencao px-2 text-rotulo font-medium text-atencao">recurso na competência {competenciaNaTela(g.competencia_recurso)}</span>
        )}
      </span>
      <span className="text-rotulo text-tinta-apoio">
        {mostrarConta ? `Conta ${g.conta_numero}${g.paciente ? ` · ${g.paciente}` : ''} · ` : ''}
        competência {competenciaNaTela(g.competencia)} · {MOTIVO_GLOSA[g.motivo_codigo]}{g.motivo_texto ? `: "${g.motivo_texto}"` : ''}
        {g.competencia_recurso && g.status !== 'em_recurso' ? ` · recurso em ${competenciaNaTela(g.competencia_recurso)}` : ''}
      </span>
      <Button type="button" variant="link" size="xs" className="min-h-0 self-start px-0 underline" onClick={() => setHistorico(!historico)}>
        {historico ? 'Esconder histórico' : `Histórico (${g.eventos.length})`}
      </Button>
      {historico && (
        <ol className="flex flex-col gap-0.5 text-rotulo text-tinta-apoio">
          {g.eventos.map((e, i) => (
            <li key={i}>
              {fmtDataHora(e.em)} · {EVENTO_GLOSA[e.evento] ?? e.evento}
              {e.competencia ? ` · ${competenciaNaTela(e.competencia)}` : ''}{e.valor != null ? ` · ${reais(e.valor)}` : ''}
              {e.por ? ` · ${e.por}` : ''}{e.motivo ? ` · "${e.motivo}"` : ''}
            </li>
          ))}
        </ol>
      )}
      {acoes.length > 0 && !acao && (
        <div className="flex flex-wrap gap-2">
          {acoes.map((a) => (
            <Button key={a.para} size="xs" variant={a.para === 'perdida' ? 'ghost' : 'outline'} onClick={() => { setAcao(a); setMotivo('') }}>{a.rotulo}</Button>
          ))}
        </div>
      )}
      {acao && (
        <div className="flex flex-col gap-1.5 rounded-controle border border-fio p-2">
          {acao.pedeCompetencia && (
            <div className="flex flex-col gap-1">
              <Label htmlFor={`glosa-comp-${g.id}`}>Competência da reapresentação ou do recurso (MM/AAAA)</Label>
              <Input id={`glosa-comp-${g.id}`} className="h-8 w-32" value={comp} onChange={(e) => setComp(e.target.value)} />
            </div>
          )}
          {acao.pedeValor && (
            <div className="flex flex-col gap-1">
              <Label htmlFor={`glosa-valor-${g.id}`}>Valor recuperado (vazio = tudo, {reais(g.valor)})</Label>
              <Input id={`glosa-valor-${g.id}`} className="h-8 w-32" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} />
            </div>
          )}
          <Label htmlFor={`glosa-motivo-${g.id}`}>{acao.rotulo}: motivo</Label>
          <Textarea id={`glosa-motivo-${g.id}`} rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          {mudar.error && <p role="alert" className="text-critico">{(mudar.error as Error).message}</p>}
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setAcao(null)}>Voltar</Button>
            <Button size="sm" disabled={motivo.trim().length < MINIMO_MOTIVO || (acao.pedeCompetencia && !lerCompetencia(comp)) || valorInvalido || mudar.isPending}
              onClick={() => mudar.mutate(acao)}>{acao.rotulo}</Button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Registro da glosa no detalhe da conta fechada ou faturada (1a a 4a). */
export function RegistrarGlosa({ contaId, glosaveis, aoMudar }: { contaId: string; glosaveis: Glosavel[]; aoMudar: () => void }) {
  const [aberto, setAberto] = React.useState(false)
  const [alvo, setAlvo] = React.useState('0')
  const [motivoCodigo, setMotivoCodigo] = React.useState<MotivoGlosa | ''>('')
  const [texto, setTexto] = React.useState('')
  // valor e competência vêm do item escolhido e podem ser mudados (3a)
  const valorDe = (x?: Glosavel) => (x ? x.valor.toFixed(2).replace('.', ',') : '')
  const [valor, setValor] = React.useState(() => valorDe(glosaveis[0]))
  const [comp, setComp] = React.useState(() => (glosaveis[0] ? competenciaNaTela(glosaveis[0].competencia) : ''))
  const item = glosaveis[Number(alvo)]
  const escolher = (i: string) => {
    setAlvo(i)
    setValor(valorDe(glosaveis[Number(i)]))
    setComp(glosaveis[Number(i)] ? competenciaNaTela(glosaveis[Number(i)].competencia) : '')
  }
  const registrar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('registrar_glosa', {
        p_conta: contaId, p_origem: item.origem ?? undefined, p_item: item.id ?? undefined, p_motivo_codigo: motivoCodigo as MotivoGlosa,
        p_motivo_texto: texto.trim() || undefined, p_valor: lerValor(valor) ?? undefined, p_competencia: lerCompetencia(comp) ?? undefined,
      })
      if (error) throw error
    },
    onSuccess: () => { setAberto(false); setMotivoCodigo(''); setTexto(''); aoMudar() },
  })
  if (!aberto) return <Button size="sm" variant="outline" className="self-start" onClick={() => setAberto(true)}>Registrar glosa</Button>
  const pronto = !!item && !!motivoCodigo && lerValor(valor) !== null && !!lerCompetencia(comp)
    && (motivoCodigo !== 'outro' || texto.trim().length >= MINIMO_MOTIVO)
  return (
    <div className="flex flex-col gap-2 rounded-controle border border-fio p-3">
      <span className="text-rotulo text-tinta-sussurro">A partir do relatório de rejeição do SIA/SIH ou do gestor municipal.</span>
      <div className="flex flex-col gap-1">
        <Label htmlFor="glosa-alvo">O que foi glosado</Label>
        <CampoSelecao id="glosa-alvo" value={alvo} onChange={(e) => escolher(e.target.value)}>
          {glosaveis.map((x, i) => <option key={`${x.origem}-${x.id}-${i}`} value={String(i)}>{x.rotulo}</option>)}
        </CampoSelecao>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="glosa-motivo-codigo">Motivo</Label>
          <CampoSelecao id="glosa-motivo-codigo" value={motivoCodigo} onChange={(e) => setMotivoCodigo(e.target.value as MotivoGlosa | '')}>
            <option value="">Escolha…</option>
            {(Object.keys(MOTIVO_GLOSA) as MotivoGlosa[]).map((m) => <option key={m} value={m}>{MOTIVO_GLOSA[m]}</option>)}
          </CampoSelecao>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="glosa-valor">Valor glosado (R$)</Label>
          <Input id="glosa-valor" className="h-9 w-28" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="glosa-comp">Competência (MM/AAAA)</Label>
          <Input id="glosa-comp" className="h-9 w-28" value={comp} onChange={(e) => setComp(e.target.value)} />
        </div>
      </div>
      {item && <span className="text-rotulo text-tinta-sussurro">Valor de referência do SIGTAP: {reais(item.valor)}.</span>}
      <Textarea aria-label="Descrição da glosa" rows={2} placeholder={motivoCodigo === 'outro' ? 'Descreva a glosa (mínimo de 10 letras)' : 'Detalhe do relatório (opcional)'}
        value={texto} onChange={(e) => setTexto(e.target.value)} />
      {registrar.error && <p role="alert" className="text-critico">{(registrar.error as Error).message}</p>}
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={() => setAberto(false)}>Cancelar</Button>
        <Button size="sm" disabled={!pronto || registrar.isPending} onClick={() => registrar.mutate()}>Registrar</Button>
      </div>
    </div>
  )
}
