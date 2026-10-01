import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bug, CalendarClock, CircleCheck, RotateCcw, ShieldCheck, Siren,
  TriangleAlert, UserX, type LucideIcon,
} from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/spinner'
import { TituloPagina, TituloSecao } from '@/components/monitor/Pagina'
import type { Database } from '@/types/database'

import { haQuanto, selo } from './dadosAdmin'
import { cartao } from './ui'

// Onda 12 — "Erros e alertas do sistema" do administrador geral. Duas partes:
//  • Erros do aplicativo: os defeitos capturados no navegador (erros_cliente),
//    agrupados por assinatura (erros_cliente_agrupados). Marcar resolvido não
//    apaga (resolver_erro_cliente).
//  • Verificações do sistema: as checagens de lógica dos agentes Hermes, por
//    um invólucro de super admin (verificacoes_sistema), agrupadas por tema.

// ── erros do aplicativo ──────────────────────────────────────────────────────

type ErroGrupo = Database['public']['Functions']['erros_cliente_agrupados']['Returns'][number]

const TIPO_ERRO: Record<string, string> = {
  render: 'Tela (render)',
  erro_js: 'Erro de código',
  promessa: 'Promessa rejeitada',
  rpc: 'Falha de RPC',
  rede: 'Falha de rede',
}

const quando = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

function useErros(dias: number, incluirResolvidos: boolean) {
  return useQuery({
    queryKey: ['erros-agrupados', dias, incluirResolvidos],
    refetchInterval: 60_000,
    queryFn: async () => {
      const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString()
      const { data, error } = await supabase.rpc('erros_cliente_agrupados', {
        p_desde: desde,
        p_incluir_resolvidos: incluirResolvidos,
      })
      if (error) throw error
      return data ?? []
    },
  })
}

function ErroItem({ erro }: { erro: ErroGrupo }) {
  const queryClient = useQueryClient()
  const [erroAcao, setErroAcao] = React.useState<string | null>(null)

  const resolver = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('resolver_erro_cliente', {
        p_assinatura: erro.assinatura,
        p_resolver: !erro.resolvido,
      })
      if (error) throw error
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['erros-agrupados'] }),
    onError: (e: Error) => setErroAcao(e.message),
  })

  return (
    <div className={cn('flex items-stretch gap-[13px] border-b border-trilha px-5 py-3.5 last:border-0 hover:bg-campo', erro.resolvido && 'opacity-70')}>
      <span className={cn('w-[3px] shrink-0 self-stretch rounded-capsula', erro.resolvido ? 'bg-conforme' : 'bg-critico')} aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-[9px]">
          <span className="text-corpo font-medium text-tinta">{erro.mensagem || 'Sem mensagem'}</span>
          <span className={cn(selo, 'text-tinta-apoio bg-trilha')}>{TIPO_ERRO[erro.tipo] ?? erro.tipo}</span>
          {erro.resolvido && <span className={cn(selo, 'text-conforme bg-conforme/10')}>Resolvido</span>}
        </div>
        <span className="text-apoio text-tinta-sussurro">{erro.origem || 'origem não informada'}</span>
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-0.5 text-apoio text-tinta-sussurro">
          <span className="tabular-nums">{erro.ocorrencias} {erro.ocorrencias === 1 ? 'ocorrência' : 'ocorrências'}</span>
          <span className="tabular-nums">{erro.perfis_afetados} {erro.perfis_afetados === 1 ? 'pessoa afetada' : 'pessoas afetadas'}</span>
          <span>última {haQuanto(erro.ultima_em)}</span>
          <span>desde {quando(erro.primeira_em)}</span>
        </div>
        {erroAcao && <span role="alert" className="text-apoio text-critico">{erroAcao}</span>}
      </div>
      <button
        type="button"
        onClick={() => { setErroAcao(null); resolver.mutate() }}
        disabled={resolver.isPending}
        className="flex items-center gap-1.5 self-center rounded-[9px] border border-fio bg-superficie px-3 py-1.5 text-apoio whitespace-nowrap text-tinta-apoio hover:border-marca hover:text-acao disabled:opacity-60"
      >
        {resolver.isPending ? <Spinner className="size-4" /> : erro.resolvido ? <RotateCcw className="size-4" /> : <CircleCheck className="size-4" />}
        {erro.resolvido ? 'Reabrir' : 'Marcar resolvido'}
      </button>
    </div>
  )
}

