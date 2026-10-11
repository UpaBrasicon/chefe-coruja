// Gestor: libera ou retira a unidade do alcance dos papéis de rede (Fase 4,
// tarefa 12). Decisão do gestor; fica no histórico e na auditoria.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Network } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { useUnidade } from '@/contexts/UnidadeContext'
import { fmtDataHora } from '@/lib/datas'
import { PAPEL_LABEL } from '@/lib/constants'
import { supabase } from '@/lib/supabase'
import type { Papel } from '@/types/database'

type Liberacao = {
  modulo_ativo: boolean; eh_secretaria: boolean; secretaria: string | null; liberada: boolean
  alterado_em: string | null; alterado_por: string | null; pessoas: { nome: string; papel: Papel }[]
}

export default function LiberacaoRede() {
  const qc = useQueryClient()
  const { unidadeAtiva } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id ?? ''
  const l = useQuery({
    queryKey: ['rede-liberacao', unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('rede_liberacao', { p_unidade: unidadeId })
      if (error) throw error
      return data as unknown as Liberacao
    },
  })
  const mudar = useMutation({
    mutationFn: async (liberar: boolean) => {
      const { error } = await supabase.rpc('rede_liberar_unidade', { p_unidade: unidadeId, p_liberar: liberar })
      if (error) throw error
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['rede-liberacao', unidadeId] }),
  })
  const d = l.data
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Network className="size-4" aria-hidden /> Acesso dos papéis de rede</CardTitle>
        <CardDescription>
          Secretaria (só números), Regulação regional (pedidos de regulação, só leitura, com acesso registrado) e Faturamento da secretaria
          (produção e arquivos fechados). Você decide se esta unidade entra; pode retirar quando quiser.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-apoio">
        {l.isLoading ? <Spinner /> : l.error ? <p role="alert" className="text-critico">{(l.error as Error).message}</p>
          : !d?.modulo_ativo ? <span className="text-tinta-sussurro">O módulo de rede está desligado nesta organização.</span>
          : d.eh_secretaria ? <span className="text-tinta-sussurro">Esta é a unidade Secretaria.</span> : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={d.liberada ? 'success' : 'secondary'}>{d.liberada ? 'Liberada para a rede' : 'Fora do alcance da rede'}</Badge>
                {d.alterado_em && <span className="text-rotulo text-tinta-sussurro">{d.alterado_por ?? '—'} · {fmtDataHora(d.alterado_em)}</span>}
                <Button size="sm" className="ml-auto" variant={d.liberada ? 'outline' : 'default'} onClick={() => mudar.mutate(!d.liberada)} disabled={mudar.isPending}>
                  {d.liberada ? 'Retirar da rede' : 'Liberar para a rede'}
                </Button>
              </div>
              <p className="text-tinta-apoio">
                Pessoas de rede ({d.secretaria ?? 'Secretaria'}): {d.pessoas.length === 0 ? 'nenhuma ainda' : d.pessoas.map((p) => `${p.nome} (${PAPEL_LABEL[p.papel]})`).join(', ')}.
              </p>
            </>
          )}
        {mudar.error && <p role="alert" className="text-rotulo text-critico">{(mudar.error as Error).message}</p>}
      </CardContent>
    </Card>
  )
}
