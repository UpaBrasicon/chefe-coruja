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

import { Chip, Chips, TituloPagina, TituloSecao, Vazio } from '@/components/monitor/Pagina'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CampoSelecao } from '@/components/ui/campo-selecao'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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
const VARIANTE: Record<EtapaGlosa, 'destructive' | 'warning' | 'success' | 'secondary'> = {
  aberta: 'destructive', em_recurso: 'warning', recuperada: 'success', perdida: 'secondary',
}

export default function Glosas() {
  const { unidadeAtiva } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  const [etapa, setEtapa] = React.useState<EtapaGlosa | null>(null)
  const [competencia, setCompetencia] = React.useState<string | null>(null)
  const qc = useQueryClient()

  const painel = useQuery({
    queryKey: ['glosas', unidadeId, etapa, competencia],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('glosas_da_unidade', {
        p_unidade: unidadeId!, p_status: etapa ?? undefined, p_competencia: competencia ?? undefined,
      })
      if (error) throw error
      return data as unknown as PainelGlosas
    },
  })
  const p = painel.data
  const recarregar = () => { void qc.invalidateQueries({ queryKey: ['glosas'] }); void qc.invalidateQueries({ queryKey: ['conta'] }) }

  return (
    <div className="flex w-full flex-col gap-4">
      <TituloPagina
        icone={FileX}
        titulo="Glosas"
        descricao="Produção recusada pelo SIA/SIH ou pelo gestor municipal, registrada a partir do relatório de rejeição. O faturamento acompanha o recurso; só o gestor marca como perdida."
      />
      <MensagemErro texto={painel.error ? (painel.error as Error).message : null} />
      {painel.isLoading || !p ? <Spinner /> : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {([['Glosado', p.totais.glosado], ['Em andamento', p.totais.em_andamento], ['Recuperado', p.totais.recuperado], ['Perdido', p.totais.perdido]] as const).map(([r, v]) => (
              <div key={r} className="rounded-container border border-fio bg-superficie px-3 py-2">
                <span className="block text-rotulo text-tinta-sussurro">{r}{competencia ? ` · ${competenciaNaTela(competencia)}` : ''}</span>
                <span className="text-dialogo font-semibold text-tinta">{reais(v)}</span>
              </div>
            ))}
          </div>

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
                    {MOTIVO_GLOSA[m.motivo]}: {m.quantidade} glosa(s), {reais(m.glosado)} glosado, {reais(m.recuperado)} recuperado
                  </li>
                ))}
              </ul>
            </section>
          )}

          <Chips rotulo="Etapa da glosa">
            <Chip ativo={etapa === null} onClick={() => setEtapa(null)}>todas</Chip>
            {(['aberta', 'em_recurso', 'recuperada', 'perdida'] as const).map((e) => (
              <Chip key={e} ativo={etapa === e} onClick={() => setEtapa(e)}>{ETAPA_GLOSA[e]}</Chip>
            ))}
          </Chips>
          {p.glosas.length === 0 ? (
            <Vazio icone={FileX} titulo="Nenhuma glosa neste filtro" texto="A glosa é registrada na conta fechada, a partir do relatório de rejeição." />
          ) : (
            <ul className="flex flex-col gap-2">
              {p.glosas.map((g) => (
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
      </span>
      <span className="text-rotulo text-tinta-apoio">
        {mostrarConta ? `Conta ${g.conta_numero}${g.paciente ? ` · ${g.paciente}` : ''} · ` : ''}
        competência {competenciaNaTela(g.competencia)} · {MOTIVO_GLOSA[g.motivo_codigo]}{g.motivo_texto ? `: “${g.motivo_texto}”` : ''}
        {g.competencia_recurso ? ` · recurso em ${competenciaNaTela(g.competencia_recurso)}` : ''}
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
              {e.por ? ` · ${e.por}` : ''}{e.motivo ? ` · “${e.motivo}”` : ''}
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
