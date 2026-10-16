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

import { Chip, Chips, TituloPagina, TituloSecao, Vazio } from '@/components/monitor/Pagina'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { useUnidade } from '@/contexts/UnidadeContext'
import {
  acoesDaConta, ETAPA, EVENTO, PAGADOR, TIPO, type AcaoConta, type Conta, type ContaDetalhe, type EtapaConta, type Pagador, type TipoConta,
} from '@/lib/contas'
import { fmtDataHora } from '@/lib/datas'
import { supabase } from '@/lib/supabase'
import { Erro } from '@/pages/farmacia/Farmacia'

const MINIMO_MOTIVO = 10
const VARIANTE: Record<EtapaConta, 'info' | 'warning' | 'secondary' | 'outline'> = {
  aberta: 'info', em_conferencia: 'warning', fechada: 'secondary', faturada: 'outline',
}
const selectCls = 'h-9 rounded-controle border border-fio bg-campo px-2 text-apoio'

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
      <Erro texto={lista.error ? (lista.error as Error).message : null} />
      {lista.isLoading ? <Spinner /> : (lista.data?.contas ?? []).length === 0 ? (
        <Vazio icone={Wallet} titulo="Nenhuma conta nesta etapa" texto="As contas abrem sozinhas com o atendimento na porta e com a internação." />
      ) : (
        <div className="overflow-x-auto rounded-container border border-fio bg-superficie">
          <table className="w-full min-w-[720px] text-apoio">
            <thead className="border-b border-fio text-left text-rotulo text-tinta-sussurro">
              <tr>
                <th className="px-3 py-2 font-medium">Conta</th><th className="px-3 py-2 font-medium">Paciente</th>
                <th className="px-3 py-2 font-medium">Tipo</th><th className="px-3 py-2 font-medium">Atendimento</th>
                <th className="px-3 py-2 font-medium">Pagador</th><th className="px-3 py-2 font-medium">Etapa</th>
              </tr>
            </thead>
            <tbody>
              {lista.data!.contas.map((c) => (
                <tr key={c.id} className="cursor-pointer border-b border-trilha last:border-0 hover:bg-trilha/60" onClick={() => setAberta(c.id)}>
                  <td className="whitespace-nowrap px-3 py-2 font-medium text-tinta">
                    {c.numero}
                    {(c.origem || c.derivadas.length > 0) && <Link2 className="ml-1 inline size-3.5 text-tinta-sussurro" aria-label="conta ligada" />}
                  </td>
                  <td className="px-3 py-2">{c.paciente.nome}<span className="text-tinta-sussurro"> · {c.paciente.prontuario ?? '—'}</span></td>
                  <td className="px-3 py-2">{TIPO[c.tipo]}</td>
                  <td className="px-3 py-2 text-tinta-apoio">
                    {c.atendimento?.inicio ? fmtDataHora(c.atendimento.inicio) : '—'}
                    {c.atendimento_terminou ? (c.atendimento?.fim ? ` até ${fmtDataHora(c.atendimento.fim)}` : '') : ' · em andamento'}
                  </td>
                  <td className="px-3 py-2">{PAGADOR[c.pagador]}</td>
                  <td className="px-3 py-2"><Badge variant={VARIANTE[c.status]}>{ETAPA[c.status]}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
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
      <DialogContent className="sm:max-w-[620px]">
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
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-fio px-3 py-2">
                <Link2 className="size-4 text-tinta-sussurro" aria-hidden />
                {c.origem && (
                  <span>Veio da porta: <button type="button" className="font-medium text-acao underline" onClick={() => onTrocar(c.origem!.id)}>{c.origem.numero}</button> ({ETAPA[c.origem.status]})</span>
                )}
                {c.derivadas.map((d) => (
                  <span key={d.id}>Internação: <button type="button" className="font-medium text-acao underline" onClick={() => onTrocar(d.id)}>{d.numero}</button> ({ETAPA[d.status]})</span>
                ))}
              </div>
            )}
            <Erro texto={erro?.message ?? null} />

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
            {acoes.find((a) => a.bloqueio) && <p className="text-rotulo text-tinta-sussurro">{acoes.find((a) => a.bloqueio)!.bloqueio} A conta fecha depois.</p>}
            {acao && (
              <div className="flex flex-col gap-1.5 rounded-lg border border-fio p-3">
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
                  <select id="conta-pagador" className={selectCls} value={pagador} onChange={(e) => { setPagador(e.target.value as Pagador | ''); setMotivo('') }}>
                    <option value="">—</option>
                    {(['sus', 'convenio', 'particular'] as const).filter((p) => p !== c.pagador).map((p) => <option key={p} value={p}>{PAGADOR[p]}</option>)}
                  </select>
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
