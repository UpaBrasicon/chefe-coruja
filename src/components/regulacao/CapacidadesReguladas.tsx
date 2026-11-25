// ─────────────────────────────────────────────────────────────────────────────
// O que as unidades reguladas têm (pedido do RT de 24/11/2026).
//
// O regulador e o gestor da central consultam o que cada unidade que a central
// regula tem — tipos de leito (com a quantidade), exames e especialidades —
// ao decidir o destino. Quem cadastra é o administrador da rede (perfil
// Administrador › Regulação). Para a vaga de agora, o mapa de vagas.
// No pedido, as unidades que têm o que ele procura vêm primeiro, destacadas.
// Migration 20270421000012_regulacao_central_certa.sql.
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery } from '@tanstack/react-query'
import { Building2 } from 'lucide-react'

import { Vazio } from '@/components/monitor/Pagina'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { MensagemErro } from '@/components/ui/mensagem-erro'
import { Spinner } from '@/components/ui/spinner'
import { fmtDataHora } from '@/lib/datas'
import {
  CATEGORIAS, capacidadeCombina, categoriaDoPedido, ordenarParaPedido,
  type PedidoProcura, type UnidadeRegulada,
} from '@/lib/regulamentacaoCentrais'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

type Resposta = { central_id: string; unidades: UnidadeRegulada[] }

export function CapacidadesReguladas({ centralId, pedido = null, compacto = false, origemId, aoEscolher }: {
  centralId: string
  /** No painel de decisão: o que o pedido procura, para destacar. */
  pedido?: PedidoProcura | null
  compacto?: boolean
  /** A unidade de origem do pedido não é destino. */
  origemId?: string
  /** No painel de decisão: põe a unidade como destino. */
  aoEscolher?: (unidadeId: string) => void
}) {
  const q = useQuery({
    queryKey: ['regulacao-capacidades-reguladas', centralId],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('regulacao_capacidades_reguladas', { p_central: centralId })
      if (error) throw error
      return data as unknown as Resposta
    },
  })
  const unidades = ordenarParaPedido(q.data?.unidades ?? [], pedido)
  const destaque = pedido ? categoriaDoPedido(pedido.tipo) : null

  const conteudo = q.isLoading ? <Spinner /> : q.error ? <MensagemErro erro={q.error} acao="ler o que as unidades têm" /> : unidades.length === 0 ? (
    <Vazio icone={Building2} titulo="Nenhuma unidade regulada por esta central"
      texto="O administrador da rede define que unidades cada central regula e o que cada uma tem." />
  ) : (
    <ul className="flex flex-col divide-y divide-fio">
      {unidades.map((u) => {
        const tem = !!pedido && u.capacidades.some((c) => capacidadeCombina(c, pedido))
        return (
          <li key={u.id} className="flex flex-col gap-1.5 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-tinta">{u.nome}</span>
              {tem && <Badge variant="success">Tem o que o pedido procura</Badge>}
              {u.atualizado_em && <span className="text-rotulo text-tinta-sussurro">atualizado em {fmtDataHora(u.atualizado_em)}</span>}
              {u.id === origemId && <Badge variant="secondary">origem do pedido</Badge>}
              {aoEscolher && u.id !== origemId && (
                <Button size="xs" variant="outline" className="ml-auto" onClick={() => aoEscolher(u.id)}>Escolher como destino</Button>
              )}
            </div>
            {u.capacidades.length === 0 ? (
              <span className="text-rotulo text-tinta-sussurro">Nada informado pelo administrador.</span>
            ) : (
              <dl className="grid gap-1 sm:grid-cols-[10rem_1fr]">
                {CATEGORIAS.map(({ categoria, rotulo, vazio }) => {
                  const itens = u.capacidades.filter((c) => c.categoria === categoria)
                  return (
                    <div key={categoria} className={cn('contents', destaque && destaque !== categoria && compacto && 'hidden')}>
                      <dt className={cn('text-rotulo text-tinta-apoio', destaque === categoria && 'font-medium text-tinta')}>{rotulo}</dt>
                      <dd className="flex flex-wrap gap-1">
                        {itens.length === 0 ? <span className="text-rotulo text-tinta-sussurro">{vazio}</span> : itens.map((c) => (
                          <Badge key={c.codigo} title={c.observacao ?? undefined}
                            variant={pedido && capacidadeCombina(c, pedido) ? 'success' : destaque === categoria ? 'info' : 'secondary'}>
                            {c.nome}{c.categoria === 'leito' && c.quantidade != null ? ` · ${c.quantidade}` : ''}{c.observacao ? ' *' : ''}
                          </Badge>
                        ))}
                      </dd>
                    </div>
                  )
                })}
              </dl>
            )}
          </li>
        )
      })}
    </ul>
  )

  const nota = 'Cadastro do administrador da rede: o que cada unidade tem, não a vaga de agora (essa está no mapa de vagas). * tem observação; passe o mouse para ler.'
  if (compacto) {
    return (
      <div className="flex flex-col gap-2 rounded-controle border border-fio bg-superficie p-3 text-apoio">
        <span className="text-rotulo text-tinta-sussurro">{nota}</span>
        {conteudo}
      </div>
    )
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-corpo"><Building2 className="size-4" aria-hidden /> O que as unidades reguladas têm</CardTitle>
        <CardDescription>Leitos por tipo, exames e especialidades das unidades que esta central regula. {nota}</CardDescription>
      </CardHeader>
      <CardContent className="text-apoio">{conteudo}</CardContent>
    </Card>
  )
}
