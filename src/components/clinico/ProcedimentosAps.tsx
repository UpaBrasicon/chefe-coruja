// Procedimentos da UBS (percurso da UBS, U7, PR 5): o profissional de plantão
// registra o procedimento da ficha aberta, com o resultado nos testes rápidos.
// Grava pela registrar_procedimento_aps; o pré-natal já lê os testes daqui, e o
// teste reagente vira sugestão na notificação compulsória (nunca notifica só).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import * as React from 'react'

import { Chip } from '@/components/monitor/Pagina'
import { Button } from '@/components/ui/button'
import { CampoSelecao } from '@/components/ui/campo-selecao'
import { Label } from '@/components/ui/label'
import { useUnidade } from '@/contexts/UnidadeContext'
import {
  nomeProcedimentoUbs, procedimentosDoPapel, RESULTADOS_TESTE, rotuloResultado, type ResultadoTeste,
} from '@/domain/procedimentosUbs'
import { hora } from '@/lib/formato'
import { supabase } from '@/lib/supabase'

type Feito = { id: string; procedimento: string; resultado: string | null; realizado_em: string }

export function ProcedimentosAps({ episodioId }: { episodioId: string }) {
  const qc = useQueryClient()
  const { papelAtivo } = useUnidade()
  const opcoes = procedimentosDoPapel(papelAtivo)
  const [codigo, setCodigo] = React.useState('')
  const [resultado, setResultado] = React.useState<ResultadoTeste | null>(null)
  const escolhido = opcoes.find((p) => p.codigo === codigo)

  const feitos = useQuery({
    queryKey: ['procedimentos-aps', episodioId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('procedimentos_aps_do_episodio', { p_episodio: episodioId })
      if (error) throw error
      return (data ?? []) as unknown as Feito[]
    },
  })

  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('registrar_procedimento_aps', {
        p_episodio: episodioId, p_procedimento: codigo, p_resultado: escolhido?.comResultado ? resultado ?? undefined : undefined,
      })
      if (error) throw error
    },
    onSuccess: () => {
      setCodigo('')
      setResultado(null)
      void qc.invalidateQueries({ queryKey: ['procedimentos-aps', episodioId] })
    },
  })

  const pronto = !!escolhido && (!escolhido.comResultado || !!resultado)

  return (
    <section aria-label="Procedimentos" className="flex flex-col gap-3 rounded-container border border-fio bg-superficie px-4 py-3">
      <span className="text-controle font-semibold text-tinta">Procedimentos</span>
      {opcoes.length === 0 ? (
        <p className="text-apoio text-tinta-sussurro">Seu papel não registra procedimentos na UBS.</p>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`proc-${episodioId}`}>Procedimento</Label>
            <CampoSelecao id={`proc-${episodioId}`} value={codigo} onChange={(e) => { setCodigo(e.target.value); setResultado(null) }}>
              <option value="">Escolha o procedimento</option>
              {opcoes.map((p) => <option key={p.codigo} value={p.codigo}>{p.nome}</option>)}
            </CampoSelecao>
          </div>
          {escolhido?.comResultado && (
            <div role="radiogroup" aria-label="Resultado do teste" className="flex flex-wrap items-center gap-2">
              <span className="text-apoio font-medium text-tinta">Resultado</span>
              {RESULTADOS_TESTE.map((r) => (
                <Chip key={r.valor} variante="opcao" radio ativo={resultado === r.valor} onClick={() => setResultado(r.valor)}>{r.rotulo}</Chip>
              ))}
            </div>
          )}
          {escolhido?.comResultado && resultado === 'reagente' && (
            <p role="note" className="text-apoio text-tinta-apoio">Teste reagente: o caso aparece como sugestão na notificação compulsória, para o enfermeiro conferir e notificar.</p>
          )}
          <div className="flex flex-wrap items-center justify-end gap-2">
            {salvar.error && <span role="alert" className="mr-auto text-apoio text-critico">{salvar.error.message}</span>}
            <Button size="sm" disabled={!pronto || salvar.isPending} onClick={() => salvar.mutate()}><Check /> Registrar procedimento</Button>
          </div>
        </>
      )}
      {(feitos.data ?? []).length > 0 && (
        <ul className="flex flex-col gap-1 border-t border-trilha pt-2">
          {(feitos.data ?? []).map((f) => (
            <li key={f.id} className="text-apoio text-tinta-apoio">
              {hora(f.realizado_em)} · {nomeProcedimentoUbs(f.procedimento)}{rotuloResultado(f.resultado) ? ` · ${rotuloResultado(f.resultado)}` : ''}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
