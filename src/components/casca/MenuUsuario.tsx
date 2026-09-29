import { Popover as PopoverPrimitive } from '@base-ui/react/popover'
import { Building2, Lock, LogOut, Repeat, SlidersHorizontal, UserRound } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { PAPEL_LABEL } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { Papel } from '@/types/database'

// Menu do usuário (P/index.html 1057–1092, 25/09): o avatar com as iniciais
// abre nome, registro, perfil e unidade; troca de unidade e de perfil; as
// preferências de prescrição (só plantonista); e Sair, que passa pela
// pergunta de saída.

function iniciais(nome: string | undefined) {
  const w = (nome ?? '')
    .replace(/^(Dra?|Enf|Téc|Ft|Nut)\.\s*/i, '')
    .split(/\s+/)
    .filter((x) => x && !/^(da|de|do|dos|das|e)$/i.test(x))
  return (((w[0] ?? '')[0] ?? '') + ((w.length > 1 ? w[w.length - 1][0] : (w[0] ?? '')[1]) ?? '')).toUpperCase()
}

export function MenuUsuario({
  nome,
  registro,
  fotoUrl,
  unidade,
  podeTrocarUnidade,
  papeis,
  papelAtivo,
  onTrocarPapel,
  onSair,
  onBloquear,
  tamanho = 32,
}: {
  nome?: string
  registro?: string | null
  fotoUrl?: string | null
  unidade?: string
  podeTrocarUnidade: boolean
  papeis: Papel[]
  papelAtivo: Papel | null
  onTrocarPapel: (p: Papel) => void
  onSair: () => void
  /** Bloqueia a tela agora (quem sai da frente do computador). */
  onBloquear: () => void
  tamanho?: 32 | 38
}) {
  const navigate = useNavigate()
  const [aberto, setAberto] = useState(false)
  const ir = (to: string) => {
    setAberto(false)
    navigate(to)
  }
  const ini = iniciais(nome)

  return (
    <PopoverPrimitive.Root open={aberto} onOpenChange={setAberto}>
      <PopoverPrimitive.Trigger
        aria-label="Menu do usuário"
        className={cn(
          'grid shrink-0 place-items-center overflow-hidden rounded-capsula bg-fio font-semibold text-tinta-apoio hover:bg-fio-forte',
          tamanho === 32 ? 'size-8 text-rotulo' : 'size-[38px] text-apoio',
        )}
      >
        {fotoUrl ? <img src={fotoUrl} alt="" className="size-full object-cover" /> : ini || <UserRound className="size-4" aria-hidden />}
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner side="bottom" align="end" sideOffset={8} className="z-[80]">
          <PopoverPrimitive.Popup className="flex w-[300px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-menu border border-fio bg-superficie text-tinta shadow-popover outline-none data-open:animate-cc-dlg">
            <div className="flex items-center gap-3 px-4 pt-4 pb-3.5">
              <span className="grid size-10 shrink-0 place-items-center rounded-capsula bg-fio text-controle font-semibold text-tinta-apoio">{ini}</span>
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-corpo font-semibold text-tinta">{nome}</span>
                {registro && <span className="text-apoio text-tinta-apoio">{registro}</span>}
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-apoio text-tinta-sussurro">{papelAtivo ? PAPEL_LABEL[papelAtivo] : ''}</span>
                  {podeTrocarUnidade && (
                    <button type="button" onClick={() => ir('/seletor')} className="flex items-center gap-[5px] text-apoio whitespace-nowrap text-acao hover:text-acao-pressionada">
                      <Repeat className="size-[13px]" aria-hidden />
                      Trocar unidade
                    </button>
                  )}
                </div>
              </div>
            </div>
            {unidade && (
              <div className="flex items-center gap-[7px] px-4 pb-3.5 text-apoio text-tinta-sussurro">
                <Building2 className="size-3.5 shrink-0" aria-hidden />
                <span>{unidade}</span>
              </div>
            )}
            {papeis.length > 1 && (
              <div className="flex flex-col gap-2 border-t border-trilha px-4 py-3">
                <span className="text-[11px] font-semibold tracking-[0.06em] text-tinta-sussurro uppercase">Trocar perfil</span>
                <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Perfil em uso">
                  {papeis.map((p) => {
                    const on = p === papelAtivo
                    return (
                      <button
                        key={p}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => {
                          setAberto(false)
                          if (!on) onTrocarPapel(p)
                        }}
                        className={cn(
                          'rounded-capsula px-2.5 py-[3px] text-rotulo whitespace-nowrap hover:text-acao',
                          on ? 'bg-marca/10 font-semibold text-acao' : 'text-tinta-sussurro',
                        )}
                      >
                        {PAPEL_LABEL[p]}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            <div className="flex flex-col gap-0.5 border-t border-trilha p-1.5">
              <button type="button" onClick={() => ir('/perfil')} className="flex min-h-11 items-center gap-2.5 rounded-controle-sm px-2.5 py-2.5 text-left text-controle text-tinta hover:bg-trilha">
                <UserRound className="size-4 text-tinta-sussurro" aria-hidden />
                Meu perfil
              </button>
              {papelAtivo === 'plantonista' && (
                <button type="button" onClick={() => ir('/preferencias-prescricao')} className="flex min-h-11 items-center gap-2.5 rounded-controle-sm px-2.5 py-2.5 text-left text-controle text-tinta hover:bg-trilha">
                  <SlidersHorizontal className="size-4 text-tinta-sussurro" aria-hidden />
                  Minhas preferências de prescrição
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setAberto(false)
                  onBloquear()
                }}
                className="flex min-h-11 items-center gap-2.5 rounded-controle-sm px-2.5 py-2.5 text-left text-controle text-tinta hover:bg-trilha"
              >
                <Lock className="size-4 text-tinta-sussurro" aria-hidden />
                Bloquear tela
              </button>
              <button
                type="button"
                onClick={() => {
                  setAberto(false)
                  onSair()
                }}
                className="flex min-h-11 items-center gap-2.5 rounded-controle-sm px-2.5 py-2.5 text-left text-controle text-critico hover:bg-[#FEF2F2]"
              >
                <LogOut className="size-4" aria-hidden />
                Sair
              </button>
            </div>
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
