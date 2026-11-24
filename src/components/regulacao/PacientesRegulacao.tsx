// ─────────────────────────────────────────────────────────────────────────────
// Pacientes e a regulação (pedidos do RT de 24/11/2026):
// • R2, médico: dentro de Atendimento, a lista de quem está em regulação
//   (leito, paciente, tipo, situação, prazo e aviso de mensagem nova do
//   regulador); o clique abre a aba Regulação do paciente.
// • NIR: a Internação — os internados por setor e quem está em regulação, só o
//   resumo e o que acontece na regulação, com anexar exames pela aba.
// • Gestor: todos os internados separados por setor, com o que está pendente
//   e o que o médico regulador pergunta ou pede.
// RPC regulacao_pacientes (migration 20270421000040).
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, Waypoints } from 'lucide-react'
import * as React from 'react'

import { Chip, Chips, Vazio } from '@/components/monitor/Pagina'
import { AbaRegulacaoPaciente, EsperaDaCentral } from '@/components/regulacao/AbaRegulacaoPaciente'
import { SeloSla } from '@/components/regulacao/SlaRegulacao'
import { Badge } from '@/components/ui/badge'
import { BotaoLinha } from '@/components/ui/botao-linha'
import { EsqueletoLinhas } from '@/components/ui/esqueleto-linhas'
import { MensagemErro } from '@/components/ui/mensagem-erro'
import { rotuloIdade } from '@/domain/idade'
import { fmtDataHora } from '@/lib/datas'
import { STATUS, resumoPedido } from '@/lib/regulacao'
import { emRegulacao, esperaAOrigem, mensagensNovas, ordenarPorAcao, porSetor, type PacienteRegulacao } from '@/lib/regulacaoPaciente'
import { dataIso } from '@/lib/formato'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

export type ModoLista = 'medico' | 'nir' | 'gestor'

function usePacientesRegulacao(unidadeId: string) {
  return useQuery({
    queryKey: ['regulacao-pacientes', 'unidade', unidadeId],
    enabled: !!unidadeId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('regulacao_pacientes', { p_unidade: unidadeId })
      if (error) throw error
      return (data ?? []) as unknown as PacienteRegulacao[]
    },
  })
}

export function PacientesRegulacao({ unidadeId, modo }: { unidadeId: string; modo: ModoLista }) {
  const q = usePacientesRegulacao(unidadeId)
  // médico: só quem está em regulação; NIR e gestor: os internados, com o filtro
  const [so, setSo] = React.useState<'todos' | 'regulacao' | 'pendentes'>(modo === 'medico' ? 'regulacao' : 'todos')
  const [aberto, setAberto] = React.useState<string | null>(null)
  if (q.isLoading) return <EsqueletoLinhas linhas={5} rotulo="Carregando os pacientes…" />
  if (q.error) return <MensagemErro texto={(q.error as Error).message} />
  const todos = q.data ?? []
  const emReg = emRegulacao(todos)
  const pendentes = emReg.filter((l) => l.pedidos.some(esperaAOrigem))
  const lista = so === 'regulacao' ? emReg : so === 'pendentes' ? pendentes : todos
  const linha = (l: PacienteRegulacao) => (
    <LinhaPaciente key={l.paciente.id} l={l} modo={modo} aberto={aberto === l.paciente.id}
      alternar={() => setAberto(aberto === l.paciente.id ? null : l.paciente.id)} unidadeId={unidadeId} />
  )
  return (
    <div className="flex flex-col gap-3 text-apoio">
      {modo !== 'medico' && (
        <Chips rotulo="Mostrar">
          <Chip radio ativo={so === 'todos'} contagem={todos.length} onClick={() => setSo('todos')}>Todos</Chip>
          <Chip radio ativo={so === 'regulacao'} contagem={emReg.length} onClick={() => setSo('regulacao')}>Em regulação</Chip>
          <Chip radio ativo={so === 'pendentes'} contagem={pendentes.length} onClick={() => setSo('pendentes')}>A central espera a unidade</Chip>
        </Chips>
      )}
      {lista.length === 0 ? (
        <Vazio icone={Waypoints} titulo={modo === 'medico' || so !== 'todos' ? 'Nenhum paciente em regulação' : 'Nenhum paciente internado'}
          texto={modo === 'medico' ? 'Os pacientes com pedido de regulação aberto nesta unidade aparecem aqui.' : undefined} />
      ) : modo === 'medico' ? (
        <ul className="flex flex-col divide-y divide-fio rounded-cartao border border-fio bg-superficie">{ordenarPorAcao(lista).map(linha)}</ul>
      ) : (
        porSetor(lista).map((g) => (
          <section key={g.setor} aria-label={g.setor} className="flex flex-col gap-1">
            <h3 className="flex items-baseline gap-2 font-medium text-tinta">
              {g.setor} <span className="text-rotulo font-normal text-tinta-sussurro">{g.pacientes.length} paciente(s)</span>
            </h3>
            <ul className="flex flex-col divide-y divide-fio rounded-cartao border border-fio bg-superficie">{g.pacientes.map(linha)}</ul>
          </section>
        ))
      )}
    </div>
  )
}

function LinhaPaciente({ l, modo, aberto, alternar, unidadeId }: {
  l: PacienteRegulacao; modo: ModoLista; aberto: boolean; alternar: () => void; unidadeId: string
}) {
  const abertos = l.pedidos.filter((p) => p.em_aberto)
  const p = abertos[0]
  const novas = mensagensNovas(l)
  const idade = l.paciente.nascimento ? rotuloIdade(l.paciente.nascimento, dataIso()) : null
  const esperando = abertos.filter(esperaAOrigem)
  return (
    <li>
      <BotaoLinha variante="linha" aria-expanded={aberto} className="flex-wrap items-center gap-2 border-0 px-3 py-2 hover:bg-campo" onClick={alternar}>
        <span className="min-w-14 font-semibold text-acao">{l.leito ?? (l.internacao ? 'Sem leito' : 'Porta')}</span>
        <span className="font-medium text-tinta">{l.paciente.nome}</span>
        {idade && <span className="text-tinta-sussurro">{idade}</span>}
        {modo === 'medico' && l.setor && <span className="text-tinta-sussurro">{l.setor.nome}</span>}
        {p ? (
          <>
            <span className="text-tinta-apoio">{resumoPedido(p)}{abertos.length > 1 ? ` e mais ${abertos.length - 1}` : ''}</span>
            <Badge variant="info">{STATUS[p.status]}</Badge>
            <SeloSla sla={p.sla} />
          </>
        ) : (
          <span className="text-tinta-sussurro">
            sem regulação{l.internacao ? ` · internado desde ${fmtDataHora(l.internacao.admissao)}` : ''}
          </span>
        )}
        {novas > 0 && <Badge variant="warning">{novas === 1 ? 'mensagem nova do regulador' : `${novas} mensagens novas do regulador`}</Badge>}
        <ChevronDown className={cn('ml-auto size-4 shrink-0 text-tinta-sussurro', aberto && 'rotate-180')} aria-hidden />
      </BotaoLinha>
      {/* gestor e NIR: o que a central espera aparece sem abrir */}
      {modo !== 'medico' && !aberto && esperando.map((x) => <EsperaDaCentral key={x.id} p={x} />)}
      {aberto && (
        <div className="border-t border-fio bg-campo/40 px-3 py-3">
          <AbaRegulacaoPaciente pacienteId={l.paciente.id} unidadeId={unidadeId} />
        </div>
      )}
    </li>
  )
}
