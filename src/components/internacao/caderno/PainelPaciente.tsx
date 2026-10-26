// Painel "Paciente" ao lado das abas do leito aberto (revisão visual 3.5, opção B
// do RT com ressalvas, 26/10/2026): propriedades em linhas, como a lateral de uma
// issue do Linear. Leito, situação, internação, chegada, classificação da porta,
// acuidade e diagnóstico. Os alertas (alergia, isolamento, atendimento anterior)
// ficam no cabeçalho, à vista também no celular.
import { useQuery } from '@tanstack/react-query'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { hora } from '@/lib/formato'
import type { CorRisco } from '@/domain/risco'
import { SeloClassificacao } from '@/components/paciente/CabecalhoPaciente'
import { Estado } from '@/components/porta/Estado'

import { type Acuidade, diaHora, type Internacao } from './comum'

const BANDA_TEXTO = ['text-conforme', 'text-observacao', 'text-critico']
const BANDA_ROTULO = ['risco baixo', 'atenção', 'risco alto']

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[100px_minmax(0,1fr)] items-baseline gap-2 py-1.5">
      <dt className="text-apoio text-tinta-sussurro">{rotulo}</dt>
      <dd className="text-apoio text-tinta">{children}</dd>
    </div>
  )
}

export function PainelPaciente({ i, ativa, acuidade, diagnostico, onClassificacao, acoes }: {
  i: Internacao
  ativa: boolean
  acuidade?: Acuidade
  /** CID e descrição do diagnóstico primário vigente (ou o da admissão). */
  diagnostico: string
  onClassificacao: () => void
  /** Botões do pé do painel (ex.: recém-nascido da mãe). */
  acoes?: React.ReactNode
}) {
  const setor = useQuery({
    queryKey: ['setor-nome', i.setor_atual_id],
    enabled: !!i.setor_atual_id,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('setores').select('nome').eq('id', i.setor_atual_id!).maybeSingle()
      if (error) throw error
      return data?.nome ?? null
    },
  })
  const observacao = i.status === 'em_observacao'
  const local = [i.leito ? i.leito.identificador : ativa ? 'Aguardando box/leito' : null, setor.data].filter(Boolean).join(' · ')
  const cor = (i.episodio?.cor_atual as CorRisco | null | undefined) ?? null
  const a = acuidade
  const temAcuidade = ativa && !!a?.escala && !!a.aferido_em && a.total !== undefined
  const banda = a?.banda ?? 0

  return (
    <aside aria-label="Paciente" className="flex flex-col border-fio lg:border-l lg:pl-5">
      <h3 className="pb-1 text-apoio font-semibold text-tinta">Paciente</h3>
      <dl className="flex flex-col">
        <Linha rotulo="Leito">{local || '—'}</Linha>
        <Linha rotulo="Situação">
          {observacao ? <Estado tom="ambar">Em observação</Estado> : ativa ? <Estado tom="teal">Internado</Estado> : <Estado tom="cinza">Alta {diaHora(i.data_alta)}</Estado>}
        </Linha>
        {!observacao && i.internado_em && <Linha rotulo="Internado">{diaHora(i.internado_em)}</Linha>}
        <Linha rotulo="Na unidade">desde {diaHora(i.data_admissao)}</Linha>
        {cor && <Linha rotulo="Classificação"><SeloClassificacao cor={cor} onClick={onClassificacao} /></Linha>}
        {ativa && (
          <Linha rotulo="Acuidade">
            {temAcuidade ? (
              <span className={cn('font-semibold tabular-nums', BANDA_TEXTO[banda])} title={`Aferido às ${hora(a!.aferido_em!)}`}>
                {a!.escala} {a!.total}{a!.parcial ? '*' : ''} · {BANDA_ROTULO[banda]}
              </span>
            ) : <span className="text-tinta-sussurro">sem aferição em 24 h</span>}
          </Linha>
        )}
        <Linha rotulo="Diagnóstico">{diagnostico || <span className="text-tinta-sussurro">sem diagnóstico registrado</span>}</Linha>
      </dl>
      {acoes && <div className="mt-2 flex flex-wrap gap-1.5 border-t border-fio pt-3 empty:hidden">{acoes}</div>}
    </aside>
  )
}
