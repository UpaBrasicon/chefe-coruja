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
import { SeloControlado } from '@/components/farmacia/SeloControlado'
import { useControladosDoCatalogo, useControleDosItens } from '@/hooks/useControlados'
import type { Controle } from '@/domain/controlados'
import { separarVencidos } from '@/lib/filaValidacao'
import { usePrescricoesVigentes, type ItemVigente } from '@/hooks/usePrescricoesVigentes'
import { usePacientesDasFaltas } from '@/hooks/useContextoPacienteFarmacia'
import { ordenarQuemFicaSem, textoProximoHorario, type HorarioFalta } from '@/lib/contextoPacienteFarmacia'

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
//
// Lacuna 3 (Portaria 344, decisão do RT de 10/11/2026, C5 e C6): o controlado
// entra na fila como a alta vigilância (sem liberação e validação), com o
// selo "Controlado · B1"; o saldo pode ficar negativo, e o controlado com saldo
// negativo abre a parte do estoque, em vermelho, para a farmácia conferir.

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
  validade?: string | null
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

  // controlado: a lista de cada item (fila e sem liberação) e os itens do catálogo
  const idsItens = [...(validacao.data ?? []).filter((i) => !i.ultima_situacao).map((i) => i.item_id), ...(semLiberacao.data ?? []).map((s) => s.item_id)]
  const controles = useControleDosItens(idsItens).data
  const controladosCatalogo = useControladosDoCatalogo().data
  // DI3: quem fica sem o medicamento em falta (só para quem age; o gestor não lê a dispensação)
  const vigentes = usePrescricoesVigentes(unidade, podeAgir)
  // DI3: leito e próximo horário de cada item em falta (pacientes_das_faltas)
  const horariosFalta = usePacientesDasFaltas(unidade, podeAgir).data ?? null
  const pacientesDaFalta = (medicamentoId: string) => (vigentes.data ? vigentes.data.itens.filter((i) => i.medicamento_id === medicamentoId) : null)

  const listaFaltas = faltas.data ?? []
  const semRetorno = listaFaltas.filter((f) => !f.retorno)
  const comRetorno = listaFaltas.filter((f) => f.retorno)
  const listaEstoque = estoque.data ?? []
  const comFalta = new Set(listaFaltas.map((f) => f.medicamento_id))
  // C6: controlado com saldo negativo, sempre na fila (mesmo com falta registrada)
  const controladoNegativo = listaEstoque.filter((e) => e.quantidade != null && e.quantidade < 0 && controladosCatalogo?.has(e.medicamento_id))
  const negativos = new Set(controladoNegativo.map((e) => e.medicamento_id))
  const estoqueSemFalta = listaEstoque
    .filter((e) => (e.situacao === 'falta' || e.situacao === 'critico') && !e.falta_id && !comFalta.has(e.medicamento_id) && !negativos.has(e.medicamento_id))
    .sort((a, b) => Number(b.situacao === 'falta') - Number(a.situacao === 'falta') || Number(b.alta_vigilancia) - Number(a.alta_vigilancia))
  const semContagem = listaEstoque.filter((e) => e.situacao === 'nao_informado').length
  const listaSemLib = semLiberacao.data ?? []
  // FA1: a validação entra numa linha só, com o mesmo número da aba, do menu e do
  // topo (contarFila: sem os itens de prescrição vencida)
  const aValidar = separarVencidos(validacao.data ?? []).aValidar
  const prioritarios = aValidar.filter((i) => i.alta_vigilancia || controles?.has(i.item_id))
  const maisAntigo = aValidar.reduce<string | null>((m, i) => (!m || i.prescrito_em < m ? i.prescrito_em : m), null)
  const pacientesValidacao = new Set(aValidar.map((i) => i.paciente_nome)).size
  const total = listaSemLib.length + (aValidar.length ? 1 : 0) + semRetorno.length + controladoNegativo.length + estoqueSemFalta.length
  const falha = faltas.error ?? estoque.error ?? validacao.error ?? semLiberacao.error

  if (faltas.isLoading || estoque.isLoading) return <Spinner />

  const semContagemTexto = semContagem > 0 && `${semContagem} ${semContagem === 1 ? 'item' : 'itens'} sem contagem`
  const fora = [
    comRetorno.length > 0 && `${comRetorno.length} ${comRetorno.length === 1 ? 'falta já com retorno' : 'faltas já com retorno'} ao plantão (${comRetorno.map((f) => f.principio_ativo).join(', ')})`,
  ].filter(Boolean)

  return (
    <div className="flex flex-col gap-3">
      <MensagemErro texto={erro ?? (falha ? (falha as Error).message : null)} />
      {total === 0 ? (
        <Vazio icone={CheckCircle2} titulo={podeAgir ? 'Nada pede você agora' : 'Nada pede a farmácia agora'}
          texto="Nenhuma administração sem liberação, nenhuma prescrição a validar, nenhuma falta sem retorno, nenhum controlado com saldo negativo e nenhum estoque crítico sem falta registrada." />
      ) : (
        <>
          {/* no farmacêutico, a aba já se chama "Pede você agora": fica só a ordem */}
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {!podeAgir && <h3 className="text-corpo font-semibold text-tinta">Pede a farmácia agora</h3>}
            <span className="text-rotulo text-tinta-sussurro">Sem liberação, depois validação, depois faltas sem retorno, depois estoque</span>
          </div>
          <ul className="overflow-hidden rounded-cartao border border-fio bg-superficie">
            {listaSemLib.map((s) => (
              <Linha key={`l${s.id}`} tipo="Sem liberação" tom="vermelho" av={!controles?.has(s.item_id)} controle={controles?.get(s.item_id)}
                desde={s.administrado_em} agora={agora}
                titulo={nome(s.descricao, s.dose, s.via)}
                contexto={juntar(s.paciente, s.local, s.administrado_por && `administrado por ${s.administrado_por}`, s.justificativa && `"${s.justificativa}"`)}
                acao={<Button size="xs" variant="outline" onClick={() => navegar('/alta-vigilancia')}>Ver</Button>} />
            ))}
            {aValidar.length > 0 && (
              <Linha key="validacao" tipo="Validação" tom={prioritarios.length ? 'vermelho' : 'ambar'}
                desde={maisAntigo} agora={agora}
                titulo={`${aValidar.length} ${aValidar.length === 1 ? 'item a validar' : 'itens a validar'} de ${pacientesValidacao} ${pacientesValidacao === 1 ? 'paciente' : 'pacientes'}`}
                contexto={prioritarios.length ? `${prioritarios.length} de alta vigilância ou controlado` : 'nenhum de alta vigilância ou controlado'}
                acao={irPara && <Button size="xs" onClick={() => irPara('validacao')}>Validar</Button>} />
            )}
            {semRetorno.map((f) => <LinhaFalta key={`f${f.id}`} f={f} agora={agora} podeAgir={podeAgir} chamar={chamar} pacientes={pacientesDaFalta(f.medicamento_id)} horarios={horariosFalta} />)}
            {controladoNegativo.map((e) => (
              <Linha key={`n${e.medicamento_id}`} tipo="Saldo negativo" tom="vermelho" av={e.alta_vigilancia} controle={controladosCatalogo?.get(e.medicamento_id)}
                desde={e.atualizado_em} agora={agora} titulo={nome(e.principio_ativo, e.apresentacao)}
                contexto={juntar(`Saldo ${numero(e.quantidade ?? 0)} na unidade`, 'medicamento controlado: confira o estoque e a dispensação')}
                acao={irPara && <Button size="xs" variant="outline" onClick={() => irPara('disponibilidade')}>Conferir</Button>} />
            ))}
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
      {(fora.length > 0 || semContagemTexto) && (
        <p className="text-rotulo text-tinta-sussurro">
          Fora da fila: {fora.join(' · ')}{fora.length > 0 && semContagemTexto ? ' · ' : ''}
          {/* FA1: os itens sem contagem levam à Disponibilidade */}
          {semContagemTexto && (irPara
            ? <Button variant="link" size="xs" className="h-auto min-h-0 px-0 text-rotulo" onClick={() => irPara('disponibilidade')}>{semContagemTexto}</Button>
            : semContagemTexto)}
        </p>
      )}
    </div>
  )
}

/** Uma linha da fila: tipo, o quê, de quem, há quanto e a ação (só para quem age). */
function Linha({ tipo, tom, av, controle, titulo, contexto, desde, agora, acao, children }: {
  tipo: string; tom: 'vermelho' | 'ambar'; av?: boolean; controle?: Controle; titulo: string; contexto: string
  desde: string | null; agora: number; acao?: React.ReactNode; children?: React.ReactNode
}) {
  return (
    <li className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-trilha px-5 py-2.5 text-apoio last:border-b-0">
      <span className="w-28"><Estado tom={tom}>{tipo}</Estado></span>
      <span className="flex min-w-0 flex-[1_1_300px] flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-2 font-medium text-tinta">{titulo}{av && <SeloAltaVigilancia curto />}{controle && <SeloControlado controle={controle} />}</span>
        <span className="text-rotulo text-tinta-sussurro">{contexto}</span>
      </span>
      <span className="w-20 text-tinta-apoio tabular-nums">{desde ? tempoDecorrido(desde, agora) : '—'}</span>
      {acao && <span className="ml-auto flex min-w-40 justify-end">{acao}</span>}
      {children}
    </li>
  )
}

/** Falta sem retorno, com quem fica sem o medicamento e as ações da falta. */
function LinhaFalta({ f, agora, podeAgir, chamar, pacientes, horarios }: {
  f: FaltaPriorizada; agora: number; podeAgir: boolean
  chamar: (p: PromiseLike<{ error: { message: string } | null }>) => Promise<boolean>
  pacientes: ItemVigente[] | null; horarios: HorarioFalta[] | null
}) {
  const [respondendo, setRespondendo] = React.useState(false)
  const contagem = f.pacientes > 0 ? `${f.pacientes} ${f.pacientes === 1 ? 'paciente' : 'pacientes'}${f.setores.length ? ` (${f.setores.join(', ')})` : ''}` : 'sem paciente com prescrição'
  return (
    <Linha tipo="Falta" tom={f.situacao === 'em_cotacao' ? 'ambar' : 'vermelho'} av={f.alta_vigilancia} desde={f.sinalizada_em} agora={agora}
      titulo={nome(f.principio_ativo, f.apresentacao)}
      contexto={juntar(SIT[f.situacao] ?? f.situacao, pacientes?.length ? null : contagem, f.observacao, 'plantão sem retorno')}
      acao={podeAgir && !respondendo && <AcoesFalta f={f} chamar={chamar} responder={() => setRespondendo(true)} />}>
      {pacientes && pacientes.length > 0 && <QuemFicaSem pacientes={pacientes} horarios={horarios} agora={agora} />}
      {respondendo && <RetornoAoPlantao f={f} chamar={chamar} fechar={() => setRespondendo(false)} />}
    </Linha>
  )
}

/**
 * DI3 (revisão do perfil, RT 24/11/2026): as mesmas ações da falta no painel e
 * na aba Faltas — Responder ao plantão (enquanto não houver retorno), Em cotação
 * (da registrada) e Reposta.
 */
export function AcoesFalta({ f, chamar, responder }: {
  f: Pick<FaltaPriorizada, 'id' | 'situacao' | 'retorno'>
  chamar: (p: PromiseLike<{ error: { message: string } | null }>) => Promise<boolean>
  responder: () => void
}) {
  return (
    <span className="flex flex-wrap justify-end gap-2">
      {!f.retorno && <Button size="xs" variant="outline" onClick={responder}>Responder ao plantão</Button>}
      {f.situacao === 'registrada' && <Button size="xs" variant="outline" onClick={() => void chamar(supabase.rpc('avancar_falta', { p_falta: f.id, p_situacao: 'em_cotacao' }))}>Em cotação</Button>}
      <Button size="xs" variant="outline" onClick={() => void chamar(supabase.rpc('avancar_falta', { p_falta: f.id, p_situacao: 'reposta' }))}>Reposta</Button>
    </span>
  )
}

/** O campo do retorno ao plantão, na própria linha da falta. */
export function RetornoAoPlantao({ f, chamar, fechar }: {
  f: Pick<FaltaPriorizada, 'id'>; chamar: (p: PromiseLike<{ error: { message: string } | null }>) => Promise<boolean>; fechar: () => void
}) {
  const [texto, setTexto] = React.useState('')
  return (
    <div className="flex w-full flex-wrap items-center gap-2 pb-1">
      <Input className="h-8 min-w-56 flex-1" placeholder="Retorno ao plantão: substituto, previsão ou conduta" value={texto} onChange={(e) => setTexto(e.target.value)} autoFocus />
      <Button size="xs" disabled={texto.trim().length < 5}
        onClick={() => void chamar(supabase.rpc('registrar_retorno_falta', { p_falta: f.id, p_texto: texto.trim() })).then((ok) => { if (ok) { setTexto(''); fechar() } })}>
        Enviar retorno
      </Button>
      <Button size="xs" variant="ghost" onClick={fechar}>Cancelar</Button>
    </div>
  )
}

/**
 * DI3: quem fica sem o medicamento — paciente, leito (ou setor), a frequência
 * prescrita e o próximo horário aprazado, a dose mais próxima primeiro
 * (pacientes_das_faltas, RT 24/11/2026). Sem a leitura dos horários, fica o
 * setor da prescrição e a ordem pelo nome.
 */
export function QuemFicaSem({ pacientes, horarios, agora }: { pacientes: ItemVigente[]; horarios?: HorarioFalta[] | null; agora?: number }) {
  return (
    <ul aria-label="Pacientes com o medicamento prescrito, a dose mais próxima primeiro" className="flex w-full flex-col gap-1 pb-1 text-rotulo text-tinta-apoio">
      {ordenarQuemFicaSem(pacientes, horarios).map((p) => {
        const proxima = textoProximoHorario(p.horario, agora)
        return (
          <li key={p.item_id}>
            <span className="font-medium text-tinta">{p.paciente}</span>
            {[p.horario?.local ?? p.setor, [p.dose, p.posologia].filter(Boolean).join(' ') || null, p.se_necessario && !proxima ? 'se necessário' : null]
              .filter(Boolean).map((x) => ` · ${x}`).join('')}
            {proxima && <span className={p.horario?.proximo_em ? 'font-medium text-tinta' : undefined}> · {proxima}</span>}
          </li>
        )
      })}
    </ul>
  )
}
