import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight, Building2, LogOut, Megaphone, Pause, Play } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, matchPath, useLocation } from 'react-router-dom'

import { useBanners } from '@/hooks/useBanners'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

import { Marca } from './Marca'
import { agruparNavegacao, ICONE_GRUPO, type ChaveNota, type ItemNav } from './navegacao'
import { diaMes as fmtData } from '@/lib/formato'

// A lateral da casca (P/index.html 895–973): recolhida em 68px de ícones,
// abre por cima do conteúdo ao passar o mouse ou com foco (CSS .cc-recolhe
// em index.css). Três blocos: a navegação com as notas, os avisos "Da
// unidade" (ou "Da rede" do administrador) e o Sair no pé. O gestor, com os
// itens em grupos, tem o trilho das áreas (LateralAreas, abaixo).

function ItemLateral({ item, nota }: { item: ItemNav; nota?: number }) {
  const Icone = item.icone
  return (
    <NavLink
      to={item.to}
      end={item.exato}
      title={item.rotulo}
      className={({ isActive }) =>
        cn(
          'relative flex w-full items-center gap-2.5 rounded-controle py-[9px] pr-3 pl-[15px] text-corpo whitespace-nowrap transition-colors',
          isActive ? 'bg-acao/10 font-semibold text-acao hover:text-acao' : 'text-tinta-apoio hover:bg-trilha hover:text-tinta-apoio',
        )
      }
    >
      <Icone className="size-[17px] shrink-0" aria-hidden />
      <span className="cc-some flex-1 truncate text-left">{item.rotulo}</span>
      {!!nota && (
        <span className="cc-nota rounded-capsula bg-nota px-[7px] py-px text-rotulo font-semibold text-atencao tabular" aria-label={`${nota} pendente${nota > 1 ? 's' : ''}`}>
          {nota}
        </span>
      )}
    </NavLink>
  )
}

const INTERVALO_AVISO_MS = 6000

