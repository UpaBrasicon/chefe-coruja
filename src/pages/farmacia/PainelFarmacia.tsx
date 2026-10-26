import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2 } from 'lucide-react'
import * as React from 'react'
import { useNavigate } from 'react-router-dom'

import { Vazio } from '@/components/monitor/Pagina'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { MensagemErro } from '@/components/ui/mensagem-erro'
import { numero, tempoDecorrido } from '@/lib/formato'
import { supabase } from '@/lib/supabase'
import { Estado } from '@/components/porta/Estado'
import { SeloAltaVigilancia } from '@/components/farmacia/SeloAltaVigilancia'

// Painel da farmácia (Fase 2, tarefa 9; migration 20261031000008). Junta o
// que é crítico: faltas abertas priorizadas (alta vigilância, pacientes
// afetados, setores), estoque crítico, validação pendente de alta vigilância
// e administradas sem liberação da farmácia. A farmácia dá retorno em cada falta; o plantão
// vê o retorno ao escolher o medicamento na prescrição.
//
// Revisão visual 3.7b (opção C do RT, 26/10/2026): uma fila só do que pede o
// farmacêutico, em ordem: administradas sem liberação, validação de alta
// vigilância, faltas sem retorno ao plantão e estoque crítico sem falta
// registrada. Cada linha diz o tipo, o quê, de quem, há quanto e a ação; o que
// já está encaminhado fica numa linha embaixo. O gestor vê a mesma fila sem as ações.

export type FaltaPriorizada = {
  id: string; medicamento_id: string; principio_ativo: string; apresentacao: string | null; situacao: string
  observacao: string | null; sinalizada_em: string; sinalizada_por: string | null; alta_vigilancia: boolean
  pacientes: number; setores: string[]; retorno: { texto: string; por: string | null; em: string } | null
}
type SemLiberacao = {
  id: string; item_id: string; paciente: string; local: string | null; descricao: string; dose: string | null; via: string | null
  justificativa: string | null; administrado_por: string | null; administrado_em: string
}
type ItemValidacao = {
  item_id: string; paciente_nome: string; local: string | null; descricao: string; dose: string | null; via: string | null
  alta_vigilancia: boolean; prescrito_por: string | null; prescrito_em: string; ultima_situacao: string | null
}
const SIT: Record<string, string> = { registrada: 'Registrada', em_cotacao: 'Em cotação', reposta: 'Reposta' }
const juntar = (...partes: (string | null | undefined | false)[]) => partes.filter(Boolean).join(' · ')
const nome = (...partes: (string | null | undefined)[]) => partes.filter(Boolean).join(' ')

