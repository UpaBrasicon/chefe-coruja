// ─────────────────────────────────────────────────────────────────────────────
// Cabeçalho único do paciente (protótipo, D4).
//
// Um só componente para a porta e o leito, para que nome, local e alergia não
// possam divergir entre telas: leito/box/setor, nome, idade e sexo, contexto
// (queixa, desde quando), o SELO DE ALERGIA em três estados sempre visível
// (vermelho quando tem; abre "Alergias e eventos adversos"), o chip da cor da
// classificação da porta, o selo de ISOLAMENTO (vermelho quando ativo; marca e
// retira), o chip de acuidade quando houver e o botão de
// atendimento anterior sem desfecho (D5; o botão some quando não há). Não gruda: fica no topo do conteúdo (D4).
//
// compacto (leito aberto, revisão visual 3.5, opção B do RT): sem cartão; nome,
// idade, sexo e permanência numa linha, a ação à direita (transferir de setor) e
// embaixo só os alertas (alergia, isolamento, atendimento anterior sem desfecho).
// Leito, situação, classificação e acuidade vão para o painel Paciente ao lado.
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery } from '@tanstack/react-query'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { dataIso, hora } from '@/lib/formato'
import { rotuloIdade } from '@/domain/idade'
import { NIVEL_RISCO, type CorRisco } from '@/domain/risco'
import { BotaoEpisodiosAnteriores } from '@/components/prontuario/GavetaEpisodios'

import { GavetaAlergias, SeloAlergia } from './AlergiasEventos'
import { GavetaIsolamento, SeloIsolamento } from './Isolamento'

const hoje = () => dataIso()
const SEXO: Record<string, string> = { M: 'masculino', F: 'feminino', I: 'sexo ignorado' }

