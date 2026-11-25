// A planilha de exames de uma internação, fora do leito aberto: a mesma
// PlanilhaExamesLeito, com as leituras e a permissão de lançar já ligadas.
// Nasceu para o dossiê do NIR (decisão do RT de 25/11/2026, B-09: na planilha
// só o médico e o NIR lançam valores; o NIR não abre o leito).
import { useExamesDaInternacao, usePodeLancarPlanilha } from '@/components/internacao/exames/dados'
import { PlanilhaExamesLeito } from '@/components/internacao/exames/PlanilhaExamesLeito'
import { MensagemErro } from '@/components/ui/mensagem-erro'
import { Spinner } from '@/components/ui/spinner'

export function PlanilhaDaInternacao({ internacaoId }: { internacaoId: string }) {
  const { pedidos, resultados, recarregar } = useExamesDaInternacao(internacaoId)
  const podeLancar = usePodeLancarPlanilha(internacaoId)
  const erro = (pedidos.error ?? resultados.error) as Error | null
  if (pedidos.isLoading || resultados.isLoading) return <Spinner />
  return (
    <div className="flex flex-col gap-2">
      <MensagemErro texto={erro ? erro.message : null} />
      <PlanilhaExamesLeito pedidos={pedidos.data ?? []} resultados={resultados.data ?? []} podeLancar={podeLancar} recarregar={recarregar} />
    </div>
  )
}
