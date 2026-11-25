import { Popover as PopoverPrimitive } from '@base-ui/react/popover'
import { AlignJustify, Building2, Check, ChevronRight, Compass, Globe, Lock, LogOut, Monitor, Moon, Rows3, ShieldCheck, SlidersHorizontal, Sun, UserRound } from 'lucide-react'
import { useState, type ReactNode } from 'react'
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
//
// Revisão das telas novas (RT, 25/11/2026):
// • ME1: papéis em lista, um por linha, com a marca de seleção à esquerda; o
//   nome da unidade inteiro (até duas linhas); as outras unidades recolhidas
//   sem rolagem dentro do menu; "Ver todas as unidades" no pé da lista, e o
//   cabeçalho do menu sem "Trocar unidade" (a barra de cima já tem).
// • ME2: o administrador geral aparece uma vez, à parte ("Toda a rede"), em
//   vez de entrar só na unidade em uso.
// • ME3: o registro do conselho só vem quando o papel em uso assina com ele
//   (registroNoMenu, quem chama decide); a densidade saiu da barra de cima e
//   mora aqui, ao lado do Tema.

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
  adminGeral = false,
  papelAtivo,
  onTrocarPerfil,
  onSair,
  onBloquear,
  primeirosPassos,
  tema = 'automatico',
  onTrocarTema,
  compacto = false,
  onTrocarDensidade,
  tamanho = 32,
}: {
  nome?: string
  registro?: string | null
  fotoUrl?: string | null
  unidade?: string
  podeTrocarUnidade: boolean
  /** Papéis da pessoa por unidade (agruparPerfisPorUnidade), a ativa primeiro. */
  grupos: GrupoDePerfis[]
  /** Administrador geral da plataforma: o perfil vale em toda a rede e aparece à parte. */
  adminGeral?: boolean
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
  /** Densidade da tela (ME3): compacta ou confortável. */
  compacto?: boolean
  onTrocarDensidade?: (compacto: boolean) => void
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
  const perfis = totalDePerfis(grupos) + (adminGeral ? 1 : 0)
  const trocar = (p: Papel, unidadeId: string, on: boolean) => {
    setAberto(false)
    if (!on) onTrocarPerfil(p, unidadeId)
  }

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
          <PopoverPrimitive.Popup className="flex max-h-[var(--available-height)] w-[300px] max-w-[calc(100vw-32px)] flex-col overflow-y-auto rounded-container border border-fio bg-superficie text-tinta shadow-popover outline-none data-open:animate-cc-dlg">
            <div className="flex items-center gap-3 px-4 pt-4 pb-3.5">
              <span className="grid size-10 shrink-0 place-items-center rounded-capsula bg-fio text-controle font-semibold text-tinta-apoio">{ini}</span>
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-corpo font-semibold text-tinta">{nome}</span>
                {registro && <span className="text-apoio text-tinta-apoio">{registro}</span>}
                <span className="text-apoio text-tinta-sussurro">{[papelAtivo ? PAPEL_LABEL[papelAtivo] : '', unidade].filter(Boolean).join(' · ')}</span>
              </div>
            </div>
            {(perfis > 1 || podeTrocarUnidade) && (
              <div className="flex flex-col gap-1 border-t border-trilha px-2 py-2.5">
                {perfis > 1 && <span className="rotulo px-2 pb-0.5 text-tinta-sussurro">Trocar perfil</span>}
                {perfis > 1 && adminGeral && (
                  <ListaDePapeis rotulo="Perfil em toda a rede">
                    <LinhaDePapel
                      on={papelAtivo === 'admin'}
                      rotulo={PAPEL_LABEL.admin}
                      apoio="Toda a rede"
                      nomeAcessivel={`${PAPEL_LABEL.admin} · toda a rede`}
                      onClick={() => {
                        const ativa = grupos.find((g) => g.ativa) ?? grupos[0]
                        if (ativa) trocar('admin', ativa.unidadeId, papelAtivo === 'admin')
                      }}
                    />
                  </ListaDePapeis>
                )}
                {perfis > 1 &&
                  grupos.map((g) => {
                    const recolhivel = recolher && !g.ativa
                    const fechado = recolhivel && !abertas.has(g.unidadeId)
                    const contagem = `${g.papeis.length} ${g.papeis.length === 1 ? 'perfil' : 'perfis'}`
                    return (
                      <div key={g.unidadeId} className="flex flex-col">
                        {recolhivel ? (
                          <button
                            type="button"
                            aria-expanded={!fechado}
                            aria-label={`${g.nome}, ${contagem}`}
                            onClick={() => alternarGrupo(g.unidadeId)}
                            className="flex min-h-8 items-start gap-1.5 rounded-controle px-2 py-1.5 text-left text-rotulo text-tinta-apoio hover:bg-trilha hover:text-tinta"
                          >
                            <ChevronRight className={cn('mt-px size-3.5 shrink-0 transition-transform', !fechado && 'rotate-90')} aria-hidden />
                            <span className="line-clamp-2 min-w-0 flex-1">{g.nome}</span>
                            <span className="shrink-0 text-tinta-sussurro">{contagem}</span>
                          </button>
                        ) : (
                          <span className="flex min-h-8 items-start gap-1.5 px-2 py-1.5 text-rotulo text-tinta-apoio">
                            <Building2 className="mt-px size-3.5 shrink-0" aria-hidden />
                            <span className="line-clamp-2 min-w-0 flex-1">{g.nome}</span>
                            {g.ativa && <span className="shrink-0 text-tinta-sussurro">em uso</span>}
                          </span>
                        )}
                        {!fechado && (
                          <ListaDePapeis rotulo={`Perfis em ${g.nome}`}>
                            {g.papeis.map((p) => {
                              const on = g.ativa && p === papelAtivo
                              return (
                                <LinhaDePapel
                                  key={p}
                                  on={on}
                                  rotulo={PAPEL_LABEL[p]}
                                  nomeAcessivel={`${PAPEL_LABEL[p]} · ${g.nome}`}
                                  onClick={() => trocar(p, g.unidadeId, on)}
                                />
                              )
                            })}
                          </ListaDePapeis>
                        )}
                      </div>
                    )
                  })}
                {podeTrocarUnidade && (
                  <button
                    type="button"
                    onClick={() => ir('/seletor')}
                    className="mt-0.5 flex min-h-8 items-center gap-2 rounded-controle px-2 text-left text-apoio text-acao hover:bg-trilha hover:text-acao-pressionada"
                  >
                    <Globe className="size-3.5 shrink-0" aria-hidden />
                    Ver todas as unidades
                  </button>
                )}
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
            {onTrocarDensidade && (
              <div className="flex flex-col gap-2 border-t border-trilha px-4 py-3">
                <span className="rotulo text-tinta-sussurro">Densidade</span>
                <div className="flex gap-1.5" role="radiogroup" aria-label="Densidade da tela">
                  {([
                    { valor: true, rotulo: 'Compacta', icone: Rows3 },
                    { valor: false, rotulo: 'Confortável', icone: AlignJustify },
                  ] as const).map(({ valor, rotulo, icone: Icone }) => {
                    const on = valor === compacto
                    return (
                      <Button key={rotulo} size="sm" variant={on ? 'secondary' : 'ghost'} role="radio" aria-checked={on} onClick={() => onTrocarDensidade(valor)}>
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

/** Os papéis de um grupo, um por linha (ME1). */
function ListaDePapeis({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="flex flex-col" role="radiogroup" aria-label={rotulo}>
      {children}
    </div>
  )
}

/** Uma linha de 32 px: a marca de seleção à esquerda, na mesma coluna em todas. */
function LinhaDePapel({ on, rotulo, apoio, nomeAcessivel, onClick }: { on: boolean; rotulo: string; apoio?: string; nomeAcessivel: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      aria-label={nomeAcessivel}
      onClick={onClick}
      className={cn(
        'flex min-h-8 items-center gap-1.5 rounded-controle px-2 text-left text-apoio hover:bg-trilha',
        on ? 'font-semibold text-acao' : 'text-tinta',
      )}
    >
      <Check className={cn('size-3.5 shrink-0', !on && 'invisible')} aria-hidden />
      <span className="min-w-0 flex-1">{rotulo}</span>
      {apoio && <span className="shrink-0 text-rotulo font-normal text-tinta-sussurro">{apoio}</span>}
    </button>
  )
}
