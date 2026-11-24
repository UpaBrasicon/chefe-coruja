// Peças visuais comuns às telas da enfermagem (protótipo, P/index.html
// 1892–1926 e 8168–8203): o cartão com título, o botão "Cuidados" e a pílula
// dos aprazamentos atrasados.
import { CalendarClock, ClipboardList } from 'lucide-react'
import type * as React from 'react'
import { Link } from 'react-router-dom'

import { selosDaContencao, type ContencaoAtiva } from '@/lib/contencao'
import { contarFaixa, pendenciaPrincipal, type ChavePendencia, type PendenciasPaciente } from '@/lib/pendenciasEnfermagem'
import { textoResumoValidade, type resumoValidade } from '@/lib/validadePrescricao'
import { cn } from '@/lib/utils'
import type { CorRisco } from '@/domain/risco'
import { PilulaRisco } from '@/components/clinico/PilulaRisco'
import { ProximoPlantao } from '@/components/casca/ProximoPlantao'
import { Vazio } from '@/components/monitor/Pagina'

import { PILULA } from './useEnfermagem'
import { Button, buttonVariants } from '@/components/ui/button'

export function Bloco({ titulo, extra, children }: { titulo: string; extra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-cartao border border-fio bg-superficie">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-trilha px-5 py-3">
        <span className="text-apoio font-semibold text-tinta">{titulo}</span>
        {extra && <span className="text-apoio text-tinta-sussurro">{extra}</span>}
      </div>
      {children}
    </section>
  )
}

/**
 * PS1/IN3 (revisão do perfil Enfermeiro, RT 24/11/2026): a faixa do topo com o
 * que está atrasado agora; cada número filtra a lista e um segundo toque tira
 * o filtro. Sem nada atrasado, uma linha só.
 */
export function FaixaPendencias({ lista, chaves, filtro, onFiltro }: {
  lista: readonly PendenciasPaciente[]; chaves: readonly ChavePendencia[]
  filtro: ChavePendencia | null; onFiltro: (c: ChavePendencia | null) => void
}) {
  const itens = contarFaixa(lista, chaves)
  if (itens.every((i) => i.n === 0)) {
    return <p className="text-apoio text-tinta-sussurro">Nada atrasado no plantão agora.</p>
  }
  return (
    <div role="group" aria-label="O que está atrasado agora" className="flex flex-wrap gap-2">
      {itens.filter((i) => i.n > 0 || i.chave === filtro).map((i) => (
        // padrao-ok: filtro em número grande; o Chip não tem o número em destaque
        <button key={i.chave} type="button" aria-pressed={filtro === i.chave} onClick={() => onFiltro(filtro === i.chave ? null : i.chave)}
          className={cn('flex items-baseline gap-2 rounded-container border px-3 py-2 text-left transition-colors',
            filtro === i.chave ? 'border-acao bg-acao/10' : 'border-fio bg-superficie hover:border-acao')}>
          <span className={cn('text-secao font-semibold tabular-nums', i.chave === 'vencida' || i.chave === 'atrasada' ? 'text-critico' : 'text-atencao')}>{i.n}</span>
          <span className="text-apoio text-tinta">{i.rotulo}</span>
        </button>
      ))}
      {filtro && <Button variant="ghost" size="sm" onClick={() => onFiltro(null)}>Mostrar todos</Button>}
    </div>
  )
}

/** Uma pendência por linha (a mais urgente); o resto fica em Cuidados. */
export function PendenciaPrincipal({ p }: { p: PendenciasPaciente }) {
  const x = pendenciaPrincipal(p)
  if (!x) return null
  return (
    <span className="flex items-baseline gap-1.5">
      <span className={cn(PILULA, x.critica ? 'bg-alerta-critico text-critico' : 'bg-alerta-atencao text-atencao')}>{x.texto}</span>
      {x.outras > 0 && <span className="text-rotulo text-tinta-sussurro" title="As outras pendências abrem em Cuidados">+{x.outras}</span>}
    </span>
  )
}

