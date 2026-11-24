// ─────────────────────────────────────────────────────────────────────────────
// Pronto Socorro da enfermagem (protótipo "ps-enf", P/index.html 1892–1926).
//
// Os pacientes dos setores de porta e observação em que a pessoa está escalada
// agora (a escala é a porta, ADR 0003). Revisão do perfil Enfermeiro (RT
// 24/11/2026): PS1, uma faixa no topo com o que está atrasado, que filtra a
// lista; PS2, uma lista só, em grupos (aguardando médico, em atendimento, em
// observação), com a mesma linha para todos e uma pendência principal (o resto
// abre em Cuidados); PS3, fora da escala, o próximo plantão e a Escala. TE3:
// os leitos dos setores de internação ficam na Internação da enfermagem.
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery } from '@tanstack/react-query'
import { Stethoscope } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'

import { supabase } from '@/lib/supabase'
import { useUnidade } from '@/contexts/UnidadeContext'
import { rotulosPrioridade } from '@/domain/prioridade'
import { ALVO_MIN, ordemMedica, type CorRisco } from '@/domain/risco'
import { tem, type ChavePendencia } from '@/lib/pendenciasEnfermagem'
import { TituloPagina } from '@/components/monitor/Pagina'
import { DescansoDoPlantao } from '@/components/plantao/DescansoDoPlantao'
import type { LinhaObservacao } from '@/components/observacao/modelo'
import { EsqueletoLinhas } from '@/components/ui/esqueleto-linhas'

import { FaixaPendencias, GrupoLista, LinhaPaciente, VazioForaDaEscala } from './Pecas'
import { LeitosParaLiberar } from './LeitosParaLiberar'
import { ObitosPendentes } from '@/components/obito/ObitosPendentes'
import { GavetaCuidados, type PacienteEmCuidado } from './GavetaCuidados'
import { duracao, idadeDe, useAgora, usePendenciasPorPaciente, useSetoresComTipo, useSetoresDaEscala } from './useEnfermagem'
import { erroDeLeitura } from '@/lib/offline/erroDeLeitura'

type Triado = {
  id: string; paciente_id: string; setor_id: string; cor_atual: CorRisco; classificado_em: string; queixa: string
  publico: string | null; prioridades_legais: string[]; atendimento_iniciado_em: string | null; reavaliar_em: string | null
  paciente: { nome: string; nome_social: string | null; data_nascimento: string | null } | null
}

const CHAVES: ChavePendencia[] = ['vencida', 'atrasada', 'contencao', 'vencendo']

