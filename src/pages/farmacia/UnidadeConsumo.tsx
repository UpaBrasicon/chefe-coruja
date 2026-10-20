// ─────────────────────────────────────────────────────────────────────────────
// Unidade de consumo dos medicamentos (Fase 5B, tarefa 3, etapa 3.1; decisões
// do RT de 17/10/2026). O cadastro é um só para todas as unidades: a unidade
// veio sugerida pela apresentação ("Ampola 10 mL" → ampola; frasco de pó →
// frasco-ampola) e a farmácia ou o gestor confere ou corrige, com histórico.
// A dispensação (3.2) e a conta (3.3) contam nesta unidade.
// Migration 20261129000001_unidade_consumo.sql.
// ─────────────────────────────────────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, PackageCheck } from 'lucide-react'
import * as React from 'react'

import { Chip, Chips, TituloPagina, Vazio } from '@/components/monitor/Pagina'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { fmtDataHora } from '@/lib/datas'
import { supabase } from '@/lib/supabase'
import { rotuloUnidade, UNIDADES_CONSUMO, type MedicamentoUnidade, type UnidadeConsumo } from '@/lib/unidadeConsumo'
import { MensagemErro } from '@/components/ui/mensagem-erro'

const selectCls = 'h-8 rounded-controle border border-fio bg-campo px-2 text-apoio'

export default function UnidadeConsumoPagina() {
  const [aConferir, setAConferir] = React.useState(true)
  const [termo, setTermo] = React.useState('')
  const [busca, setBusca] = React.useState('')
  React.useEffect(() => {
    const t = setTimeout(() => setBusca(termo.trim()), 300)
    return () => clearTimeout(t)
  }, [termo])

  const lista = useQuery({
    queryKey: ['unidade-consumo', busca, aConferir],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('medicamentos_unidade_consumo', { p_busca: busca || undefined, p_a_conferir: aConferir })
      if (error) throw error
      return data as unknown as { itens: MedicamentoUnidade[]; a_conferir: number; sem_unidade: number }
    },
  })

  return (
    <div className="flex w-full max-w-5xl flex-col gap-4">
      <TituloPagina
        icone={PackageCheck}
        titulo="Unidade de consumo"
        descricao="Em que unidade cada medicamento é dispensado e contado na conta. A sugestão veio da apresentação; confira ou corrija. O cadastro vale para todas as unidades."
      />
      <Chips rotulo="Quais medicamentos">
        <Chip ativo={aConferir} onClick={() => setAConferir(true)} contagem={lista.data?.a_conferir}>a conferir</Chip>
        <Chip ativo={!aConferir} onClick={() => setAConferir(false)}>todos</Chip>
      </Chips>
      <Input className="max-w-md" aria-label="Buscar medicamento" placeholder="Buscar pelo nome ou pela apresentação" value={termo} onChange={(e) => setTermo(e.target.value)} />
      {(lista.data?.sem_unidade ?? 0) > 0 && (
        <p className="text-apoio text-atencao">{lista.data!.sem_unidade} medicamento(s) sem unidade: a apresentação não diz a forma. Escolha na lista.</p>
      )}
      <MensagemErro texto={lista.error ? (lista.error as Error).message : null} />
      {lista.isLoading ? <Spinner /> : (lista.data?.itens ?? []).length === 0 ? (
        <Vazio icone={PackageCheck} titulo={aConferir ? 'Nada a conferir' : 'Nenhum medicamento'} texto={aConferir ? 'Todas as unidades de consumo já foram conferidas.' : undefined} />
      ) : (
        <div className="overflow-x-auto rounded-container border border-fio bg-superficie">
          <table className="w-full min-w-[640px] text-apoio">
            <thead className="border-b border-fio text-left text-rotulo text-tinta-sussurro">
              <tr><th className="px-3 py-2 font-medium">Medicamento</th><th className="px-3 py-2 font-medium">Unidade de consumo</th><th className="px-3 py-2 font-medium">Conferida</th></tr>
            </thead>
            <tbody>
              {lista.data!.itens.map((m) => <Linha key={m.id} m={m} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Linha({ m }: { m: MedicamentoUnidade }) {
  const qc = useQueryClient()
  const [unidade, setUnidade] = React.useState<UnidadeConsumo | ''>(m.unidade_consumo ?? '')
  const [outra, setOutra] = React.useState(m.unidade_consumo_outra ?? '')
  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('definir_unidade_consumo', {
        p_medicamento: m.id, p_unidade: unidade as UnidadeConsumo, p_outra: unidade === 'outra' ? outra.trim() : undefined,
      })
      if (error) throw error
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['unidade-consumo'] }),
  })
  const mudou = unidade !== (m.unidade_consumo ?? '') || (unidade === 'outra' && outra.trim() !== (m.unidade_consumo_outra ?? ''))
  const pronto = !!unidade && (unidade !== 'outra' || outra.trim().length >= 3)
  return (
    <tr className="border-b border-trilha align-top last:border-0">
      <td className="px-3 py-2">
        <span className="font-medium text-tinta">{m.principio_ativo}</span>
        <span className="block text-rotulo text-tinta-sussurro">{[m.apresentacao, m.concentracao].filter(Boolean).join(' · ')}</span>
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label={`Unidade de consumo de ${m.principio_ativo}`} className={selectCls} value={unidade}
            onChange={(e) => setUnidade(e.target.value as UnidadeConsumo | '')}>
            <option value="">Escolha…</option>
            {UNIDADES_CONSUMO.map(([k, r]) => <option key={k} value={k}>{r}</option>)}
          </select>
          {unidade === 'outra' && (
            <Input className="h-8 w-40" aria-label="Qual unidade" placeholder="Qual unidade" value={outra} onChange={(e) => setOutra(e.target.value)} />
          )}
          <Button size="sm" variant={mudou ? 'default' : 'outline'} disabled={!pronto || salvar.isPending || (!mudou && !!m.conferida_em)}
            onClick={() => salvar.mutate()}>
            <Check /> {mudou ? 'Salvar' : 'Confirmar'}
          </Button>
        </div>
        {salvar.error && <span role="alert" className="block text-rotulo text-critico">{(salvar.error as Error).message}</span>}
      </td>
      <td className="px-3 py-2 text-tinta-apoio">
        {m.conferida_em ? `${rotuloUnidade(m.unidade_consumo, m.unidade_consumo_outra)} · ${m.conferida_por ?? '—'}, ${fmtDataHora(m.conferida_em)}` : 'sugerida, a conferir'}
      </td>
    </tr>
  )
}
