import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useUnidade } from '@/contexts/UnidadeContext'
import { useDefinirCamadaUnidade, useFerramentasDaUnidade } from '@/hooks/useFerramentaClinica'

/**
 * Camada da unidade (Fase 5): o gestor acrescenta uma nota local ou suspende
 * uma ferramenta na sua unidade. Sobrepõe sem apagar — a regra da camada base e
 * a aprovação do responsável técnico continuam como estão, e cada mudança fica
 * registrada com motivo.
 */
export default function FerramentasUnidade() {
  const { unidadeAtiva } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  const { data: lista, isLoading } = useFerramentasDaUnidade(unidadeId)
  const definir = useDefinirCamadaUnidade(unidadeId)
  const [editando, setEditando] = useState<string | null>(null)
  const [nota, setNota] = useState('')
  const [oculta, setOculta] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  function abrir(id: string, notaAtual: string | null, ocultaAtual: boolean) {
    setEditando(id)
    setNota(notaAtual ?? '')
    setOculta(ocultaAtual)
    setMotivo('')
    setErro(null)
  }

  async function salvar() {
    if (!editando) return
    try {
      await definir.mutateAsync({ ferramenta: editando, oculta, nota, motivo })
      setEditando(null)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar')
    }
  }

  if (isLoading) return null

  return (
    <div className="flex flex-col gap-3">
      <p className="max-w-2xl text-apoio text-tinta-sussurro">
        A regra de cada ferramenta vem da camada base, aprovada pelo responsável técnico. Aqui a unidade acrescenta uma nota
        local ou suspende o uso — sem apagar a regra.
      </p>
      {lista?.map((f) => (
        <div key={f.ferramenta_id} className="rounded-container border border-fio bg-superficie px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-tinta">{f.titulo}</span>
              {f.versao_aprovada ? (
                <Badge variant="secondary">aprovada · {f.versao_aprovada}</Badge>
              ) : (
                <Badge variant="outline">aguardando aprovação</Badge>
              )}
              {f.pendentes > 0 && f.versao_aprovada && <Badge variant="outline">versão nova aguardando</Badge>}
              {f.oculta && <Badge variant="destructive">suspensa na unidade</Badge>}
            </div>
            {editando !== f.ferramenta_id && (
              <Button size="sm" variant="outline" onClick={() => abrir(f.ferramenta_id, f.nota_local, f.oculta)}>
                Camada da unidade
              </Button>
            )}
          </div>
          {f.nota_local && editando !== f.ferramenta_id && (
            <p className="mt-1 text-apoio text-tinta">
              Nota da unidade: {f.nota_local}
              <span className="text-tinta-sussurro"> — {f.definida_por}</span>
            </p>
          )}
          {editando === f.ferramenta_id && (
            <div className="mt-3 flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`nota-${f.ferramenta_id}`}>Nota da unidade (aparece na ferramenta)</Label>
                <Textarea id={`nota-${f.ferramenta_id}`} value={nota} onChange={(e) => setNota(e.target.value)} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="size-4" checked={oculta} onChange={(e) => setOculta(e.target.checked)} />
                Suspender o uso desta ferramenta na unidade
              </label>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`motivo-${f.ferramenta_id}`}>Motivo (obrigatório)</Label>
                <Input id={`motivo-${f.ferramenta_id}`} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
              </div>
              {erro && <p className="rounded-lg border border-critico/30 bg-critico/[0.08] p-3 text-sm text-critico">{erro}</p>}
              <div className="flex gap-2">
                <Button size="sm" onClick={salvar} disabled={definir.isPending || motivo.trim().length < 10}>
                  Salvar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditando(null)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
