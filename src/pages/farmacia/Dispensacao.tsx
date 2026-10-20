// ─────────────────────────────────────────────────────────────────────────────
// Dispensação da farmácia (Fase 5B, tarefa 3, etapa 3.2; decisões do RT de
// 17/10/2026). O farmacêutico dispensa os itens de medicamento da prescrição
// vigente (e, avulso, com destino e motivo); com a farmácia fechada, a
// enfermagem que cuida do paciente retira com justificativa e o farmacêutico
// confere depois. O sistema sugere a quantidade (vezes nas próximas 24 h ×
// unidades por vez) e quem dispensa define. Dispensar baixa o estoque; o saldo
// pode ficar negativo e aparece para a farmácia conferir. Devolução com motivo
// volta ao estoque. Migration 20261130000001_dispensacao_farmacia.sql.
// ─────────────────────────────────────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PackageOpen } from 'lucide-react'
import * as React from 'react'

import { TituloPagina, TituloSecao, Vazio } from '@/components/monitor/Pagina'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { useUnidade } from '@/contexts/UnidadeContext'
import { fmtDataHora } from '@/lib/datas'
import { porPaciente, type Dispensacao, type ItemParaDispensar } from '@/lib/dispensacao'
import { normalizarMedicamento } from '@/lib/search'
import { supabase } from '@/lib/supabase'
import { rotuloUnidade } from '@/lib/unidadeConsumo'
import { MensagemErro } from '@/components/ui/mensagem-erro'
import { Abas } from '@/components/monitor/Pagina'

type Aba = 'prescricoes' | 'avulsa' | 'registro'
const MINIMO = 10

export default function DispensacaoPagina() {
  const { unidadeAtiva, papelAtivo } = useUnidade()
  const unidade = unidadeAtiva?.unidade_id
  const farmacia = papelAtivo === 'farmaceutico' || papelAtivo === 'gestor'
  const [aba, setAba] = React.useState<Aba>(papelAtivo === 'gestor' ? 'registro' : 'prescricoes')
  const abas: readonly (readonly [Aba, string])[] = papelAtivo === 'gestor'
    ? [['registro', 'Registro']]
    : farmacia ? [['prescricoes', 'Prescrições'], ['avulsa', 'Avulsa'], ['registro', 'Registro']] : [['prescricoes', 'Retirada sem farmacêutico']]
  return (
    <div className="flex w-full max-w-5xl flex-col">
      <TituloPagina icone={PackageOpen} titulo="Dispensação"
        descricao={farmacia
          ? 'O que sai da farmácia para o paciente, em unidades de consumo. O sistema sugere a quantidade; quem dispensa define. Dispensar baixa o estoque.'
          : 'Farmácia fechada: retire o medicamento do paciente sob seus cuidados com justificativa. O farmacêutico confere depois.'} />
      <Abas abas={abas} valor={aba} onChange={setAba} rotulo="Dispensação" />
      {unidade && aba === 'prescricoes' && <Prescricoes unidade={unidade} />}
      {unidade && aba === 'avulsa' && <Avulsa unidade={unidade} />}
      {unidade && aba === 'registro' && <Registro unidade={unidade} podeAgir={papelAtivo === 'farmaceutico'} />}
    </div>
  )
}

function Prescricoes({ unidade }: { unidade: string }) {
  const [termo, setTermo] = React.useState('')
  const [busca, setBusca] = React.useState('')
  React.useEffect(() => { const t = setTimeout(() => setBusca(termo.trim()), 300); return () => clearTimeout(t) }, [termo])
  const lista = useQuery({
    queryKey: ['itens-para-dispensar', unidade, busca],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('itens_para_dispensar', { p_unidade: unidade, p_busca: busca || undefined })
      if (error) throw error
      return data as unknown as { farmaceutico: boolean; itens: ItemParaDispensar[] }
    },
  })
  const grupos = porPaciente(lista.data?.itens ?? [])
  return (
    <div className="flex flex-col gap-3">
      <Input className="max-w-md" aria-label="Buscar paciente ou medicamento" placeholder="Buscar paciente ou medicamento" value={termo} onChange={(e) => setTermo(e.target.value)} />
      <MensagemErro texto={lista.error ? (lista.error as Error).message : null} />
      {lista.isLoading ? <Spinner /> : grupos.length === 0 ? (
        <Vazio icone={PackageOpen} titulo="Nenhum medicamento prescrito" texto="Itens de medicamento das prescrições vigentes aparecem aqui." />
      ) : grupos.map((g) => (
        <section key={g.paciente_id} className="rounded-container border border-fio bg-superficie">
          <div className="border-b border-trilha px-4 py-2 text-controle font-medium text-tinta">
            {g.paciente}<span className="font-normal text-tinta-sussurro"> · {g.prontuario ?? '—'}{g.setor ? ` · ${g.setor}` : ''}</span>
          </div>
          {g.itens.map((i) => <LinhaItem key={i.item_id} i={i} farmaceutico={!!lista.data?.farmaceutico} />)}
        </section>
      ))}
    </div>
  )
}

