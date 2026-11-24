// ─────────────────────────────────────────────────────────────────────────────
// Dispensação da farmácia (Fase 5B, tarefa 3, etapa 3.2; decisões do RT de
// 17/10/2026). O farmacêutico dispensa os itens de medicamento da prescrição
// vigente (e, avulso, com destino e motivo); com a farmácia fechada, a
// enfermagem que cuida do paciente retira com justificativa e o farmacêutico
// confere depois. O sistema sugere a quantidade (vezes nas próximas 24 h ×
// unidades por vez) e quem dispensa define. Dispensar baixa o estoque; o saldo
// pode ficar negativo e aparece para a farmácia conferir. Devolução com motivo
// volta ao estoque. Migration 20261130000001_dispensacao_farmacia.sql.
//
// Revisão visual 3.7b (opção A do RT, 26/10/2026): Prescrições como caixa de
// entrada, igual à validação — à esquerda um paciente por linha, à direita os
// itens do escolhido, com a quantidade e Dispensar na própria linha.
// Lacuna 3 (Portaria 344): o controlado leva o selo "Controlado · B1".
// ─────────────────────────────────────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Info, PackageOpen } from 'lucide-react'
import * as React from 'react'

import { Chip, Chips, TituloPagina, TituloSecao, Vazio } from '@/components/monitor/Pagina'
import { BotaoLinha } from '@/components/ui/botao-linha'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { useUnidade } from '@/contexts/UnidadeContext'
import { fmtDataHora } from '@/lib/datas'
import { justificativaRetirada, MOTIVOS_RETIRADA, notasUnicas, porPaciente, situacaoParaDispensar, type Dispensacao, type ItemParaDispensar } from '@/lib/dispensacao'
import type { Liberacao } from '@/lib/duplaChecagem'
import { useControladosDoCatalogo } from '@/hooks/useControlados'
import { PERIODOS_REGISTRO } from '@/lib/movimentosEstoque'
import { normalizarMedicamento } from '@/lib/search'
import { filtroDaUnidade } from '@/lib/medicamentoCadastro'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { rotuloUnidade } from '@/lib/unidadeConsumo'
import { MensagemErro } from '@/components/ui/mensagem-erro'
import { Estado } from '@/components/porta/Estado'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useValorAdiado } from '@/hooks/useValorAdiado'
import { SeloDoMedicamento } from '@/components/farmacia/SeloControlado'

type Aba = 'prescricoes' | 'avulsa' | 'registro'
const MINIMO = 10

export default function DispensacaoPagina() {
  const { unidadeAtiva, papelAtivo } = useUnidade()
  const unidade = unidadeAtiva?.unidade_id
  const farmacia = papelAtivo === 'farmaceutico' || papelAtivo === 'gestor'
  const [aba, setAba] = React.useState<Aba>(papelAtivo === 'gestor' ? 'registro' : 'prescricoes')
  const abas: readonly (readonly [Aba, string])[] = papelAtivo === 'gestor'
    ? [['registro', 'Registro']]
    : farmacia ? [['prescricoes', 'Prescrições'], ['avulsa', 'Avulsa'], ['registro', 'Registro']] : []
  return (
    <div className="flex w-full max-w-5xl flex-col">
      {/* RS2: o mesmo nome do menu (na enfermagem, "Retirada sem farmacêutico") */}
      <TituloPagina icone={PackageOpen} titulo={farmacia ? 'Dispensação' : 'Retirada sem farmacêutico'}
        descricao={farmacia
          ? 'O que sai da farmácia para o paciente, em unidades de consumo. O sistema sugere a quantidade; quem dispensa define. Dispensar baixa o estoque.'
          : unidadeAtiva?.unidade.tipo === 'ubs'
            // percurso da UBS (U14, E6): a farmácia da UBS tem horário
            ? 'Fora do horário da farmácia, retire o medicamento do paciente sob seus cuidados. O farmacêutico confere depois.'
            : 'Com a farmácia fechada, retire o medicamento do paciente sob seus cuidados. O farmacêutico confere depois.'} />
      {abas.length > 1 && (
        <Tabs value={aba} onValueChange={(v) => setAba(v as Aba)} className="mb-[18px]">
          <TabsList aria-label="Dispensação">
            {abas.map(([k, r]) => <TabsTrigger key={k} value={k}>{r}</TabsTrigger>)}
          </TabsList>
        </Tabs>
      )}
      {unidade && aba === 'prescricoes' && <Prescricoes unidade={unidade} />}
      {unidade && aba === 'avulsa' && <Avulsa unidade={unidade} />}
      {unidade && aba === 'registro' && <Registro unidade={unidade} podeAgir={papelAtivo === 'farmaceutico'} />}
    </div>
  )
}