export function PainelFarmacia({ unidade, podeAgir, irPara }: {
  unidade: string; podeAgir: boolean; irPara?: (aba: 'faltas' | 'validacao' | 'disponibilidade') => void
}) {
  const qc = useQueryClient()
  const navegar = useNavigate()
  const [erro, setErro] = React.useState<string | null>(null)
  // "há quanto" anda a cada minuto
  const [agora, setAgora] = React.useState(() => Date.now())
  React.useEffect(() => {
    const t = window.setInterval(() => setAgora(Date.now()), 60_000)
    return () => window.clearInterval(t)
  }, [])

  const faltas = useQuery({
    queryKey: ['faltas-priorizadas', unidade],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('faltas_priorizadas', { p_unidade: unidade })
      if (error) throw error
      return (data ?? []) as unknown as FaltaPriorizada[]
    },
  })
  // as chaves 'farmacia-estoque', 'fila-validacao' e 'sem-liberacao' são as
  // mesmas da Disponibilidade, da Validação e da tela Alta vigilância: o cache
  // guarda a lista inteira e o painel só filtra na leitura
  const estoque = useQuery({
    queryKey: ['farmacia-estoque', unidade],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('farmacia_estoque', { p_unidade: unidade })
      if (error) throw error
      return data ?? []
    },
  })
  const validacao = useQuery({
    queryKey: ['fila-validacao', unidade],
    enabled: podeAgir,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('fila_validacao', { p_unidade: unidade })
      if (error) throw error
      return (data ?? []) as ItemValidacao[]
    },
    select: (lista) => lista.filter((i) => i.alta_vigilancia && !i.ultima_situacao)
      .sort((a, b) => a.prescrito_em.localeCompare(b.prescrito_em)),
  })
  // alta vigilância administrada sem a liberação da farmácia (decisão do RT de 09/10/2026)
  const semLiberacao = useQuery({
    queryKey: ['sem-liberacao', unidade],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('administracoes_sem_liberacao', { p_unidade: unidade })
      if (error) throw error
      return (data ?? []) as unknown as SemLiberacao[]
    },
    select: (lista) => (Array.isArray(lista) ? lista : []),
  })

  async function chamar(p: PromiseLike<{ error: { message: string } | null }>) {
    const { error } = await p
    if (error) { setErro(error.message); return false }
    setErro(null)
    for (const k of ['faltas-priorizadas', 'faltas', 'farmacia-estoque']) void qc.invalidateQueries({ queryKey: [k, unidade] })
    return true
  }

  const listaFaltas = faltas.data ?? []
  const semRetorno = listaFaltas.filter((f) => !f.retorno)
  const comRetorno = listaFaltas.filter((f) => f.retorno)
  const listaEstoque = estoque.data ?? []
  const comFalta = new Set(listaFaltas.map((f) => f.medicamento_id))
  const estoqueSemFalta = listaEstoque
    .filter((e) => (e.situacao === 'falta' || e.situacao === 'critico') && !e.falta_id && !comFalta.has(e.medicamento_id))
    .sort((a, b) => Number(b.situacao === 'falta') - Number(a.situacao === 'falta') || Number(b.alta_vigilancia) - Number(a.alta_vigilancia))
  const semContagem = listaEstoque.filter((e) => e.situacao === 'nao_informado').length
  const listaSemLib = semLiberacao.data ?? []
  const listaValidacao = validacao.data ?? []
  const total = listaSemLib.length + listaValidacao.length + semRetorno.length + estoqueSemFalta.length
  const falha = faltas.error ?? estoque.error ?? validacao.error ?? semLiberacao.error

  if (faltas.isLoading || estoque.isLoading) return <Spinner />

  const fora = [
    comRetorno.length > 0 && `${comRetorno.length} ${comRetorno.length === 1 ? 'falta já com retorno' : 'faltas já com retorno'} ao plantão (${comRetorno.map((f) => f.principio_ativo).join(', ')})`,
    semContagem > 0 && `${semContagem} ${semContagem === 1 ? 'item' : 'itens'} sem contagem`,
  ].filter(Boolean)

  return (
    <div className="flex flex-col gap-3">
      <MensagemErro texto={erro ?? (falha ? (falha as Error).message : null)} />
      {total === 0 ? (
        <Vazio icone={CheckCircle2} titulo={podeAgir ? 'Nada pede você agora' : 'Nada pede a farmácia agora'}
          texto="Sem administração sem liberação, sem validação de alta vigilância pendente, sem falta sem retorno e sem estoque crítico sem falta registrada." />
      ) : (
        <>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className="text-corpo font-semibold text-tinta">
              {podeAgir ? 'Pede você agora' : 'Pede a farmácia agora'} <span className="text-critico tabular-nums">{total}</span>
            </h3>
            <span className="text-rotulo text-tinta-sussurro">sem liberação, depois validação de alta vigilância, depois faltas sem retorno, depois estoque</span>
          </div>
          <ul className="overflow-hidden rounded-cartao border border-fio bg-superficie">
            {listaSemLib.map((s) => (
              <Linha key={`l${s.id}`} tipo="Sem liberação" tom="vermelho" av desde={s.administrado_em} agora={agora}
                titulo={nome(s.descricao, s.dose, s.via)}
                contexto={juntar(s.paciente, s.local, s.administrado_por && `administrado por ${s.administrado_por}`, s.justificativa && `“${s.justificativa}”`)}
                acao={<Button size="xs" variant="outline" onClick={() => navegar('/alta-vigilancia')}>Ver</Button>} />
            ))}
            {listaValidacao.map((v) => (
              <Linha key={`v${v.item_id}`} tipo="Validação" tom="vermelho" av desde={v.prescrito_em} agora={agora}
                titulo={nome(v.descricao, v.dose, v.via)}
                contexto={juntar(v.paciente_nome, v.local, v.prescrito_por)}
                acao={irPara && <Button size="xs" onClick={() => irPara('validacao')}>Validar</Button>} />
            ))}
            {semRetorno.map((f) => <LinhaFalta key={`f${f.id}`} f={f} agora={agora} podeAgir={podeAgir} chamar={chamar} />)}
            {estoqueSemFalta.map((e) => (
              <Linha key={`e${e.medicamento_id}`} tipo="Estoque" tom={e.situacao === 'falta' ? 'vermelho' : 'ambar'} av={e.alta_vigilancia}
                desde={e.atualizado_em} agora={agora} titulo={nome(e.principio_ativo, e.apresentacao)}
                contexto={juntar(`${e.situacao === 'falta' ? 'Em falta' : 'Crítico'}: ${e.quantidade == null ? '—' : numero(e.quantidade)} na unidade`, 'sem falta registrada')}
                acao={podeAgir && (
                  <Button size="xs" variant="outline"
                    onClick={() => void chamar(supabase.rpc('sinalizar_falta', { p_unidade: unidade, p_medicamento: e.medicamento_id, p_observacao: `Saldo ${e.quantidade == null ? '—' : numero(e.quantidade)} na farmácia` }))}>
                    Sinalizar falta
                  </Button>
                )} />
            ))}
          </ul>
        </>
      )}
      {fora.length > 0 && <p className="text-rotulo text-tinta-sussurro">Fora da fila: {fora.join(' · ')}.</p>}
    </div>
  )
}

