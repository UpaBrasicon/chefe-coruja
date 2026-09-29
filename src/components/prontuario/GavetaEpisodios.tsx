// ─────────────────────────────────────────────────────────────────────────────
// Gaveta do atendimento SEM DESFECHO (protótipo D5, com a regra do usuário de
// 29/09/2026): mostra ao médico que está com o paciente o atendimento anterior
// que ficou em aberto — sem alta, sem encaminhamento para outro setor e sem
// internação —, para ninguém esquecer uma pessoa triada e nunca atendida.
// O histórico já encerrado não aparece aqui; ele segue pelo pedido de acesso
// ao prontuário.
// ─────────────────────────────────────────────────────────────────────────────
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'

import { CORES_RISCO, type CorRisco } from '@/domain/risco'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Gaveta, GavetaCabeca, GavetaPe } from '@/components/ui/gaveta'
import { Spinner } from '@/components/ui/spinner'

import { useEpisodiosAnteriores } from './useEpisodiosAnteriores'

const quando = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }) : ''

const ETAPA: Record<string, string> = {
  triagem: 'Aguardando triagem',
  atendimento: 'Aguardando ou em atendimento médico',
}

function tempoDesde(iso: string) {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000))
  if (min < 60) return `há ${min} min`
  const h = Math.round(min / 60)
  if (h < 48) return `há ${h} h`
  return `há ${Math.round(h / 24)} dias`
}

export function GavetaEpisodios({
  pacienteId,
  nome,
  episodioAtualId,
  aberta,
  onAbertaChange,
}: {
  pacienteId: string
  nome: string
  /** O atendimento que está na tela: não conta como "anterior". */
  episodioAtualId?: string | null
  aberta: boolean
  onAbertaChange: (v: boolean) => void
}) {
  const q = useEpisodiosAnteriores(pacienteId, episodioAtualId)
  const lista = q.data ?? []

  return (
    <Gaveta aberta={aberta} onAbertaChange={onAbertaChange} rotulo="Atendimento sem desfecho">
      <GavetaCabeca sobre="Atendimento sem desfecho" titulo={nome} detalhe={q.data ? (lista.length ? 'Ficou sem alta, sem encaminhamento e sem internação' : 'Nenhum atendimento em aberto') : undefined} />

      {q.isLoading && (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      )}
      {q.error && (
        <p className="mx-[22px] my-4 rounded-controle border border-critico/30 bg-alerta-critico p-3 text-apoio text-critico">{(q.error as Error).message}</p>
      )}

      {lista.map((a) => {
        const cor = CORES_RISCO.includes(a.cor_atual as CorRisco) ? (a.cor_atual as CorRisco) : null
        return (
          <div key={a.episodio_id} className="flex flex-col gap-2 border-b border-trilha px-[22px] py-4">
            <div className="flex flex-wrap items-baseline gap-2.5">
              <span className="text-corpo font-semibold tracking-[-0.01em] text-tinta tabular">{quando(a.chegada_em)}</span>
              <span className="text-apoio text-tinta-sussurro">{tempoDesde(a.chegada_em)}</span>
              <span className="rounded-capsula bg-alerta-atencao px-2 py-[3px] text-rotulo font-semibold tracking-[0.04em] text-atencao uppercase">Sem desfecho</span>
            </div>
            <span className="text-corpo text-tinta">{a.queixa}</span>
            <span className="text-apoio text-tinta-sussurro">
              {[a.setor_nome, ETAPA[a.etapa] ?? a.etapa, cor ? `classificação ${cor}` : 'sem classificação', a.medico_nome && `com ${a.medico_nome}`]
                .filter(Boolean)
                .join(' · ')}
            </span>
            {a.ultimo_registro && (
              <div className="flex flex-col gap-1 rounded-controle bg-campo px-3.5 py-3">
                <span className="rotulo text-tinta-sussurro">Último registro · {quando(a.ultimo_registro_em)}</span>
                <p className="text-controle leading-[1.6] whitespace-pre-line text-pretty text-tinta-apoio">{a.ultimo_registro}</p>
              </div>
            )}
            {a.noMeuPlantao ? (
              <Link to="/atendimento" className="self-start text-apoio font-medium text-acao hover:text-acao-pressionada">
                Está na sua fila: abrir o Atendimento para dar o desfecho
              </Link>
            ) : (
              <span className="text-apoio text-pretty text-tinta-sussurro">
                O desfecho é dado por quem está de plantão {a.setor_nome ? `no ${a.setor_nome}` : 'no setor do atendimento'}. Avise a equipe de lá ou o gestor.
              </span>
            )}
          </div>
        )
      })}

      {q.data && lista.length === 0 && (
        <div className="flex flex-col items-center gap-1.5 px-6 py-12 text-center">
          <CheckCircle2 className="size-[22px] text-conforme" aria-hidden />
          <span className="text-corpo font-semibold text-tinta">Nenhum atendimento em aberto</span>
          <span className="max-w-[34ch] text-apoio text-pretty text-tinta-sussurro">Todos os atendimentos anteriores desta pessoa têm desfecho registrado.</span>
        </div>
      )}

      <GavetaPe className="text-pretty">
        Você vê este atendimento porque {nome} está sob o seu cuidado agora. O histórico já encerrado segue pelo pedido de acesso ao prontuário.
      </GavetaPe>
    </Gaveta>
  )
}

/**
 * Aviso no cabeçalho do leito e da porta: só aparece quando há atendimento
 * sem desfecho, em âmbar, e abre a gaveta. Sem pendência, não ocupa lugar.
 */
export function BotaoEpisodiosAnteriores({
  pacienteId,
  nome,
  episodioAtualId,
  className,
}: {
  pacienteId: string
  nome: string
  episodioAtualId?: string | null
  className?: string
}) {
  const [aberta, setAberta] = React.useState(false)
  const q = useEpisodiosAnteriores(pacienteId, episodioAtualId)
  if (!q.data?.length) return null
  return (
    <>
      <Button size="sm" variant="outline" className={cn('border-atencao/40 bg-alerta-atencao text-atencao hover:border-atencao hover:text-atencao', className)} onClick={() => setAberta(true)}>
        <AlertTriangle />
        Atendimento sem desfecho
      </Button>
      <GavetaEpisodios pacienteId={pacienteId} nome={nome} episodioAtualId={episodioAtualId} aberta={aberta} onAbertaChange={setAberta} />
    </>
  )
}
