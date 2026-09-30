import { useQuery } from '@tanstack/react-query'
import { CalendarClock, LogOut, MapPin } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '@/contexts/AuthContext'
import { useUnidade } from '@/contexts/UnidadeContext'
import { supabase } from '@/lib/supabase'
import { Spinner } from '@/components/ui/spinner'

// Fora do expediente: quem entra pela escala e não está nela agora não vê o
// app — vê quando volta. O próximo plantão vem do servidor (relógio dele, não
// do aparelho); a casca reconfere a escala a cada minuto e libera sozinha
// quando o turno começa (usePlantao).

const TURNO: Record<string, string> = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite', madrugada: 'Madrugada' }
const FUSO = 'America/Sao_Paulo'

const hora = (d: Date) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: FUSO })
const diaMes = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', timeZone: FUSO })
const semana = (d: Date) => d.toLocaleDateString('pt-BR', { weekday: 'short', timeZone: FUSO }).replace('.', '')
const dataLonga = (d: Date) => {
  const t = d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: FUSO })
  return t.charAt(0).toUpperCase() + t.slice(1)
}

/** "em 40 min", "em 5 h 20 min", "em 3 dias" — a partir da hora do servidor. */
function quantoFalta(ms: number) {
  const min = Math.max(1, Math.round(ms / 60_000))
  if (min < 60) return `em ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `em ${h} h${min % 60 ? ` ${min % 60} min` : ''}`
  const dias = Math.round(h / 24)
  return dias === 1 ? 'em 1 dia' : `em ${dias} dias`
}

function useProximoPlantao() {
  return useQuery({
    queryKey: ['meu-proximo-plantao'],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('meu_proximo_plantao')
      if (error) throw error
      const p = data?.[0]
      if (!p) return null
      return {
        unidadeId: p.unidade_id,
        unidade: p.unidade_nome,
        setor: p.setor_nome,
        turno: p.rotulo?.trim() || TURNO[p.turno] || p.turno,
        inicio: new Date(p.inicio),
        fim: new Date(p.fim),
        agoraServidor: new Date(p.agora),
      }
    },
  })
}

export function ForaDoExpediente() {
  const { signOut } = useAuth()
  const { unidadeAtiva } = useUnidade()
  const navigate = useNavigate()
  const { data: proximo, isLoading, isError } = useProximoPlantao()

  async function handleSair() {
    await signOut()
    navigate('/login', { replace: true })
  }

  const outraUnidade = proximo && proximo.unidadeId !== unidadeAtiva?.unidade_id

  return (
    <div className="flex min-h-dvh items-center justify-center bg-campo p-4">
      <section aria-labelledby="fora-titulo" className="w-full max-w-[460px] animate-cc-sobe rounded-cartao border border-fio bg-superficie p-6 shadow-repouso">
        <span className="grid size-[42px] place-items-center rounded-container bg-alerta-marca text-acao" aria-hidden>
          <CalendarClock className="size-[21px]" />
        </span>
        <h1 id="fora-titulo" className="mt-4 text-titulo leading-[1.1] font-semibold tracking-[-0.02em] text-tinta">
          Fora do seu horário
        </h1>
        <p className="mt-1.5 text-apoio text-pretty text-tinta-sussurro">
          Você não está na escala deste momento{unidadeAtiva ? ` em ${unidadeAtiva.unidade.nome}` : ''}. A plataforma abre sozinha quando o seu plantão começar, pelo relógio do servidor.
        </p>

        <div className="mt-5 overflow-hidden rounded-container border border-fio">
          <div className="border-b border-trilha bg-campo px-4 py-2.5 text-rotulo font-semibold tracking-[0.06em] text-tinta-sussurro uppercase">
            Próximo plantão
          </div>
          {isLoading ? (
            <div className="flex justify-center px-4 py-5">
              <Spinner rotulo="Lendo a escala" />
            </div>
          ) : isError ? (
            <p className="px-4 py-4 text-apoio text-tinta-sussurro">Não foi possível ler a escala agora. A tela tenta de novo em um minuto.</p>
          ) : !proximo ? (
            <p className="px-4 py-4 text-apoio text-pretty text-tinta-sussurro">
              Nenhum plantão futuro no seu nome. Se isso não confere, fale com a coordenação da unidade.
            </p>
          ) : (
            <div className="flex items-center gap-3.5 px-4 py-3.5">
              <div className="flex size-[52px] shrink-0 flex-col items-center justify-center rounded-container bg-acao text-white" aria-hidden>
                <span className="text-secao leading-none font-semibold tabular">{diaMes(proximo.inicio)}</span>
                <span className="text-rotulo opacity-80">{semana(proximo.inicio)}</span>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-corpo font-medium text-tinta">
                  {proximo.turno} · {proximo.setor}
                </span>
                <span className="text-apoio text-tinta-sussurro tabular">
                  {dataLonga(proximo.inicio)}, {hora(proximo.inicio)} às {hora(proximo.fim)}
                </span>
                {outraUnidade && (
                  <span className="flex items-center gap-1 text-apoio text-tinta-apoio">
                    <MapPin className="size-3.5 shrink-0" aria-hidden />
                    {proximo.unidade}
                  </span>
                )}
              </div>
              <span className="shrink-0 rounded-capsula bg-alerta-marca px-2.5 py-1 text-rotulo font-medium text-acao">
                {quantoFalta(proximo.inicio.getTime() - proximo.agoraServidor.getTime())}
              </span>
            </div>
          )}
        </div>

        <p className="mt-4 text-apoio text-pretty text-tinta-sussurro">
          Não é preciso sair e entrar de novo: esta tela confere a escala a cada minuto. Troca ou plantão extra passam pela coordenação.
        </p>

        <button
          type="button"
          onClick={handleSair}
          className="mt-5 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-controle border border-fio bg-superficie text-controle font-medium text-tinta-apoio hover:border-marca hover:text-acao"
        >
          <LogOut className="size-4" aria-hidden />
          Sair
        </button>
      </section>
    </div>
  )
}