type LinhaFila = { item_id: string; paciente_id: string; local: string | null; ultima_situacao: string | null; validade: string | null }

function Prescricoes({ unidade }: { unidade: string }) {
  const { papelAtivo } = useUnidade()
  const enfermagem = papelAtivo === 'enfermeiro' || papelAtivo === 'tecnico_enfermagem'
  const tecnico = papelAtivo === 'tecnico_enfermagem'
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
  // RS1/RS2 (enfermagem): a mesma fila da Checagem dá a última checagem, a validade, o leito atual e o recorte da escala
  const fila = useQuery({
    queryKey: ['fila-checagem'],
    enabled: enfermagem,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('fila_checagem')
      if (error) throw error
      return (data ?? []) as unknown as LinhaFila[]
    },
  })
  const daFila = new Map((fila.data ?? []).map((l) => [l.item_id, l]))
  const pacientesDaEscala = new Set((fila.data ?? []).map((l) => l.paciente_id))
  const localDe = new Map((fila.data ?? []).map((l) => [l.paciente_id, l.local]))
  const itensTodos = (lista.data?.itens ?? [])
    // RS2: na enfermagem, só os pacientes da escala em curso (os da fila da Checagem)
    .filter((i) => !enfermagem || !fila.data || pacientesDaEscala.has(i.paciente_id))
    // RS2: o local atual (leito ou box) no lugar do setor de entrada, quando a enfermagem tem
    .map((i) => ({ ...i, setor: localDe.get(i.paciente_id) ?? i.setor }))
  const grupos = porPaciente(itensTodos)
  const [escolhido, setEscolhido] = React.useState<string | null>(null)
  const sel = grupos.find((g) => g.paciente_id === escolhido) ?? grupos[0]
  // RS1/FM1: a validade de cada item da prescrição vigente do paciente escolhido
  const vigente = useQuery({
    queryKey: ['prescricao-vigente-dispensa', sel?.paciente_id],
    enabled: !!sel,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('prescricao_vigente', { p_paciente: sel!.paciente_id })
      if (error) throw error
      return new Map((data ?? []).map((x) => [x.id, x.validade]))
    },
  })
  const situacao = (i: ItemParaDispensar) => situacaoParaDispensar(i, {
    validade: daFila.get(i.item_id)?.validade ?? vigente.data?.get(i.item_id) ?? null,
    ultimaSituacao: daFila.get(i.item_id)?.ultima_situacao ?? null,
  })
  const itensSel = (sel?.itens ?? []).filter((i) => situacao(i) !== 'dose_unica_feita')
  // TE5 (perfil Técnico, RT 24/11/2026): controlado (Portaria 344) e alta vigilância ficam com o enfermeiro
  const controlados = useControladosDoCatalogo()
  const ids = itensSel.map((i) => i.item_id)
  const liberacao = useQuery({
    queryKey: ['liberacao-farmacia', ids.join(',')],
    enabled: tecnico && ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('liberacao_farmacia', { p_itens: ids })
      if (error) throw error
      return new Map(((data ?? []) as unknown as Liberacao[]).map((e) => [e.item_id, e]))
    },
  })
  const soEnfermeiro = (i: ItemParaDispensar) => tecnico
    && (!!controlados.data?.get(i.medicamento_id) || (() => { const l = liberacao.data?.get(i.item_id); return !!l && l.alta_vigilancia !== false })())
  // RS3: o motivo da retirada, escolhido uma vez
  const [motivo, setMotivo] = React.useState('')
  const [complemento, setComplemento] = React.useState('')
  const justificativa = justificativaRetirada(motivo, complemento)
  const farmaceutico = !!lista.data?.farmaceutico
  const notas = notasUnicas(itensSel)
  const zerado = (i: ItemParaDispensar) => i.saldo_estoque != null && i.saldo_estoque <= 0
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-apoio text-tinta-sussurro">
          {grupos.length > 0
            ? `${grupos.length} ${grupos.length === 1 ? 'paciente' : 'pacientes'} com medicamento na prescrição vigente · a quantidade vem sugerida para as próximas 24 h`
            : 'Itens de medicamento das prescrições vigentes.'}
        </p>
        <Input className="h-8 w-64" aria-label="Buscar paciente ou medicamento" placeholder="Buscar paciente ou medicamento" value={termo} onChange={(e) => setTermo(e.target.value)} />
      </div>
      {!farmaceutico && !lista.isLoading && grupos.length > 0 && (
        <div className="flex flex-col gap-2 rounded-container border border-fio bg-superficie px-4 py-3">
          <span className="text-apoio font-medium text-tinta">Motivo da retirada</span>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Motivo da retirada">
            {MOTIVOS_RETIRADA.map((m) => <Chip key={m} ativo={motivo === m} onClick={() => setMotivo(motivo === m ? '' : m)}>{m}</Chip>)}
          </div>
          <Input className="h-8" aria-label="Complemento do motivo" placeholder="Complemento (opcional)" value={complemento} onChange={(e) => setComplemento(e.target.value)} />
          {tecnico && <span className="text-apoio text-tinta-sussurro">Controlados e alta vigilância: retirada pelo enfermeiro.</span>}
        </div>
      )}
      <MensagemErro texto={lista.error ? (lista.error as Error).message : null} />
      {lista.isLoading ? <Spinner /> : !sel ? (
        <Vazio icone={PackageOpen} titulo="Nenhum medicamento prescrito"
          texto={enfermagem ? 'Itens de medicamento das prescrições vigentes dos pacientes da sua escala aparecem aqui.' : 'Itens de medicamento das prescrições vigentes aparecem aqui.'} />
      ) : (
        <div className="grid overflow-hidden rounded-cartao border border-fio bg-superficie md:grid-cols-[280px_minmax(0,1fr)]">
          <ul aria-label="Pacientes com itens a dispensar" className="border-b border-fio md:border-r md:border-b-0">
            {grupos.map((g) => (
              <li key={g.paciente_id}>
                <BotaoLinha variante="linha" aria-current={g.paciente_id === sel.paciente_id ? 'true' : undefined} onClick={() => setEscolhido(g.paciente_id)}
                  className={cn('flex-col gap-0.5 px-4', g.paciente_id === sel.paciente_id && 'bg-alerta-marca')}>
                  <span className="text-apoio font-semibold text-tinta">{g.paciente}</span>
                  <span className="text-rotulo text-tinta-sussurro">{[g.setor, g.prontuario ? `pront. ${g.prontuario}` : null].filter(Boolean).join(' · ') || '—'}</span>
                  <span className="flex flex-wrap gap-x-2 text-rotulo empty:hidden">
                    {g.itens.some((i) => i.validacao === 'devolvido') ? <span className="font-semibold text-critico">devolvido para correção</span>
                      : g.itens.some(zerado) ? <span className="font-semibold text-atencao">estoque zerado</span> : null}
                  </span>
                </BotaoLinha>
              </li>
            ))}
          </ul>
          <section aria-label={`Itens de ${sel.paciente}`} className="flex min-w-0 flex-col">
            <div className="border-b border-fio px-5 py-3.5">
              <h3 className="text-corpo font-semibold text-tinta">{sel.paciente}</h3>
              <p className="text-apoio text-tinta-sussurro">{[sel.setor, sel.prontuario ? `prontuário ${sel.prontuario}` : null].filter(Boolean).join(' · ') || '—'}</p>
            </div>
            {/* RS3: a nota da comparação de dose uma vez, no topo; no item, só o ícone */}
            {notas.length > 0 && (
              <div role="note" className="flex items-start gap-2 border-b border-trilha bg-alerta-atencao px-5 py-2.5 text-apoio text-atencao">
                <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span className="flex flex-col gap-0.5">{notas.map((n) => <span key={n}>{n}</span>)}</span>
              </div>
            )}
            {itensSel.length === 0 && <p className="px-5 py-4 text-apoio text-tinta-sussurro">Nada a dispensar para este paciente agora.</p>}
            {itensSel.map((i) => (
              <LinhaItem key={i.item_id} i={i} farmaceutico={farmaceutico} vencido={situacao(i) === 'vencido'}
                soEnfermeiro={soEnfermeiro(i)} justificativa={justificativa} />
            ))}
          </section>
        </div>
      )}
    </div>
  )
}

