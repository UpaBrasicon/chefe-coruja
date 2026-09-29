import { History, LogOut, Repeat, Search, SlidersHorizontal, Users, WifiOff } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'

import { cn } from '@/lib/utils'

import { Marca } from './Marca'
import type { ChaveNota, ItemNav } from './navegacao'
import { hm, type Sinal } from './useSinal'

// A topbar (P/index.html 1009–1053): contexto do papel à esquerda (a unidade;
// a rede, para o administrador; o médico, para a telemedicina), e à direita o
// que o papel precisa ver sempre — o sino, a busca, o compacto e o avatar.
// Buscar e Compacto são pílulas com borda; o rótulo some no modo compacto.

function Pilula({ rotulo, titulo, icone: Icone, onClick, ativo }: { rotulo: string; titulo: string; icone: typeof Search; onClick: () => void; ativo?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={titulo}
      aria-label={titulo}
      aria-pressed={ativo}
      className={cn(
        'flex h-8 items-center gap-1.5 rounded-capsula border px-[11px] text-apoio whitespace-nowrap transition-colors hover:border-[#94A3B8]',
        ativo ? 'border-marca/35 bg-marca/10 text-acao' : 'border-fio bg-superficie text-tinta-sussurro',
      )}
    >
      <Icone className="size-[15px]" aria-hidden />
      <span className="cc-den-rot max-[1023px]:hidden">{rotulo}</span>
    </button>
  )
}

export function Topo({
  contexto,
  extra,
  compacto,
  onBuscar,
  onCompacto,
  sino,
  fila,
  avatar,
  trocarUnidade,
}: {
  contexto: ReactNode
  /** "4 em plantão agora", "9 unidades · 37 em plantão", status da telemedicina. */
  extra?: ReactNode
  compacto: boolean
  onBuscar: () => void
  onCompacto: () => void
  sino?: ReactNode
  fila?: ReactNode
  avatar: ReactNode
  trocarUnidade?: () => void
}) {
  return (
    <header className="cc-top z-10 flex min-h-[var(--cc-topo)] flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-fio bg-superficie px-4 py-2.5 md:px-7 lg:flex-nowrap lg:py-0">
      <div className="flex min-w-0 flex-[1_1_100%] items-center gap-3 overflow-hidden lg:flex-[1_1_auto]">
        <span className="min-w-[108px] truncate text-corpo font-medium text-tinta">{contexto}</span>
        {trocarUnidade && (
          <button type="button" onClick={trocarUnidade} className="hidden shrink-0 items-center gap-[5px] text-apoio whitespace-nowrap text-acao hover:text-acao-pressionada md:flex">
            <Repeat className="size-[13px]" aria-hidden />
            Trocar unidade
          </button>
        )}
      </div>
      <div className="flex flex-[1_1_100%] flex-wrap items-center gap-2.5 lg:flex-[0_0_auto] lg:flex-nowrap lg:gap-4">
        {extra}
        {fila}
        {sino}
        <Pilula rotulo="Buscar" titulo="Buscar ferramenta, leito ou tela (Ctrl+K)" icone={Search} onClick={onBuscar} />
        <Pilula
          rotulo={compacto ? 'Compacto' : 'Confortável'}
          titulo={compacto ? 'Voltar ao modo confortável' : 'Modo compacto: menos ar, mesmos tamanhos de leitura'}
          icone={SlidersHorizontal}
          onClick={onCompacto}
          ativo={compacto}
        />
        {avatar}
      </div>
    </header>
  )
}

/** Texto de contexto sussurrado com ícone, à direita da topbar. */
export function ContextoTopo({ icone: Icone = Users, children }: { icone?: typeof Users; children: ReactNode }) {
  return (
    <span className="flex items-center gap-[7px] text-apoio whitespace-nowrap text-tinta-sussurro">
      <Icone className="size-[15px]" aria-hidden />
      {children}
    </span>
  )
}

/**
 * O topo do plantonista abaixo de 1024px (P/index.html 978–1007): marca, a
 * pílula do plantão (até que horas, ou "Fora"), avatar e Sair; embaixo, as
 * quatro abas-bloco com ícone em cima do rótulo.
 */