function LinhaItem({ i, farmaceutico }: { i: ItemParaDispensar; farmaceutico: boolean }) {
  const qc = useQueryClient()
  const [qtd, setQtd] = React.useState(i.sugestao.quantidade != null ? String(i.sugestao.quantidade) : '')
  const [just, setJust] = React.useState('')
  const [aviso, setAviso] = React.useState<string | null>(null)
  const unidade = rotuloUnidade(i.unidade_consumo, i.unidade_consumo_outra).toLowerCase()
  const dispensar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('dispensar_item', { p_item: i.item_id, p_quantidade: Number(qtd), p_justificativa: farmaceutico ? undefined : just.trim() })
      if (error) throw error
      return data as unknown as { saldo: number; estoque_negativo: boolean }
    },
    onSuccess: (r) => {
      setAviso(r.estoque_negativo ? `Dispensado. Saldo do estoque ficou ${r.saldo}: confira o saldo da farmácia.` : `Dispensado. Saldo: ${r.saldo}.`)
      setJust('')
      for (const k of ['itens-para-dispensar', 'dispensacoes']) void qc.invalidateQueries({ queryKey: [k] })
    },
  })
  const pronto = Number(qtd) >= 1 && (farmaceutico || just.trim().length >= MINIMO)
  return (
    <div className="flex flex-col gap-1.5 border-b border-trilha px-4 py-3 text-apoio last:border-0">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-medium text-tinta">{i.medicamento}</span>
        <span className="text-tinta-apoio">{[i.dose, i.via, i.posologia].filter(Boolean).join(' · ')}{i.se_necessario ? ' · se necessário' : ''}</span>
        {i.validacao === 'confere' && <Badge variant="secondary">validado</Badge>}
        {i.validacao === 'devolvido' && <Badge variant="destructive">devolvido para correção</Badge>}
      </div>
      <span className="text-rotulo text-tinta-sussurro">
        Dispensado nas últimas 24 h: {i.dispensado_24h} {unidade} · estoque: {i.saldo_estoque ?? '—'}
      </span>
      <span className="text-rotulo text-tinta-apoio">
        Sugestão: {i.sugestao.quantidade != null ? `${i.sugestao.quantidade} ${unidade}` : 'sem sugestão'}
        {i.sugestao.explicacao ? ` (${i.sugestao.explicacao})` : ''}
      </span>
      {i.sugestao.notas.map((n) => <span key={n} className="text-rotulo text-atencao">{n}</span>)}
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor={`qtd-${i.item_id}`}>Quantidade ({unidade})</Label>
          <Input id={`qtd-${i.item_id}`} className="h-8 w-24" inputMode="numeric" value={qtd} onChange={(e) => setQtd(e.target.value.replace(/\D/g, ''))} />
        </div>
        {!farmaceutico && (
          <Textarea aria-label="Justificativa da retirada sem farmacêutico" rows={1} className="min-w-[240px] flex-1"
            placeholder="Por que retira sem farmacêutico (mínimo de 10 letras)" value={just} onChange={(e) => setJust(e.target.value)} />
        )}
        <Button size="sm" disabled={!pronto || dispensar.isPending} onClick={() => dispensar.mutate()}>
          {farmaceutico ? 'Dispensar' : 'Retirar sem farmacêutico'}
        </Button>
      </div>
      {dispensar.error && <p role="alert" className="text-critico">{(dispensar.error as Error).message}</p>}
      {aviso && <p role="status" className="text-conforme">{aviso}</p>}
    </div>
  )
}

