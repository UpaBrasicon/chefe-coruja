import { Clock, MapPin } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { useAvisosFlutuantes } from '@/contexts/AvisosFlutuantesContext'
import type { StatusPlantao } from '@/hooks/usePlantao'

// Fim do plantão (P/index.html vigiarPlantao/vigiarOciosidade, ~21741): o
// check-out automático acontece no servidor na hora da escala. A partir daí a
// sessão só fica aberta enquanto houver uso — 5 minutos sem mouse nem teclado
// e ela fecha sozinha, com aviso 1 minuto antes. Vale para quem entra por
// escala; gestor, farmacêutico e administrador não têm plantão.

const LIMITE_MS = 5 * 60_000
const EVENTOS = ['pointerdown', 'pointermove', 'keydown', 'input', 'scroll', 'touchstart'] as const

export function useSessaoPosPlantao(status: StatusPlantao, entraPorEscala: boolean) {
  const { avisar } = useAvisosFlutuantes()
  const [posPlantao, setPosPlantao] = useState(false)
  const [encerrada, setEncerrada] = useState(false)
  const anterior = useRef<StatusPlantao>(status)
  const ultimaAtividade = useRef(0)
  const avisou = useRef(false)

  // A virada escala → fora durante a sessão é o fim do plantão.
  useEffect(() => {
    const era = anterior.current
    anterior.current = status
    if (!entraPorEscala) return
    if ((era === 'escala' || era === 'sem_conexao') && status === 'fora') {
      const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
      ultimaAtividade.current = Date.now()
      setPosPlantao(true)
      avisar({
        tag: 'Turno',
        icone: MapPin,
        quando: 'agora',
        titulo: `Plantão encerrado às ${hora}`,
        texto: 'O check-out automático é feito pela escala. A sessão fecha sozinha depois de 5 minutos sem uso.',
      })
    }
  }, [status, entraPorEscala, avisar])

  useEffect(() => {
    if (!posPlantao || encerrada) return
    ultimaAtividade.current = Date.now()
    const aoAgir = () => {
      ultimaAtividade.current = Date.now()
      avisou.current = false
    }
    EVENTOS.forEach((ev) => window.addEventListener(ev, aoAgir, { passive: true }))
    const t = window.setInterval(() => {
      const parado = Date.now() - ultimaAtividade.current
      if (parado >= LIMITE_MS) {
        setEncerrada(true)
      } else if (parado >= LIMITE_MS - 60_000 && !avisou.current) {
        avisou.current = true
        avisar({
          tag: 'Sessão',
          cor: '#B45309',
          icone: Clock,
          quando: 'agora',
          titulo: 'A sessão fecha em 1 minuto',
          texto: 'Plantão encerrado e sem atividade. Mexa o mouse ou continue escrevendo para manter aberta.',
        })
      }
    }, 5000)
    return () => {
      EVENTOS.forEach((ev) => window.removeEventListener(ev, aoAgir))
      window.clearInterval(t)
    }
  }, [posPlantao, encerrada, avisar])

  return { posPlantao, encerrada }
}
