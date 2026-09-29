import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, X } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { useUnidade } from '@/contexts/UnidadeContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'

// Registros feitos sem conexão que chegaram mais de 24 h depois do fato
// (migration 0014). Não entram no prontuário sozinhos: o gestor aceita ou
// descarta, sempre com motivo, e a decisão é única.

type Linha = {
  id: string
  paciente_nome: string
  autor_nome: string
  tipo: string
  hora_fato: string
  recebido_em: string
  dados: { valor_num?: number; valor_texto?: string; conceito_id?: string; tipo?: string }
  decisao: 'aceito' | 'descartado' | null
  decidido_por_nome: string | null
  motivo: string | null
}

const fmt = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })

function atraso(fato: string, chegada: string) {
  const h = Math.round((Date.parse(chegada) - Date.parse(fato)) / 3_600_000)
  return h >= 48 ? `${Math.round(h / 24)} dias depois` : `${h} h depois`
}

export default function RevisaoSemConexao() {
  const { unidadeAtiva } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  const queryClient = useQueryClient()
  const [motivos, setMotivos] = React.useState<Record<string, string>>({})

  const { data, isLoading, error } = useQuery({
    queryKey: ['revisao-sem-conexao', unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('revisoes_sem_conexao', { p_unidade: unidadeId! })
      if (error) throw error
      return data as unknown as Linha[]
    },
  })

  const { data: conceitos } = useQuery({
    queryKey: ['conceitos-nomes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('conceito').select('id, nome')
      if (error) throw error
      return new Map((data ?? []).map((c) => [c.id, c.nome.replace(/-/g, ' ')]))
    },
  })

  const decidir = useMutation({
    mutationFn: async ({ id, aceitar }: { id: string; aceitar: boolean }) => {
      const { error } = await supabase.rpc('decidir_revisao_sincronizacao', {
        p_id: id,
        p_aceitar: aceitar,
        p_motivo: motivos[id] ?? '',
      })
      if (error) throw error
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['revisao-sem-conexao'] }),
  })

  const pendentes = (data ?? []).filter((l) => !l.decisao)
  const decididos = (data ?? []).filter((l) => l.decisao)

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registros tardios</CardTitle>
          <CardDescription>
            Feitos sem conexão e recebidos mais de 24 horas depois do fato. Só entram no prontuário se você aceitar.
            Confira com o registro em papel antes de decidir.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {isLoading && <Spinner />}
          {error && <p className="text-sm text-critico">{(error as Error).message}</p>}
          {!isLoading && pendentes.length === 0 && (
            <p className="text-sm text-tinta-sussurro">Nenhum registro aguardando revisão.</p>
          )}
          {pendentes.map((l) => (
            <div key={l.id} className="flex flex-col gap-2 rounded-controle border border-fio p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium text-tinta">{l.paciente_nome}</span>
                <span className="text-xs text-tinta-sussurro">
                  fato {fmt(l.hora_fato)} · chegou {atraso(l.hora_fato, l.recebido_em)}
                </span>
              </div>
              <div className="text-sm text-tinta-apoio">
                {l.tipo === 'documento' ? (
                  <>Documento (folha provisória): <span className="font-medium">{(l.dados.tipo ?? '').replace('_', ' ')}</span></>
                ) : (
                  <>
                    {conceitos?.get(l.dados.conceito_id ?? '') ?? 'Observação'}:{' '}
                    <span className="font-medium tabular-nums">{l.dados.valor_num ?? l.dados.valor_texto ?? '—'}</span>
                  </>
                )}
                {' · '}por {l.autor_nome}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  className="min-w-0 flex-1"
                  placeholder="Motivo da decisão (obrigatório)"
                  value={motivos[l.id] ?? ''}
                  onChange={(e) => setMotivos((m) => ({ ...m, [l.id]: e.target.value }))}
                />
                <Button
                  size="sm"
                  disabled={decidir.isPending || (motivos[l.id] ?? '').trim().length < 5}
                  onClick={() => decidir.mutate({ id: l.id, aceitar: true })}
                >
                  <Check /> Aceitar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={decidir.isPending || (motivos[l.id] ?? '').trim().length < 5}
                  onClick={() => decidir.mutate({ id: l.id, aceitar: false })}
                >
                  <X /> Descartar
                </Button>
              </div>
            </div>
          ))}
          {decidir.isError && <p className="text-sm text-critico">{(decidir.error as Error).message}</p>}
        </CardContent>
      </Card>

      {decididos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Decididos</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1.5">
            {decididos.map((l) => (
              <div key={l.id} className="text-sm text-tinta-apoio">
                <span className={l.decisao === 'aceito' ? 'text-conforme' : 'text-critico'}>
                  {l.decisao === 'aceito' ? 'Aceito' : 'Descartado'}
                </span>
                {' · '}
                {l.paciente_nome} · fato {fmt(l.hora_fato)} · por {l.decidido_por_nome}: {l.motivo}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
