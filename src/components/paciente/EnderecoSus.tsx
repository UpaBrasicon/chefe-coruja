// Endereço e dados do SUS do paciente (Fase 3, tarefa 3): campos do BPA-I
// que não travam a porta. O que faltar vira aviso na conferência do
// faturamento. Grava por salvar_endereco_sus (quem atua no paciente e o
// faturamento); só as chaves alteradas vão ao servidor.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import type { EnderecoSus as Endereco } from '@/lib/bpa'
import { supabase } from '@/lib/supabase'

type Campo = 'cep' | 'municipio_ibge' | 'tipo_logradouro' | 'endereco' | 'numero_endereco' | 'complemento' | 'bairro' | 'nacionalidade' | 'etnia'
const CAMPOS: readonly { k: Campo; rotulo: string; max: number; dica?: string; numerico?: boolean }[] = [
  { k: 'cep', rotulo: 'CEP', max: 9, numerico: true },
  { k: 'municipio_ibge', rotulo: 'Município (código IBGE)', max: 7, numerico: true, dica: '6 ou 7 dígitos' },
  { k: 'tipo_logradouro', rotulo: 'Tipo de logradouro (código)', max: 3, numerico: true, dica: 'tabela do SIA' },
  { k: 'endereco', rotulo: 'Logradouro', max: 120 },
  { k: 'numero_endereco', rotulo: 'Número', max: 5, dica: 'SN se não houver' },
  { k: 'complemento', rotulo: 'Complemento', max: 10 },
  { k: 'bairro', rotulo: 'Bairro', max: 30 },
  { k: 'nacionalidade', rotulo: 'Nacionalidade (código)', max: 3, numerico: true, dica: 'tabela do SIA' },
]

export function EnderecoSus({ pacienteId, titulo = true }: { pacienteId: string; titulo?: boolean }) {
  const qc = useQueryClient()
  const atual = useQuery({
    queryKey: ['endereco-sus', pacienteId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('endereco_sus', { p_paciente: pacienteId })
      if (error) throw error
      return data as unknown as Endereco
    },
  })
  const [mudou, setMudou] = React.useState<Partial<Record<Campo | 'situacao_rua' | 'sem_documento', string | boolean>>>({})
  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('salvar_endereco_sus', { p_paciente: pacienteId, p_dados: mudou })
      if (error) throw error
    },
    onSuccess: () => { setMudou({}); void qc.invalidateQueries({ queryKey: ['endereco-sus', pacienteId] }) },
  })
  if (atual.isLoading) return <Spinner />
  if (atual.error) return <p role="alert" className="text-xs text-critico">{(atual.error as Error).message}</p>
  const e = atual.data!
  const valor = (k: Campo) => (k in mudou ? String(mudou[k] ?? '') : (e[k] ?? ''))
  const marcado = (k: 'situacao_rua' | 'sem_documento') => (k in mudou ? Boolean(mudou[k]) : e[k])
  const indigena = e.raca_cor === 'indigena'

  return (
    <div className="flex flex-col gap-2">
      {titulo && (
        <div>
          <p className="text-apoio font-medium text-tinta">Endereço e dados do SUS</p>
          <p className="text-xs text-tinta-sussurro">Vão no BPA. Não são obrigatórios para abrir a ficha; o que faltar aparece para o faturamento.</p>
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {CAMPOS.map((c) => (
          <div key={c.k} className="flex flex-col gap-1">
            <Label htmlFor={`sus-${c.k}-${pacienteId}`} className="text-xs">{c.rotulo}</Label>
            <Input id={`sus-${c.k}-${pacienteId}`} className="h-8" maxLength={c.max} inputMode={c.numerico ? 'numeric' : undefined}
              placeholder={c.dica} value={valor(c.k)} onChange={(ev) => setMudou((m) => ({ ...m, [c.k]: ev.target.value }))} />
          </div>
        ))}
        {indigena && (
          <div className="flex flex-col gap-1">
            <Label htmlFor={`sus-etnia-${pacienteId}`} className="text-xs">Etnia (código, 4 dígitos)</Label>
            <Input id={`sus-etnia-${pacienteId}`} className="h-8" maxLength={4} inputMode="numeric" value={valor('etnia')}
              onChange={(ev) => setMudou((m) => ({ ...m, etnia: ev.target.value }))} />
          </div>
        )}
      </div>
      {e.municipio && <span className="text-xs text-tinta-sussurro">Município no cadastro: {e.municipio}{e.uf ? `/${e.uf}` : ''}</span>}
      <div className="flex flex-wrap items-center gap-4 text-apoio">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={marcado('situacao_rua')} onChange={(ev) => setMudou((m) => ({ ...m, situacao_rua: ev.target.checked }))} />
          Pessoa em situação de rua
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={marcado('sem_documento')} onChange={(ev) => setMudou((m) => ({ ...m, sem_documento: ev.target.checked }))} />
          Sem CPF nem registro civil
        </label>
        <Button size="xs" className="ml-auto" disabled={Object.keys(mudou).length === 0 || salvar.isPending} onClick={() => salvar.mutate()}>
          Salvar endereço do SUS
        </Button>
      </div>
      {salvar.error && <p role="alert" className="text-xs text-critico">{(salvar.error as Error).message}</p>}
    </div>
  )
}