/** "45 min", "3h20", "4 dias" desde o instante. */
function duracao(desde: string, agora: number) {
  const min = Math.max(0, Math.round((agora - Date.parse(desde)) / 60_000))
  if (min < 60) return `${min} min`
  if (min < 48 * 60) return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`
  return `${Math.floor(min / 1440)} dias`
}

const MTS: Record<CorRisco, string> = {
  vermelho: 'bg-mts-vermelho text-mts-texto',
  laranja: 'bg-mts-laranja text-mts-texto',
  amarelo: 'bg-mts-amarelo text-mts-amarelo-texto',
  verde: 'bg-mts-verde text-mts-texto',
  azul: 'bg-mts-azul text-mts-texto',
}
const BANDA = ['bg-alerta-conforme text-conforme', 'bg-alerta-atencao text-atencao', 'bg-alerta-critico text-critico']
const BANDA_TEXTO = ['text-conforme', 'text-observacao', 'text-critico']
type AcuidadeResumo = { escala: 'NEWS2' | 'PEWS' | null; total?: number; banda?: 0 | 1 | 2; parcial?: boolean; aferido_em?: string | null }

export type CabecalhoPacienteProps = {
  pacienteId: string
  /** Nome a mostrar (o social, quando houver); sem ele, vem do cadastro. */
  nome?: string
  /** Leito, box ou setor (ex.: "Leito 12"). */
  local?: string | null
  /** Setor, para compor o local pelo nome do cadastro. */
  setorId?: string | null
  /** Início da permanência (chegada na porta ou admissão). */
  desde?: string | null
  /** Rótulo da permanência (ex.: "na porta há", "internado há"). */
  rotuloDesde?: string
  /** Linha de contexto (queixa, pediatria, prioridade). */
  contexto?: React.ReactNode
  /** Selos extras à esquerda (ex.: "Internado", "Em observação"). */
  extra?: React.ReactNode
  /** Cor da classificação de risco da porta (Manchester). */
  corClassificacao?: CorRisco | null
  /** Abre a classificação (a aba/seção da triagem). */
  onClassificacao?: () => void
  /** Mostrar o chip de acuidade (NEWS2/PEWS), quando houver aferição. */
  acuidade?: boolean
  /** Mostrar o aviso de atendimento anterior sem desfecho (D5; só depois de abrir o prontuário no servidor). */
  episodios?: boolean
  /** Na porta: o atendimento na tela não conta como anterior. */
  episodioAtualId?: string | null
  /** Sem cartão e só com os alertas embaixo (leito aberto, 3.5). */
  compacto?: boolean
  /** As duas linhas de sempre, sem o cartão (prancheta da observação, 3.6). */
  semCartao?: boolean
  /** Ação no canto direito da linha do nome (só no compacto). */
  acao?: React.ReactNode
  className?: string
}

/** Selo da cor da classificação da porta (Manchester): a cor é da enfermagem. */
export function SeloClassificacao({ cor, onClick }: { cor: CorRisco; onClick?: () => void }) {
  return onClick ? (
    // padrao-ok: a pílula da classificação clicável usa as cores do protocolo; nenhuma peça tem esses tons
    <button type="button" onClick={onClick} title="Classificação de risco da porta (Manchester). Abrir a classificação."
      className={cn('rounded-capsula px-2.5 py-[3px] text-rotulo font-semibold whitespace-nowrap capitalize hover:opacity-90', MTS[cor])}>
      {cor} · {NIVEL_RISCO[cor]}
    </button>
  ) : (
    <span title="Classificação de risco da porta (Manchester)"
      className={cn('rounded-capsula px-2.5 py-[3px] text-rotulo font-semibold whitespace-nowrap capitalize', MTS[cor])}>
      {cor} · {NIVEL_RISCO[cor]}
    </span>
  )
}

export function CabecalhoPaciente({
  pacienteId, nome, local, setorId, desde, rotuloDesde = 'há', contexto, extra,
  corClassificacao, onClassificacao, acuidade = false, episodios = false, episodioAtualId, compacto = false, semCartao = false, acao, className,
}: CabecalhoPacienteProps) {
  const [alergiasAbertas, setAlergiasAbertas] = React.useState(false)
  const [isolamentoAberto, setIsolamentoAberto] = React.useState(false)
  const [agora, setAgora] = React.useState(() => Date.now())
  React.useEffect(() => {
    const t = window.setInterval(() => setAgora(Date.now()), 60_000)
    return () => window.clearInterval(t)
  }, [])

  const paciente = useQuery({
    queryKey: ['cabecalho-paciente', pacienteId],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('pacientes').select('nome, nome_social, data_nascimento, data_nascimento_estimada, sexo').eq('id', pacienteId).maybeSingle()
      if (error) throw error
      return data
    },
  })
  const setor = useQuery({
    queryKey: ['setor-nome', setorId],
    enabled: !!setorId,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('setores').select('nome').eq('id', setorId!).maybeSingle()
      if (error) throw error
      return data?.nome ?? null
    },
  })
  // mesma chave do leito aberto: um cálculo só no banco
  const acu = useQuery({
    queryKey: ['acuidade', pacienteId],
    enabled: acuidade,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('acuidade', { p_paciente: pacienteId })
      if (error) throw error
      return data as unknown as AcuidadeResumo
    },
  })

  const p = paciente.data
  const nomeVisivel = nome || p?.nome_social || p?.nome || 'Paciente'
  // idade estimada (Portão 2, tarefa 2) leva a marca
  const idade = p?.data_nascimento ? `${rotuloIdade(p.data_nascimento, hoje())}${p.data_nascimento_estimada ? ' (estimada)' : ''}` : null
  const sexo = p?.sexo ? SEXO[p.sexo] ?? p.sexo : null
  const onde = [local, setor.data].filter(Boolean).join(' · ')
  const a = acu.data
  const temAcuidade = acuidade && !!a?.escala && !!a.aferido_em && a.total !== undefined

  const gavetas = (
    <>
      <GavetaAlergias pacienteId={pacienteId} nome={nomeVisivel} aberta={alergiasAbertas} onAbertaChange={setAlergiasAbertas} />
      <GavetaIsolamento pacienteId={pacienteId} nome={nomeVisivel} aberta={isolamentoAberto} onAbertaChange={setIsolamentoAberto} />
    </>
  )

  if (compacto) {
    return (
      <div className={cn('flex flex-col gap-2', className)}>
        <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
          <div className="flex min-w-[200px] flex-1 flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <span className="text-corpo font-semibold text-tinta">
              {nomeVisivel}{' '}
              <span className="text-apoio font-normal text-tinta-sussurro">{[idade, sexo].filter(Boolean).join(' · ') || 'idade não informada'}</span>
            </span>
            {desde && <span className="text-apoio text-tinta-sussurro">{rotuloDesde} <span className="tabular-nums">{duracao(desde, agora)}</span></span>}
          </div>
          {acao && <div className="flex shrink-0 flex-wrap gap-[7px]">{acao}</div>}
        </div>
        <div className="flex flex-wrap items-center gap-2 empty:hidden">
          <SeloAlergia pacienteId={pacienteId} onClick={() => setAlergiasAbertas(true)} />
          <SeloIsolamento pacienteId={pacienteId} onClick={() => setIsolamentoAberto(true)} />
          {episodios && <BotaoEpisodiosAnteriores pacienteId={pacienteId} nome={nomeVisivel} episodioAtualId={episodioAtualId} />}
        </div>
        {gavetas}
      </div>
    )
  }

  return (
    // Duas linhas (P/index.html 1752–1771): quem é a pessoa, depois os selos.
    <div className={cn('flex flex-col gap-2.5', !semCartao && 'rounded-cartao border border-fio bg-superficie px-5 py-[15px] shadow-repouso', className)}>
      <div className="flex flex-wrap items-start gap-x-3.5 gap-y-2">
      <div className="flex min-w-[180px] flex-1 flex-col gap-0.5">
        <span className="text-corpo font-semibold text-tinta">
          {nomeVisivel}{' '}
          <span className="text-apoio font-normal text-tinta-sussurro">{[idade, sexo].filter(Boolean).join(' · ') || 'idade não informada'}</span>
        </span>
        {(contexto || desde) && (
          <span className="text-apoio text-tinta-sussurro">
            {contexto}
            {contexto && desde && ' · '}
            {desde && <>{rotuloDesde} <span className="tabular-nums">{duracao(desde, agora)}</span></>}
          </span>
        )}
      </div>
      {episodios && <BotaoEpisodiosAnteriores pacienteId={pacienteId} nome={nomeVisivel} episodioAtualId={episodioAtualId} />}
      </div>

      <div className="flex flex-wrap items-center gap-2">
      {onde && <span className={cn('text-apoio font-semibold text-acao', !semCartao && 'rounded-capsula bg-acao/10 px-[9px] py-1')}>{onde}</span>}
      {extra}
      <SeloAlergia pacienteId={pacienteId} onClick={() => setAlergiasAbertas(true)} />
      <SeloIsolamento pacienteId={pacienteId} onClick={() => setIsolamentoAberto(true)} />

      {corClassificacao && <SeloClassificacao cor={corClassificacao} onClick={onClassificacao} />}

      {temAcuidade && (
        <span title={`Acuidade pelo ${a!.escala}, aferido às ${hora(a!.aferido_em!)}`}
          className={cn('text-rotulo font-semibold tabular-nums', semCartao ? BANDA_TEXTO[a!.banda ?? 0] : cn('rounded-capsula px-2.5 py-[3px]', BANDA[a!.banda ?? 0]))}>
          {a!.escala} {a!.total}{a!.parcial ? '*' : ''}
        </span>
      )}

      </div>

      {gavetas}
    </div>
  )
}
