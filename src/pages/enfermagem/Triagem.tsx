import { useQuery } from '@tanstack/react-query'
import { Check, Printer } from 'lucide-react'
import * as React from 'react'
import { useSearchParams } from 'react-router-dom'

import { supabase } from '@/lib/supabase'
import { imprimirRelatorio } from '@/lib/prontuario'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useUnidade } from '@/contexts/UnidadeContext'
import { rotuloIdade } from '@/domain/idade'
import { ordemTriagem, rotulosPrioridade } from '@/domain/prioridade'
import { ordemMedica, rotuloCor, type CorRisco } from '@/domain/risco'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { TituloPagina } from '@/components/monitor/Pagina'
import { AlergiaNaTela } from './AlergiaNaTela'
import { Classificar } from './triagem/Classificar'
import { EsperaMedico } from './triagem/Espera'
import { BarraSalaTriagem, FilaTriagem } from './triagem/Fila'
import { useSalaTriagem } from './triagem/useSalaTriagem'
import { acimaDoAlvo, dataSP, esperaMin, nomeDe, type NaEspera, type NaFila } from './triagem/comum'

// Triagem (Fase 2.2 + porte do protótipo): a fila da porta e a classificação
// de risco em janela sobre ela. O protocolo da unidade é REFERÊNCIA — a cor é
// a que o enfermeiro marca; o sistema nunca pré-seleciona nem troca (ADR 0007).
// Depois de classificar, "Imprimir resumo" sai a folha de classificação de
// risco, montada no servidor (folha_relatorio 'classificacao').
// Abaixo da fila, os classificados que ainda esperam o médico: a enfermagem
// reclassifica se o quadro mudou na espera (correções do portão, tarefa 2).
// Revisão visual 3.4 (opção B do RT, 25/10/2026): as duas listas em abas, como a
// fila do PS; a aba fica na URL (?fila=), e a maior espera da triagem e quem
// passou do alvo da cor aparecem à direita das abas, em qualquer aba.

const ABAS = [
  { valor: 'triagem', rotulo: 'Aguardando triagem' },
  { valor: 'medico', rotulo: 'Classificados aguardando o médico' },
] as const
type Aba = (typeof ABAS)[number]['valor']

