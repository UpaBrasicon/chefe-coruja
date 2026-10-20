import { useEffect, useMemo } from 'react'

import { classificarErro } from '@/lib/erros'
import { reportarErro } from '@/lib/reportarErro'
import { cn } from '@/lib/utils'

/**
 * Mensagem de erro (guia do padrão, 2.2). Dois formatos: `linha`, sob o campo
 * (ligada a ele por aria-describedby com o `id`), e `caixa`, para falha de ação
 * ou de carga. Sempre role="alert".
 *
 * - `texto`: frase pronta para a pessoa (validação da tela).
 * - `erro` + `acao`: o erro que voltou do banco ou da rede. A frase da regra do
 *   servidor aparece como veio; o resto vira "Não foi possível <acao>. Tente de
 *   novo." e o detalhe técnico vai para o registro de erros.
 */
export function MensagemErro({ texto, erro, acao = 'concluir agora', formato = 'caixa', id, className }: {
  texto?: string | null
  erro?: unknown
  acao?: string
  formato?: 'linha' | 'caixa'
  id?: string
  className?: string
}) {
  const classificado = useMemo(() => (erro ? classificarErro(erro, acao) : null), [erro, acao])

  useEffect(() => {
    if (classificado?.tecnico) reportarErro({ tipo: 'rpc', mensagem: classificado.tecnico })
  }, [classificado])

  const mostrar = texto || classificado?.texto
  if (!mostrar) return null
  return (
    <p
      id={id}
      role="alert"
      className={cn(
        formato === 'linha'
          ? 'mt-1 text-rotulo text-critico'
          : 'rounded-container border border-critico/30 bg-alerta-critico px-3.5 py-2.5 text-apoio text-critico',
        className,
      )}
    >
      {mostrar}
    </p>
  )
}
