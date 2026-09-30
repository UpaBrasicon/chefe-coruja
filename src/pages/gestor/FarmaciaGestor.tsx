// ─────────────────────────────────────────────────────────────────────────────
// Farmácia do gestor (protótipo "farmacia", P/index.html 7335–7431).
//
// O gestor vê a CONSEQUÊNCIA do trabalho da farmácia: o que o plantão e o
// farmacêutico sinalizaram (Registrada → Em cotação → Reposta) e o estoque
// informado pelo farmacêutico, com o selo da comparação com os limites.
// Validação da prescrição e diluição padrão continuam do farmacêutico. Tudo
// vem de farmacia_do_gestor (migration 20261007000001); aqui não se grava.
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery } from '@tanstack/react-query'
import { Check, Copy, FlaskConical, Megaphone } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { useUnidade } from '@/contexts/UnidadeContext'
import { TituloPagina } from '@/components/monitor/Pagina'
import { Spinner } from '@/components/ui/spinner'

type Falta = {
  id: string; medicamento: string; apresentacao: string | null; situacao: 'registrada' | 'em_cotacao' | 'reposta'
  observacao: string | null; sinalizada_por: string | null; sinalizada_em: string; atualizada_por: string | null; atualizada_em: string | null
}
type Estoque = {
  medicamento_id: string; medicamento: string; apresentacao: string | null; quantidade: number
  limite_critico: number | null; limite_falta: number | null; situacao: 'falta' | 'critico' | 'ok'
  atualizado_por: string | null; atualizado_em: string
}

const SIT_FALTA = { registrada: 'Registrada', em_cotacao: 'Em cotação', reposta: 'Reposta' } as const
const SIT_ESTOQUE = { falta: 'Em falta', critico: 'Crítico', ok: 'Adequado' } as const
const SELO = 'inline-flex items-center whitespace-nowrap rounded-capsula px-2 py-[3px] text-rotulo font-semibold uppercase tracking-[0.03em]'
const quando = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }) : '—'
const num = (n: number | null) => (n == null ? '—' : n.toLocaleString('pt-BR'))

