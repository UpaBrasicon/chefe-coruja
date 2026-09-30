import * as React from 'react'
import { Clock, LogOut, MapPin, X } from 'lucide-react'

import { useUnidade } from '@/contexts/UnidadeContext'
import { FormularioCheckin } from '@/components/checkin/FormularioCheckin'
import type { SituacaoCheckin } from '@/hooks/usePlantao'

/**
 * A tela de check-in da casca (ADR 0003; regra de 30/09/2026).
 *
 * Quem entra pela escala tem até a tolerância da unidade (padrão 30 min)
 * depois do início do plantão para fazer o check-in. Passada a tolerância sem
 * check-in, o SERVIDOR fecha a porta (private.plantoes_agora) e a casca mostra
 * só esta tela: fazer o check-in ou sair. Feito o check-in (o atraso fica na
 * auditoria do gestor), a porta abre na hora — sem liberação de ninguém.
 * Antes da tolerância, a mesma tela abre pelo aviso de check-in pendente
 * (AvisoCheckinPendente), com o tempo que falta.
 *
 * Tudo pelo relógio do servidor: a hora vem de situacao_checkin e anda aqui
 * pelo desvio medido na resposta.
 */

const TURNO: Record<string, string> = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite', madrugada: 'Madrugada' }
const FUSO = 'America/Sao_Paulo'
const hora = (d: Date) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: FUSO })

/** Hora do servidor (ms), andando no aparelho pelo desvio da última leitura. */
function useAgoraServidor(situacao: SituacaoCheckin | null, passoMs = 15_000) {
  const desvio = situacao ? Date.parse(situacao.servidor) - situacao.recebidoEm : null
  const [agora, setAgora] = React.useState<number | null>(null)
  React.useEffect(() => {
    if (desvio === null) return
    const tique = () => setAgora(Date.now() + desvio)
    tique()
    const t = window.setInterval(tique, passoMs)
    return () => window.clearInterval(t)
  }, [desvio, passoMs])
  return desvio === null ? null : agora
}

function minutos(ms: number) {
  const min = Math.max(0, Math.round(ms / 60_000))
  if (min < 60) return `${min} min`
  return `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ''}`
}

