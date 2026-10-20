import { useQuery } from '@tanstack/react-query'
import { History } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { dataHora } from '@/lib/formato'
import { TituloPagina, Trilha } from '@/components/monitor/Pagina'
import { useUnidade } from '@/contexts/UnidadeContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type Historico = {
  id: string
  acao: string
  detalhe: string | null
  plantao_id: string | null
  dados: unknown | null
  created_at: string
  perfis: { nome_completo: string } | null
}

const ACAO_LABEL: Record<string, { label: string; variant: 'success' | 'destructive' | 'warning' | 'info' | 'secondary' | 'default' }> = {
  criar: { label: 'Criação', variant: 'info' },
  alterar: { label: 'Alteração', variant: 'secondary' },
  remover: { label: 'Remoção', variant: 'destructive' },
  passagem_aplicada: { label: 'Passagem aplicada', variant: 'success' },
  passagem_solicitada: { label: 'Passagem solicitada', variant: 'info' },
  erro_passagem: { label: 'Erro de passagem', variant: 'destructive' },
  troca_solicitada: { label: 'Troca solicitada', variant: 'info' },
  troca_aprovada: { label: 'Troca aprovada', variant: 'success' },
  troca_recusada: { label: 'Troca recusada', variant: 'warning' },
  publicar: { label: 'Publicação', variant: 'success' },
  marcar_vaga: { label: 'Vaga marcada', variant: 'warning' },
  retirar_vaga: { label: 'Vaga retirada', variant: 'secondary' },
}

export default function HistoricoEscala({ embutido = false }: { embutido?: boolean } = {}) {
  const { unidadeAtiva } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  const [acaoFiltro, setAcaoFiltro] = React.useState('')

  const { data: historico, isLoading } = useQuery({
    queryKey: ['historico-escala', unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('historico_escala')
        .select('id, acao, detalhe, plantao_id, dados, created_at, perfis(nome_completo)')
        .eq('unidade_id', unidadeId!)
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return (data ?? []) as unknown as Historico[]
    },
  })

  const linhas = React.useMemo(() => {
    const itens = historico ?? []
    if (!acaoFiltro) return itens
    return itens.filter((h) => h.acao === acaoFiltro)
  }, [historico, acaoFiltro])

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      {!embutido && (
        <div className="flex flex-col">
          <Trilha niveis={[{ rotulo: 'Início', to: '/' }, { rotulo: 'Histórico da escala' }]} />
          <TituloPagina icone={History} titulo="Histórico da escala" className="mb-0"
            descricao={<>
              Auditoria completa das alterações e, em destaque, os <strong>erros de passagem</strong> — para
              entender o que ocorreu em cada movimentação de plantão.
            </>} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Select value={acaoFiltro || null} onValueChange={(v) => setAcaoFiltro(v ?? '')}>
          <SelectTrigger className="w-60">
            <SelectValue placeholder="Filtrar por ação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="publicar">Publicações</SelectItem>
            <SelectItem value="marcar_vaga">Vagas marcadas</SelectItem>
            <SelectItem value="erro_passagem">Erros de passagem</SelectItem>
            <SelectItem value="passagem_aplicada">Passagens aplicadas</SelectItem>
            <SelectItem value="passagem_solicitada">Passagens solicitadas</SelectItem>
            <SelectItem value="troca_solicitada">Trocas solicitadas</SelectItem>
            <SelectItem value="troca_aprovada">Trocas aprovadas</SelectItem>
            <SelectItem value="troca_recusada">Trocas recusadas</SelectItem>
            <SelectItem value="criar">Criações</SelectItem>
            <SelectItem value="alterar">Alterações</SelectItem>
            <SelectItem value="remover">Remoções</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-corpo">
            <History className="size-4 text-tinta-sussurro" />
            {linhas.length} registro(s)
          </CardTitle>
          <CardDescription>Últimas 200 movimentações registradas.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {isLoading ? (
            <div className="flex h-24 items-center justify-center">
              <Spinner />
            </div>
          ) : linhas.length === 0 ? (
            <p className="text-apoio text-tinta-sussurro">Nenhum registro encontrado.</p>
          ) : (
            linhas.map((h) => {
              const meta = ACAO_LABEL[h.acao] ?? { label: h.acao, variant: 'secondary' as const }
              return (
                <div
                  key={h.id}
                  className={`rounded-controle border p-2.5 text-apoio ${h.acao === 'erro_passagem' ? 'border-critico/30 bg-alerta-critico' : ''}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                    <span className="text-rotulo text-tinta-sussurro">
                      {dataHora(h.created_at)}
                    </span>
                    <span className="ml-auto text-rotulo text-tinta-sussurro">
                      por {h.perfis?.nome_completo ?? 'sistema'}
                    </span>
                  </div>
                  {h.detalhe && <div className="mt-1.5 text-rotulo">{h.detalhe}</div>}
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}