export default function FarmaciaGestor() {
  const { unidadeAtiva } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  const [copiado, setCopiado] = React.useState(false)

  const dados = useQuery({
    queryKey: ['farmacia-gestor', unidadeId],
    enabled: !!unidadeId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('farmacia_do_gestor', { p_unidade: unidadeId! })
      if (error) throw error
      return data as unknown as { faltas: Falta[]; estoque: Estoque[] }
    },
  })
  const faltas = dados.data?.faltas ?? []
  const estoque = dados.data?.estoque ?? []
  const emFalta = estoque.filter((e) => e.situacao === 'falta').length
  const criticos = estoque.filter((e) => e.situacao === 'critico').length

  // "Exportar pedido de reposição": o texto do que está em falta ou crítico,
  // para o gestor colar no pedido de compra (não grava nada).
  async function copiarPedido() {
    const linhas = estoque.filter((e) => e.situacao !== 'ok').map((e) =>
      `${e.medicamento}${e.apresentacao ? ` (${e.apresentacao})` : ''}: saldo ${num(e.quantidade)}, crítico ≤ ${num(e.limite_critico)}, falta ≤ ${num(e.limite_falta)}`)
    const abertas = faltas.filter((f) => f.situacao !== 'reposta').map((f) => `${f.medicamento}: ${SIT_FALTA[f.situacao].toLowerCase()}${f.observacao ? ` (${f.observacao})` : ''}`)
    const texto = [`Pedido de reposição · ${unidadeAtiva?.unidade.nome ?? ''} · ${quando(new Date().toISOString())}`, '',
      ...(linhas.length ? ['Estoque em falta ou crítico:', ...linhas.map((l) => `- ${l}`)] : ['Nenhum item em falta ou crítico no estoque informado.']),
      ...(abertas.length ? ['', 'Faltas sinalizadas:', ...abertas.map((l) => `- ${l}`)] : [])].join('\n')
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
      window.setTimeout(() => setCopiado(false), 2500)
    } catch { /* sem área de transferência: nada a fazer */ }
  }

  return (
    <div className="mx-auto w-full max-w-[896px]">
      <TituloPagina icone={FlaskConical} titulo="Farmácia" />
      {dados.error && <p className="mb-3 text-apoio text-critico">{(dados.error as Error).message}</p>}
      {dados.isLoading && <div className="flex justify-center py-8"><Spinner /></div>}

      {!dados.isLoading && (
        <div className="flex flex-col gap-[22px]">
          <section className="overflow-hidden rounded-cartao border border-fio bg-superficie shadow-repouso">
            <div className="flex items-center gap-2.5 border-b border-trilha px-5 py-3.5">
              <Megaphone className="size-4 text-atencao" aria-hidden />
              <h2 className="text-corpo font-semibold tracking-[-0.01em] text-tinta">Sinalizado pelo farmacêutico</h2>
            </div>
            {faltas.length === 0 && (
              <p className="border-b border-trilha px-5 py-3.5 text-apoio text-tinta-sussurro">Nenhuma falta aberta. As repostas nos últimos 7 dias também aparecem aqui.</p>
            )}
            {faltas.map((f) => (
              <div key={f.id} className="flex flex-wrap items-center gap-3.5 border-b border-trilha px-5 py-[13px] hover:bg-campo">
                <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-0.5">
                  <span className="text-corpo font-medium text-tinta">{f.medicamento}{f.apresentacao && <span className="font-normal text-tinta-sussurro"> · {f.apresentacao}</span>}</span>
                  {f.observacao && <span className="text-apoio text-pretty text-tinta-sussurro">{f.observacao}</span>}
                </div>
                <span className={cn(SELO, f.situacao === 'reposta' ? 'bg-conforme/[0.08] text-conforme' : 'bg-atencao/[0.08] text-atencao')}>{SIT_FALTA[f.situacao]}</span>
                <span className="text-apoio whitespace-nowrap text-tinta-sussurro">
                  {f.sinalizada_por ?? '—'} · {quando(f.sinalizada_em)}
                </span>
              </div>
            ))}
            <div className="bg-campo px-5 py-3 text-apoio text-pretty text-tinta-sussurro">
              Padrão de diluição e auditoria de prescrição são da farmácia. O gestor vê a consequência: o que falta e o que já foi cotado.
            </div>
          </section>

          <section className="cc-lista overflow-hidden rounded-cartao border border-fio bg-superficie shadow-repouso">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-trilha px-5 py-3.5">
              <span className={cn('text-apoio', emFalta + criticos ? 'text-atencao' : 'text-tinta-sussurro')}>
                {estoque.length ? `${emFalta} em falta · ${criticos} crítico${criticos === 1 ? '' : 's'}` : 'O farmacêutico ainda não informou o estoque.'}
              </span>
              <button type="button" onClick={() => void copiarPedido()} disabled={!estoque.length && !faltas.length}
                className="flex items-center gap-1.5 rounded-controle border border-fio bg-superficie px-3 py-[7px] text-apoio whitespace-nowrap text-tinta-apoio hover:border-marca hover:text-acao disabled:opacity-50">
                {copiado ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
                {copiado ? 'Copiado' : 'Exportar pedido de reposição'}
              </button>
            </div>
            {estoque.length > 0 && (
              <div className="flex items-center gap-3 border-b border-fio bg-campo px-5 py-[11px] text-rotulo font-semibold tracking-[0.05em] text-tinta-sussurro uppercase">
                <span className="min-w-0 flex-1">Item</span>
                <span className="w-[120px] shrink-0">Situação</span>
                <span className="w-[104px] shrink-0 text-right">Saldo</span>
              </div>
            )}
            {estoque.map((e) => {
              const ref = e.limite_critico ?? e.limite_falta
              const pct = ref ? Math.max(0, Math.min(100, Math.round((e.quantidade / ref) * 100))) : 100
              const cor = e.situacao === 'ok' ? 'bg-conforme' : e.situacao === 'critico' ? 'bg-atencao' : 'bg-critico'
              return (
                <div key={e.medicamento_id} className="flex items-center gap-3 border-b border-trilha px-5 py-[13px] last:border-0 hover:bg-campo">
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-corpo font-medium text-tinta">{e.medicamento}</span>
                    <span className="text-apoio text-tinta-sussurro">{[e.apresentacao, `atualizado ${quando(e.atualizado_em)}`, e.atualizado_por].filter(Boolean).join(' · ')}</span>
                  </div>
                  <div className="w-[120px] shrink-0">
                    <span className={cn(SELO, e.situacao === 'ok' ? 'bg-conforme/[0.08] text-conforme' : e.situacao === 'critico' ? 'bg-atencao/[0.08] text-atencao' : 'bg-critico/[0.08] text-critico')}>
                      {SIT_ESTOQUE[e.situacao]}
                    </span>
                  </div>
                  <div className="flex w-[104px] shrink-0 flex-col items-end gap-[5px]">
                    <span className="text-apoio font-semibold tabular-nums text-tinta">{e.quantidade > 0 ? `${num(e.quantidade)} un.` : 'Sem saldo'}</span>
                    <div className="relative h-[5px] w-full rounded-capsula bg-trilha" aria-hidden>
                      <div className={cn('absolute inset-y-0 left-0 rounded-capsula', cor)} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-rotulo tabular-nums text-tinta-sussurro">{ref != null ? `crítico ${num(e.limite_critico)} · falta ${num(e.limite_falta)}` : 'sem limites'}</span>
                  </div>
                </div>
              )
            })}
          </section>
        </div>
      )}
    </div>
  )
}
