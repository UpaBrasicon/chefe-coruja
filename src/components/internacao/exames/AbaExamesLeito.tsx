// Aba Exames do leito aberto, para o médico (modelo do RT de 25/11/2026,
// EXM1): três vistas, "Solicitar exames", "Anexar exames" e "Planilha /
// Evolução", e "Imprimir pedido" à direita (os exames aguardando resultado,
// numa folha só ou uma por setor). Enfermagem e gestor continuam com a lista
// de antes (ListaExamesLeito), escolhida em caderno/Documentos.
import { Printer } from 'lucide-react'
import * as React from 'react'

import { useExamesDaInternacao, usePodeLancarPlanilha, pendente } from '@/components/internacao/exames/dados'
import { AnexarExamesLeito } from '@/components/internacao/exames/AnexarExamesLeito'
import { ImprimirPedidoExames, type PedidoParaImprimir } from '@/components/internacao/exames/ImprimirPedidoExames'
import { PlanilhaExamesLeito } from '@/components/internacao/exames/PlanilhaExamesLeito'
import { PedidoExamesLeito } from '@/components/internacao/documentos/PedidoExamesLeito'
import { Abas } from '@/components/monitor/Pagina'
import { Button } from '@/components/ui/button'
import { MensagemErro } from '@/components/ui/mensagem-erro'
import { montarPlanilha } from '@/lib/examesAba'

type Vista = 'solicitar' | 'anexar' | 'planilha'

export function AbaExamesLeito({ internacaoId, pacienteId }: { internacaoId: string; pacienteId: string }) {
  const { pedidos, resultados, recarregar } = useExamesDaInternacao(internacaoId)
  // B-09 (RT, 25/11/2026): o médico sem o paciente no plantão vê a planilha, sem o botão de lançar
  const podeLancar = usePodeLancarPlanilha(internacaoId)
  const [vista, setVista] = React.useState<Vista>('solicitar')
  const [imprimir, setImprimir] = React.useState<PedidoParaImprimir | null>(null)
  const lista = pedidos.data ?? []
  const res = resultados.data ?? []
  const comResultado = new Set(res.map((r) => r.exame_id))
  const ativos = lista.filter((p) => p.situacao !== 'cancelado')
  const aguardando = lista.filter(pendente)
  const aguardandoLaudo = aguardando.filter((p) => !comResultado.has(p.id))
  const coletas = montarPlanilha(res).colunas.length

  const imprimirAguardando = () => setImprimir({
    exames: aguardando.map((p) => ({ exame: p.exame, grupo: p.grupo, obs: p.observacao, urgencia: p.urgencia, indicacao: p.indicacao, cid: p.cid })),
  })

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start gap-2">
        <Abas<Vista> rotulo="Exames" valor={vista} onChange={setVista} className="mb-0" abas={[
          ['solicitar', `Solicitar exames (${ativos.length})`],
          ['anexar', `Anexar exames (${aguardandoLaudo.length} aguardando)`],
          ['planilha', `Planilha / Evolução (${coletas} ${coletas === 1 ? 'coleta' : 'coletas'})`],
        ]} />
        <Button size="sm" variant="outline" className="ml-auto" disabled={aguardando.length === 0} onClick={imprimirAguardando}
          title={aguardando.length === 0 ? 'Nenhum exame aguardando resultado' : 'Imprime os exames aguardando resultado'}>
          <Printer aria-hidden /> Imprimir pedido ({aguardando.length})
        </Button>
      </div>
      <MensagemErro texto={(pedidos.error ?? resultados.error) ? ((pedidos.error ?? resultados.error) as Error).message : null} />

      {vista === 'solicitar' && (
        <PedidoExamesLeito internacaoId={internacaoId} pacienteId={pacienteId} pedidos={lista} recarregar={recarregar} aoImprimir={setImprimir} />
      )}
      {vista === 'anexar' && <AnexarExamesLeito pedidos={lista} resultados={res} medico recarregar={recarregar} />}
      {vista === 'planilha' && <PlanilhaExamesLeito pedidos={lista} resultados={res} podeLancar={podeLancar} recarregar={recarregar} />}

      {imprimir && <ImprimirPedidoExames pedido={imprimir} pacienteId={pacienteId} internacaoId={internacaoId} onFechar={() => setImprimir(null)} />}
    </div>
  )
}