function LinhaItem({ i, farmaceutico, vencido, soEnfermeiro, justificativa }: {
  i: ItemParaDispensar; farmaceutico: boolean; vencido: boolean
  /** TE5: no perfil Técnico, controlado e alta vigilância não se retiram */
  soEnfermeiro: boolean
  /** RS3: o motivo escolhido no topo */
  justificativa: string
}) {
  const qc = useQueryClient()
  const [qtd, setQtd] = React.useState(i.sugestao.quantidade != null ? String(i.sugestao.quantidade) : '')
  const [aviso, setAviso] = React.useState<string | null>(null)
  const unidade = rotuloUnidade(i.unidade_consumo, i.unidade_consumo_outra).toLowerCase()
  const dispensar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('dispensar_item', { p_item: i.item_id, p_quantidade: Number(qtd), p_justificativa: farmaceutico ? undefined : justificativa })
      if (error) throw error
      return data as unknown as { saldo: number; estoque_negativo: boolean }
    },
    onSuccess: (r) => {
      setAviso(r.estoque_negativo ? `Dispensado. Saldo do estoque ficou ${r.saldo}: confira o saldo da farmácia.` : `Dispensado. Saldo: ${r.saldo}.`)
      for (const k of ['itens-para-dispensar', 'dispensacoes']) void qc.invalidateQueries({ queryKey: [k] })
    },
  })
  const pronto = Number(qtd) >= 1 && (farmaceutico || justificativa.trim().length >= MINIMO)
  const zerado = i.saldo_estoque != null && i.saldo_estoque <= 0
  const podeAgir = !vencido && !soEnfermeiro
  return (
    <div className="flex flex-col gap-2 border-b border-trilha px-5 py-3 text-apoio last:border-b-0">
      <div className="flex flex-wrap items-start gap-x-5 gap-y-2">
        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-1">
          <span className="flex flex-wrap items-baseline gap-2">
            <span className="font-semibold text-tinta">{i.medicamento}</span>
            <SeloDoMedicamento id={i.medicamento_id} />
            {i.validacao === 'confere' && <Estado tom="verde">validado</Estado>}
            {i.validacao === 'devolvido' && <Estado tom="vermelho">devolvido para correção</Estado>}
            {i.sugestao.notas.length > 0 && <span title={i.sugestao.notas.join(' ')} className="text-atencao"><Info className="size-3.5" aria-label="Conferir a dose (nota no topo)" /></span>}
          </span>
          <span className="text-tinta">{[i.dose, i.via, i.posologia].filter(Boolean).join(' · ')}{i.se_necessario ? ' · se necessário' : ''}</span>
          <span className="text-rotulo text-tinta-sussurro">
            Sugestão {i.sugestao.quantidade != null ? `${i.sugestao.quantidade} ${unidade}` : 'sem sugestão'}{i.sugestao.explicacao ? ` (${i.sugestao.explicacao})` : ''}
            {' · '}nas últimas 24 h {i.dispensado_24h}
            {i.saldo_estoque != null && <> · estoque <span className={cn(zerado && 'font-semibold text-critico')}>{i.saldo_estoque}</span></>}
          </span>
        </div>
        {vencido ? (
          // RS1: a mesma regra da Checagem; vencido não se administra nem se retira
          <Estado tom="vermelho">Vencido · peça renovação</Estado>
        ) : soEnfermeiro ? null : (
          <div className="flex items-center gap-2">
            <Input id={`qtd-${i.item_id}`} aria-label={`Quantidade de ${i.medicamento} (${unidade})`} className="h-8 w-20 tabular-nums" inputMode="numeric" value={qtd} onChange={(e) => setQtd(e.target.value.replace(/\D/g, ''))} />
            <span className="text-rotulo text-tinta-sussurro">{unidade}</span>
            <Button size="sm" disabled={!pronto || dispensar.isPending} title={!farmaceutico && !pronto ? 'Escolha o motivo da retirada no topo' : undefined}
              onClick={() => dispensar.mutate()}>{farmaceutico ? 'Dispensar' : 'Retirar'}</Button>
          </div>
        )}
      </div>
      {podeAgir && dispensar.error && <p role="alert" className="text-critico">{(dispensar.error as Error).message}</p>}
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
  const buscaAdiada = useValorAdiado(busca)
  const resultados = useQuery({
    queryKey: ['busca-medicamento-avulsa', buscaAdiada, unidade],
    enabled: buscaAdiada.trim().length >= 3 && !med,
    queryFn: async () => {
      const { data, error } = await supabase.from('medicamento').select('id, principio_ativo, apresentacao, unidade_consumo, unidade_consumo_outra')
        .eq('ativo', true).or(filtroDaUnidade(unidade)).ilike('principio_ativo_norm', `%${normalizarMedicamento(buscaAdiada.trim())}%`).order('principio_ativo').limit(15)
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
        <div className="flex items-center justify-between rounded-controle border border-fio px-3 py-2">
          <span><span className="font-medium text-tinta">{med.principio_ativo}</span> {med.apresentacao ?? ''} · {rotuloUnidade(med.unidade_consumo, med.unidade_consumo_outra)}</span>
          <Button size="xs" variant="outline" onClick={() => setMed(null)}>Trocar</Button>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <Input aria-label="Medicamento" placeholder="Medicamento do cadastro (3 letras ou mais)" value={busca} onChange={(e) => setBusca(e.target.value)} />
          {(resultados.data ?? []).map((m) => (
            <BotaoLinha key={m.id} variante="linha" onClick={() => setMed(m)} className="gap-2 border-fio px-2 py-1 text-rotulo hover:bg-trilha">
              <span className="font-medium">{m.principio_ativo}</span><span className="text-tinta-apoio">{m.apresentacao}</span>
            </BotaoLinha>
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
  // ponto 5 (RT, 27/10/2026): o Registro olha mais que 72 h
  const [horas, setHoras] = React.useState<number>(72)
  const lista = useQuery({
    queryKey: ['dispensacoes', unidade, horas],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('dispensacoes_da_unidade', { p_unidade: unidade, p_horas: horas })
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
        <div role="alert" className="rounded-controle border border-atencao/30 bg-alerta-atencao px-3 py-2">
          <span className="font-medium text-tinta">Saldo negativo: confira o estoque destes medicamentos.</span>
          <ul className="list-disc pl-5 text-tinta-apoio">{d!.estoque_negativo.map((e) => <li key={e.medicamento}>{e.medicamento}: {e.saldo}</li>)}</ul>
        </div>
      )}
      <TituloSecao extra={d && d.a_conferir > 0 ? `${d.a_conferir} retirada(s) sem farmacêutico a conferir` : `últimas ${PERIODOS_REGISTRO.find(([h]) => h === horas)?.[1] ?? `${horas} h`}`}>Dispensações</TituloSecao>
      <Chips rotulo="Período">
        {PERIODOS_REGISTRO.map(([h, rotulo]) => <Chip key={h} ativo={horas === h} onClick={() => setHoras(h)}>{rotulo}</Chip>)}
      </Chips>
      {lista.isLoading ? <Spinner /> : (d?.dispensacoes ?? []).length === 0 ? <p className="text-tinta-sussurro">Nenhuma dispensação nas últimas {PERIODOS_REGISTRO.find(([h]) => h === horas)?.[1] ?? `${horas} h`}.</p> : (
        <div className="overflow-x-auto rounded-container border border-fio bg-superficie">
          <Table className="min-w-[640px] text-apoio">
            <TableHeader className="bg-transparent">
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-3 py-2 text-rotulo font-medium tracking-normal normal-case">Medicamento</TableHead>
                <TableHead className="px-3 py-2 text-rotulo font-medium tracking-normal normal-case">Para</TableHead>
                <TableHead className="px-3 py-2 text-rotulo font-medium tracking-normal normal-case">Qtd.</TableHead>
                <TableHead className="px-3 py-2 text-rotulo font-medium tracking-normal normal-case">Quem, quando</TableHead>
                <TableHead className="px-3 py-2" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {d!.dispensacoes.map((x) => (
                <TableRow key={x.id} className="align-top hover:bg-transparent">
                  <TableCell className="px-3 py-2 align-top whitespace-normal">{x.medicamento}</TableCell>
                  <TableCell className="px-3 py-2 align-top whitespace-normal">{x.paciente ?? `Avulsa: ${x.destino}`}{x.motivo ? <span className="block text-rotulo text-tinta-sussurro">"{x.motivo}"</span> : null}</TableCell>
                  <TableCell className="px-3 py-2 align-top whitespace-normal">{x.quantidade}{x.devolvido > 0 ? ` (voltou ${x.devolvido})` : ''} {rotuloUnidade(x.unidade_consumo).toLowerCase()}</TableCell>
                  <TableCell className="px-3 py-2 align-top whitespace-normal">
                    {x.dispensada_por ?? '—'}, {fmtDataHora(x.dispensada_em)}
                    {x.sem_farmaceutico && (
                      <span className="block text-rotulo">
                        {x.conferida_em ? <span className="text-conforme">sem farmacêutico · conferida por {x.conferida_por}</span> : <Estado tom="ambar">sem farmacêutico · a conferir</Estado>}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-right align-top whitespace-normal">
                    {podeAgir && x.sem_farmaceutico && !x.conferida_em && <Button size="xs" onClick={() => conferir.mutate(x.id)}>Conferir</Button>}
                    {podeAgir && x.quantidade - x.devolvido > 0 && (
                      <Button size="xs" variant="ghost" onClick={() => { setDevolvendo(x); setQtd('1'); setMotivo('') }}>Devolução</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {devolvendo && (
        <div className="flex flex-col gap-2 rounded-controle border border-fio p-3">
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