export function GateCheckIn({
  situacao,
  bloqueado,
  onFeito,
  onFechar,
  onSair,
}: {
  situacao: SituacaoCheckin | null
  /** true: a tolerância venceu e o app está fechado; false: aberto pelo aviso. */
  bloqueado: boolean
  onFeito: () => void
  onFechar?: () => void
  onSair: () => void
}) {
  const { unidadeAtiva } = useUnidade()
  const agora = useAgoraServidor(situacao)
  const p = situacao?.pendente ?? null
  const inicio = p ? new Date(p.inicio) : null
  const prazo = p ? new Date(p.prazo) : null
  const atraso = agora !== null && inicio ? agora - inicio.getTime() : null
  const falta = agora !== null && prazo ? prazo.getTime() - agora : null

  return (
    <div
      className={
        bloqueado
          ? 'flex min-h-dvh items-center justify-center bg-campo p-4'
          : 'fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm'
      }
      role={bloqueado ? undefined : 'dialog'}
      aria-modal={bloqueado ? undefined : true}
      aria-labelledby="checkin-titulo"
    >
      <section className="w-full max-w-[460px] animate-cc-sobe rounded-cartao border border-fio bg-superficie p-6 shadow-repouso">
        <div className="flex items-start justify-between gap-3">
          <span className="grid size-[42px] place-items-center rounded-container bg-alerta-marca text-acao" aria-hidden>
            <MapPin className="size-[21px]" />
          </span>
          {!bloqueado && onFechar && (
            <button
              type="button"
              onClick={onFechar}
              aria-label="Fechar"
              className="grid size-8 place-items-center rounded-controle text-tinta-sussurro hover:bg-campo hover:text-tinta"
            >
              <X className="size-4" aria-hidden />
            </button>
          )}
        </div>
        <h1 id="checkin-titulo" className="mt-4 text-titulo leading-[1.1] font-semibold tracking-[-0.02em] text-tinta">
          {bloqueado ? 'Faça o check-in para entrar' : 'Check-in do plantão'}
        </h1>
        <p className="mt-1.5 text-apoio text-pretty text-tinta-sussurro">
          {bloqueado
            ? `O prazo de ${situacao?.tolerancia_min ?? 30} min depois do início do plantão passou sem check-in, e o acesso ficou fechado. Faça o check-in agora: o acesso volta na hora e o atraso fica registrado para a coordenação.`
            : `Você tem até ${situacao?.tolerancia_min ?? 30} min depois do início do plantão para fazer o check-in. Depois disso, o acesso fica fechado até o check-in.`}
        </p>

        {p && inicio && (
          <div className="mt-5 overflow-hidden rounded-container border border-fio">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-corpo font-medium text-tinta">
                  {TURNO[p.turno] ?? p.turno} · {p.setor_nome}
                </span>
                <span className="text-apoio text-tinta-sussurro tabular">
                  {hora(inicio)} às {hora(new Date(p.fim))}
                  {unidadeAtiva ? ` · ${unidadeAtiva.unidade.nome}` : ''}
                </span>
              </div>
              {falta !== null && falta > 0 ? (
                <span className="shrink-0 rounded-capsula bg-alerta-marca px-2.5 py-1 text-rotulo font-medium text-acao tabular">
                  faltam {minutos(falta)}
                </span>
              ) : (
                atraso !== null && (
                  <span className="shrink-0 rounded-capsula bg-alerta-atencao px-2.5 py-1 text-rotulo font-medium text-atencao tabular">
                    {minutos(atraso)} de atraso
                  </span>
                )
              )}
            </div>
          </div>
        )}

        <div className="mt-5">
          <FormularioCheckin unidadeId={unidadeAtiva?.unidade_id} comObservacao={false} rotulo="Fazer check-in agora" tamanho="lg" onFeito={onFeito} />
        </div>

        <p className="mt-4 flex items-center gap-1.5 text-rotulo text-tinta-sussurro tabular">
          <Clock className="size-3" aria-hidden />
          {agora !== null ? `Relógio da unidade ${hora(new Date(agora))} (servidor)` : 'Sincronizando com o relógio do servidor…'}
        </p>
        <p className="mt-1 text-rotulo text-pretty text-tinta-sussurro">
          A localização é registrada (dentro ou fora do raio da unidade); fora do raio ou sem GPS, o check-in pede uma justificativa.
        </p>

        {bloqueado && (
          <button
            type="button"
            onClick={onSair}
            className="mt-5 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-controle border border-fio bg-superficie text-controle font-medium text-tinta-apoio hover:border-marca hover:text-acao"
          >
            <LogOut className="size-4" aria-hidden />
            Sair
          </button>
        )}
      </section>
    </div>
  )
}

/**
 * Aviso de check-in pendente, antes da tolerância: quanto falta pelo relógio
 * do servidor. Ao vencer o prazo chama onVencer (a casca relê a situação e
 * fecha a porta sem esperar o minuto seguinte).
 */
export function AvisoCheckinPendente({
  situacao,
  onAbrir,
  onVencer,
}: {
  situacao: SituacaoCheckin
  onAbrir: () => void
  onVencer: () => void
}) {
  const agora = useAgoraServidor(situacao, 5_000)
  const prazo = situacao.pendente ? Date.parse(situacao.pendente.prazo) : null
  const falta = agora !== null && prazo !== null ? prazo - agora : null
  const vencido = falta !== null && falta <= 0
  React.useEffect(() => {
    if (vencido) onVencer()
  }, [vencido, onVencer])
  if (!situacao.pendente || prazo === null) return null

  return (
    <div role="status" className="flex items-center justify-between gap-3 border-b border-fio bg-alerta-atencao px-4 py-2 text-apoio text-atencao md:px-7">
      <span className="flex items-center gap-2">
        <MapPin className="size-4 shrink-0" aria-hidden />
        {vencido ? (
          <span>
            Check-in pendente em {situacao.pendente.setor_nome}: o prazo das <span className="font-semibold tabular">{hora(new Date(prazo))}</span> passou, e esse setor fica fechado até o check-in.
          </span>
        ) : (
          <span>
            Check-in pendente: faça até <span className="font-semibold tabular">{hora(new Date(prazo))}</span>
            {falta !== null ? <span className="tabular"> (faltam {minutos(falta)})</span> : null}. Depois disso, o acesso fica fechado até o check-in.
          </span>
        )}
      </span>
      <button
        type="button"
        onClick={onAbrir}
        className="shrink-0 rounded-controle bg-acao px-3 py-1 text-rotulo font-medium text-white hover:bg-acao-pressionada"
      >
        Fazer check-in
      </button>
    </div>
  )
}