/**
 * PS2/IN1: a mesma linha para todo paciente da enfermagem: cor da
 * classificação (da enfermagem), local, nome e idade, queixa, uma pendência
 * principal, o tempo e "Cuidados".
 */
export function LinhaPaciente({ cor, comCor = true, local, nome, idade, texto, pendencias, tempo, tempoCritico = false, onCuidados }: {
  cor?: CorRisco | null; comCor?: boolean; local: string | null; nome: string; idade: string; texto: string
  pendencias: PendenciasPaciente; tempo: string; tempoCritico?: boolean; onCuidados: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-trilha px-5 py-3 last:border-0">
      {comCor && <PilulaRisco cor={cor ?? null} className="min-w-[72px]" />}
      <span className="w-14 shrink-0 truncate text-apoio font-semibold text-acao" title={local ?? undefined}>{local ?? '—'}</span>
      <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-0.5">
        <span className="text-corpo font-medium text-tinta">{nome} <span className="text-apoio font-normal text-tinta-sussurro">{idade}</span></span>
        {texto && <span className="truncate text-apoio text-tinta-sussurro" title={texto}>{texto}</span>}
      </div>
      <PendenciaPrincipal p={pendencias} />
      <span className={cn('text-apoio whitespace-nowrap tabular-nums', tempoCritico ? 'font-semibold text-critico' : 'text-tinta-apoio')}>{tempo}</span>
      <BotaoCuidados onClick={onCuidados} />
    </div>
  )
}

/** Um grupo da lista única (PS2): título curto com a contagem, sem cartão próprio. */
export function GrupoLista({ titulo, n, children }: { titulo: string; n: number; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <div className="flex items-baseline gap-2 border-b border-trilha bg-campo px-5 py-2">
        <span className="text-apoio font-semibold text-tinta">{titulo}</span>
        <span className="text-apoio tabular-nums text-tinta-sussurro">{n}</span>
      </div>
      {children}
    </div>
  )
}

/** PS3: fora da escala, o próximo plantão e o caminho para a Escala, em vez de um vazio sem saída. */
export function VazioForaDaEscala({ onde }: { onde: string }) {
  return (
    <div className="flex flex-col gap-3">
      <Vazio icone={CalendarClock} titulo="Você não está na escala agora"
        texto={<>Aparecem aqui {onde} dos setores em que você está de plantão agora. Quem monta a escala é o gestor da unidade.</>} />
      <ProximoPlantao />
      <div><Link to="/minha-escala" className={buttonVariants({ variant: 'outline', size: 'sm' })}><CalendarClock /> Ver a escala</Link></div>
    </div>
  )
}

export function BotaoCuidados({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="outline" onClick={onClick}>
      <ClipboardList className="size-3.5" aria-hidden /> Cuidados
    </Button>
  )
}

/** Contenção mecânica ativa (lacuna 4): o selo mais urgente do servidor; sem selo, "Em contenção mecânica". */
export function PilulaContencao({ c }: { c: ContencaoAtiva | undefined }) {
  if (!c) return null
  const selo = selosDaContencao(c)[0]
  return (
    <span className={cn(PILULA, selo?.tom === 'critico' ? 'bg-alerta-critico text-critico' : 'bg-alerta-atencao text-atencao')}>
      {selo ? selo.texto : 'Em contenção mecânica'}
    </span>
  )
}

/** Prescrição vencida ou vencendo (lacuna 6, COFEN 689/2022): o item vencido não se administra. */
export function PilulaValidade({ r, agora }: { r: ReturnType<typeof resumoValidade> | undefined; agora: number }) {
  const t = r ? textoResumoValidade(r, agora) : null
  if (!t) return null
  return (
    <span title={t.titulo} className={cn(PILULA, t.tom === 'critico' ? 'bg-alerta-critico text-critico' : 'bg-alerta-atencao text-atencao')}>
      {t.texto}
    </span>
  )
}

export function PilulaAtraso({ n }: { n: number }) {
  if (!n) return null
  return <span className={cn(PILULA, 'bg-alerta-critico text-critico')}>{n} {n === 1 ? 'aprazamento atrasado' : 'aprazamentos atrasados'}</span>
}
