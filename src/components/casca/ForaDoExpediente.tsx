import * as React from 'react'
import { ArrowLeft, CalendarClock, CalendarDays, LogOut, UserCog } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { PAPEIS_POR_ESCALA, PAPEL_LABEL, ROTA_INICIAL } from '@/lib/constants'
import { useAuth } from '@/contexts/AuthContext'
import { useUnidade } from '@/contexts/UnidadeContext'
import { ProximoPlantao } from '@/components/casca/ProximoPlantao'
import { Button } from '@/components/ui/button'
import { EscalaEquipe } from '@/components/escala/EscalaEquipe'

// Fora do expediente: quem entra pela escala e não está nela agora não vê o
// app — vê quando volta. O próximo plantão vem do servidor (relógio dele, não
// do aparelho); a casca reconfere a escala a cada minuto e libera sozinha
// quando o turno começa (usePlantao). Fora do plantão abre só a Escala (aba
// Escala, E3; resposta 3 do RT em 27/10/2026), nada clínico.

export function ForaDoExpediente() {
  const { signOut } = useAuth()
  const { unidadeAtiva, papeisDaUnidade, setPapelAtivo } = useUnidade()
  const navigate = useNavigate()
  const outrosPapeis = papeisDaUnidade.filter((p) => !PAPEIS_POR_ESCALA.includes(p))
  const [verEscala, setVerEscala] = React.useState(false)

  async function handleSair() {
    await signOut()
    navigate('/login', { replace: true })
  }

  if (verEscala) {
    return (
      <div className="min-h-dvh bg-campo p-4">
        <div className="mx-auto flex max-w-6xl flex-col gap-3">
          <Button variant="ghost" size="sm" className="w-fit" onClick={() => setVerEscala(false)}>
            <ArrowLeft /> Voltar
          </Button>
          <EscalaEquipe />
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-campo p-4">
      <section aria-labelledby="fora-titulo" className="w-full max-w-[460px] animate-cc-sobe rounded-cartao border border-fio bg-superficie p-6 shadow-repouso">
        <span className="grid size-[42px] place-items-center rounded-container bg-alerta-marca text-acao" aria-hidden>
          <CalendarClock className="size-[21px]" />
        </span>
        {/* padrao-ok: título da tela fora do horário (tela cheia, não é página) */}
        <h1 id="fora-titulo" className="mt-4 text-titulo leading-[1.1] font-semibold tracking-[-0.02em] text-tinta">
          Fora do seu horário
        </h1>
        <p className="mt-1.5 text-apoio text-pretty text-tinta-sussurro">
          Você não está na escala deste momento{unidadeAtiva ? ` em ${unidadeAtiva.unidade.nome}` : ''}. A plataforma abre sozinha quando o seu plantão começar, pelo relógio do servidor.
        </p>

        <ProximoPlantao className="mt-5" />

        <Button variant="outline" className="mt-4 w-full" onClick={() => setVerEscala(true)}>
          <CalendarDays /> Ver minha escala
        </Button>

        <p className="mt-4 text-apoio text-pretty text-tinta-sussurro">
          Não é preciso sair e entrar de novo: esta tela confere a escala a cada minuto. Troca ou plantão extra passam pela coordenação.
        </p>

        {/* quem tem outro papel na unidade, que não depende de escala (gestão,
            farmácia, administração), troca para ele em vez de ficar preso aqui */}
        {outrosPapeis.length > 0 && (
          <div className="mt-5 flex flex-col gap-2">
            {outrosPapeis.map((p) => (
              <button key={p} type="button" onClick={() => { setPapelAtivo(p); navigate(ROTA_INICIAL[p], { replace: true }) }}
                className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-controle bg-acao text-controle font-medium text-sobre-acao hover:bg-acao/90">
                <UserCog className="size-4" aria-hidden />
                Entrar como {PAPEL_LABEL[p]}
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={handleSair}
          className="mt-5 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-controle border border-fio bg-superficie text-controle font-medium text-tinta-apoio hover:border-acao hover:text-acao"
        >
          <LogOut className="size-4" aria-hidden />
          Sair
        </button>
      </section>
    </div>
  )
}
