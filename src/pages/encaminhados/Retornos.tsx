// Retornos à UBS (5A, tarefa 6, parte 6.2; decisões I2 e I4 do RT em
// 03/11/2026): o paciente da unidade que teve alta, evasão, transferência ou
// óbito numa UPA ou num hospital da rede. A lista é de todos da UBS; o resumo
// clínico só abre para o médico, o enfermeiro e o gestor, fica registrado no
// acesso ao prontuário da unidade de origem e marca "visto". "Agendar retorno"
// leva à agenda da UBS com o paciente.
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarPlus, CornerDownLeft, FileText, TriangleAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import * as React from 'react'

import { TituloSecao, Vazio } from '@/components/monitor/Pagina'
import { Estado } from '@/components/porta/Estado'
import { BotaoLinha } from '@/components/ui/botao-linha'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useUnidade } from '@/contexts/UnidadeContext'
import { linkMarcarNaAgenda } from '@/domain/agenda'
import { DESFECHO_RETORNO, SITUACAO_RETORNO, nomeDoRetorno, pedeBuscaAtiva, type Retorno } from '@/domain/encaminhamento'
import { rotuloIdade } from '@/domain/idade'
import { dataIso, diaMesHora } from '@/lib/formato'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

import { useRetornos } from './useRetornos'

const msg = (e: unknown) => (e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e))
const DOCUMENTO: Record<string, string> = {
  receita: 'Receita', atestado: 'Atestado', encaminhamento: 'Encaminhamento', pedido_exames: 'Pedido de exames', sumario_alta: 'Sumário de alta',
}

export function Retornos({ unidadeId }: { unidadeId: string | undefined }) {
  const lista = useRetornos(unidadeId)
  const { papeisDaUnidade } = useUnidade()
  const veResumo = (['plantonista', 'enfermeiro', 'gestor'] as const).some((p) => papeisDaUnidade.includes(p))
  const [sel, setSel] = React.useState<string | null>(null)
  const itens = lista.data ?? []
  const escolhido = itens.find((r) => r.id === sel) ?? itens[0]

  if (lista.isLoading) return <Spinner />
  if (lista.error) return <p className="text-apoio text-critico">{msg(lista.error)}</p>
  if (itens.length === 0) {
    return <Vazio icone={CornerDownLeft} titulo="Nenhum retorno" texto="Quando um paciente da unidade tem alta, evasão, transferência ou óbito numa UPA ou num hospital da rede, o retorno aparece aqui." />
  }
  return (
    <div className="grid items-start overflow-hidden rounded-cartao border border-fio bg-superficie md:grid-cols-[minmax(0,340px)_1fr]">
      <ul aria-label="Retornos" className="max-h-[70vh] overflow-y-auto border-b border-fio md:border-r md:border-b-0">
        {itens.map((r) => {
          const ativo = escolhido?.id === r.id
          return (
            <li key={r.id}>
              <BotaoLinha variante="linha" aria-current={ativo || undefined} onClick={() => setSel(r.id)}
                className={cn('flex-col gap-0.5', ativo && 'bg-alerta-marca')}>
                <span className="flex w-full items-center justify-between gap-2">
                  <strong className="truncate text-controle text-tinta">{nomeDoRetorno(r)}</strong>
                  <Estado tom={SITUACAO_RETORNO[r.situacao].tom}>{SITUACAO_RETORNO[r.situacao].rotulo}</Estado>
                </span>
                <span className="text-rotulo text-tinta-sussurro">
                  {DESFECHO_RETORNO[r.desfecho] ?? r.desfecho} · {r.unidade_origem} · {diaMesHora(r.saida_em)}
                </span>
              </BotaoLinha>
            </li>
          )
        })}
      </ul>
      {/* ao abrir, o escolhido fica fixo: a lista volta com os "a ver" na frente */}
      {escolhido && <DetalheRetorno key={escolhido.id} r={escolhido} veResumo={veResumo} onAberto={() => setSel(escolhido.id)} />}
    </div>
  )
}