function BlocoErros() {
  const [dias, setDias] = React.useState<7 | 30>(7)
  const [resolvidos, setResolvidos] = React.useState(false)
  const erros = useErros(dias, resolvidos)
  const lista = erros.data ?? []

  return (
    <section className="mb-7">
      <TituloSecao extra={erros.data ? `${lista.length} ${lista.length === 1 ? 'grupo' : 'grupos'}` : undefined}>
        Erros do aplicativo
      </TituloSecao>
      <div className={cartao}>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-fio px-5 py-3">
          <div role="group" aria-label="Período" className="flex items-center gap-1.5 text-apoio text-tinta-sussurro">
            <CalendarClock className="size-4" aria-hidden />
            {([7, 30] as const).map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={dias === d}
                onClick={() => setDias(d)}
                className={cn(
                  'rounded-capsula border px-[11px] py-1 transition-colors',
                  dias === d ? 'border-acao bg-acao font-medium text-white' : 'border-fio bg-superficie text-tinta-apoio hover:border-acao hover:text-acao',
                )}
              >
                {d} dias
              </button>
            ))}
          </div>
          <label className="ml-auto flex items-center gap-2 text-apoio text-tinta-apoio">
            <input type="checkbox" checked={resolvidos} onChange={(e) => setResolvidos(e.target.checked)} className="size-4 accent-[var(--color-acao)]" />
            Mostrar resolvidos
          </label>
        </div>

        {erros.isLoading && <div className="px-5 py-5"><Spinner /></div>}
        {erros.error && <p className="px-5 py-4 text-apoio text-critico">{(erros.error as Error).message}</p>}
        {lista.map((e) => <ErroItem key={e.assinatura} erro={e} />)}
        {erros.data && lista.length === 0 && (
          <div className="flex flex-col items-center gap-1.5 px-5 py-[34px] text-center">
            <CircleCheck className="size-6 text-conforme" aria-hidden />
            <p className="text-corpo font-semibold text-tinta">Nenhum erro nos últimos {dias} dias</p>
            <p className="text-apoio text-tinta-sussurro">
              {resolvidos ? 'Nada registrado no período.' : 'Nenhum erro em aberto. Marque "Mostrar resolvidos" para ver os já tratados.'}
            </p>
          </div>
        )}
      </div>
    </section>
  )
}

// ── verificações do sistema ──────────────────────────────────────────────────

type Verificacoes = {
  gerado_em: string
  escala: {
    plantoes_sobrepostos: { perfil: string | null; unidade_a: string | null; unidade_b: string | null; inicio_a: string; inicio_b: string }[]
    buracos_escala: { unidade: string | null; setor: string; horas_sem_ninguem: number; primeira_hora: string }[]
    checkin_pendente: { perfil: string | null; unidade: string | null; setor: string; inicio: string }[]
    setores_ocupados_sem_plantao: { unidade: string | null; setor: string | null; leitos_ocupados: number }[]
  }
  cadastro: {
    perfis_sem_vinculo: { perfil: string | null }[]
    crm_duplicado: { crm: string; uf_crm: string | null; perfis: string[] }[]
  }
  seguranca: {
    cadeia_auditoria: number | null
    acessos_anomalos: { perfil: string | null; unidade: string | null; aberturas: number; impressoes: number; pacientes_distintos: number }[]
  }
  operacao: {
    revisoes_paradas: { unidade: string | null; pendentes: number; mais_antiga: string }[]
  }
}

function useVerificacoes() {
  return useQuery({
    queryKey: ['verificacoes-sistema'],
    refetchInterval: 120_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('verificacoes_sistema')
      if (error) throw error
      return data as unknown as Verificacoes
    },
  })
}

/** Uma verificação: título, achados e como escrever cada achado numa linha. */
type Checagem = {
  titulo: string
  singular: string
  plural: string
  itens: unknown[]
  linha: (item: never) => string
}

const hora = (s: number) => (s === 1 ? '1 hora' : `${s} horas`)

