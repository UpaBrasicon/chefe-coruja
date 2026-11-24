import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ArrowDown, Check, Copy } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { useLugarDoResumo, useSecaoDaFerramenta } from './contexto'

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
  aoIrDetalhes,
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
  /** antes de rolar (ex.: abrir a aba "Próximos passos") */
  aoIrDetalhes?: () => void
}) {
  // F5 (RT, 24/11/2026): na tela larga, coluna fixa à direita (o ToolLayout dá o
  // lugar); no celular, barra presa ao pé com o espaço dela reservado no fim da
  // página; entre os dois, a barra que acompanha a rolagem, como antes.
  const lugar = useLugarDoResumo()
  const naJanela = useSecaoDaFerramenta() !== null
  const larga = useLarguraDesde(1280)
  const celular = !useLarguraDesde(768)
  const avisar = lugar?.avisar
  const reservar = lugar?.reservar
  useEffect(() => {
    if (!avisar) return
    avisar(true)
    return () => avisar(false)
  }, [avisar])

  // Na janela por cima do atendimento a barra segue presa à rolagem da janela.
  const fixaNoPe = celular && !naJanela && !!reservar
  const barra = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = barra.current
    if (!fixaNoPe || !el || !reservar) return
    const medir = () => reservar(el.offsetHeight + 16)
    medir()
    const obs = new ResizeObserver(medir)
    obs.observe(el)
    return () => { obs.disconnect(); reservar(0) }
  }, [fixaNoPe, reservar])

  if (larga && lugar?.lado) {
    return createPortal(
      <ConteudoResumo
        vertical
        principal={principal} detalhe={detalhe} tom={tom} textoCopia={textoCopia}
        alvoDetalhes={alvoDetalhes} rotuloDetalhes={rotuloDetalhes} aoIrDetalhes={aoIrDetalhes}
      />,
      lugar.lado,
    )
  }
  return (
    <div ref={barra} className={cn(
      fixaNoPe
        ? 'fixed inset-x-3 z-30 bottom-[calc(66px+env(safe-area-inset-bottom))]'
        // No celular a barra de navegação (fixa, ~62 px) cobre o pé da tela.
        : 'sticky z-30 -mx-1 mt-2 bottom-[calc(66px+env(safe-area-inset-bottom))] md:bottom-3',
    )}>
      <ConteudoResumo
        principal={principal} detalhe={detalhe} tom={tom} textoCopia={textoCopia}
        alvoDetalhes={alvoDetalhes} rotuloDetalhes={rotuloDetalhes} aoIrDetalhes={aoIrDetalhes}
      />
    </div>
  )
}

function useLarguraDesde(px: number) {
  const consulta = `(min-width: ${px}px)`
  const [casa, setCasa] = useState(() => typeof window !== 'undefined' && window.matchMedia(consulta).matches)
  useEffect(() => {
    const mq = window.matchMedia(consulta)
    const on = () => setCasa(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [consulta])
  return casa
}

function ConteudoResumo({
  principal,
  detalhe,
  tom = 'neutro',
  textoCopia,
  alvoDetalhes,
  rotuloDetalhes = 'Ver detalhes',
  aoIrDetalhes,
  vertical,
}: {
  principal: ReactNode
  detalhe?: ReactNode
  tom?: 'neutro' | 'atencao' | 'critico'
  textoCopia?: string
  alvoDetalhes?: string
  rotuloDetalhes?: string
  aoIrDetalhes?: () => void
  vertical?: boolean
}) {
  return (
    <div
      role="region"
      aria-label="Resumo do cálculo"
      className={cn(
        // Cheio na cor da marca, como o cartão de resultado do modelo do RT (MDCalc):
        // pedido do RT na homologação em 16/11/2026 ("não tem contraste nenhum").
        'flex flex-wrap items-center gap-x-4 gap-y-2 rounded-cartao bg-acao px-4 py-3 text-sobre-acao',
        vertical ? 'flex-col items-stretch' : 'shadow-[0_8px_24px_-8px_rgb(0_0_0/0.45)]',
      )}
    >
      <div aria-live="polite" className={cn('flex min-w-0 flex-col gap-0.5', !vertical && 'flex-[1_1_220px]')}>
        {/* A faixa do escore (atenção, crítico) vai numa pílula clara, para a cor ler sobre o fundo escuro. */}
        <span
          className={cn(
            'w-fit text-secao font-semibold tabular-nums',
            tom !== 'neutro' && 'rounded-controle bg-superficie px-2 py-0.5',
            tom === 'critico' ? 'text-critico' : tom === 'atencao' ? 'text-atencao' : 'text-sobre-acao',
          )}
        >
          {principal}
        </span>
        {detalhe && <span className="text-apoio text-sobre-acao/85">{detalhe}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {alvoDetalhes && (
          <Button
            variant="outline"
            size="sm"
            className="border-sobre-acao/50 bg-transparent text-sobre-acao hover:border-sobre-acao hover:bg-sobre-acao/10 hover:text-sobre-acao"
            onClick={() => {
              aoIrDetalhes?.()
              document.getElementById(alvoDetalhes)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }}
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
      <Button variant="outline" size="sm" className="border-superficie bg-superficie font-semibold text-acao hover:bg-superficie/90 hover:text-acao disabled:opacity-60" disabled={!texto} onClick={copiar} title={texto ? 'Copia o resultado com dados, fonte e versão, para colar na evolução' : 'Nada calculado ainda'}>
        {estado === 'copiado' ? <Check /> : <Copy />}
        {estado === 'copiado' ? 'Copiado' : 'Copiar resultado'}
      </Button>
      {estado === 'falhou' && (
        <span role="alert" className="rounded-controle bg-superficie px-2 py-0.5 text-apoio text-critico">Não foi possível copiar: o navegador bloqueou. Selecione o texto na tela.</span>
      )}
    </>
  )
}
