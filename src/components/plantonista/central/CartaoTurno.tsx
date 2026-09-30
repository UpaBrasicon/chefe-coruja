import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Clock, LogOut, MapPin, ShieldCheck, Stethoscope, TriangleAlert, Users } from 'lucide-react'

import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { useFaixaPlantonista } from '@/hooks/useFaixaPlantonista'
import { esperaPorCor } from '@/domain/esperaPorta'
import { formatarDuracao, JANELA_OBSERVACAO_MIN, nivelDaObservacao, tempoDaJanela } from '@/domain/plantao'
import { ALVO_MIN, NIVEL_RISCO, rotuloCor, type CorRisco } from '@/domain/risco'

// Cartão de turno da Central (P/index.html 1419–1486): substitui a faixa de
// parâmetros do plantonista (decisão de 19–20/09 no protótipo). Setor e turno
// da escala, check-in e check-out, relógio do servidor, espera na porta por
// cor e os atalhos do plantão. Tudo do banco, pela RLS do próprio usuário:
// a espera conta só os setores em que ele está escalado agora.

const TURNO: Record<string, string> = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite', madrugada: 'Madrugada' }

const COR_PILULA: Record<CorRisco, string> = {
  vermelho: 'bg-mts-vermelho text-white',
  laranja: 'bg-mts-laranja text-white',
  amarelo: 'bg-mts-amarelo text-mts-amarelo-texto',
  verde: 'bg-mts-verde text-white',
  azul: 'bg-mts-azul text-white',
}

const hhmm = (d: Date) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })

type Presenca = { id: string; checkin_em: string | null; checkout_em: string | null; checkin_dentro: boolean | null; checkin_justificativa: string | null }
type Plantao = { setor_nome: string; turno: string; inicio: string; fim: string; unidade_id: string }
type Proximo = { setor_nome: string; unidade_nome: string; rotulo: string | null; turno: string; inicio: string }

