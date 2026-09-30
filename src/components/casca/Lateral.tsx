import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight, Building2, LogOut, Megaphone, Pause, Play } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'

import { useBanners } from '@/hooks/useBanners'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

import { Marca } from './Marca'
import type { ChaveNota, ItemNav } from './navegacao'

// A lateral da casca (P/index.html 895–973): recolhida em 68px de ícones,
// abre por cima do conteúdo ao passar o mouse ou com foco (CSS .cc-recolhe
// em index.css). Três blocos: a navegação com as notas, os avisos "Da
// unidade" (ou "Da rede" do administrador) e o Sair no pé.

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
          isActive ? 'bg-marca/10 font-semibold text-acao hover:text-acao' : 'text-tinta-apoio hover:bg-trilha hover:text-tinta-apoio',
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
const fmtData = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })

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
      <div className="flex min-h-[152px] flex-col overflow-hidden rounded-container border border-fio bg-campo">
        {a?.imagem_url && <img src={a.imagem_url} alt="" className="h-[74px] w-full border-b border-fio object-cover" />}
        <div className="flex flex-1 flex-col gap-[7px] p-3" aria-live={pausado ? 'polite' : 'off'}>
          {a ? (
            <>
              <span className="w-fit rounded-capsula bg-marca/10 px-1.5 py-0.5 text-rotulo font-semibold tracking-[0.05em] text-acao uppercase">Aviso</span>
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
                      className={cn('h-[5px] rounded-capsula transition-[width] duration-200', k === i % avisos.length ? 'w-3.5 bg-marca' : 'w-[5px] bg-fio-forte')}
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
      <div className="rounded-container border border-fio bg-campo px-3 py-1">
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

export function Lateral({
  itens,
  notas,
  papelTexto,
  inicio,
  unidadeId,
  ehGestor,
  ehAdmin,
  onSair,
}: {
  itens: ItemNav[]
  notas: Partial<Record<ChaveNota, number>>
  papelTexto: string
  inicio: string
  unidadeId?: string
  ehGestor: boolean
  ehAdmin: boolean
  onSair: () => void
}) {
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
