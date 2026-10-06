// ─────────────────────────────────────────────────────────────────────────────
// Pronto Socorro da enfermagem (protótipo "ps-enf", P/index.html 1892–1926).
//
// Dois blocos, dos setores em que a pessoa está escalada agora (a escala é a
// porta, ADR 0003): "Triados no Pronto Socorro" (aguardando o médico e em
// atendimento) e "Em observação". Cada linha tem "Cuidados", que abre o
// painel de cuidados de enfermagem numa gaveta. Tela inicial do técnico na
// porta e na observação (InicioEnfermagem escolhe pela escala).
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery } from '@tanstack/react-query'
import { Stethoscope, Users } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'

import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { useUnidade } from '@/contexts/UnidadeContext'
import { rotulosPrioridade } from '@/domain/prioridade'
import { ALVO_MIN, ordemMedica, type CorRisco } from '@/domain/risco'
import { PilulaRisco } from '@/components/clinico/PilulaRisco'
import { TituloPagina, Vazio } from '@/components/monitor/Pagina'
import type { LinhaObservacao } from '@/components/observacao/modelo'
import { Spinner } from '@/components/ui/spinner'

import { Bloco, BotaoCuidados, PilulaAtraso } from './Pecas'
import { LeitosParaLiberar } from './LeitosParaLiberar'
import { GavetaCuidados, type PacienteEmCuidado } from './GavetaCuidados'
import { PILULA, TIPOS_INTERNACAO, atrasadosPorPaciente, duracao, idadeDe, msgErro, useAgora, usePendenciasEnfermagem, useSetoresDaEscala, useTiposDaEscala } from './useEnfermagem'

type Triado = {
  id: string; paciente_id: string; setor_id: string; cor_atual: CorRisco; classificado_em: string; queixa: string
  publico: string | null; prioridades_legais: string[]; atendimento_iniciado_em: string | null; reavaliar_em: string | null
  paciente: { nome: string; nome_social: string | null; data_nascimento: string | null } | null
}