/** "Da unidade": o carrossel de avisos do gestor, com pausa (WCAG 2.2.2). */
function DaUnidadeLateral({ unidadeId, ehGestor }: { unidadeId?: string; ehGestor: boolean }) {
  const { data: avisos = [] } = useBanners(unidadeId)
  const [i, setI] = useState(0)
  const [pausado, setPausado] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)

  useEffect(() => {
    if (pausado || avisos.length < 2) return
    const t = window.setInterval(() => setI((x) => (x + 1) % avisos.length), INTERVALO_AVISO_MS)
    return () => window.clearInterval(t)
  }, [pausado, avisos.length])

  if (!avisos.length && !ehGestor) return null
  const a = avisos.length ? avisos[i % avisos.length] : null

  return (
    <div className="cc-side-bloco mx-2.5 mt-[18px] border-t border-fio pt-4">
      <span className="rotulo flex items-center gap-1.5 px-0.5 pb-2 text-tinta-sussurro">
        <Megaphone className="size-3" aria-hidden />
        Da unidade
      </span>
      {/* Sem cartão nem selo "Aviso" (revisão visual 3.1): o rótulo "Da unidade" já diz o que é. */}
      <div className="flex min-h-[152px] flex-col overflow-hidden">
        {a?.imagem_url && <img src={a.imagem_url} alt="" className="mb-1 h-[74px] w-full rounded-controle object-cover" />}
        <div className="flex flex-1 flex-col gap-[7px] px-0.5 py-1" aria-live={pausado ? 'polite' : 'off'}>
          {a ? (
            <>
              {a.titulo && <span className="text-apoio leading-[1.35] font-semibold tracking-[-0.005em] text-tinta">{a.titulo}</span>}
              {a.descricao && <span className="text-rotulo leading-[1.4] text-pretty text-tinta-sussurro">{a.descricao}</span>}
              {ehGestor ? (
                <Link to="/unidade?aba=imagens" className="inline-flex items-center gap-1 text-rotulo font-medium text-acao">
                  Editar aviso <ArrowUpRight className="size-3" aria-hidden />
                </Link>
              ) : (
                a.link_url && (
                  <a href={a.link_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-rotulo font-medium text-acao">
                    Abrir <ArrowUpRight className="size-3" aria-hidden />
                  </a>
                )
              )}
            </>
          ) : (
            <>
              <span className="text-apoio font-semibold text-tinta">Nenhum aviso publicado</span>
              <Link to="/unidade?aba=imagens" className="inline-flex items-center gap-1 text-rotulo font-medium text-acao">
                Publicar aviso <ArrowUpRight className="size-3" aria-hidden />
              </Link>
            </>
          )}
          {a && (
            <div className="mt-auto flex items-center justify-between gap-2 pt-2">
              <div className="flex items-center gap-1">
                {avisos.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setPausado((v) => !v)}
                    aria-label={pausado ? 'Retomar rotação dos avisos' : 'Pausar rotação dos avisos'}
                    className="mr-[3px] grid size-4 place-items-center text-tinta-sussurro hover:text-acao"
                  >
                    {pausado ? <Play className="size-[11px]" aria-hidden /> : <Pause className="size-[11px]" aria-hidden />}
                  </button>
                )}
                {avisos.length > 1 &&
                  avisos.map((b, k) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setI(k)}
                      aria-label={`Aviso ${k + 1} de ${avisos.length}`}
                      className={cn('h-[5px] rounded-capsula transition-[width] duration-200', k === i % avisos.length ? 'w-3.5 bg-acao' : 'w-[5px] bg-fio-forte')}
                    />
                  ))}
              </div>
              <span className="text-rotulo text-tinta-sussurro">{fmtData(a.created_at)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Contagens de 1 a 4 vêm nulas do banco (private.suprimir, fase 6): quando há
// alguma suprimida, a soma da rede não pode fingir que ela é zero.
type LinhaRede = { leitos?: number | null; leitos_ocupados?: number | null; profissionais_em_expediente?: number | null }

/** "Da rede": três números agregados para o administrador, sem paciente. */
function DaRede() {
  const { data } = useQuery({
    queryKey: ['painel-organizacao-lateral'],
    refetchInterval: 120_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('painel_organizacao', { p_dias: 7 })
      if (error) throw error
      return (data ?? []) as LinhaRede[]
    },
  })
  if (!data) return null
  const soma = (k: keyof LinhaRede) => (data.some((u) => u[k] == null) ? null : data.reduce((n, u) => n + (u[k] ?? 0), 0))
  const leitos = soma('leitos')
  const ocupados = soma('leitos_ocupados')
  const plantao = soma('profissionais_em_expediente')
  const linhas = [
    { rotulo: 'Unidades', valor: String(data.length) },
    { rotulo: 'Ocupação da rede', valor: leitos && ocupados !== null ? `${Math.round((ocupados / leitos) * 100)}%` : '—' },
    { rotulo: 'Em plantão agora', valor: plantao === null ? '< 5' : String(plantao) },
  ]
  return (
    <div className="cc-side-bloco mx-2.5 mt-[18px] border-t border-fio pt-4">
      <span className="rotulo flex items-center gap-1.5 px-0.5 pb-2 text-tinta-sussurro">
        <Building2 className="size-3" aria-hidden />
        Da rede
      </span>
      <div className="divide-y divide-trilha px-0.5">
        {linhas.map((l) => (
          <div key={l.rotulo} className="flex items-baseline justify-between gap-2.5 py-2">
            <span className="text-apoio text-tinta-apoio">{l.rotulo}</span>
            <span className="text-corpo font-semibold text-tinta tabular">{l.valor}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

type PropsLateral = {
  itens: ItemNav[]
  notas: Partial<Record<ChaveNota, number>>
  papelTexto: string
  inicio: string
  unidadeId?: string
  ehGestor: boolean
  ehAdmin: boolean
  onSair: () => void
}

const somaNotas = (itens: ItemNav[], notas: Partial<Record<ChaveNota, number>>) =>
  itens.reduce((n, i) => n + (i.nota ? notas[i.nota] ?? 0 : 0), 0)

/**
 * Revisão visual 3.9 (27/10/2026, opção B do RT): com os itens agrupados (o
 * gestor, 30 itens), a lateral recolhida escondia a área atual. Vira um trilho
 * fixo com as áreas, sempre à vista, e uma coluna com as telas da área atual
 * e o aviso "Da unidade". Área de uma tela só (Painel, Exames) não abre coluna.
 */
function LateralAreas({ itens, notas, papelTexto, inicio, unidadeId, ehGestor, onSair }: PropsLateral) {
  const { pathname } = useLocation()
  const ativo = (i: ItemNav) => !!matchPath({ path: i.to, end: !!i.exato }, pathname)
  const areas = agruparNavegacao(itens)
  const atual = areas.find((a) => a.itens.some(ativo))

  return (
    <div className="sticky top-0 z-40 hidden h-dvh shrink-0 md:flex">
      <aside className="flex h-full w-[80px] flex-col items-center justify-between overflow-y-auto border-r border-fio bg-superficie py-[18px]">
        <div className="flex flex-col items-center gap-1">
          <Link to={inicio} title="Página principal" className="mb-4 text-tinta hover:text-acao">
            <Marca papel={papelTexto} simbolo />
          </Link>
          <nav aria-label="Áreas" className="flex flex-col items-center gap-1">
            {areas.map((a) => {
              const rotulo = a.grupo ?? a.itens[0].rotulo
              const Icone = (a.grupo && ICONE_GRUPO[a.grupo]) || a.itens[0].icone
              const eh = a === atual
              const nota = somaNotas(a.itens, notas)
              return (
                <Link
                  key={rotulo}
                  to={a.itens[0].to}
                  title={rotulo}
                  aria-current={eh ? 'location' : undefined}
                  className={cn(
                    'relative flex w-[76px] flex-col items-center gap-1 rounded-controle py-2 text-rotulo transition-colors',
                    eh ? 'bg-acao/10 font-semibold text-acao hover:text-acao' : 'text-tinta-apoio hover:bg-trilha hover:text-tinta-apoio',
                  )}
                >
                  <Icone className="size-[18px]" aria-hidden />
                  <span className="w-full truncate text-center">{rotulo}</span>
                  {!!nota && <span className="absolute top-1 right-2.5 size-2 rounded-capsula bg-atencao" aria-label={`${nota} pendente${nota > 1 ? 's' : ''}`} />}
                </Link>
              )
            })}
          </nav>
        </div>
        <button type="button" onClick={onSair} title="Sair" aria-label="Sair" className="grid size-9 shrink-0 place-items-center rounded-controle text-tinta-sussurro hover:text-acao">
          <LogOut className="size-4" aria-hidden />
        </button>
      </aside>
      {atual && atual.itens.length > 1 && (
        <aside className="flex h-full w-[220px] flex-col justify-between overflow-y-auto border-r border-fio bg-superficie py-[18px]">
          <div>
            <span className="block px-[17px] pt-1.5 pb-[18px] text-secao font-semibold text-tinta">{atual.grupo}</span>
            <nav aria-label={`Telas de ${atual.grupo}`} className="flex flex-col gap-[3px] px-2.5">
              {atual.itens.map((item) => (
                <ItemLateral key={item.to} item={item} nota={item.nota ? notas[item.nota] : undefined} />
              ))}
            </nav>
          </div>
          <DaUnidadeLateral unidadeId={unidadeId} ehGestor={ehGestor} />
        </aside>
      )}
    </div>
  )
}

export function Lateral(props: PropsLateral) {
  const { itens, notas, papelTexto, inicio, unidadeId, ehGestor, ehAdmin, onSair } = props
  if (itens.some((i) => i.grupo)) return <LateralAreas {...props} />
  return (
    <aside className="cc-side cc-recolhe sticky top-0 hidden h-dvh w-[var(--cc-lateral)] shrink-0 flex-col border-r border-fio bg-superficie md:flex">
      <div className="cc-side-miolo flex h-full flex-col justify-between py-[18px]">
        <div>
          <Link to={inicio} title="Página principal" className="flex items-center px-[17px] pb-[22px] text-tinta hover:text-acao">
            <Marca papel={papelTexto} />
          </Link>
          <nav aria-label="Navegação principal" className="flex flex-col gap-[3px] px-2.5">
            {itens.map((item) => (
              <ItemLateral key={item.to} item={item} nota={item.nota ? notas[item.nota] : undefined} />
            ))}
          </nav>
          {ehAdmin ? <DaRede /> : <DaUnidadeLateral unidadeId={unidadeId} ehGestor={ehGestor} />}
        </div>
        <div className="px-[26px]">
          <button type="button" onClick={onSair} className="flex w-full items-center gap-[9px] py-2 text-apoio text-tinta-sussurro hover:text-acao">
            <LogOut className="size-4 shrink-0" aria-hidden />
            <span className="cc-some">Sair</span>
          </button>
        </div>
      </div>
    </aside>
  )
}