function DetalheRetorno({ r, veResumo, onAberto }: { r: Retorno; veResumo: boolean; onAberto: () => void }) {
  const qc = useQueryClient()
  const abrir = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('contrarreferencia_abrir', { p_id: r.id })
      if (error) throw error
      return data as unknown as Retorno
    },
    onSuccess: () => { onAberto(); void qc.invalidateQueries({ queryKey: ['contrarreferencias'] }) },
  })
  const aberto = abrir.data
  const p = r.paciente
  return (
    <section aria-label="Retorno do paciente" className="flex flex-col gap-3 px-5 py-4">
      <span className="rotulo flex items-center gap-1.5 text-tinta-sussurro"><CornerDownLeft className="size-3.5" aria-hidden /> Retorno nº {r.numero}</span>
      <TituloSecao className="mb-0" extra={p.data_nascimento ? rotuloIdade(p.data_nascimento, dataIso()) : undefined}>{nomeDoRetorno(r)}</TituloSecao>
      <p className="text-controle text-tinta-apoio">
        {DESFECHO_RETORNO[r.desfecho] ?? r.desfecho} na {r.unidade_origem} · <span className="text-tinta-sussurro">{diaMesHora(r.saida_em)}</span>
        {r.encaminhamento_numero ? <span className="text-tinta-sussurro"> · enviado pela unidade (envio nº {r.encaminhamento_numero})</span> : null}
      </p>
      {pedeBuscaAtiva(r.desfecho) && (
        <p role="note" className="flex items-center gap-2 rounded-controle border border-atencao/30 bg-alerta-atencao px-3 py-2 text-apoio text-tinta">
          <TriangleAlert className="size-4 shrink-0 text-atencao" aria-hidden /> Saiu sem completar o atendimento: considere a busca ativa.
        </p>
      )}
      {aberto ? <ResumoRetorno r={aberto} /> : veResumo ? (
        <div className="flex flex-col gap-1">
          <div><Button size="sm" disabled={abrir.isPending} onClick={() => abrir.mutate()}><FileText /> Ver o resumo{r.tem_orientacao ? ' e a orientação' : ''}</Button></div>
          <span className="text-rotulo text-tinta-sussurro">Abrir fica registrado no acesso ao prontuário da {r.unidade_origem}.</span>
          {abrir.error && <p role="alert" className="text-apoio text-critico">{msg(abrir.error)}</p>}
        </div>
      ) : (
        <p className="text-apoio text-tinta-sussurro">O resumo clínico é visto pelo médico, pelo enfermeiro e pelo gestor da unidade.</p>
      )}
      {r.situacao === 'visto' && r.visto_em && (
        <span className="text-rotulo text-tinta-sussurro">Visto{r.visto_por ? ` por ${r.visto_por}` : ''} em {diaMesHora(r.visto_em)}</span>
      )}
      <div>
        <Button size="sm" variant="outline" render={<Link to={linkMarcarNaAgenda(r.paciente_ubs_id, null, 'consulta_programada')} />}>
          <CalendarPlus /> Agendar retorno
        </Button>
      </div>
    </section>
  )
}

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <span className="rotulo text-tinta-sussurro">{rotulo}</span>
      <span className="text-apoio text-tinta">{children}</span>
    </div>
  )
}

function ResumoRetorno({ r }: { r: Retorno }) {
  const s = r.resumo
  if (!s) return null
  const ret = s.pacote_alta?.retorno_detalhes
  return (
    <div className="flex flex-col gap-3">
      {r.orientacao && (
        <div className="rounded-container border border-acao/30 bg-alerta-marca px-3.5 py-2.5">
          <span className="rotulo text-acao">Orientação à UBS</span>
          <p className="text-controle text-tinta">{r.orientacao}</p>
        </div>
      )}
      <div className="grid gap-3 rounded-container border border-fio px-3.5 py-2.5 sm:grid-cols-2">
        <Linha rotulo="Entrada">{s.entrada_em ? diaMesHora(s.entrada_em) : '—'}</Linha>
        <Linha rotulo="Saída">{diaMesHora(s.saida_em)}</Linha>
        <Linha rotulo="Diagnóstico de alta">{s.cid ? `${s.cid}${s.cid_descricao ? ` · ${s.cid_descricao}` : ''}` : '—'}</Linha>
        <Linha rotulo="Médico">{s.medico ?? '—'}</Linha>
        {s.destino && <Linha rotulo="Destino">{s.destino}</Linha>}
        {s.relato && <Linha rotulo="Relato">{s.relato}</Linha>}
      </div>
      {s.registro && (s.registro.avaliacao || s.registro.plano) && (
        <div className="rounded-container border border-fio px-3.5 py-2.5 text-apoio text-tinta-apoio">
          <span className="rotulo text-tinta-sussurro">Último registro do atendimento</span>
          {s.registro.avaliacao && <p><strong className="text-tinta">A</strong> {s.registro.avaliacao}</p>}
          {s.registro.plano && <p><strong className="text-tinta">P</strong> {s.registro.plano}</p>}
        </div>
      )}
      {(ret || s.pacote_alta?.retorno) && (
        <div className="rounded-container border border-fio px-3.5 py-2.5 text-apoio text-tinta-apoio">
          <span className="rotulo text-tinta-sussurro">Retorno pedido na alta</span>
          {ret?.onde && <p>Onde: {ret.onde}</p>}
          {ret?.quando && <p>Quando: {ret.quando}</p>}
          {ret?.exame_controle && <p>Exame de controle: {ret.exame_controle}</p>}
          {!ret && s.pacote_alta?.retorno && <p>{s.pacote_alta.retorno}</p>}
        </div>
      )}
      {s.documentos.length > 0 && (
        <p className="text-apoio text-tinta-apoio">
          <span className="rotulo text-tinta-sussurro">Documentos emitidos: </span>
          {s.documentos.map((d) => DOCUMENTO[d.tipo] ?? d.tipo.replace(/_/g, ' ')).join(', ')}
        </p>
      )}
    </div>
  )
}
