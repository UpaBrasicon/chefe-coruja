import { useQuery } from '@tanstack/react-query'
import { MapPin } from 'lucide-react'

import { useUnidade } from '@/contexts/UnidadeContext'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/spinner'
import { dataPorExtenso, dia, hora, semanaCurta } from '@/lib/formato'

// O próximo plantão de quem está logado, pelo relógio do servidor. Sai da tela
// "Fora do seu horário" e aparece também no alto da aba Escala (E3).

const TURNO: Record<string, string> = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite', madrugada: 'Madrugada' }

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

export function ProximoPlantao({ className }: { className?: string }) {
  const { unidadeAtiva } = useUnidade()
  const { data: proximo, isLoading, isError } = useProximoPlantao()
  const outraUnidade = proximo && proximo.unidadeId !== unidadeAtiva?.unidade_id
  return (
    <div className={cn('overflow-hidden rounded-container border border-fio bg-superficie', className)}>
      <div className="border-b border-trilha bg-campo px-4 py-2.5 text-rotulo font-semibold text-tinta-sussurro">
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
          <div className="flex size-[52px] shrink-0 flex-col items-center justify-center rounded-container bg-acao text-sobre-acao" aria-hidden>
            <span className="text-secao leading-none font-semibold tabular">{dia(proximo.inicio)}</span>
            <span className="text-rotulo opacity-80">{semanaCurta(proximo.inicio)}</span>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-corpo font-medium text-tinta">
              {proximo.turno} · {proximo.setor}
            </span>
            <span className="text-apoio text-tinta-sussurro tabular">
              {dataPorExtenso(proximo.inicio)}, {hora(proximo.inicio)} às {hora(proximo.fim)}
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
  )
}
