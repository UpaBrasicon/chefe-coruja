import { useQuery } from '@tanstack/react-query'
import { Check, Printer, Stethoscope } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { imprimirRelatorio } from '@/lib/prontuario'
import { Button } from '@/components/ui/button'
import { useUnidade } from '@/contexts/UnidadeContext'
import { rotuloIdade } from '@/domain/idade'
import { ordemTriagem, rotulosPrioridade } from '@/domain/prioridade'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { TituloPagina } from '@/components/monitor/Pagina'
import { Classificar } from './triagem/Classificar'
import { FilaTriagem } from './triagem/Fila'
import { dataSP, nomeDe, type NaFila } from './triagem/comum'

// Triagem (Fase 2.2 + porte do protótipo): a fila da porta e a classificação
// de risco em janela sobre ela. O protocolo da unidade é REFERÊNCIA — a cor é
// a que o enfermeiro marca; o sistema nunca pré-seleciona nem troca (ADR 0007).
// Depois de classificar, "Imprimir resumo" sai a folha de classificação de
// risco, montada no servidor (folha_relatorio 'classificacao').

export default function Triagem() {
  const { unidadeAtiva } = useUnidade()
  const [atual, setAtual] = React.useState<NaFila | null>(null)
  // o aviso da última classificação leva o episódio, para o "Imprimir resumo"
  const [aviso, setAviso] = React.useState<{ texto: string; episodioId: string } | null>(null)

  const fila = useQuery({
    queryKey: ['triagem-fila', unidadeAtiva?.unidade_id],
    enabled: !!unidadeAtiva,
    refetchInterval: 20_000,
    queryFn: async () => {
      const { data: ids, error: e1 } = await supabase.rpc('setores_na_escala_agora')
      if (e1) throw e1
      const setores = (Array.isArray(ids) ? ids : []) as string[]
      if (setores.length === 0) return []
      const { data, error } = await supabase
        .from('episodios')
        .select('id, setor_id, chegada_em, queixa, prioridades_legais, paciente:pacientes(nome, nome_social, data_nascimento, sexo)')
        .in('setor_id', setores)
        .eq('etapa', 'triagem')
      if (error) throw error
      return ((data ?? []) as unknown as NaFila[]).sort(ordemTriagem)
    },
  })

  const fechar = (msg: string | null) => {
    if (msg && atual) setAviso({ texto: msg, episodioId: atual.id })
    setAtual(null)
  }
  const prios = atual ? rotulosPrioridade(atual.prioridades_legais) : []

  return (
    <>
      <TituloPagina icone={Stethoscope} titulo="Triagem" descricao="Fichas da recepção aguardando classificação. O protocolo é referência; a cor é sua." />
      {aviso && (
        <div role="status" className="mb-3 flex flex-wrap items-center gap-[9px] rounded-container border border-marca/20 bg-marca/5 px-[15px] py-[11px] text-controle text-acao">
          <Check className="size-[15px]" aria-hidden />
          <span className="flex-[1_1_220px]">{aviso.texto}</span>
          <Button variant="outline" size="sm" className="border-marca/35 bg-superficie text-acao"
            onClick={() => void imprimirRelatorio({ tipo: 'classificacao', episodioId: aviso.episodioId })}>
            <Printer /> Imprimir resumo
          </Button>
        </div>
      )}
      <FilaTriagem
        fila={fila.data ?? []}
        carregando={fila.isLoading}
        erro={fila.error as Error | null}
        onTriar={(e) => { setAviso(null); setAtual(e) }}
      />

      <Dialog open={!!atual} onOpenChange={(aberto) => { if (!aberto) setAtual(null) }} disablePointerDismissal>
        <DialogContent className="top-6 max-h-[calc(100dvh-3rem)] translate-y-0 gap-3.5 bg-campo p-5 sm:max-w-[980px]">
          {atual && (
            <>
              <div className="flex flex-col gap-1 pr-10">
                <span className="text-rotulo font-semibold tracking-[0.06em] text-tinta-sussurro uppercase">Triagem</span>
                <DialogTitle>
                  {nomeDe(atual)}{' '}
                  <span className="text-controle font-normal text-tinta-sussurro">
                    {atual.paciente?.data_nascimento ? rotuloIdade(atual.paciente.data_nascimento, dataSP()) : 'idade não informada'}
                  </span>
                </DialogTitle>
                <DialogDescription>
                  {[`Queixa referida: ${atual.queixa}`, prios.length ? `Prioridade legal: ${prios.join(', ')}` : ''].filter(Boolean).join(' · ')}
                  <br />
                  Ao registrar a classificação, o paciente vai para a fila do atendimento médico.
                </DialogDescription>
              </div>
              <Classificar key={atual.id} ep={atual} onFim={fechar} />
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