/** Uma linha da fila: tipo, o quê, de quem, há quanto e a ação (só para quem age). */
function Linha({ tipo, tom, av, titulo, contexto, desde, agora, acao, children }: {
  tipo: string; tom: 'vermelho' | 'ambar'; av?: boolean; titulo: string; contexto: string
  desde: string | null; agora: number; acao?: React.ReactNode; children?: React.ReactNode
}) {
  return (
    <li className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-trilha px-5 py-2.5 text-apoio last:border-b-0">
      <span className="w-28"><Estado tom={tom}>{tipo}</Estado></span>
      <span className="flex min-w-0 flex-[1_1_300px] flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-2 font-medium text-tinta">{titulo}{av && <SeloAltaVigilancia curto />}</span>
        <span className="text-rotulo text-tinta-sussurro">{contexto}</span>
      </span>
      <span className="w-20 text-tinta-apoio tabular-nums">{desde ? tempoDecorrido(desde, agora) : '—'}</span>
      {acao && <span className="flex w-40 justify-end">{acao}</span>}
      {children}
    </li>
  )
}

/** Falta sem retorno: "Responder ao plantão" abre o campo na própria linha. */
function LinhaFalta({ f, agora, podeAgir, chamar }: {
  f: FaltaPriorizada; agora: number; podeAgir: boolean
  chamar: (p: PromiseLike<{ error: { message: string } | null }>) => Promise<boolean>
}) {
  const [aberto, setAberto] = React.useState(false)
  const [texto, setTexto] = React.useState('')
  const pacientes = f.pacientes > 0 ? `${f.pacientes} ${f.pacientes === 1 ? 'paciente' : 'pacientes'}${f.setores.length ? ` (${f.setores.join(', ')})` : ''}` : 'sem paciente com prescrição'
  return (
    <Linha tipo="Falta" tom={f.situacao === 'em_cotacao' ? 'ambar' : 'vermelho'} av={f.alta_vigilancia} desde={f.sinalizada_em} agora={agora}
      titulo={nome(f.principio_ativo, f.apresentacao)}
      contexto={juntar(SIT[f.situacao] ?? f.situacao, pacientes, f.observacao, 'plantão sem retorno')}
      acao={podeAgir && !aberto && <Button size="xs" variant="outline" onClick={() => setAberto(true)}>Responder ao plantão</Button>}>
      {aberto && (
        <div className="flex w-full flex-wrap items-center gap-2 pb-1">
          <Input className="h-8 min-w-56 flex-1" placeholder="Retorno ao plantão: substituto, previsão ou conduta" value={texto} onChange={(e) => setTexto(e.target.value)} autoFocus />
          <Button size="xs" disabled={texto.trim().length < 5}
            onClick={() => void chamar(supabase.rpc('registrar_retorno_falta', { p_falta: f.id, p_texto: texto.trim() })).then((ok) => { if (ok) { setTexto(''); setAberto(false) } })}>
            Enviar retorno
          </Button>
          <Button size="xs" variant="ghost" onClick={() => setAberto(false)}>Cancelar</Button>
        </div>
      )}
    </Linha>
  )
}