function temas(v: Verificacoes): { tema: string; icone: LucideIcon; checagens: Checagem[] }[] {
  const e = v.escala, c = v.cadastro, s = v.seguranca, o = v.operacao
  return [
    {
      tema: 'Escala e plantão',
      icone: CalendarClock,
      checagens: [
        {
          titulo: 'Plantões sobrepostos', singular: 'plantão sobreposto', plural: 'plantões sobrepostos',
          itens: e.plantoes_sobrepostos,
          linha: (i: Verificacoes['escala']['plantoes_sobrepostos'][number]) =>
            `${i.perfil ?? 'profissional'} — ${i.unidade_a ?? '?'} e ${i.unidade_b ?? '?'} ao mesmo tempo (${quando(i.inicio_a)})`,
        },
        {
          titulo: 'Buracos na escala (próximas 24 h)', singular: 'buraco', plural: 'buracos',
          itens: e.buracos_escala,
          linha: (i: Verificacoes['escala']['buracos_escala'][number]) =>
            `${i.unidade ?? '?'} · ${i.setor} — ${hora(i.horas_sem_ninguem)} sem ninguém (a partir de ${i.primeira_hora})`,
        },
        {
          titulo: 'Check-in pendente', singular: 'check-in pendente', plural: 'check-ins pendentes',
          itens: e.checkin_pendente,
          linha: (i: Verificacoes['escala']['checkin_pendente'][number]) =>
            `${i.perfil ?? 'profissional'} — ${i.unidade ?? '?'} · ${i.setor} (plantão às ${i.inicio})`,
        },
        {
          titulo: 'Setores ocupados sem plantão', singular: 'setor', plural: 'setores',
          itens: e.setores_ocupados_sem_plantao,
          linha: (i: Verificacoes['escala']['setores_ocupados_sem_plantao'][number]) =>
            `${i.unidade ?? '?'} · ${i.setor ?? '?'} — ${i.leitos_ocupados} ${i.leitos_ocupados === 1 ? 'leito ocupado' : 'leitos ocupados'}, ninguém de plantão`,
        },
      ],
    },
    {
      tema: 'Cadastro',
      icone: UserX,
      checagens: [
        {
          titulo: 'Perfis sem vínculo', singular: 'perfil sem vínculo', plural: 'perfis sem vínculo',
          itens: c.perfis_sem_vinculo,
          linha: (i: Verificacoes['cadastro']['perfis_sem_vinculo'][number]) => i.perfil ?? 'profissional sem nome',
        },
        {
          titulo: 'CRMs duplicados', singular: 'CRM duplicado', plural: 'CRMs duplicados',
          itens: c.crm_duplicado,
          linha: (i: Verificacoes['cadastro']['crm_duplicado'][number]) =>
            `CRM ${i.crm}${i.uf_crm ? `/${i.uf_crm}` : ''} — ${i.perfis.join(', ')}`,
        },
      ],
    },
    {
      tema: 'Segurança e auditoria',
      icone: ShieldCheck,
      checagens: [
        {
          titulo: 'Acessos anômalos ao prontuário (24 h)', singular: 'acesso anômalo', plural: 'acessos anômalos',
          itens: s.acessos_anomalos,
          linha: (i: Verificacoes['seguranca']['acessos_anomalos'][number]) =>
            `${i.perfil ?? 'profissional'} — ${i.unidade ?? '?'}: ${i.aberturas} aberturas, ${i.impressoes} impressões, ${i.pacientes_distintos} pacientes`,
        },
      ],
    },
    {
      tema: 'Operação',
      icone: Siren,
      checagens: [
        {
          titulo: 'Revisões clínicas paradas (> 24 h)', singular: 'revisão parada', plural: 'revisões paradas',
          itens: o.revisoes_paradas,
          linha: (i: Verificacoes['operacao']['revisoes_paradas'][number]) =>
            `${i.unidade ?? '?'} — ${i.pendentes} ${i.pendentes === 1 ? 'pendente' : 'pendentes'} (a mais antiga de ${i.mais_antiga})`,
        },
      ],
    },
  ]
}

