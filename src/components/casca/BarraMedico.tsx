import * as React from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Menu, Search, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Gaveta, GavetaCabeca } from '@/components/ui/gaveta'
import { cn } from '@/lib/utils'
import type { TipoUnidade } from '@/types/database'
import { ROTA_PERGUNTAR_IA, agruparNavegacao, barraMedicoCelular, menuMedicoCelular, type ChaveNota, type ItemNav } from './navegacao'

// Barra de baixo do médico abaixo de 1024px (item 6 do BACKLOG; CM1 e CM7 = A,
// RT em 23/11/2026): Início, Leitos, Perguntar à IA no meio e em destaque,
// Prontuários e Menu. O botão flutuante de busca aparece nas outras telas e
// abre a busca da Central completa (siglas, sentido e "Perguntar à IA").

const ROTA_BUSCA = '/plantonista?todas=1&busca=1'

/** Item ativo: o Início vale para a Central e as ferramentas; a IA, só para a busca aberta por ela. */
function ativo(item: ItemNav, pathname: string, search: string): boolean {
  const ia = new URLSearchParams(search).get('ia') === '1'
  if (item.to === ROTA_PERGUNTAR_IA) return pathname === '/plantonista' && ia
  if (item.to === '/plantonista') return pathname.startsWith('/plantonista') && !ia
  return pathname === item.to || pathname.startsWith(`${item.to}/`)
}

const BASE_ITEM = 'relative flex min-h-13 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-container px-0.5 py-1.5 text-rotulo leading-tight no-underline transition-colors'

function ItemDaBarra({ item, nota }: { item: ItemNav; nota?: number }) {
  const { pathname, search } = useLocation()
  const marcado = ativo(item, pathname, search)
  const Icone = item.icone
  if (item.to === ROTA_PERGUNTAR_IA) {
    return (
      <Link to={item.to} aria-current={marcado ? 'page' : undefined} className={cn(BASE_ITEM, 'font-medium text-acao')}>
        <span className={cn('flex h-7 w-11 items-center justify-center rounded-controle border border-acao', marcado ? 'bg-acao text-sobre-acao' : 'bg-superficie')}>
          <Icone className="size-5" aria-hidden />
        </span>
        <span className="truncate text-center">{item.rotulo}</span>
      </Link>
    )
  }
  return (
    <Link to={item.to} aria-current={marcado ? 'page' : undefined}
      className={cn(BASE_ITEM, marcado ? 'bg-acao/10 font-medium text-acao' : 'text-tinta-apoio')}>
      <Icone className="size-5" aria-hidden />
      <span className="truncate text-center">{item.curto ?? item.rotulo}</span>
      {!!nota && <span className="absolute top-0.5 right-1.5 rounded-capsula bg-nota px-1.5 text-rotulo leading-4 font-semibold text-atencao">{nota}</span>}
    </Link>
  )
}

function MenuDaBarra({ itens, notas }: { itens: ItemNav[]; notas: Partial<Record<ChaveNota, number>> }) {
  const [aberta, setAberta] = React.useState(false)
  const { pathname, search } = useLocation()
  const marcado = itens.some((i) => ativo(i, pathname, search))
  const soma = itens.reduce((a, i) => a + (i.nota ? notas[i.nota] ?? 0 : 0), 0)
  return (
    <>
      <Button type="button" variant="ghost" onClick={() => setAberta(true)} aria-haspopup="dialog"
        className={cn(BASE_ITEM, 'h-auto', marcado ? 'bg-acao/10 font-semibold text-acao' : 'font-normal text-tinta-apoio')}>
        <Menu className="size-5" aria-hidden />
        <span className="truncate text-center">Menu</span>
        {soma > 0 && <span className="absolute top-0.5 right-1.5 rounded-capsula bg-nota px-1.5 text-rotulo leading-4 font-semibold text-atencao">{soma}</span>}
      </Button>
      <Gaveta aberta={aberta} onAbertaChange={setAberta} rotulo="Menu">
        <GavetaCabeca titulo="Menu" />
        <nav aria-label="Menu" className="flex flex-col p-2">
          {agruparNavegacao(itens).map((bloco, k) => (
            <div key={bloco.grupo ?? `bloco-${k}`} role={bloco.grupo ? 'group' : undefined} aria-label={bloco.grupo ?? undefined} className="flex flex-col">
              {bloco.grupo && <span aria-hidden className="rotulo px-3.5 pt-3 pb-1 text-tinta-sussurro">{bloco.grupo}</span>}
              {bloco.itens.map((item) => {
                const Icone = item.icone
                const nota = item.nota ? notas[item.nota] : undefined
                return (
                  <NavLink key={item.to} to={item.to} end={item.exato} onClick={() => setAberta(false)}
                    className={({ isActive }) => cn('flex min-h-12 items-center gap-3 rounded-container px-3.5 text-controle no-underline',
                      isActive ? 'bg-acao/10 font-semibold text-acao' : 'text-tinta')}>
                    <Icone className="size-5 shrink-0" aria-hidden />
                    <span className="flex-1">{item.rotulo}</span>
                    {!!nota && <span className="rounded-capsula bg-nota px-1.5 text-rotulo font-semibold text-atencao">{nota}</span>}
                  </NavLink>
                )
              })}
            </div>
          ))}
        </nav>
      </Gaveta>
    </>
  )
}

