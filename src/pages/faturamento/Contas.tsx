// ─────────────────────────────────────────────────────────────────────────────
// Faturamento — contas do atendimento (Fase 5B, tarefa 1; decisões do RT de
// 16/10/2026 no BACKLOG).
//
// A conta abre sozinha: uma da porta (ambulatorial, vai no BPA) para cada
// atendimento e uma de internação (vai na AIH) quando o paciente é internado,
// ligada à da porta. Etapas: aberta → em conferência → fechada → faturada. O
// faturamento conduz e fecha; reabrir é do gestor, com motivo. O pagador vem da
// categoria do paciente e pode ser trocado com motivo. Itens e valores entram
// nas tarefas 2 e 3. Migration 20261127000001_conta_atendimento.sql.
// ─────────────────────────────────────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link2, Wallet } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'

import { Chip, Chips, TituloPagina, TituloSecao, Vazio } from '@/components/monitor/Pagina'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CampoSelecao } from '@/components/ui/campo-selecao'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { useUnidade } from '@/contexts/UnidadeContext'
import {
  acoesDaConta, ETAPA, EVENTO, GRUPO_PENDENCIA, ondeCorrigir, ORIGEM_ITEM, PAGADOR, reais, TIPO,
  SITUACAO_DOCUMENTO, TIPO_APAC, type GrupoPendencia,
  type AcaoConta, type AihConta, type ApacConta, type Conta, type ContaDetalhe, type EtapaConta, type ItemConta, type MedicamentoConta,
  type Pagador, type TipoConta,
} from '@/lib/contas'
import { competenciaNaTela } from '@/lib/aih'
import { rotuloUnidade } from '@/lib/unidadeConsumo'
import { codigoSigtapNaTela, type ProfissionalParaFaturar } from '@/lib/bpa'
import { fmtData, fmtDataHora } from '@/lib/datas'
import { supabase } from '@/lib/supabase'
import { MensagemErro } from '@/components/ui/mensagem-erro'
import { CartaoGlosa, RegistrarGlosa } from '@/pages/faturamento/Glosas'

const MINIMO_MOTIVO = 10
const VARIANTE: Record<EtapaConta, 'info' | 'warning' | 'secondary' | 'outline'> = {
  aberta: 'info', em_conferencia: 'warning', fechada: 'secondary', faturada: 'outline',
}