export default function ProntoSocorroEnfermagem() {
  const { unidadeAtiva, papelAtivo } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  const agora = useAgora()
  const [cuidando, setCuidando] = React.useState<PacienteEmCuidado | null>(null)

  const setores = useSetoresDaEscala()
  const meusSetores = setores.data ?? []

  const triados = useQuery({
    queryKey: ['enfermagem-ps-triados', unidadeId, meusSetores],
    enabled: meusSetores.length > 0,
    refetchInterval: 20_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('episodios')
        .select('id, paciente_id, setor_id, cor_atual, classificado_em, queixa, publico, prioridades_legais, atendimento_iniciado_em, reavaliar_em, paciente:pacientes(nome, nome_social, data_nascimento)')
        .in('setor_id', meusSetores)
        .eq('etapa', 'atendimento')
      if (error) throw error
      // aguardando primeiro, pela ordem médica (cor e espera); depois os em atendimento
      const l = (data ?? []) as unknown as Triado[]
      return [...l.filter((e) => !e.atendimento_iniciado_em).sort(ordemMedica), ...l.filter((e) => e.atendimento_iniciado_em).sort(ordemMedica)]
    },
  })

  const observacao = useQuery({
    queryKey: ['painel-observacao', unidadeId],
    enabled: !!unidadeId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('painel_observacao', { p_unidade: unidadeId! })
      if (error) throw error
      return (data ?? []) as unknown as LinhaObservacao[]
    },
  })
  const emObservacao = (observacao.data ?? []).filter((o) => o.estado !== 'finalizado')

  const pendencias = usePendenciasEnfermagem()
  const atrasados = atrasadosPorPaciente(pendencias.data)
  // a escala também tem setor de internação: os internados ficam na outra tela
  const temInternacao = useTiposDaEscala().tipos.some((t) => TIPOS_INTERNACAO.includes(t))

  const carregando = setores.isLoading || triados.isLoading || observacao.isLoading
  const erro = setores.error ?? triados.error ?? observacao.error
  const lista = triados.data ?? []

  return (
    <>
      <TituloPagina icone={Stethoscope} titulo="Pronto Socorro"
        descricao={`Triados e em observação dos setores da sua escala. Em Cuidados ficam SAE, aprazamento e checagem, sinais vitais e anotação.${papelAtivo === 'tecnico_enfermagem' ? ' Como técnico, você checa, afere e registra; a SAE é do enfermeiro.' : ''}`} />
      {erro && <p className="mb-3 text-apoio text-critico">{msgErro(erro)}</p>}
      {!carregando && !erro && meusSetores.length === 0 ? (
        <Vazio icone={Stethoscope} titulo="Você não está na escala agora"
          texto="O Pronto Socorro da enfermagem mostra os pacientes dos setores em que você está de plantão neste momento." />
      ) : (
        <div className="flex flex-col gap-3">
          {temInternacao && (
            <Link to="/enfermagem/internacao" className="flex items-center gap-2 rounded-container border border-fio bg-alerta-marca px-4 py-3 text-apoio text-acao hover:underline">
              <Users className="size-4" aria-hidden /> Sua escala também tem setor de internação: os internados estão na Internação da enfermagem.
            </Link>
          )}
          <Bloco titulo="Triados no Pronto Socorro">
            {carregando && <div className="px-5 py-4"><Spinner /></div>}
            {!carregando && lista.length === 0 && <p className="px-5 py-[18px] text-controle text-tinta-sussurro">Nenhum paciente triado agora.</p>}
            {lista.map((e) => {
              const nome = e.paciente?.nome_social || e.paciente?.nome || 'Paciente'
              const aguardando = !e.atendimento_iniciado_em
              const espera = Math.max(0, Math.round((agora - Date.parse(e.classificado_em)) / 60_000))
              const acima = aguardando && espera > ALVO_MIN[e.cor_atual]
              return (
                <div key={e.id} className="flex flex-wrap items-center gap-3.5 border-b border-trilha px-5 py-[13px] last:border-0">
                  <PilulaRisco cor={e.cor_atual} />
                  <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-0.5">
                    <span className="text-corpo font-medium text-tinta">{nome} <span className="text-apoio font-normal text-tinta-sussurro">{idadeDe(e.paciente?.data_nascimento)}</span></span>
                    <span className="text-apoio text-tinta-sussurro [text-wrap:pretty]">
                      {[e.queixa, e.prioridades_legais.length ? `Prioridade: ${rotulosPrioridade(e.prioridades_legais).join(', ')}` : '', e.publico === 'pediatrico' ? 'pediatria' : '']
                        .filter(Boolean).join(' · ')}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {aguardando
                        ? <span className={cn(PILULA, 'bg-trilha text-tinta-apoio')}>Aguardando médico</span>
                        : e.reavaliar_em
                          ? <span className={cn(PILULA, 'bg-alerta-atencao text-atencao')}>Em reavaliação</span>
                          : <span className={cn(PILULA, 'bg-alerta-marca text-acao')}>Em atendimento</span>}
                      <PilulaAtraso n={atrasados.get(e.paciente_id) ?? 0} />
                    </div>
                  </div>
                  <span className={cn('text-apoio whitespace-nowrap tabular-nums', acima ? 'font-semibold text-critico' : 'text-tinta-apoio')}>
                    {aguardando ? `espera ${duracao(e.classificado_em, agora)}` : `em atendimento há ${duracao(e.atendimento_iniciado_em, agora)}`}
                  </span>
                  <BotaoCuidados onClick={() => setCuidando({
                    pacienteId: e.paciente_id, episodioId: e.id, nome, local: 'Pronto Socorro', setorId: e.setor_id,
                    contexto: e.queixa, desde: e.classificado_em, rotuloDesde: 'triado há', cor: e.cor_atual,
                  })} />
                </div>
              )
            })}
          </Bloco>

          <Bloco titulo="Em observação">
            {carregando && <div className="px-5 py-4"><Spinner /></div>}
            {!carregando && emObservacao.length === 0 && <p className="px-5 py-[18px] text-controle text-tinta-sussurro">Ninguém em observação nos setores da sua escala.</p>}
            {emObservacao.map((o) => (
              <div key={o.internacao_id} className="flex flex-wrap items-center gap-3.5 border-b border-trilha px-5 py-[13px] last:border-0">
                <span className={cn(PILULA, 'min-w-[70px] justify-center self-center bg-alerta-atencao text-atencao')}>{o.box ?? o.setor_nome}</span>
                <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-0.5">
                  <span className="text-corpo font-medium text-tinta">{o.nome} <span className="text-apoio font-normal text-tinta-sussurro">{idadeDe(o.data_nascimento)}</span></span>
                  <span className="text-apoio text-tinta-sussurro [text-wrap:pretty]">{[o.queixa, o.setor_nome].filter(Boolean).join(' · ')}</span>
                  <div className="flex flex-wrap gap-1.5">
                    <span className={cn(PILULA, 'bg-alerta-atencao text-atencao')}>Em observação</span>
                    <PilulaAtraso n={atrasados.get(o.paciente_id) ?? 0} />
                  </div>
                </div>
                <span className="text-apoio whitespace-nowrap tabular-nums text-tinta-apoio">há {duracao(o.entrada, agora)}</span>
                <BotaoCuidados onClick={() => setCuidando({
                  pacienteId: o.paciente_id, episodioId: o.episodio_id, internacaoId: o.internacao_id, nome: o.nome,
                  local: o.box ?? o.setor_nome, setorId: o.setor_id, contexto: o.queixa, desde: o.entrada,
                  rotuloDesde: 'em observação há', cor: (o.cor as CorRisco | null) ?? null,
                })} />
              </div>
            ))}
          </Bloco>
          <LeitosParaLiberar unidadeId={unidadeId} setores={meusSetores} />
        </div>
      )}
      <GavetaCuidados paciente={cuidando} onFechar={() => setCuidando(null)} />
    </>
  )
}