export default function Triagem() {
  const { unidadeAtiva } = useUnidade()
  const [atual, setAtual] = React.useState<NaFila | null>(null)
  // cor da última classificação quando a janela é de reclassificação
  const [corAtual, setCorAtual] = React.useState<CorRisco | null>(null)
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
        .select('id, paciente_id, setor_id, chegada_em, queixa, prioridades_legais, paciente:pacientes(nome, nome_social, data_nascimento, prontuario, nome_mae, responsavel_nome, sexo)')
        .in('setor_id', setores)
        .eq('etapa', 'triagem')
      if (error) throw error
      return ((data ?? []) as unknown as NaFila[]).sort(ordemTriagem)
    },
  })

  const espera = useQuery({
    queryKey: ['triagem-espera', unidadeAtiva?.unidade_id],
    enabled: !!unidadeAtiva,
    refetchInterval: 20_000,
    queryFn: async () => {
      const { data: ids, error: e1 } = await supabase.rpc('setores_na_escala_agora')
      if (e1) throw e1
      const setores = (Array.isArray(ids) ? ids : []) as string[]
      if (setores.length === 0) return []
      const { data, error } = await supabase
        .from('episodios')
        .select('id, paciente_id, setor_id, chegada_em, queixa, prioridades_legais, cor_atual, classificado_em, paciente:pacientes(nome, nome_social, data_nascimento, prontuario, nome_mae, responsavel_nome, sexo)')
        .in('setor_id', setores)
        .eq('etapa', 'atendimento')
        .is('atendimento_iniciado_em', null)
        .not('cor_atual', 'is', null)
      if (error) throw error
      return ((data ?? []) as unknown as NaEspera[]).sort(ordemMedica)
    },
  })

  const [busca, setBusca] = useSearchParams()
  const aba: Aba = busca.get('fila') === 'medico' ? 'medico' : 'triagem'
  const trocarAba = (v: Aba) => setBusca((b) => { const n = new URLSearchParams(b); if (v === 'triagem') n.delete('fila'); else n.set('fila', v); return n }, { replace: true })
  const sala = useSalaTriagem(fila.data ?? [])
  const contagem: Record<Aba, number> = { triagem: (fila.data ?? []).length, medico: (espera.data ?? []).length }
  const maiorEspera = Math.max(0, ...(fila.data ?? []).map((e) => esperaMin(e.chegada_em)))
  const acima = acimaDoAlvo(espera.data ?? [])

  const fechar = (msg: string | null) => {
    if (msg && atual) setAviso({ texto: msg, episodioId: atual.id })
    setAtual(null)
    setCorAtual(null)
  }
  const prios = atual ? rotulosPrioridade(atual.prioridades_legais) : []

  return (
    <>
      <TituloPagina titulo="Triagem" descricao="Fichas da recepção aguardando classificação. O protocolo é referência; a cor é sua." />
      {aviso && (
        <div role="status" className="mb-3 flex flex-wrap items-center gap-[9px] rounded-container border border-acao/20 bg-acao/5 px-[15px] py-[11px] text-controle text-acao">
          <Check className="size-[15px]" aria-hidden />
          <span className="flex-[1_1_220px]">{aviso.texto}</span>
          <Button variant="outline" size="sm" className="border-acao/35 bg-superficie text-acao"
            onClick={() => void imprimirRelatorio({ tipo: 'classificacao', episodioId: aviso.episodioId })}>
            <Printer /> Imprimir resumo
          </Button>
        </div>
      )}
      <div className="mb-3 empty:hidden"><BarraSalaTriagem sala={sala} /></div>
      <Tabs value={aba} onValueChange={(v) => trocarAba(v as Aba)} className="gap-3">
        <div className="flex flex-wrap items-end gap-x-4 gap-y-1 border-b border-fio">
          <TabsList aria-label="Triagem" className="w-auto max-w-full flex-[1_0_auto] gap-5 border-b-0">
            {ABAS.map((a) => (
              <TabsTrigger key={a.valor} value={a.valor}>
                {a.rotulo}
                <span className="text-rotulo font-semibold text-acao tabular-nums">{contagem[a.valor]}</span>
              </TabsTrigger>
            ))}
          </TabsList>
          {/* o que pede atenção aparece em qualquer aba */}
          <span className="pb-2.5 text-apoio text-tinta-sussurro">
            {contagem.triagem > 0 && <>maior espera na triagem {maiorEspera} min · </>}
            <span className={cn(acima > 0 && 'font-medium text-critico')}>{acima} acima do alvo da cor</span>
          </span>
        </div>
        <TabsContent value="triagem">
          <FilaTriagem
            fila={fila.data ?? []}
            carregando={fila.isLoading}
            erro={fila.error as Error | null}
            sala={sala}
            onTriar={(e) => { setAviso(null); setCorAtual(null); setAtual(e) }}
          />
        </TabsContent>
        <TabsContent value="medico">
          <EsperaMedico
            lista={espera.data ?? []}
            carregando={espera.isLoading}
            erro={espera.error as Error | null}
            onReclassificar={(e) => { setAviso(null); setCorAtual(e.cor_atual); setAtual(e) }}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={!!atual} onOpenChange={(aberto) => { if (!aberto) { setAtual(null); setCorAtual(null) } }} disablePointerDismissal>
        <DialogContent className="top-6 max-h-[calc(100dvh-3rem)] translate-y-0 gap-3.5 bg-campo p-5 sm:max-w-[980px]">
          {atual && (
            <>
              <div className="flex flex-col gap-1 pr-10">
                <span className="text-rotulo font-semibold text-tinta-sussurro">
                  {corAtual ? `Reclassificação · hoje ${rotuloCor(corAtual)}` : 'Triagem'}
                </span>
                <DialogTitle>
                  {nomeDe(atual)}{' '}
                  <span className="text-controle font-normal text-tinta-sussurro">
                    {atual.paciente?.data_nascimento ? rotuloIdade(atual.paciente.data_nascimento, dataSP()) : 'idade não informada'}
                  </span>
                </DialogTitle>
                {/* alergia à vista enquanto classifica (R4); a cor continua sendo do enfermeiro */}
                <AlergiaNaTela pacienteId={atual.paciente_id} className="py-1" />
                <DialogDescription>
                  {[`Queixa referida: ${atual.queixa}`, prios.length ? `Prioridade legal: ${prios.join(', ')}` : ''].filter(Boolean).join(' · ')}
                  <br />
                  {corAtual
                    ? 'O paciente continua na fila do atendimento médico, na posição da nova prioridade.'
                    : 'Ao registrar a classificação, o paciente vai para a fila do atendimento médico.'}
                </DialogDescription>
              </div>
              <Classificar key={`${atual.id}-${corAtual ?? 'nova'}`} ep={atual} corAtual={corAtual} onFim={fechar} />
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