function LinhaChecagem({ checagem }: { checagem: Checagem }) {
  const [aberto, setAberto] = React.useState(false)
  const n = checagem.itens.length
  const ok = n === 0
  return (
    <div className="border-b border-trilha px-5 py-3 last:border-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {ok
          ? <CircleCheck className="size-4 shrink-0 text-conforme" aria-hidden />
          : <TriangleAlert className="size-4 shrink-0 text-critico" aria-hidden />}
        <span className="text-corpo text-tinta">{checagem.titulo}</span>
        {ok ? (
          <span className={cn(selo, 'ml-auto text-conforme bg-conforme/10')}>ok</span>
        ) : (
          <button
            type="button"
            onClick={() => setAberto((a) => !a)}
            aria-expanded={aberto}
            className={cn(selo, 'ml-auto text-critico bg-critico/10 hover:brightness-95')}
          >
            {n} {n === 1 ? checagem.singular : checagem.plural}
          </button>
        )}
      </div>
      {!ok && aberto && (
        <ul className="mt-2 flex flex-col gap-1 pl-7">
          {checagem.itens.map((item, idx) => (
            <li key={idx} className="text-apoio text-pretty text-tinta-apoio">• {checagem.linha(item as never)}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

function BlocoVerificacoes() {
  const v = useVerificacoes()

  return (
    <section>
      <TituloSecao extra={v.data ? `verificado ${haQuanto(v.data.gerado_em)}` : undefined}>
        Verificações do sistema
      </TituloSecao>

      {v.isLoading && <div className={cn(cartao, 'px-5 py-5')}><Spinner /></div>}
      {v.error && <p className={cn(cartao, 'px-5 py-4 text-apoio text-critico')}>{(v.error as Error).message}</p>}

      {v.data && (
        <>
          {/* cadeia de auditoria: resultado escalar, destaque próprio */}
          <div className={cn(cartao, 'mb-3.5 flex items-center gap-3 px-5 py-3.5')}>
            {v.data.seguranca.cadeia_auditoria === null
              ? <CircleCheck className="size-5 shrink-0 text-conforme" aria-hidden />
              : <TriangleAlert className="size-5 shrink-0 text-critico" aria-hidden />}
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-corpo text-tinta">Cadeia de auditoria</span>
              <span className="text-apoio text-tinta-sussurro">
                {v.data.seguranca.cadeia_auditoria === null
                  ? 'Íntegra — nenhuma linha adulterada.'
                  : `Rompida a partir da linha #${v.data.seguranca.cadeia_auditoria}.`}
              </span>
            </div>
            <span className={cn(selo, v.data.seguranca.cadeia_auditoria === null ? 'text-conforme bg-conforme/10' : 'text-critico bg-critico/10')}>
              {v.data.seguranca.cadeia_auditoria === null ? 'ok' : 'alerta'}
            </span>
          </div>

          <div className="flex flex-col gap-3.5">
            {temas(v.data).map((grupo) => (
              <div key={grupo.tema} className={cartao}>
                <div className="flex items-center gap-2 border-b border-fio px-5 py-3">
                  <grupo.icone className="size-4 text-tinta-sussurro" aria-hidden />
                  <h3 className="text-apoio font-semibold tracking-[0.03em] text-tinta-apoio uppercase">{grupo.tema}</h3>
                </div>
                {grupo.checagens.map((ch) => <LinhaChecagem key={ch.titulo} checagem={ch} />)}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  )
}

// ── página ───────────────────────────────────────────────────────────────────

export default function ErrosEAlertas() {
  const erros = useErros(7, false)
  const abertos = (erros.data ?? []).length

  return (
    <div className="mx-auto flex w-full max-w-[896px] flex-col">
      <TituloPagina
        icone={Bug}
        titulo="Erros e alertas"
        descricao={erros.data
          ? abertos === 0
            ? 'Nenhum erro em aberto nos últimos 7 dias · verificações de lógica da rede'
            : `${abertos} ${abertos === 1 ? 'erro em aberto' : 'erros em aberto'} nos últimos 7 dias · verificações de lógica da rede`
          : 'Defeitos do navegador e verificações de lógica da rede'}
      />
      <BlocoErros />
      <BlocoVerificacoes />
    </div>
  )
}
