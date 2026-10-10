// Críticas da AIH da unidade (Fase 3, tarefa 2; decisões do RT de 09/10/2026).
// O gestor marca cada crítica como bloqueante (impede emitir o laudo) ou só
// aviso (vai para o regulador), com motivo; sem ajuste, vale o padrão do
// produto. Migration 20261102000003_aih_criticas.sql.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileWarning } from 'lucide-react'
import * as React from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import type { ConfigCritica } from '@/lib/aih'
import { fmtDataHora } from '@/lib/datas'
import { supabase } from '@/lib/supabase'

export function CriticasAih({ unidadeId, podeEditar }: { unidadeId: string; podeEditar: boolean }) {
  const lista = useQuery({
    queryKey: ['criticas-aih', unidadeId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('criticas_aih_da_unidade', { p_unidade: unidadeId })
      if (error) throw error
      return (data ?? []) as unknown as ConfigCritica[]
    },
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><FileWarning className="size-4 text-tinta-sussurro" /> Críticas da AIH</CardTitle>
        <CardDescription>
          Bloqueante impede o médico de emitir o laudo de AIH até corrigir; aviso pede o “ciente” e segue para o médico regulador.
          Sem ajuste da unidade, vale o padrão do produto.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        {lista.isLoading ? <Spinner /> : lista.error ? (
          <p role="alert" className="text-critico">{(lista.error as Error).message}</p>
        ) : (lista.data ?? []).map((c) => <LinhaCritica key={c.codigo} c={c} unidadeId={unidadeId} podeEditar={podeEditar} />)}
      </CardContent>
    </Card>
  )
}

function LinhaCritica({ c, unidadeId, podeEditar }: { c: ConfigCritica; unidadeId: string; podeEditar: boolean }) {
  const qc = useQueryClient()
  const [abrindo, setAbrindo] = React.useState(false)
  const [motivo, setMotivo] = React.useState('')
  const trocar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('definir_critica_aih', {
        p_unidade: unidadeId, p_critica: c.codigo, p_bloqueante: !c.bloqueante, p_motivo: motivo.trim(),
      })
      if (error) throw error
    },
    onSuccess: () => { setAbrindo(false); setMotivo(''); void qc.invalidateQueries({ queryKey: ['criticas-aih', unidadeId] }) },
  })
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-fio px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-tinta">{c.titulo}</span>
        <Badge variant={c.bloqueante ? 'destructive' : 'warning'} className="ml-auto">{c.bloqueante ? 'bloqueante' : 'aviso'}</Badge>
        {podeEditar && !abrindo && (
          <Button size="xs" variant="outline" onClick={() => setAbrindo(true)}>{c.bloqueante ? 'Passar a aviso' : 'Passar a bloqueante'}</Button>
        )}
      </div>
      <span className="text-xs text-tinta-sussurro">
        Padrão do produto: {c.padrao ? 'bloqueante' : 'aviso'}
        {c.ajuste && <> · ajustado por {c.ajuste.por ?? '—'}, {fmtDataHora(c.ajuste.em)}: “{c.ajuste.motivo}”</>}
      </span>
      {abrindo && (
        <div className="flex flex-wrap gap-2">
          <Input className="h-8 flex-1" placeholder="Motivo (mínimo de 10 letras)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <Button size="xs" disabled={motivo.trim().length < 10 || trocar.isPending} onClick={() => trocar.mutate()}>Salvar</Button>
          <Button size="xs" variant="ghost" onClick={() => { setAbrindo(false); trocar.reset() }}>Voltar</Button>
          {trocar.error && <span role="alert" className="basis-full text-xs text-critico">{(trocar.error as Error).message}</span>}
        </div>
      )}
    </div>
  )
}