function useCartaoTurno(unidadeId: string | undefined, perfilId: string | undefined) {
  return useQuery({
    queryKey: ['cartao-turno', unidadeId, perfilId],
    enabled: !!unidadeId && !!perfilId,
    refetchInterval: 30_000,
    queryFn: async () => {
      const [plantao, presenca, setores] = await Promise.all([
        supabase.rpc('meu_plantao_agora'),
        supabase
          .from('presenca_plantonista')
          .select('id, checkin_em, checkout_em, checkin_dentro, checkin_justificativa')
          .eq('unidade_id', unidadeId!)
          .eq('perfil_id', perfilId!)
          .order('checkin_em', { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle(),
        supabase.rpc('setores_na_escala_agora'),
      ])
      if (plantao.error) throw plantao.error
      if (presenca.error) throw presenca.error
      const meus = ((plantao.data ?? []) as Plantao[]).filter((p) => p.unidade_id === unidadeId)
      const idsSetores = Array.isArray(setores.data) ? (setores.data as unknown[]).filter((x): x is string => typeof x === 'string') : []

      let fila: { cor_atual: CorRisco | null; classificado_em: string | null }[] = []
      if (idsSetores.length) {
        const { data, error } = await supabase
          .from('episodios')
          .select('cor_atual, classificado_em')
          .in('setor_id', idsSetores)
          .eq('etapa', 'atendimento')
          .is('atendimento_iniciado_em', null)
        if (error) throw error
        fila = (data ?? []) as typeof fila
      }

      let proximo: Proximo | null = null
      if (!meus.length) {
        const { data } = await supabase.rpc('meu_proximo_plantao')
        proximo = ((data ?? []) as Proximo[])[0] ?? null
      }
      return { plantoes: meus, presenca: presenca.data as Presenca | null, fila, proximo }
    },
  })
}

/** Relógio da unidade: hora do servidor, avançada localmente entre as sincronias. */
function useRelogioServidor(agoraServidor: Date | undefined) {
  const [agora, setAgora] = useState<Date | null>(null)
  useEffect(() => {
    if (!agoraServidor) return
    const desvio = agoraServidor.getTime() - Date.now()
    const tique = () => setAgora(new Date(Date.now() + desvio))
    tique()
    const t = window.setInterval(tique, 15_000)
    return () => window.clearInterval(t)
  }, [agoraServidor])
  return agora
}

export function CartaoTurno({ unidadeId, perfilId }: { unidadeId?: string; perfilId?: string }) {
  const cartao = useCartaoTurno(unidadeId, perfilId)
  const faixa = useFaixaPlantonista(unidadeId)
  const agoraServidor = faixa.data?.agoraServidor
  const agora = useRelogioServidor(agoraServidor)

  const d = cartao.data
  const plantoes = d?.plantoes ?? []
  const emCurso = plantoes.length > 0
  const p = d?.presenca
  const dentroDoPlantao = !!(p?.checkin_em && !p.checkout_em)
  const janela = faixa.data?.janela
  const turnoRestante = janela && agora ? tempoDaJanela(janela.inicio, janela.fim, agora) : null
  const posPlantao = dentroDoPlantao && !emCurso
  const espera = d && agora ? esperaPorCor(d.fila, agora) : []
  const obsMin = faixa.data?.maiorObservacaoMin ?? null
  const nivelObs = obsMin === null ? null : nivelDaObservacao(obsMin)

  const titulo = emCurso
    ? `${[...new Set(plantoes.map((x) => x.setor_nome))].join(' · ')} — ${TURNO[plantoes[0].turno] ?? plantoes[0].turno}`
    : 'Sem plantão em curso'
  const horario = emCurso ? `${hhmm(new Date(plantoes[0].inicio))} às ${hhmm(new Date(plantoes[plantoes.length - 1].fim))}` : null

  const checkin = !p?.checkin_em || p.checkout_em
    ? null
    : `Check-in ${hhmm(new Date(p.checkin_em))}, ${p.checkin_dentro === false ? (p.checkin_justificativa ? 'fora do raio, com justificativa' : 'fora do raio') : p.checkin_dentro ? 'dentro do raio' : 'sem validação de local'}`

  return (
    <section aria-label="Meu turno" className="mb-5 overflow-hidden rounded-cartao border border-fio bg-superficie shadow-repouso">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 border-b border-fio px-5 py-3.5">
        <span className="flex items-center gap-[7px] text-corpo font-semibold tracking-[-0.012em] text-tinta">
          <Stethoscope className="size-4 text-acao" aria-hidden />
          {cartao.isLoading ? 'Carregando o turno…' : titulo}
        </span>
        {emCurso && (
          <>
            <span className="h-3.5 w-px bg-fio" aria-hidden />
            <span className="text-apoio text-tinta-apoio tabular">{horario}{turnoRestante ? ` · restam ${formatarDuracao(turnoRestante.restante)}` : ''}</span>
            <span className="h-3.5 w-px bg-fio" aria-hidden />
            {checkin ? (
              <span className={cn('flex items-center gap-[5px] text-apoio', p?.checkin_dentro === false ? 'text-atencao' : 'text-conforme')}>
                <MapPin className="size-[13px]" aria-hidden />
                {checkin}
              </span>
            ) : (
              <Link to="/plantao/check-in" className="flex items-center gap-[5px] text-apoio font-medium text-atencao hover:text-acao">
                <MapPin className="size-[13px]" aria-hidden />
                Check-in pendente — fazer agora
              </Link>
            )}
          </>
        )}
        {dentroDoPlantao && (
          <Link
            to="/plantao/check-in"
            className={cn(
              'ml-auto inline-flex items-center gap-1.5 rounded-controle-sm border bg-superficie px-[11px] py-[5px] text-apoio whitespace-nowrap',
              posPlantao ? 'border-atencao/40 text-atencao hover:border-atencao' : 'border-fio text-tinta-apoio hover:border-marca hover:text-acao',
            )}
          >
            <LogOut className="size-[13px]" aria-hidden />
            Fazer check-out
          </Link>
        )}
        {!emCurso && d?.proximo && (
          <>
            <span className="h-3.5 w-px bg-fio" aria-hidden />
            <span className="text-apoio text-tinta-apoio">
              Próximo: {new Date(d.proximo.inicio).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })} {hhmm(new Date(d.proximo.inicio))} · {d.proximo.setor_nome} · {d.proximo.rotulo?.trim() || TURNO[d.proximo.turno] || d.proximo.turno}
            </span>
          </>
        )}
        {!emCurso && d && !d.proximo && (
          <>
            <span className="h-3.5 w-px bg-fio" aria-hidden />
            <span className="text-apoio text-tinta-sussurro">Nenhum plantão confirmado adiante</span>
          </>
        )}
        <span className="flex basis-full items-center gap-[5px] text-rotulo text-tinta-sussurro tabular">
          <Clock className="size-3" aria-hidden />
          {agora && agoraServidor
            ? `Relógio da unidade ${hhmm(agora)} · sincronizado com o servidor às ${hhmm(agoraServidor)}`
            : 'Sincronizando com o relógio do servidor…'}
        </span>
        {posPlantao && (
          <span role="status" className="flex basis-full items-start gap-[7px] rounded-controle bg-alerta-atencao px-[11px] py-2 text-apoio text-atencao">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            Plantão encerrado. A plataforma segue aberta enquanto você conclui o que falta; o check-out fecha o seu plantão.
          </span>
        )}
      </div>

      {emCurso && faixa.data && obsMin === null && espera.length > 0 && espera.every((e) => e.aguardando === 0) && (
        <div className="flex items-center gap-[9px] border-b border-fio bg-alerta-conforme px-5 py-3 text-apoio text-conforme">
          <ShieldCheck className="size-4 shrink-0" aria-hidden />
          Ninguém aguardando o médico na porta e ninguém em observação no seu acesso.
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 bg-campo px-5 py-[11px]">
        <div className="flex flex-wrap items-center gap-4">
          <Link to="/plantao/internacao/pacientes" className="flex items-center gap-1.5 text-apoio text-tinta-apoio hover:text-acao">
            <Users className="size-[15px] text-tinta-sussurro" aria-hidden />
            Ver pacientes internados
          </Link>
          {emCurso && (
            <div className="flex flex-wrap items-center gap-1.5" title="Espera na porta desde a classificação, por cor (Manchester)">
              <span className="text-rotulo text-tinta-sussurro">Espera na porta</span>
              {espera.map((e) => (
                <span
                  key={e.cor}
                  title={`${rotuloCor(e.cor)} · ${NIVEL_RISCO[e.cor]} · alvo ${ALVO_MIN[e.cor] ? `${ALVO_MIN[e.cor]} min` : 'imediato'} · ${e.aguardando} aguardando${e.acimaDoAlvo ? ' · maior espera acima do alvo' : ''}`}
                  className={cn(
                    'rounded-capsula px-[9px] py-0.5 text-rotulo font-semibold whitespace-nowrap tabular',
                    COR_PILULA[e.cor],
                    e.aguardando === 0 && 'opacity-45',
                    e.acimaDoAlvo && 'ring-2 ring-critico ring-offset-2 ring-offset-campo',
                  )}
                >
                  <span className="sr-only">{rotuloCor(e.cor)}: </span>
                  {e.aguardando}{e.maiorMin !== null ? ` · ${formatarDuracao(e.maiorMin)}` : ''}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-auto flex-wrap items-center justify-end gap-2">
          <Link to="/plantao" className="inline-flex items-center gap-1.5 rounded-controle border border-fio bg-superficie px-3.5 py-[7px] text-apoio text-tinta-apoio whitespace-nowrap hover:border-marca hover:text-acao">
            Abrir plantão
          </Link>
          <Link
            to="/plantao/observacao"
            className={cn(
              'inline-flex items-center gap-1.5 rounded-controle border px-3.5 py-[7px] text-apoio whitespace-nowrap',
              nivelObs === 'critico' ? 'border-critico bg-critico font-medium text-white hover:text-white' : nivelObs === 'atencao' ? 'border-atencao/40 bg-alerta-atencao font-medium text-atencao' : 'border-fio bg-superficie text-tinta-apoio hover:border-marca hover:text-acao',
            )}
            title={obsMin === null ? 'Ninguém em observação no seu acesso' : `Maior permanência em observação: ${formatarDuracao(obsMin)} (janela de ${JANELA_OBSERVACAO_MIN / 60} h)`}
          >
            {obsMin === null ? 'Ver observação' : `Observação · maior ${formatarDuracao(obsMin)}`}
            <ArrowRight className="size-[15px]" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  )
}
