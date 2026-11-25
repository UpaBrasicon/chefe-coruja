import { Popover as PopoverPrimitive } from '@base-ui/react/popover'
import { Building2, ChevronRight, Compass, Lock, LogOut, Monitor, Moon, Repeat, ShieldCheck, SlidersHorizontal, Sun, UserRound } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { BotaoLinha } from '@/components/ui/botao-linha'
import { guiaDoPapel } from '@/domain/primeirosPassos'
import { reabrirPrimeirosPassos } from '@/hooks/usePrimeirosPassos'
import { Button } from '@/components/ui/button'
import { PAPEL_LABEL } from '@/lib/constants'
import { recolherOutrasUnidades, totalDePerfis, type GrupoDePerfis } from '@/lib/perfisPorUnidade'
import { TEMA_ESCURO_LIBERADO, TEMAS, type Tema } from '@/lib/tema'
import { cn } from '@/lib/utils'
import type { Papel } from '@/types/database'

// Menu do usuário (P/index.html 1057–1092, 25/09): o avatar com as iniciais
// abre nome, registro, perfil e unidade; troca de unidade e de perfil; as
// preferências de prescrição (só plantonista); e Sair, que passa pela
// pergunta de saída. "Trocar perfil" mostra os papéis de todas as unidades,
// agrupados por unidade, a ativa primeiro (RT, 25/11/2026: dentro da UBS o
// médico do hospital, o regulador e o NIR pareciam ter sumido). O tema (claro, escuro, automático) aparece quando o escuro
// for liberado (guia do padrão, 1.4; TEMA_ESCURO_LIBERADO em lib/tema.ts).

