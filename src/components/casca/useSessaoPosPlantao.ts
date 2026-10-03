import { Clock, MapPin } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { useAvisosFlutuantes } from '@/contexts/AvisosFlutuantesContext'
import type { StatusPlantao } from '@/hooks/usePlantao'

// Fim do plantão (decisão do RT 03/10/2026). A partir do fim do turno há 20 min
// de tolerância para terminar o que está em curso — essa tolerância é do
// SERVIDOR (private.plantoes_agora), então enquanto ela vale o status segue
// 'escala' e tudo funciona. Passados os 20 min o servidor fecha a porta, o
// status vira 'fora' e a sessão fecha na hora, mesmo em uso. Para continuar,
// só o gestor libera (public.liberar_pos_plantao). Vale para quem entra por
// escala; gestor, farmacêutico e administrador não têm plantão.

export function useSessaoPosPlantao(status: StatusPlantao, entraPorEscala: boolean, fimTurnoIso?: string | null) {
  const { avisar } = useAvisosFlutuantes()
  const [encerrada, setEncerrada] = useState(false)
  const anterior = useRef<StatusPlantao>(status)
  const avisouFim = useRef(false)
  const avisouQuase = useRef(false)

  // Fim da tolerância: fim do turno + 20 min (o mesmo da private.tolerancia_fim_plantao).
  const fimTolerancia = fimTurnoIso ? new Date(fimTurnoIso).getTime() + 20 * 60_000 : null

  // A virada escala → fora é o fim da tolerância: o servidor fechou a porta.
  useEffect(() => {
    const era = anterior.current
    anterior.current = status
    if (!entraPorEscala) return
    if ((era === 'escala' || era === 'sem_conexao') && status === 'fora') {
      setEncerrada(true)
    }
  }, [status, entraPorEscala])

  // Novo turno (outro fim de tolerância) rearma os avisos: o gestor pode
  // liberar e o médico voltar a 'escala' com uma janela nova.
  useEffect(() => {
    avisouFim.current = false
    avisouQuase.current = false
  }, [fimTolerancia])

  // Avisos durante a tolerância pós-plantão (ainda 'escala', já passado o fim).
  useEffect(() => {
    if (!entraPorEscala || status !== 'escala' || !fimTolerancia) return
    const tick = () => {
      const agora = Date.now()
      const fimTurno = fimTolerancia - 20 * 60_000
      if (agora < fimTurno) return
      const fechaEm = new Date(fimTolerancia).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
      if (!avisouFim.current) {
        avisouFim.current = true
        avisar({
          tag: 'Turno',
          icone: MapPin,
          quando: 'agora',
          titulo: 'Plantão encerrado',
          texto: `Você tem até ${fechaEm} (20 min) para terminar o que está em curso. Depois disso a sessão fecha, mesmo em uso, e só o gestor libera.`,
        })
      }
      if (agora >= fimTolerancia - 2 * 60_000 && !avisouQuase.current) {
        avisouQuase.current = true
        avisar({
          tag: 'Sessão',
          cor: '#B45309',
          icone: Clock,
          quando: 'agora',
          titulo: 'A sessão fecha em instantes',
          texto: `A tolerância de 20 min acaba às ${fechaEm}. Salve ou emita agora; depois disso, só o gestor libera a continuidade.`,
        })
      }
    }
    tick()
    const t = window.setInterval(tick, 15_000)
    return () => window.clearInterval(t)
  }, [status, entraPorEscala, fimTolerancia, avisar])

  return { encerrada }
}