export default function ProntoSocorroEnfermagem() {
  const { unidadeAtiva } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  const agora = useAgora()
  const [cuidando, setCuidando] = React.useState<PacienteEmCuidado | null>(null)
  const [filtro, setFiltro] = React.useState<ChavePendencia | null>(null)

  const setores = useSetoresDaEscala()
  const meusSetores = setores.data ?? []
  const comTipo = useSetoresComTipo()
  // TE3: a porta e a observação da escala; a internação fica na outra tela
  const daPorta = comTipo.porta.map((s) => s.id)
  const nomeSetor = new Map([...comTipo.porta, ...comTipo.internacao].map((s) => [s.id, s.nome]))

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
      return ((data ?? []) as unknown as Triado[]).sort(ordemMedica)
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
  // TE3: só a observação dos setores da escala
  const emObservacao = (observacao.data ?? []).filter((o) => o.estado !== 'finalizado' && meusSetores.includes(o.setor_id))

  const pendenciasDe = usePendenciasPorPaciente(agora)
  const temInternacao = comTipo.internacao.length > 0

  const carregando = setores.isLoading || triados.isLoading || observacao.isLoading
  const erro = setores.error ?? triados.error ?? observacao.error
  const todos = triados.data ?? []
  const passa = (pacienteId: string) => !filtro || tem(pendenciasDe(pacienteId), filtro)
  const aguardando = todos.filter((e) => !e.atendimento_iniciado_em && passa(e.paciente_id))
  const emAtendimento = todos.filter((e) => e.atendimento_iniciado_em && passa(e.paciente_id))
  const observados = emObservacao.filter((o) => passa(o.paciente_id))
  const pendencias = [...todos.map((e) => pendenciasDe(e.paciente_id)), ...emObservacao.map((o) => pendenciasDe(o.paciente_id))]

  const linhaTriado = (e: Triado) => {
    const nome = e.paciente?.nome_social || e.paciente?.nome || 'Paciente'
    const espera = !e.atendimento_iniciado_em
    const min = Math.max(0, Math.round((agora - Date.parse(e.classificado_em)) / 60_000))
    const texto = [e.queixa, e.prioridades_legais.length ? `prioridade: ${rotulosPrioridade(e.prioridades_legais).join(', ')}` : '',
      e.publico === 'pediatrico' ? 'pediatria' : '', !espera && e.reavaliar_em ? 'em reavaliação' : ''].filter(Boolean).join(' · ')
    return (
      <LinhaPaciente key={e.id} cor={e.cor_atual} local={nomeSetor.get(e.setor_id) ?? null} nome={nome} idade={idadeDe(e.paciente?.data_nascimento)}
        texto={texto} pendencias={pendenciasDe(e.paciente_id)}
        tempo={espera ? `espera ${duracao(e.classificado_em, agora)}` : `há ${duracao(e.atendimento_iniciado_em, agora)}`}
        tempoCritico={espera && min > ALVO_MIN[e.cor_atual]}
        onCuidados={() => setCuidando({
          pacienteId: e.paciente_id, episodioId: e.id, nome, local: 'Pronto-Socorro', setorId: e.setor_id,
          contexto: e.queixa, desde: e.classificado_em, rotuloDesde: 'triado há', cor: e.cor_atual,
        })} />
    )
  }

  return (
    <>
      <TituloPagina icone={Stethoscope} titulo="Pronto-Socorro" descricao="Pacientes da porta e da observação dos setores da sua escala." />
      {erroDeLeitura(erro, !!triados.data || !!observacao.data) && <p className="mb-3 text-apoio text-critico">{erroDeLeitura(erro, !!triados.data || !!observacao.data)}</p>}
      {!carregando && !erro && meusSetores.length === 0 ? (
        <VazioForaDaEscala onde="os pacientes da porta e da observação" />
      ) : (
        <div className="flex flex-col gap-4">
          <FaixaPendencias lista={pendencias} chaves={CHAVES} filtro={filtro} onFiltro={setFiltro} />
          {/* pedido 8 (PS5 = A): quem dos médicos está descansando e quem está acordado */}
          <DescansoDoPlantao unidadeId={unidadeAtiva?.unidade_id} podeDividir={false} />
          <section aria-label="Pacientes do Pronto-Socorro" className="overflow-hidden rounded-cartao border border-fio bg-superficie">
            {carregando && <EsqueletoLinhas linhas={3} rotulo="Carregando os pacientes…" />}
            {!carregando && aguardando.length + emAtendimento.length + observados.length === 0 && (
              <p className="px-5 py-4 text-controle text-tinta-sussurro">
                {filtro ? 'Nenhum paciente com essa pendência.' : 'Nenhum paciente na porta nem na observação dos setores da sua escala.'}
              </p>
            )}
            {aguardando.length > 0 && <GrupoLista titulo="Aguardando médico" n={aguardando.length}>{aguardando.map(linhaTriado)}</GrupoLista>}
            {emAtendimento.length > 0 && <GrupoLista titulo="Em atendimento" n={emAtendimento.length}>{emAtendimento.map(linhaTriado)}</GrupoLista>}
            {observados.length > 0 && (
              <GrupoLista titulo="Em observação" n={observados.length}>
                {observados.map((o) => (
                  <LinhaPaciente key={o.internacao_id} cor={(o.cor as CorRisco | null) ?? null} local={o.box ?? o.setor_nome} nome={o.nome}
                    idade={idadeDe(o.data_nascimento)} texto={o.queixa ?? ''} pendencias={pendenciasDe(o.paciente_id)}
                    tempo={`há ${duracao(o.entrada, agora)}`}
                    onCuidados={() => setCuidando({
                      pacienteId: o.paciente_id, episodioId: o.episodio_id, internacaoId: o.internacao_id, nome: o.nome,
                      local: o.box ?? o.setor_nome, setorId: o.setor_id, contexto: o.queixa, desde: o.entrada,
                      rotuloDesde: 'em observação há', cor: (o.cor as CorRisco | null) ?? null,
                    })} />
                ))}
              </GrupoLista>
            )}
          </section>
          {/* PS3: o aviso da internação é uma linha com link */}
          {temInternacao && (
            <p className="text-apoio text-tinta-sussurro">
              Sua escala também tem setor de internação: os internados estão na <Link to="/enfermagem/internacao" className="text-acao hover:underline">Internação</Link>.
            </p>
          )}
          {/* lacuna 5 (O7): óbitos com comunicação, corpo ou vias por fazer */}
          <ObitosPendentes unidadeId={unidadeId} />
          <LeitosParaLiberar unidadeId={unidadeId} setores={daPorta} />
        </div>
      )}
      <GavetaCuidados paciente={cuidando} onFechar={() => setCuidando(null)} />
    </>
  )
}
