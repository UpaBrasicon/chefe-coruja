import { useParams } from 'react-router-dom'

import { LinhaEntrada, PaginaEntrada } from '@/components/entrada/LadoMarca'

// Link público da receita (/r/:tipo/:token). Ainda não abre a receita: falta
// a função que valida o token e leva à assinatura ICP-Brasil (emissão) ou à
// consulta (paciente e farmácia). Pendência técnica no fluxograma de
// pendências (Edge Function resolve-receita). A página diz isso em linguagem
// de quem recebeu o link, sem mostrar o token.
export function LinkReceita() {
  const { tipo } = useParams()
  const eEmissao = tipo === 'emissao'

  return (
    <PaginaEntrada
      titulo={eEmissao ? 'Assinatura de receita.' : 'Consulta de receita.'}
      abertura={
        eEmissao
          ? 'Este link vai levar à assinatura digital da receita. Essa etapa ainda não está disponível por aqui.'
          : 'Este link vai mostrar a receita para o paciente e para a farmácia. Essa consulta ainda não está disponível por aqui.'
      }
    >
      <ul className="cc-linhas">
        <LinhaEntrada titulo="O que vale agora">
          {eEmissao
            ? 'A receita segue pelo fluxo atual da unidade.'
            : 'Use a receita impressa entregue no atendimento.'}
        </LinhaEntrada>
        <LinhaEntrada titulo="Dúvidas">Procure a unidade que emitiu a receita.</LinhaEntrada>
      </ul>
    </PaginaEntrada>
  )
}