export function BarraMedico({ itens, notas, tipoUnidade }: { itens: ItemNav[]; notas: Partial<Record<ChaveNota, number>>; tipoUnidade: TipoUnidade | null }) {
  const barra = barraMedicoCelular(tipoUnidade)
  const menu = menuMedicoCelular(itens, tipoUnidade)
  return (
    <nav aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 flex gap-0.5 border-t border-fio bg-superficie px-1.5 pt-1.5 pb-[calc(6px+env(safe-area-inset-bottom))] lg:hidden">
      {barra.map((i) => <ItemDaBarra key={i.to} item={i} nota={i.nota ? notas[i.nota] : undefined} />)}
      {menu.length > 0 && <MenuDaBarra itens={menu} notas={notas} />}
    </nav>
  )
}

/** Busca flutuante nas outras telas (CM7 = A); some no início e na própria busca. Sobe acima das Mensagens quando elas existem. */
export function BuscaFlutuante({ acimaDasMensagens }: { acimaDasMensagens: boolean }) {
  const { pathname } = useLocation()
  if (pathname === '/plantonista') return null
  return (
    <Link to={ROTA_BUSCA} aria-label="Buscar ferramenta ou perguntar à IA" title="Buscar"
      className={cn('fixed right-4 z-[38] grid size-13 place-items-center rounded-capsula bg-tinta text-superficie no-underline shadow-fab lg:hidden',
        acimaDasMensagens ? 'bottom-[calc(138px+env(safe-area-inset-bottom))]' : 'bottom-[calc(78px+env(safe-area-inset-bottom))]')}>
      <Search className="size-6" aria-hidden />
    </Link>
  )
}

// Aviso da troca (risco do diagnóstico, CM1): uma semana a partir da primeira vez
// que o médico vê a barra, ou até tocar em "Entendi". Guardado só neste aparelho.
const CHAVE_AVISO = 'chefe-coruja:aviso-barra-medico'
const SEMANA_MS = 7 * 24 * 60 * 60 * 1000

function lerAviso(): boolean {
  try {
    const bruto = window.localStorage.getItem(CHAVE_AVISO)
    if (bruto === 'visto') return false
    const desde = Number(bruto)
    if (!bruto || !Number.isFinite(desde)) { window.localStorage.setItem(CHAVE_AVISO, String(Date.now())); return true }
    return Date.now() - desde < SEMANA_MS
  } catch {
    return true
  }
}

export function AvisoBarraMedico() {
  const [mostrar, setMostrar] = React.useState(lerAviso)
  if (!mostrar) return null
  const fechar = () => {
    try { window.localStorage.setItem(CHAVE_AVISO, 'visto') } catch { /* sem armazenamento: só fecha */ }
    setMostrar(false)
  }
  return (
    <div role="status" className="mx-4 mt-3 flex items-start gap-3 rounded-cartao border border-acao/30 bg-acao/5 px-3.5 py-3 text-apoio text-tinta lg:hidden">
      <span className="flex-1">As abas do topo agora ficam embaixo: Início, Leitos, Perguntar à IA, Prontuários e Menu (com a Agenda).</span>
      <Button type="button" variant="ghost" size="icon-sm" onClick={fechar} aria-label="Entendi, fechar o aviso">
        <X className="size-4" aria-hidden />
      </Button>
    </div>
  )
}