export default function Contas() {
  const { unidadeAtiva } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  const [etapa, setEtapa] = React.useState<EtapaConta | null>('aberta')
  const [tipo, setTipo] = React.useState<TipoConta | null>(null)
  const [aberta, setAberta] = React.useState<string | null>(null)

  const lista = useQuery({
    queryKey: ['contas', unidadeId, etapa, tipo],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('contas_da_unidade', { p_unidade: unidadeId!, p_status: etapa ?? undefined, p_tipo: tipo ?? undefined })
      if (error) throw error
      return data as unknown as { contas: Conta[]; totais: Record<EtapaConta, number> }
    },
  })
  const totais = lista.data?.totais
  // Fase 5B, tarefa 5 (4a): filtro pelo resumo de pendências que vem com a lista
  const [filtroPend, setFiltroPend] = React.useState<'todas' | 'com' | 'bloqueante'>('todas')
  const contas = (lista.data?.contas ?? []).filter((c) =>
    filtroPend === 'todas' ? true
      : filtroPend === 'bloqueante' ? (c.pendencias?.bloqueantes ?? 0) > 0
        : (c.pendencias?.bloqueantes ?? 0) + (c.pendencias?.avisos ?? 0) > 0)

  return (
    <div className="flex w-full flex-col gap-4">
      <TituloPagina
        icone={Wallet}
        titulo="Contas do atendimento"
        descricao="Cada atendimento na porta abre uma conta (BPA); a internação abre outra (AIH), ligada à da porta. O faturamento confere e fecha; o gestor reabre com motivo."
      />
      <Chips rotulo="Etapa da conta">
        {(['aberta', 'em_conferencia', 'fechada', 'faturada'] as const).map((e) => (
          <Chip key={e} ativo={etapa === e} onClick={() => setEtapa(e)} contagem={totais?.[e]}>{ETAPA[e]}</Chip>
        ))}
        <Chip ativo={etapa === null} onClick={() => setEtapa(null)}>todas</Chip>
      </Chips>
      <Chips rotulo="Tipo de conta">
        <Chip ativo={tipo === null} onClick={() => setTipo(null)}>porta e internação</Chip>
        {(['ambulatorial', 'internacao'] as const).map((t) => <Chip key={t} ativo={tipo === t} onClick={() => setTipo(t)}>{TIPO[t]}</Chip>)}
      </Chips>
      <Chips rotulo="Pendências">
        <Chip ativo={filtroPend === 'todas'} onClick={() => setFiltroPend('todas')}>todas</Chip>
        <Chip ativo={filtroPend === 'com'} onClick={() => setFiltroPend('com')}>com pendência</Chip>
        <Chip ativo={filtroPend === 'bloqueante'} onClick={() => setFiltroPend('bloqueante')}>com bloqueante</Chip>
      </Chips>
      <MensagemErro texto={lista.error ? (lista.error as Error).message : null} />
      {lista.isLoading ? <Spinner /> : contas.length === 0 ? (
        <Vazio icone={Wallet} titulo={filtroPend === 'todas' ? 'Nenhuma conta nesta etapa' : 'Nenhuma conta com pendência neste filtro'}
          texto="As contas abrem sozinhas com o atendimento na porta e com a internação." />
      ) : (
        <div className="overflow-x-auto rounded-container border border-fio bg-superficie">
          <Table variante="referencia" className="w-full min-w-[720px] text-apoio">
            <TableHeader className="border-b border-fio text-left text-rotulo text-tinta-sussurro">
              <TableRow>
                <TableHead className="px-3 py-2 font-medium">Conta</TableHead><TableHead className="px-3 py-2 font-medium">Paciente</TableHead>
                <TableHead className="px-3 py-2 font-medium">Tipo</TableHead><TableHead className="px-3 py-2 font-medium">Atendimento</TableHead>
                <TableHead className="px-3 py-2 font-medium">Pagador</TableHead><TableHead className="px-3 py-2 font-medium">Etapa</TableHead>
                <TableHead className="px-3 py-2 font-medium">Pendências</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contas.map((c) => (
                <TableRow key={c.id} className="cursor-pointer border-b border-trilha last:border-0 hover:bg-trilha/60" onClick={() => setAberta(c.id)}>
                  <TableCell className="whitespace-nowrap px-3 py-2 font-medium text-tinta">
                    {c.numero}
                    {(c.origem || c.derivadas.length > 0) && <Link2 className="ml-1 inline size-3.5 text-tinta-sussurro" aria-label="conta ligada" />}
                  </TableCell>
                  <TableCell className="px-3 py-2">{c.paciente.nome}<span className="text-tinta-sussurro"> · {c.paciente.prontuario ?? '—'}</span></TableCell>
                  <TableCell className="px-3 py-2">{TIPO[c.tipo]}</TableCell>
                  <TableCell className="px-3 py-2 text-tinta-apoio">
                    {c.atendimento?.inicio ? fmtDataHora(c.atendimento.inicio) : '—'}
                    {c.atendimento_terminou ? (c.atendimento?.fim ? ` até ${fmtDataHora(c.atendimento.fim)}` : '') : ' · em andamento'}
                  </TableCell>
                  <TableCell className="px-3 py-2">{PAGADOR[c.pagador]}</TableCell>
                  <TableCell className="px-3 py-2"><Badge variant={VARIANTE[c.status]}>{ETAPA[c.status]}</Badge></TableCell>
                  <TableCell className="whitespace-nowrap px-3 py-2">
                    {(c.pendencias?.bloqueantes ?? 0) > 0 && <Badge variant="destructive">{c.pendencias!.bloqueantes} bloqueante(s)</Badge>}
                    {(c.pendencias?.avisos ?? 0) > 0 && <span className="ml-1 text-rotulo text-atencao">{c.pendencias!.avisos} aviso(s)</span>}
                    {!(c.pendencias?.bloqueantes || c.pendencias?.avisos) && <span className="text-tinta-sussurro">—</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {aberta && <DetalheConta id={aberta} onTrocar={setAberta} onFechar={() => setAberta(null)} />}
    </div>
  )
}

function DetalheConta({ id, onTrocar, onFechar }: { id: string; onTrocar: (id: string) => void; onFechar: () => void }) {
  const qc = useQueryClient()
  const [acao, setAcao] = React.useState<AcaoConta | null>(null)
  const [motivo, setMotivo] = React.useState('')
  const [pagador, setPagador] = React.useState<Pagador | ''>('')

  const detalhe = useQuery({
    queryKey: ['conta', id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('conta_detalhe', { p_conta: id })
      if (error) throw error
      return data as unknown as ContaDetalhe
    },
  })
  const recarregar = () => { void qc.invalidateQueries({ queryKey: ['contas'] }); void qc.invalidateQueries({ queryKey: ['conta', id] }) }
  const mudar = useMutation({
    mutationFn: async (a: AcaoConta) => {
      const { error } = await supabase.rpc('mudar_etapa_conta', { p_conta: id, p_para: a.para, p_motivo: a.pedeMotivo ? motivo.trim() : undefined })
      if (error) throw error
    },
    onSuccess: () => { setAcao(null); setMotivo(''); recarregar() },
  })
  const trocar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('trocar_pagador_conta', { p_conta: id, p_pagador: pagador as Pagador, p_motivo: motivo.trim() })
      if (error) throw error
    },
    onSuccess: () => { setPagador(''); setMotivo(''); recarregar() },
  })

  const c = detalhe.data
  const acoes = c ? acoesDaConta(c) : []
  const erro = (mudar.error ?? trocar.error ?? detalhe.error) as Error | null
  const podeTrocarPagador = !!c && c.pode_conduzir && (c.status === 'aberta' || c.status === 'em_conferencia')

  return (
    <Dialog open onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle className="text-dialogo">Conta {c?.numero ?? ''}</DialogTitle>
          <DialogDescription className="text-controle">
            {c ? `${c.paciente.nome} · ${TIPO[c.tipo]} · ${PAGADOR[c.pagador]}` : 'Carregando…'}
          </DialogDescription>
        </DialogHeader>
        {!c ? <Spinner /> : (
          <div className="flex flex-col gap-3 text-apoio">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={VARIANTE[c.status]}>{ETAPA[c.status]}</Badge>
              <span className="text-tinta-sussurro">
                {c.atendimento?.setor ?? ''}{c.atendimento?.inicio ? ` · desde ${fmtDataHora(c.atendimento.inicio)}` : ''}
                {c.atendimento_terminou ? (c.atendimento?.fim ? ` · terminou ${fmtDataHora(c.atendimento.fim)}` : ' · terminado') : ' · atendimento em andamento'}
              </span>
            </div>
            {(c.origem || c.derivadas.length > 0) && (
              <div className="flex flex-wrap items-center gap-2 rounded-controle border border-fio px-3 py-2">
                <Link2 className="size-4 text-tinta-sussurro" aria-hidden />
                {c.origem && (
                  <span>Veio da porta: <Button type="button" variant="link" className="min-h-0 p-0 align-baseline font-medium underline" onClick={() => onTrocar(c.origem!.id)}>{c.origem.numero}</Button> ({ETAPA[c.origem.status]})</span>
                )}
                {c.derivadas.map((d) => (
                  <span key={d.id}>Internação: <Button type="button" variant="link" className="min-h-0 p-0 align-baseline font-medium underline" onClick={() => onTrocar(d.id)}>{d.numero}</Button> ({ETAPA[d.status]})</span>
                ))}
              </div>
            )}
            <MensagemErro texto={erro?.message ?? null} />

            <PendenciasConta c={c} aoMudar={recarregar} />

            <ItensConta c={c} podeMexer={c.pode_conduzir && (c.status === 'aberta' || c.status === 'em_conferencia')} aoMudar={recarregar} />
            <DocumentosSusConta c={c} />
            <MedicamentosConta c={c} podeMexer={c.pode_conduzir && (c.status === 'aberta' || c.status === 'em_conferencia')} aoMudar={recarregar} />

            {acoes.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {acoes.map((a) => (
                  <Button key={a.para + a.rotulo} size="sm" variant={a.pedeMotivo ? 'outline' : 'default'}
                    disabled={!!a.bloqueio || mudar.isPending} title={a.bloqueio}
                    onClick={() => (a.pedeMotivo ? (setAcao(a), setMotivo('')) : mudar.mutate(a))}>
                    {a.rotulo}
                  </Button>
                ))}
              </div>
            )}
            {acoes.find((a) => a.bloqueio) && <p className="text-rotulo text-tinta-sussurro">{acoes.find((a) => a.bloqueio)!.bloqueio}{c.atendimento_terminou ? '' : ' A conta fecha depois.'}</p>}
            {acao && (
              <div className="flex flex-col gap-1.5 rounded-controle border border-fio p-3">
                <Label htmlFor="conta-motivo">{acao.rotulo}: motivo</Label>
                <Textarea id="conta-motivo" rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setAcao(null)}>Voltar</Button>
                  <Button size="sm" disabled={motivo.trim().length < MINIMO_MOTIVO || mudar.isPending} onClick={() => mudar.mutate(acao)}>{acao.rotulo}</Button>
                </div>
              </div>
            )}
            {podeTrocarPagador && (
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="conta-pagador">Trocar pagador</Label>
                  <CampoSelecao id="conta-pagador" value={pagador} onChange={(e) => { setPagador(e.target.value as Pagador | ''); setMotivo('') }}>
                    <option value="">—</option>
                    {(['sus', 'convenio', 'particular'] as const).filter((p) => p !== c.pagador).map((p) => <option key={p} value={p}>{PAGADOR[p]}</option>)}
                  </CampoSelecao>
                </div>
                {pagador && (
                  <>
                    <Textarea aria-label="Motivo da troca de pagador" rows={1} className="min-w-[220px] flex-1" placeholder="Motivo (mínimo de 10 letras)"
                      value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                    <Button size="sm" disabled={motivo.trim().length < MINIMO_MOTIVO || trocar.isPending} onClick={() => trocar.mutate()}>Trocar</Button>
                  </>
                )}
              </div>
            )}

            {(c.status === 'fechada' || c.status === 'faturada' || (c.glosas ?? []).length > 0) && (
              <section className="flex flex-col gap-2">
                <TituloSecao className="mb-0" extra="a conta não muda de etapa">Glosas</TituloSecao>
                {(c.glosas ?? []).length === 0 && <p className="text-tinta-sussurro">Nenhuma glosa registrada.</p>}
                {(c.glosas ?? []).map((g) => (
                  <CartaoGlosa key={g.id} g={g} quem={{ pode_conduzir: c.pode_conduzir, pode_perder: c.pode_reabrir }} aoMudar={recarregar} />
                ))}
                {c.pode_conduzir && (c.glosaveis ?? []).length > 0 && <RegistrarGlosa contaId={c.id} glosaveis={c.glosaveis} aoMudar={recarregar} />}
              </section>
            )}

            <TituloSecao className="mb-1 mt-2">Histórico</TituloSecao>
            <ol className="flex flex-col gap-1">
              {c.eventos.map((e, i) => (
                <li key={i} className="text-tinta-apoio">
                  {fmtDataHora(e.em)} · {EVENTO[e.evento] ?? e.evento}
                  {e.evento === 'pagador' && e.de && e.para ? ` (${PAGADOR[e.de as Pagador]} → ${PAGADOR[e.para as Pagador]})` : ''}
                  {e.por ? ` · ${e.por}` : ''}{e.motivo ? ` · “${e.motivo}”` : ''}
                </li>
              ))}
            </ol>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// Fase 5B, tarefa 2: procedimentos da conta. Porta: as linhas do BPA do
// atendimento; internação: a AIH e os especiais lançados. Valor do SIGTAP só
// como referência (o SUS paga por custeio ou pacote). Item com problema leva o
// aviso; a trava do fechamento é da tarefa 5.
function ItensConta({ c, podeMexer, aoMudar }: { c: ContaDetalhe; podeMexer: boolean; aoMudar: () => void }) {
  const [retirando, setRetirando] = React.useState<ItemConta | null>(null)
  const [motivo, setMotivo] = React.useState('')
  const retirar = useMutation({
    mutationFn: async (i: ItemConta) => {
      const { error } = await supabase.rpc('retirar_procedimento_conta', { p_conta: c.id, p_origem: i.origem, p_id: i.origem_id, p_motivo: motivo.trim() })
      if (error) throw error
    },
    onSuccess: () => { setRetirando(null); setMotivo(''); aoMudar() },
  })
  return (
    <section className="flex flex-col gap-2">
      <TituloSecao className="mb-0" extra={c.congelada_em ? `congelada no fechamento, ${fmtDataHora(c.congelada_em)}` : 'acompanha o atendimento'}>
        Procedimentos
      </TituloSecao>
      {c.itens.length === 0 ? <p className="text-tinta-sussurro">Nenhum procedimento ainda.</p> : (
        <div className="overflow-x-auto rounded-controle border border-fio">
          <Table variante="referencia" className="w-full min-w-[520px] text-apoio">
            <TableHeader className="border-b border-fio text-left text-rotulo text-tinta-sussurro">
              <TableRow><TableHead className="px-2 py-1.5 font-medium">Procedimento</TableHead><TableHead className="px-2 py-1.5 font-medium">Qtd.</TableHead>
                <TableHead className="px-2 py-1.5 font-medium">Quem fez</TableHead><TableHead className="px-2 py-1.5 text-right font-medium">Referência</TableHead><TableHead /></TableRow>
            </TableHeader>
            <TableBody>
              {c.itens.map((i) => (
                <TableRow key={i.origem + i.origem_id + (i.procedimento ?? '')} className="border-b border-trilha align-top last:border-0">
                  <TableCell className="px-2 py-1.5">
                    <span className="font-medium text-tinta">{i.procedimento ?? '—'}</span> {i.nome ?? ''}
                    <span className="block text-rotulo text-tinta-sussurro">
                      {ORIGEM_ITEM[i.origem]}{i.aih ? ` · AIH ${i.aih.numero ?? i.aih.status}` : ''}{i.em ? ` · ${fmtDataHora(i.em)}` : ''}
                    </span>
                    {[...(i.criticas ?? []), ...(i.avisos ?? [])].map((x, k) => (
                      <span key={k} className="block text-rotulo text-atencao">{x.texto}</span>
                    ))}
                  </TableCell>
                  <TableCell className="px-2 py-1.5">{i.quantidade}</TableCell>
                  <TableCell className="px-2 py-1.5">{i.profissional ?? '—'}{i.cbo ? ` · CBO ${i.cbo}` : ''}</TableCell>
                  <TableCell className="whitespace-nowrap px-2 py-1.5 text-right">{reais(i.valor_total)}</TableCell>
                  <TableCell className="px-2 py-1.5 text-right">
                    {podeMexer && i.retiravel && (
                      <Button size="xs" variant="ghost" onClick={() => { setRetirando(i); setMotivo('') }}>Retirar</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter className="border-t-0 bg-transparent font-normal">
              <TableRow className="border-t border-fio">
                <TableCell colSpan={3} className="px-2 py-1.5 text-rotulo text-tinta-sussurro">
                  Valor de referência do SIGTAP ({c.tipo === 'ambulatorial' ? 'SA' : 'SH + SP'}); o SUS paga por custeio ou pacote.
                  {c.itens_com_aviso > 0 ? ` ${c.itens_com_aviso} item(ns) com aviso.` : ''}
                </TableCell>
                <TableCell className="whitespace-nowrap px-2 py-1.5 text-right font-semibold text-tinta">{reais(c.total_referencia)}</TableCell><TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}
      {retirando && (
        <div className="flex flex-col gap-1.5 rounded-controle border border-fio p-3">
          <Label htmlFor="item-motivo">Retirar {retirando.procedimento}: motivo</Label>
          <Textarea id="item-motivo" rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          {retirar.error && <p role="alert" className="text-critico">{(retirar.error as Error).message}</p>}
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setRetirando(null)}>Voltar</Button>
            <Button size="sm" disabled={motivo.trim().length < MINIMO_MOTIVO || retirar.isPending} onClick={() => retirar.mutate(retirando)}>Retirar</Button>
          </div>
        </div>
      )}
      {podeMexer && <LancarProcedimento c={c} aoMudar={aoMudar} />}
    </section>
  )
}

// Fase 5B, tarefa 5: pré-auditoria. Pendências agrupadas, com o que corrigir e
// onde. A bloqueante trava o fechamento; só o gestor libera, com justificativa,
// e a liberação cobre as pendências daquele momento. Na conta fechada aparece a
// lista guardada no fechamento.
function PendenciasConta({ c, aoMudar }: { c: ContaDetalhe; aoMudar: () => void }) {
  const [liberando, setLiberando] = React.useState(false)
  const [motivo, setMotivo] = React.useState('')
  const liberar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('liberar_fechamento_conta', { p_conta: c.id, p_motivo: motivo.trim() })
      if (error) throw error
    },
    onSuccess: () => { setLiberando(false); setMotivo(''); aoMudar() },
  })
  const pend = c.pendencias ?? []
  const aberta = c.status === 'aberta' || c.status === 'em_conferencia'
  const liberadas = new Set((c.liberacao?.pendencias ?? []).map((p) => p.chave))
  const grupos = (Object.keys(GRUPO_PENDENCIA) as GrupoPendencia[]).filter((g) => pend.some((p) => p.grupo === g))
  const bloqueantes = pend.filter((p) => p.bloqueante).length
  return (
    <section className="flex flex-col gap-2">
      <TituloSecao className="mb-0" extra={aberta ? 'conferência de agora' : 'guardadas no fechamento'}>
        Pendências
      </TituloSecao>
      {!c.pendencias_registradas ? (
        <p className="text-tinta-sussurro">Conta fechada antes da pré-auditoria: as pendências não foram guardadas.</p>
      ) : pend.length === 0 ? (
        <p className="text-conforme">Nenhuma pendência.</p>
      ) : (
        <>
          <p className="text-rotulo text-tinta-apoio">
            {bloqueantes > 0 ? `${bloqueantes} bloqueante(s)` : 'Nenhuma bloqueante'}
            {pend.length - bloqueantes > 0 ? ` e ${pend.length - bloqueantes} aviso(s)` : ''}.
            {aberta && bloqueantes > 0 && c.bloqueantes_sem_liberacao === 0 ? ' As bloqueantes estão liberadas pelo gestor.' : ''}
          </p>
          <div className="flex flex-col divide-y divide-trilha rounded-controle border border-fio">
            {grupos.map((g) => (
              <div key={g} className="flex flex-col gap-1 px-3 py-2">
                <span className="text-rotulo font-medium text-tinta-sussurro">{GRUPO_PENDENCIA[g]}</span>
                {pend.filter((p) => p.grupo === g).map((p) => (
                  <div key={p.chave} className="flex flex-col">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <Badge variant={p.bloqueante ? (liberadas.has(p.chave) ? 'secondary' : 'destructive') : 'warning'}>
                        {p.bloqueante ? (liberadas.has(p.chave) ? 'liberada' : 'bloqueia') : 'aviso'}
                      </Badge>
                      <span className="text-tinta">{p.texto}</span>
                      {p.vezes > 1 && <span className="text-rotulo text-tinta-sussurro">({p.vezes} vezes)</span>}
                    </span>
                    {aberta && <span className="text-rotulo text-tinta-sussurro">Onde corrigir: {ondeCorrigir(p, c.tipo)}</span>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
      {c.liberacao && (
        <p className="text-rotulo text-tinta-apoio">
          Fechamento liberado por {c.liberacao.por ?? '—'} em {fmtDataHora(c.liberacao.em)}: “{c.liberacao.motivo}”
        </p>
      )}
      {c.pode_liberar && c.status === 'em_conferencia' && c.bloqueantes_sem_liberacao > 0 && (
        liberando ? (
          <div className="flex flex-col gap-1.5 rounded-controle border border-fio p-3">
            <Label htmlFor="liberar-motivo">Liberar o fechamento com {c.bloqueantes_sem_liberacao} pendência(s) bloqueante(s): justificativa</Label>
            <Textarea id="liberar-motivo" rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            {liberar.error && <p role="alert" className="text-critico">{(liberar.error as Error).message}</p>}
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setLiberando(false)}>Voltar</Button>
              <Button size="sm" disabled={motivo.trim().length < MINIMO_MOTIVO || liberar.isPending} onClick={() => liberar.mutate()}>Liberar fechamento</Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="outline" className="self-start" onClick={() => { setLiberando(true); setMotivo('') }}>Liberar fechamento</Button>
        )
      )}
    </section>
  )
}

// Fase 5B, tarefa 4: AIH e APAC ligadas à conta. Na internação, todas as AIHs
// (a que vale marcada; rejeitada e cancelada ficam como histórico); a APAC vai
// na conta a que está ligada. A conta só mostra a situação de agora: quem pede
// e decide continua na regulação. Os avisos não travam o fechamento.
const VARIANTE_DOC: Record<AihConta['status'] | ApacConta['status'], 'success' | 'warning' | 'destructive' | 'secondary'> = {
  aprovada: 'success', autorizada: 'success', solicitada: 'warning', rejeitada: 'destructive', cancelada: 'secondary',
}

function DocumentosSusConta({ c }: { c: ContaDetalhe }) {
  const { papeisDaUnidade } = useUnidade()
  const docs = c.documentos_sus ?? { aihs: [], apacs: [], avisos: [] }
  const abreAih = papeisDaUnidade.some((p) => p === 'regulador' || p === 'gestor')
  const abreApac = papeisDaUnidade.some((p) => p === 'regulador' || p === 'faturamento' || p === 'gestor')
  const vazio = docs.aihs.length === 0 && docs.apacs.length === 0
  // na porta, a seção só aparece quando há APAC
  if (c.tipo !== 'internacao' && vazio && docs.avisos.length === 0) return null
  return (
    <section className="flex flex-col gap-2">
      <TituloSecao className="mb-0" extra="situação de agora; quem pede e decide é a regulação">
        {c.tipo === 'internacao' ? 'AIH e APAC' : 'APAC'}
      </TituloSecao>
      {docs.avisos.map((a) => <p key={a} className="text-rotulo text-atencao">{a} O aviso não impede o fechamento.</p>)}
      {vazio && docs.avisos.length === 0 && (
        <p className="text-tinta-sussurro">Nenhuma AIH ou APAC ligada a esta conta.</p>
      )}
      {!vazio && (
        <ul className="flex flex-col divide-y divide-trilha rounded-controle border border-fio">
          {docs.aihs.map((a) => (
            <li key={a.id} className={`flex flex-col gap-0.5 px-3 py-2${a.vigente ? '' : ' text-tinta-sussurro'}`}>
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="font-medium text-tinta">AIH {a.numero ?? 'sem número'}</span>
                <Badge variant={VARIANTE_DOC[a.status]}>{SITUACAO_DOCUMENTO[a.status]}</Badge>
                {a.vigente && <Badge variant="outline">a que vale</Badge>}
                {a.competencia && <span className="text-rotulo">competência {competenciaNaTela(a.competencia)}</span>}
              </span>
              {a.procedimento && <span className="text-rotulo">{codigoSigtapNaTela(a.procedimento)} {a.nome ?? ''}</span>}
              <span className="text-rotulo text-tinta-sussurro">
                pedida {fmtDataHora(a.solicitada_em)}{a.decidida_em ? ` · decidida ${fmtDataHora(a.decidida_em)}` : ''}
                {a.motivo && (a.status === 'rejeitada' || a.status === 'cancelada') ? ` · “${a.motivo}”` : ''}
              </span>
            </li>
          ))}
          {docs.apacs.map((a) => (
            <li key={a.id} className="flex flex-col gap-0.5 px-3 py-2">
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="font-medium text-tinta">APAC {a.numero ?? 'sem número'}</span>
                <Badge variant={VARIANTE_DOC[a.status]}>{SITUACAO_DOCUMENTO[a.status]}</Badge>
                <span className="text-rotulo text-tinta-sussurro">{TIPO_APAC[a.tipo]}</span>
                {a.validade_inicio && a.validade_fim && (
                  <span className="text-rotulo">validade {fmtData(a.validade_inicio)} a {fmtData(a.validade_fim)}</span>
                )}
              </span>
              <span className="text-rotulo">{codigoSigtapNaTela(a.procedimento)} {a.nome ?? ''}</span>
              {a.competencias.length > 0 && (
                <span className="flex flex-wrap gap-1.5 text-rotulo">
                  {a.competencias.map((k) => (
                    <span key={k.competencia} className={k.fora_do_arquivo ? 'text-atencao' : 'text-tinta-apoio'}>
                      {competenciaNaTela(k.competencia)}: {k.fora_do_arquivo ? 'fora do arquivo (crítica)' : k.fechada ? 'no arquivo do mês' : 'competência aberta'}
                    </span>
                  ))}
                </span>
              )}
              {a.motivo && (a.status === 'rejeitada' || a.status === 'cancelada') && (
                <span className="text-rotulo text-tinta-sussurro">“{a.motivo}”</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {(docs.aihs.length > 0 && abreAih) || (docs.apacs.length > 0 && abreApac) ? (
        <span className="flex flex-wrap gap-3 text-rotulo">
          {docs.aihs.length > 0 && abreAih && <Link className="font-medium text-acao underline" to="/aih">Abrir a tela de AIH</Link>}
          {docs.apacs.length > 0 && abreApac && <Link className="font-medium text-acao underline" to="/apac">Abrir a tela de APAC</Link>}
        </span>
      ) : null}
    </section>
  )
}

// Fase 5B, etapa 3.3: medicamentos da conta. Fonte é a dispensação da farmácia
// (menos devolução), em unidade de consumo; a administração da enfermagem fica
// ao lado para conferir. Aviso só nos casos claros e não trava o fechamento. O
// faturamento tira o item da conta com motivo e pode trazer de volta enquanto a
// conta está aberta ou em conferência. Sem valor: só consumo.
function MedicamentosConta({ c, podeMexer, aoMudar }: { c: ContaDetalhe; podeMexer: boolean; aoMudar: () => void }) {
  const [ajuste, setAjuste] = React.useState<{ m: MedicamentoConta; fora: boolean } | null>(null)
  const [motivo, setMotivo] = React.useState('')
  const ajustar = useMutation({
    mutationFn: async (a: { m: MedicamentoConta; fora: boolean }) => {
      const { error } = await supabase.rpc('medicamento_fora_da_conta', { p_conta: c.id, p_item: a.m.item_id, p_fora: a.fora, p_motivo: motivo.trim() })
      if (error) throw error
    },
    onSuccess: () => { setAjuste(null); setMotivo(''); aoMudar() },
  })
  const meds = c.medicamentos ?? []
  return (
    <section className="flex flex-col gap-2">
      <TituloSecao className="mb-0" extra={c.congelada_em ? `congelados no fechamento, ${fmtDataHora(c.congelada_em)}` : 'dispensado pela farmácia × administrado'}>
        Medicamentos
      </TituloSecao>
      {meds.length === 0 ? <p className="text-tinta-sussurro">Nenhum medicamento dispensado ou administrado nesta conta.</p> : (
        <div className="overflow-x-auto rounded-controle border border-fio">
          <Table variante="referencia" className="w-full min-w-[520px] text-apoio">
            <TableHeader className="border-b border-fio text-left text-rotulo text-tinta-sussurro">
              <TableRow><TableHead className="px-2 py-1.5 font-medium">Medicamento</TableHead><TableHead className="px-2 py-1.5 font-medium">Dispensado</TableHead>
                <TableHead className="px-2 py-1.5 font-medium">Administrado</TableHead><TableHead /></TableRow>
            </TableHeader>
            <TableBody>
              {meds.map((m) => (
                <TableRow key={m.item_id} className={`border-b border-trilha align-top last:border-0${m.fora_da_conta ? ' text-tinta-sussurro' : ''}`}>
                  <TableCell className="px-2 py-1.5">
                    <span className={m.fora_da_conta ? 'line-through' : 'font-medium text-tinta'}>{m.medicamento}</span>
                    {m.fora_da_conta && <Badge variant="outline" className="ml-1.5">fora da conta</Badge>}
                    <span className="block text-rotulo text-tinta-sussurro">{m.prescricao}</span>
                    {m.fora_da_conta && m.fora_motivo && (
                      <span className="block text-rotulo text-tinta-sussurro">“{m.fora_motivo}”{m.fora_por ? ` · ${m.fora_por}` : ''}</span>
                    )}
                    {m.aviso && !m.fora_da_conta && <span className="block text-rotulo text-atencao">{m.aviso}</span>}
                  </TableCell>
                  <TableCell className="whitespace-nowrap px-2 py-1.5">
                    {m.liquido} {rotuloUnidade(m.unidade_consumo)}
                    {m.devolvido > 0 && <span className="block text-rotulo text-tinta-sussurro">{m.dispensado} {m.dispensado === 1 ? 'saiu' : 'saíram'}, {m.devolvido} {m.devolvido === 1 ? 'voltou' : 'voltaram'}</span>}
                    {m.sem_farmaceutico && <span className="block text-rotulo text-tinta-sussurro">sem farmacêutico no turno</span>}
                  </TableCell>
                  <TableCell className="whitespace-nowrap px-2 py-1.5">{m.administrado === 0 ? 'nenhuma vez' : m.administrado === 1 ? '1 vez' : `${m.administrado} vezes`}</TableCell>
                  <TableCell className="px-2 py-1.5 text-right">
                    {podeMexer && (
                      <Button size="xs" variant="ghost" onClick={() => { setAjuste({ m, fora: !m.fora_da_conta }); setMotivo('') }}>
                        {m.fora_da_conta ? 'Voltar à conta' : 'Fora da conta'}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter className="border-t-0 bg-transparent font-normal">
              <TableRow className="border-t border-fio">
                <TableCell colSpan={4} className="px-2 py-1.5 text-rotulo text-tinta-sussurro">
                  Quantidade em unidade de consumo, já sem o que voltou à farmácia. Sem valor: entra no custeio ou no pacote.
                  {c.medicamentos_com_aviso > 0 ? ` ${c.medicamentos_com_aviso} medicamento(s) com aviso; o aviso não impede o fechamento.` : ''}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}
      {ajuste && (
        <div className="flex flex-col gap-1.5 rounded-controle border border-fio p-3">
          <Label htmlFor="med-motivo">{ajuste.fora ? 'Tirar da conta' : 'Voltar à conta'} {ajuste.m.medicamento}: motivo</Label>
          <Textarea id="med-motivo" rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          {ajustar.error && <p role="alert" className="text-critico">{(ajustar.error as Error).message}</p>}
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setAjuste(null)}>Voltar</Button>
            <Button size="sm" disabled={motivo.trim().length < MINIMO_MOTIVO || ajustar.isPending} onClick={() => ajustar.mutate(ajuste)}>
              {ajuste.fora ? 'Tirar da conta' : 'Voltar à conta'}
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}

function LancarProcedimento({ c, aoMudar }: { c: ContaDetalhe; aoMudar: () => void }) {
  const { unidadeAtiva } = useUnidade()
  const [aberto, setAberto] = React.useState(false)
  const [termo, setTermo] = React.useState('')
  const [codigo, setCodigo] = React.useState<{ codigo: string; nome: string } | null>(null)
  const [quantidade, setQuantidade] = React.useState('1')
  const [profissional, setProfissional] = React.useState('')
  const busca = useQuery({
    queryKey: ['buscar-sigtap', termo.trim()],
    enabled: aberto && !codigo && termo.trim().length >= 3,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('buscar_sigtap', { p_termo: termo.trim() })
      if (error) throw error
      return (data ?? []) as unknown as { codigo: string; nome: string }[]
    },
  })
  const profissionais = useQuery({
    queryKey: ['profissionais-para-faturar', unidadeAtiva?.unidade_id],
    enabled: aberto && !!unidadeAtiva,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('profissionais_para_faturar', { p_unidade: unidadeAtiva!.unidade_id })
      if (error) throw error
      return (data ?? []) as unknown as ProfissionalParaFaturar[]
    },
  })
  const lancar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('lancar_procedimento_conta', {
        p_conta: c.id, p_procedimento: codigo!.codigo, p_quantidade: Number(quantidade), p_profissional: profissional || undefined,
      })
      if (error) throw error
    },
    onSuccess: () => { setAberto(false); setCodigo(null); setTermo(''); setQuantidade('1'); setProfissional(''); aoMudar() },
  })
  if (!aberto) return <Button size="sm" variant="outline" className="self-start" onClick={() => setAberto(true)}>Lançar procedimento</Button>
  return (
    <div className="flex flex-col gap-2 rounded-controle border border-fio p-3">
      <span className="text-rotulo text-tinta-sussurro">
        {c.tipo === 'ambulatorial'
          ? 'Na conta da porta, o lançamento é o mesmo do BPA: só códigos da lista da unidade.'
          : 'Na internação: procedimentos especiais ou secundários que a AIH aceita à parte (UTI, OPME e outros).'}
      </span>
      {codigo ? (
        <div className="flex items-center justify-between rounded-controle border border-fio px-2 py-1">
          <span><span className="font-medium">{codigoSigtapNaTela(codigo.codigo)}</span> · {codigo.nome}</span>
          <Button size="xs" variant="ghost" onClick={() => setCodigo(null)}>Trocar</Button>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <Input className="h-8" aria-label="Procedimento SIGTAP" placeholder="Código ou nome no SIGTAP" value={termo} onChange={(e) => setTermo(e.target.value)} />
          {(busca.data ?? []).length > 0 && (
            <div className="flex max-h-40 flex-col overflow-y-auto rounded-controle border border-fio">
              {(busca.data ?? []).map((p) => (
                <Button key={p.codigo} type="button" variant="ghost" size="sm" className="justify-start" onClick={() => setCodigo(p)}>
                  {codigoSigtapNaTela(p.codigo)} · {p.nome}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="lanc-qtd">Quantidade</Label>
          <Input id="lanc-qtd" className="h-8 w-24" inputMode="numeric" value={quantidade} onChange={(e) => setQuantidade(e.target.value.replace(/\D/g, ''))} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="lanc-prof">Quem fez</Label>
          <CampoSelecao id="lanc-prof" value={profissional} onChange={(e) => setProfissional(e.target.value)}>
            <option value="">Escolha…</option>
            {(profissionais.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.nome}{p.cbo ? ` · CBO ${p.cbo}` : ''}</option>)}
          </CampoSelecao>
        </div>
      </div>
      {lancar.error && <p role="alert" className="text-critico">{(lancar.error as Error).message}</p>}
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={() => setAberto(false)}>Cancelar</Button>
        <Button size="sm" disabled={!codigo || !profissional || !(Number(quantidade) >= 1) || lancar.isPending} onClick={() => lancar.mutate()}>Lançar</Button>
      </div>
    </div>
  )
}
