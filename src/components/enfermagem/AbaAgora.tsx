// ─────────────────────────────────────────────────────────────────────────────
// Aba "Agora" da gaveta Cuidados (CU1 e CK0, revisão do perfil Enfermeiro, RT
// 24/11/2026): o que vence para este paciente, na ordem em que a enfermagem
// faz no plantão: a contenção ativa e as intercorrências, a medicação a checar
// pela ronda por horário (a mesma fila_checagem e o mesmo ItemChecagem da tela
// Checagem, só deste paciente), a última aferição de sinais vitais e a
// classificação do dia (Fugulin ou Dini) quando falta.
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery } from '@tanstack/react-query'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { useUnidade } from '@/contexts/UnidadeContext'
import { useAgora } from '@/hooks/useAgora'
import { dataHora } from '@/lib/formato'
import { Button } from '@/components/ui/button'
import { MensagemErro } from '@/components/ui/mensagem-erro'
import { Contencao } from '@/components/prontuario/Contencao'
import { Intercorrencias } from '@/components/prontuario/Intercorrencias'

import { useChecagem } from './checagem/dados'
import { ListaRonda } from './checagem/ListaRonda'
import type { Contexto, Cuidados } from './dadosCuidados'

const Secao = ({ titulo, children }: { titulo: string; children: React.ReactNode }) => (
  <section aria-label={titulo} className="flex flex-col gap-2">
    <h3 className="text-controle font-semibold text-tinta">{titulo}</h3>
    {children}
  </section>
)

export function AbaAgora({ ctx, dados, publico, onIr }: {
  ctx: Contexto; dados: Cuidados; publico: 'adulto' | 'pediatrico' | null
  /** Leva a outra aba da gaveta (sinais vitais, escalas). */
  onIr: (aba: 'sv' | 'esc') => void
}) {
  const { papelAtivo } = useUnidade()
  const agora = useAgora()
  const [erro, setErro] = React.useState<string | null>(null)
  const souEnfermeiro = papelAtivo === 'enfermeiro'
  const checagem = useChecagem(ctx.pacienteId)
  const episodioId = ctx.episodioId ?? dados.episodio_id
  const internacaoId = ctx.internacaoId ?? dados.internacao_id

  // a classificação do dia é do enfermeiro, na internação (Fugulin no adulto, Dini na criança)
  const escala = publico === 'pediatrico' ? 'dini' : 'fugulin'
  const doDia = useQuery({
    queryKey: [`${escala}-hoje`, internacaoId ?? ''],
    enabled: souEnfermeiro && !!internacaoId && publico !== null && dados.atendimento_aberto,
    queryFn: async () => {
      const { data, error } = await supabase.rpc(escala === 'dini' ? 'dini_de_hoje' : 'fugulin_de_hoje', { p_internacoes: [internacaoId!] })
      if (error) throw error
      return (data ?? {}) as unknown as Record<string, { total: number; categoria: string } | null>
    },
  })
  const escalaPendente = !!doDia.data && !doDia.data[internacaoId!]

  const ultimaSv = dados.sinais_vitais.reduce<string | null>((m, s) => (!m || s.aferido_em > m ? s.aferido_em : m), null)

  return (
    <div className="flex flex-col gap-5">
      <Contencao pacienteId={ctx.pacienteId} semBotao />
      <Intercorrencias pacienteId={ctx.pacienteId} episodioId={episodioId} internacaoId={internacaoId} semBotao />

      <Secao titulo="Medicação">
        <MensagemErro texto={erro} />
        {checagem.carregando
          ? <p className="text-apoio text-tinta-sussurro">Carregando a checagem…</p>
          : (
            <ListaRonda linhas={checagem.linhas} ctx={checagem.ctx} souEnfermeiro={souEnfermeiro} agora={agora}
              aoMudar={checagem.recarregar} aoErro={setErro}
              vazio={<p className="text-apoio text-tinta-sussurro">Nenhum item prescrito para checar.</p>} />
          )}
      </Secao>

      <Secao titulo="Sinais vitais">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-apoio text-tinta-apoio">
            {ultimaSv ? `Última aferição: ${dataHora(ultimaSv)}.` : 'Nenhuma aferição neste atendimento.'}
          </span>
          {dados.pode_registrar && <Button size="sm" variant="outline" onClick={() => onIr('sv')}>Registrar sinais vitais</Button>}
        </div>
      </Secao>

      {escalaPendente && (
        <Secao titulo="Classificação do dia">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-apoio text-atencao">{escala === 'dini' ? 'Dini' : 'Fugulin'} de hoje pendente.</span>
            <Button size="sm" variant="outline" onClick={() => onIr('esc')}>Abrir as escalas</Button>
          </div>
        </Secao>
      )}
    </div>
  )
}