export function TopoEstreito({
  inicio,
  plantao,
  avatar,
  onSair,
  abas,
  notas,
}: {
  inicio: string
  plantao: { em: boolean; rotulo: string; to: string }
  avatar: ReactNode
  onSair: () => void
  abas: ItemNav[]
  notas: Partial<Record<ChaveNota, number>>
}) {
  return (
    <header className="sticky top-0 z-10 flex flex-col border-b border-fio bg-superficie">
      <div className="flex items-center gap-2.5 px-4 py-[9px]">
        <Link to={inicio} title="Página principal" className="min-w-0 flex-1 text-tinta hover:text-acao">
          <Marca tamanho={30} />
        </Link>
        <Link
          to={plantao.to}
          aria-label={plantao.rotulo}
          title={plantao.rotulo}
          className={cn(
            'flex h-[38px] items-center gap-1.5 rounded-capsula border px-3 text-apoio font-medium tabular',
            plantao.em ? 'border-conforme/30 bg-conforme/[0.06] text-conforme' : 'border-fio bg-campo text-tinta-sussurro',
          )}
        >
          <span className={cn('size-2 rounded-capsula', plantao.em ? 'bg-conforme' : 'bg-fio-forte')} aria-hidden />
          {plantao.em ? plantao.rotulo.replace(/^Plantão /, '') : 'Fora'}
        </Link>
        {avatar}
        <button type="button" onClick={onSair} aria-label="Sair" className="grid size-[38px] shrink-0 place-items-center text-tinta-sussurro hover:text-acao">
          <LogOut className="size-[18px]" aria-hidden />
        </button>
      </div>
      <nav aria-label="Navegação principal" className="flex gap-1.5 px-4 pb-2.5 min-[480px]:gap-2">
        {abas.map((a) => {
          const Icone = a.icone
          const nota = a.nota ? notas[a.nota] : undefined
          return (
            <NavLink
              key={a.to}
              to={a.to}
              end={a.exato}
              className={({ isActive }) =>
                cn(
                  'flex min-h-[52px] min-w-0 flex-1 flex-col items-center justify-center gap-[3px] rounded-container border px-1 py-[5px] text-rotulo whitespace-nowrap',
                  isActive ? 'border-marca/35 bg-marca/10 font-semibold text-acao' : 'border-fio bg-superficie text-tinta-apoio',
                )
              }
            >
              <Icone className="size-[17px]" aria-hidden />
              <span className="flex max-w-full min-w-0 items-center gap-[5px]">
                <span className="truncate">{a.rotulo}</span>
                {!!nota && <span className="rounded-capsula bg-[#F59E0B24] px-[5px] text-[11px] font-semibold text-atencao">{nota}</span>}
              </span>
            </NavLink>
          )
        })}
      </nav>
    </header>
  )
}

/** A fita do sinal: cinza, sob a topbar, com a ação que resolve. */
export function FitaDoSinal({ sinal, onTentar }: { sinal: Sinal; onTentar: () => void }) {
  if (sinal.estado === 'conectado') return null
  const cfg =
    sinal.estado === 'atualizando'
      ? { icone: Repeat, texto: 'Buscando leitura nova…', acao: 'Aguarde', fundo: 'bg-campo' }
      : sinal.estado === 'sem-sinal'
        ? {
            icone: WifiOff,
            texto:
              `Sem sinal desde ${hm(sinal.desde)}` +
              (sinal.ultimaLeitura ? ` · você está vendo a última leitura recebida, de ${hm(sinal.ultimaLeitura)}` : ' · você está vendo a última leitura recebida') +
              (sinal.tentativa ? ` · tentativa às ${sinal.tentativa} sem resposta` : ''),
            acao: 'Tentar de novo',
            fundo: 'bg-trilha',
          }
        : { icone: History, texto: `Rede lenta na unidade · os números têm até ${sinal.idadeMin} minuto${sinal.idadeMin > 1 ? 's' : ''}`, acao: 'Atualizar agora', fundo: 'bg-campo' }
  const Icone = cfg.icone
  return (
    <div role="status" className={cn('flex flex-wrap items-center gap-[9px] border-b border-fio px-4 py-[7px] text-rotulo leading-[1.35] text-tinta-apoio lg:px-5 lg:py-2', cfg.fundo)}>
      <Icone className="size-3.5 shrink-0" aria-hidden />
      <span>{cfg.texto}</span>
      <button
        type="button"
        onClick={onTentar}
        disabled={sinal.estado === 'atualizando'}
        className="ml-auto flex items-center gap-[5px] rounded-[8px] border border-fio bg-superficie px-2.5 py-1 text-rotulo font-medium whitespace-nowrap text-tinta-apoio hover:border-[#94A3B8] hover:text-tinta disabled:opacity-45"
      >
        <Repeat className="size-3" aria-hidden />
        {cfg.acao}
      </button>
    </div>
  )
}