const ICONE_TEMA = { claro: Sun, escuro: Moon, automatico: Monitor } as const

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
  grupos,
  papelAtivo,
  onTrocarPerfil,
  onSair,
  onBloquear,
  primeirosPassos,
  tema = 'automatico',
  onTrocarTema,
  tamanho = 32,
}: {
  nome?: string
  registro?: string | null
  fotoUrl?: string | null
  unidade?: string
  podeTrocarUnidade: boolean
  /** Papéis da pessoa por unidade (agruparPerfisPorUnidade), a ativa primeiro. */
  grupos: GrupoDePerfis[]
  papelAtivo: Papel | null
  /** Troca o perfil; de outra unidade, troca a unidade junto. */
  onTrocarPerfil: (papel: Papel, unidadeId: string) => void
  onSair: () => void
  /** Bloqueia a tela agora (quem sai da frente do computador). */
  onBloquear: () => void
  /** Fase 1, item 13: para reabrir o cartão "Primeiros passos" do papel. */
  primeirosPassos?: { perfilId?: string; inicio: string; rotas: string[] }
  tema?: Tema
  onTrocarTema?: (tema: Tema) => void
  tamanho?: 32 | 38
}) {
  const navigate = useNavigate()
  const [aberto, setAberto] = useState(false)
  // outras unidades abertas à mão quando a lista vem recolhida
  const [abertas, setAbertas] = useState<ReadonlySet<string>>(() => new Set())
  const recolher = recolherOutrasUnidades(grupos)
  const alternarGrupo = (id: string) =>
    setAbertas((a) => {
      const n = new Set(a)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
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
          <PopoverPrimitive.Popup className="flex w-[300px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-container border border-fio bg-superficie text-tinta shadow-popover outline-none data-open:animate-cc-dlg">
            <div className="flex items-center gap-3 px-4 pt-4 pb-3.5">
              <span className="grid size-10 shrink-0 place-items-center rounded-capsula bg-fio text-controle font-semibold text-tinta-apoio">{ini}</span>
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-corpo font-semibold text-tinta">{nome}</span>
                {registro && <span className="text-apoio text-tinta-apoio">{registro}</span>}
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-apoio text-tinta-sussurro">{[papelAtivo ? PAPEL_LABEL[papelAtivo] : '', unidade].filter(Boolean).join(' · ')}</span>
                  {podeTrocarUnidade && (
                    <button type="button" onClick={() => ir('/seletor')} className="flex items-center gap-[5px] text-apoio whitespace-nowrap text-acao hover:text-acao-pressionada">
                      <Repeat className="size-[13px]" aria-hidden />
                      Trocar unidade
                    </button>
                  )}
                </div>
              </div>
            </div>
            {totalDePerfis(grupos) > 1 && (
              <div className="flex flex-col gap-2 border-t border-trilha px-4 py-3">
                <span className="rotulo text-tinta-sussurro">Trocar perfil</span>
                <div className="-mr-2 flex max-h-[min(45vh,320px)] flex-col gap-2.5 overflow-y-auto pr-2">
                  {grupos.map((g) => {
                    const recolhivel = recolher && !g.ativa
                    const fechado = recolhivel && !abertas.has(g.unidadeId)
                    return (
                      <div key={g.unidadeId} className="flex flex-col gap-1">
                        {recolhivel ? (
                          <button
                            type="button"
                            aria-expanded={!fechado}
                            onClick={() => alternarGrupo(g.unidadeId)}
                            className="flex min-h-7 items-center gap-1.5 text-left text-rotulo text-tinta-apoio hover:text-acao"
                          >
                            <ChevronRight className={cn('size-3.5 shrink-0 transition-transform', !fechado && 'rotate-90')} aria-hidden />
                            <span className="min-w-0 flex-1 truncate">{g.nome}</span>
                            <span className="shrink-0 text-tinta-sussurro">
                              {g.papeis.length} {g.papeis.length === 1 ? 'perfil' : 'perfis'}
                            </span>
                          </button>
                        ) : (
                          <span className="flex min-h-7 items-center gap-1.5 text-rotulo text-tinta-apoio">
                            <Building2 className="size-3.5 shrink-0" aria-hidden />
                            <span className="min-w-0 truncate">{g.nome}</span>
                            {g.ativa && <span className="shrink-0 text-tinta-sussurro">· em uso</span>}
                          </span>
                        )}
                        {!fechado && (
                          <div className="flex flex-wrap gap-1.5 pl-5" role="radiogroup" aria-label={`Perfis em ${g.nome}`}>
                            {g.papeis.map((p) => {
                              const on = g.ativa && p === papelAtivo
                              return (
                                <button
                                  key={p}
                                  type="button"
                                  role="radio"
                                  aria-checked={on}
                                  aria-label={`${PAPEL_LABEL[p]} · ${g.nome}`}
                                  onClick={() => {
                                    setAberto(false)
                                    if (!on) onTrocarPerfil(p, g.unidadeId)
                                  }}
                                  className={cn(
                                    'rounded-capsula px-2.5 py-[3px] text-rotulo whitespace-nowrap hover:text-acao',
                                    on ? 'bg-acao/10 font-semibold text-acao' : 'text-tinta-sussurro',
                                  )}
                                >
                                  {PAPEL_LABEL[p]}
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            {TEMA_ESCURO_LIBERADO && onTrocarTema && (
              <div className="flex flex-col gap-2 border-t border-trilha px-4 py-3">
                <span className="rotulo text-tinta-sussurro">Tema</span>
                <div className="flex gap-1.5" role="radiogroup" aria-label="Tema da tela">
                  {TEMAS.map(({ valor, rotulo }) => {
                    const Icone = ICONE_TEMA[valor]
                    const on = valor === tema
                    return (
                      <Button
                        key={valor}
                        size="sm"
                        variant={on ? 'secondary' : 'ghost'}
                        role="radio"
                        aria-checked={on}
                        onClick={() => onTrocarTema(valor)}
                      >
                        <Icone aria-hidden />
                        {rotulo}
                      </Button>
                    )
                  })}
                </div>
              </div>
            )}
            <div className="flex flex-col gap-0.5 border-t border-trilha p-1.5">
              <button type="button" onClick={() => ir('/perfil')} className="flex min-h-11 items-center gap-2.5 rounded-controle px-2.5 py-2.5 text-left text-controle text-tinta hover:bg-trilha">
                <UserRound className="size-4 text-tinta-sussurro" aria-hidden />
                Meu perfil
              </button>
              {primeirosPassos?.perfilId && papelAtivo && guiaDoPapel(papelAtivo, primeirosPassos.rotas) && (
                <BotaoLinha variante="linha" onClick={() => { reabrirPrimeirosPassos(primeirosPassos.perfilId!, papelAtivo); ir(primeirosPassos.inicio) }}
                  className="min-h-11 items-center gap-2.5 rounded-controle border-0 px-2.5 py-2.5 text-controle text-tinta hover:bg-trilha">
                  <Compass className="size-4 text-tinta-sussurro" aria-hidden />
                  Primeiros passos
                </BotaoLinha>
              )}
              {/* TM2 (RT, 24/11/2026): as credenciais da telemedicina moram aqui, não no menu da tela */}
              {papelAtivo === 'telemedicina' && (
                <button type="button" onClick={() => ir('/telemedicina/credenciais')} className="flex min-h-11 items-center gap-2.5 rounded-controle px-2.5 py-2.5 text-left text-controle text-tinta hover:bg-trilha">
                  <ShieldCheck className="size-4 text-tinta-sussurro" aria-hidden />
                  Unidades e credenciais
                </button>
              )}
              {papelAtivo === 'plantonista' && (
                <button type="button" onClick={() => ir('/preferencias-prescricao')} className="flex min-h-11 items-center gap-2.5 rounded-controle px-2.5 py-2.5 text-left text-controle text-tinta hover:bg-trilha">
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
                className="flex min-h-11 items-center gap-2.5 rounded-controle px-2.5 py-2.5 text-left text-controle text-tinta hover:bg-trilha"
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
                className="flex min-h-11 items-center gap-2.5 rounded-controle px-2.5 py-2.5 text-left text-controle text-critico hover:bg-alerta-critico"
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
