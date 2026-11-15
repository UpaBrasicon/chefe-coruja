// S7 (C2): faixa dos 15 minutos antes do fim das 12 horas do "Manter
// conectado". Não bloqueia a tela; no prazo, o AuthContext encerra a sessão.
import { Clock } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { hora } from '@/lib/formato'

export function AvisoFimSessao() {
  const { fimSessaoEm } = useAuth()
  if (!fimSessaoEm) return null
  return (
    <div role="status" className="flex items-center gap-2 border-b border-fio bg-alerta-atencao px-4 py-2 text-apoio text-atencao md:px-7">
      <Clock className="size-4 shrink-0" aria-hidden />
      <span>
        Sua sessão termina às <span className="font-semibold tabular">{hora(new Date(fimSessaoEm))}</span>. Salve o que estiver fazendo.
      </span>
    </div>
  )
}
