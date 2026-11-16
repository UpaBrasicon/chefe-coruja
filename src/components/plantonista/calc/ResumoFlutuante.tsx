import { useState, type ReactNode } from 'react'
import { ArrowDown, Check, Copy } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Resumo do cálculo que acompanha a rolagem (diagnóstico das calculadoras,
// F2; C2 = A e C3 = A, RT em 16/11/2026). Fica preso ao pé da área da
// ferramenta: no celular, acima da barra de navegação inferior. Nas
// condutas com lista de doses, o resumo é o dado usado ("Adulto · 70 kg");
// o "Copiar" leva a lista inteira.

export function ResumoFlutuante({
  principal,
  detalhe,
  tom = 'neutro',
  textoCopia,
  alvoDetalhes,
  rotuloDetalhes = 'Ver detalhes',
}: {
  principal: ReactNode
  detalhe?: ReactNode
  /** cor do número principal; a faixa do escore, não conduta */
  tom?: 'neutro' | 'atencao' | 'critico'
  /** sem texto (nada calculado ainda), o botão fica desligado */
  textoCopia?: string
  /** id da seção para onde "Ver detalhes" rola */
  alvoDetalhes?: string
  rotuloDetalhes?: string
}) {
  return (
    <div
      role="region"
      aria-label="Resumo do cálculo"
      className={cn(
        'sticky z-30 -mx-1 mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-cartao border border-fio bg-superficie px-4 py-3 shadow-[0_-6px_18px_-12px_rgb(0_0_0/0.35)]',
        // No celular a barra de navegação (fixa, ~62 px) cobre o pé da tela.
        'bottom-[calc(66px+env(safe-area-inset-bottom))] md:bottom-3',
      )}
    >
      <div aria-live="polite" className="flex min-w-0 flex-[1_1_220px] flex-col gap-0.5">
        <span className={cn('text-corpo font-semibold tabular-nums', tom === 'critico' ? 'text-critico' : tom === 'atencao' ? 'text-atencao' : 'text-tinta')}>
          {principal}
        </span>
        {detalhe && <span className="text-apoio text-tinta-apoio">{detalhe}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {alvoDetalhes && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => document.getElementById(alvoDetalhes)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          >
            <ArrowDown />
            {rotuloDetalhes}
          </Button>
        )}
        <BotaoCopiar texto={textoCopia} />
      </div>
    </div>
  )
}

function BotaoCopiar({ texto }: { texto?: string }) {
  const [estado, setEstado] = useState<'pronto' | 'copiado' | 'falhou'>('pronto')

  async function copiar() {
    if (!texto) return
    try {
      await navigator.clipboard.writeText(texto)
      setEstado('copiado')
    } catch {
      setEstado('falhou')
    }
    setTimeout(() => setEstado('pronto'), 2500)
  }

  return (
    <>
      <Button variant="outline" size="sm" disabled={!texto} onClick={copiar} title={texto ? 'Copia o resultado com dados, fonte e versão, para colar na evolução' : 'Nada calculado ainda'}>
        {estado === 'copiado' ? <Check className="text-conforme" /> : <Copy />}
        {estado === 'copiado' ? 'Copiado' : 'Copiar resultado'}
      </Button>
      {estado === 'falhou' && (
        <span role="alert" className="text-apoio text-critico">Não foi possível copiar: o navegador bloqueou. Selecione o texto na tela.</span>
      )}
    </>
  )
}