function Avulsa({ unidade }: { unidade: string }) {
  const qc = useQueryClient()
  const [busca, setBusca] = React.useState('')
  const [med, setMed] = React.useState<{ id: string; principio_ativo: string; apresentacao: string | null; unidade_consumo: string | null; unidade_consumo_outra: string | null } | null>(null)
  const [qtd, setQtd] = React.useState('')
  const [destino, setDestino] = React.useState('')
  const [motivo, setMotivo] = React.useState('')
  const [aviso, setAviso] = React.useState<string | null>(null)
  const resultados = useQuery({
    queryKey: ['busca-medicamento-avulsa', busca],
    enabled: busca.trim().length >= 3 && !med,
    queryFn: async () => {
      const { data, error } = await supabase.from('medicamento').select('id, principio_ativo, apresentacao, unidade_consumo, unidade_consumo_outra')
        .eq('ativo', true).ilike('principio_ativo_norm', `%${normalizarMedicamento(busca.trim())}%`).order('principio_ativo').limit(15)
      if (error) throw error
      return data ?? []
    },
  })
  const salvar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('dispensar_avulso', {
        p_unidade: unidade, p_medicamento: med!.id, p_quantidade: Number(qtd), p_destino: destino.trim(), p_motivo: motivo.trim(),
      })
      if (error) throw error
      return data as unknown as { saldo: number; estoque_negativo: boolean }
    },
    onSuccess: (r) => {
      setAviso(r.estoque_negativo ? `Dispensado. Saldo ficou ${r.saldo}: confira o saldo da farmácia.` : `Dispensado. Saldo: ${r.saldo}.`)
      setMed(null); setBusca(''); setQtd(''); setDestino(''); setMotivo('')
      void qc.invalidateQueries({ queryKey: ['dispensacoes'] })
    },
  })
  return (
    <div className="flex max-w-xl flex-col gap-3 text-apoio">
      <p className="text-tinta-sussurro">Saída sem prescrição (ex.: reposição do carrinho de emergência). Sai do estoque e fica registrada com destino e motivo.</p>
      {med ? (
        <div className="flex items-center justify-between rounded-lg border border-fio px-3 py-2">
          <span><span className="font-medium text-tinta">{med.principio_ativo}</span> {med.apresentacao ?? ''} · {rotuloUnidade(med.unidade_consumo, med.unidade_consumo_outra)}</span>
          <Button size="xs" variant="ghost" onClick={() => setMed(null)}>Trocar</Button>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <Input aria-label="Medicamento" placeholder="Medicamento do cadastro (3 letras ou mais)" value={busca} onChange={(e) => setBusca(e.target.value)} />
          {(resultados.data ?? []).map((m) => (
            <button key={m.id} type="button" onClick={() => setMed(m)} className="flex gap-2 border-b border-fio px-2 py-1 text-left text-xs last:border-0 hover:bg-trilha">
              <span className="font-medium">{m.principio_ativo}</span><span className="text-tinta-apoio">{m.apresentacao}</span>
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="av-qtd">Quantidade</Label>
          <Input id="av-qtd" className="h-8 w-24" inputMode="numeric" value={qtd} onChange={(e) => setQtd(e.target.value.replace(/\D/g, ''))} />
        </div>
        <div className="flex min-w-[220px] flex-1 flex-col gap-1">
          <Label htmlFor="av-destino">Destino</Label>
          <Input id="av-destino" className="h-8" placeholder="Ex.: carrinho de emergência do PS" value={destino} onChange={(e) => setDestino(e.target.value)} />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="av-motivo">Motivo</Label>
        <Textarea id="av-motivo" rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      </div>
      {salvar.error && <p role="alert" className="text-critico">{(salvar.error as Error).message}</p>}
      {aviso && <p role="status" className="text-conforme">{aviso}</p>}
      <Button className="self-start" disabled={!med || !(Number(qtd) >= 1) || destino.trim().length < 3 || motivo.trim().length < MINIMO || salvar.isPending}
        onClick={() => salvar.mutate()}>Dispensar avulso</Button>
    </div>
  )
}

function Registro({ unidade, podeAgir }: { unidade: string; podeAgir: boolean }) {
  const qc = useQueryClient()
  const [devolvendo, setDevolvendo] = React.useState<Dispensacao | null>(null)
  const [qtd, setQtd] = React.useState('1')
  const [motivo, setMotivo] = React.useState('')
  const lista = useQuery({
    queryKey: ['dispensacoes', unidade],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('dispensacoes_da_unidade', { p_unidade: unidade })
      if (error) throw error
      return data as unknown as { dispensacoes: Dispensacao[]; a_conferir: number; estoque_negativo: { medicamento: string; saldo: number }[] }
    },
  })
  const recarregar = () => { for (const k of ['dispensacoes', 'itens-para-dispensar']) void qc.invalidateQueries({ queryKey: [k] }) }
  const conferir = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.rpc('conferir_dispensacao', { p_dispensacao: id }); if (error) throw error },
    onSuccess: recarregar,
  })
  const devolver = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('devolver_dispensacao', { p_dispensacao: devolvendo!.id, p_quantidade: Number(qtd), p_motivo: motivo.trim() })
      if (error) throw error
    },
    onSuccess: () => { setDevolvendo(null); setMotivo(''); setQtd('1'); recarregar() },
  })
  const d = lista.data
  return (
    <div className="flex flex-col gap-3 text-apoio">
      <MensagemErro texto={(lista.error ?? conferir.error ?? devolver.error) ? ((lista.error ?? conferir.error ?? devolver.error) as Error).message : null} />
      {(d?.estoque_negativo.length ?? 0) > 0 && (
        <div role="alert" className="rounded-lg border border-atencao/30 bg-atencao/[0.06] px-3 py-2">
          <span className="font-medium text-tinta">Saldo negativo: confira o estoque destes medicamentos.</span>
          <ul className="list-disc pl-5 text-tinta-apoio">{d!.estoque_negativo.map((e) => <li key={e.medicamento}>{e.medicamento}: {e.saldo}</li>)}</ul>
        </div>
      )}
      <TituloSecao extra={d && d.a_conferir > 0 ? `${d.a_conferir} retirada(s) sem farmacêutico a conferir` : 'últimas 72 h'}>Dispensações</TituloSecao>
      {lista.isLoading ? <Spinner /> : (d?.dispensacoes ?? []).length === 0 ? <p className="text-tinta-sussurro">Nenhuma dispensação nas últimas 72 h.</p> : (
        <div className="overflow-x-auto rounded-container border border-fio bg-superficie">
          <table className="w-full min-w-[640px]">
            <thead className="border-b border-fio text-left text-rotulo text-tinta-sussurro">
              <tr><th className="px-3 py-2 font-medium">Medicamento</th><th className="px-3 py-2 font-medium">Para</th><th className="px-3 py-2 font-medium">Qtd.</th><th className="px-3 py-2 font-medium">Quem, quando</th><th /></tr>
            </thead>
            <tbody>
              {d!.dispensacoes.map((x) => (
                <tr key={x.id} className="border-b border-trilha align-top last:border-0">
                  <td className="px-3 py-2">{x.medicamento}</td>
                  <td className="px-3 py-2">{x.paciente ?? `Avulsa: ${x.destino}`}{x.motivo ? <span className="block text-rotulo text-tinta-sussurro">“{x.motivo}”</span> : null}</td>
                  <td className="px-3 py-2">{x.quantidade}{x.devolvido > 0 ? ` (voltou ${x.devolvido})` : ''} {rotuloUnidade(x.unidade_consumo).toLowerCase()}</td>
                  <td className="px-3 py-2">
                    {x.dispensada_por ?? '—'}, {fmtDataHora(x.dispensada_em)}
                    {x.sem_farmaceutico && (
                      <span className="block text-rotulo">
                        {x.conferida_em ? <span className="text-conforme">sem farmacêutico · conferida por {x.conferida_por}</span> : <Badge variant="warning">sem farmacêutico · a conferir</Badge>}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {podeAgir && x.sem_farmaceutico && !x.conferida_em && <Button size="xs" onClick={() => conferir.mutate(x.id)}>Conferir</Button>}
                    {podeAgir && x.quantidade - x.devolvido > 0 && (
                      <Button size="xs" variant="ghost" onClick={() => { setDevolvendo(x); setQtd('1'); setMotivo('') }}>Devolução</Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {devolvendo && (
        <div className="flex flex-col gap-2 rounded-lg border border-fio p-3">
          <span className="font-medium text-tinta">Devolução: {devolvendo.medicamento} (até {devolvendo.quantidade - devolvendo.devolvido})</span>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="dev-qtd">Quantidade</Label>
              <Input id="dev-qtd" className="h-8 w-24" inputMode="numeric" value={qtd} onChange={(e) => setQtd(e.target.value.replace(/\D/g, ''))} />
            </div>
            <Textarea aria-label="Motivo da devolução" rows={1} className="min-w-[240px] flex-1" placeholder="Motivo (mínimo de 10 letras)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            <Button size="sm" variant="ghost" onClick={() => setDevolvendo(null)}>Voltar</Button>
            <Button size="sm" disabled={!(Number(qtd) >= 1) || motivo.trim().length < MINIMO || devolver.isPending} onClick={() => devolver.mutate()}>Registrar devolução</Button>
          </div>
        </div>
      )}
    </div>
  )
}
