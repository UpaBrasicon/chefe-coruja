import { MessageSquare } from 'lucide-react'

// Botão flutuante de Mensagens (P/index.html .cc-chat-fab): sai da topbar e
// fica no canto inferior direito. Fica sob o véu quando a gaveta abre (z 38,
// abaixo da Gaveta) e, no celular, sobe acima da barra de navegação fixa.
// Alvo de 52px. O selo de não lidas é âmbar (o da observação), não vermelho:
// mensagem é sinal, não alarme.

export function ChatFab({ naoLidas, onAbrir }: { naoLidas: number; onAbrir: () => void }) {
  const selo = naoLidas > 99 ? '99+' : String(naoLidas)
  return (
    <button
      type="button"
      onClick={onAbrir}
      aria-label="Mensagens"
      aria-describedby={naoLidas > 0 ? 'cc-chat-fab-selo' : undefined}
      title="Mensagens"
      className="fixed right-6 bottom-6 z-[38] grid size-[52px] cursor-pointer place-items-center rounded-capsula border-0 bg-acao text-white shadow-fab transition-[background-color,transform] duration-150 ease-out outline-none hover:bg-[#0B5F59] focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-acao active:scale-[0.96] motion-reduce:transition-none max-[767px]:right-4 max-[767px]:bottom-[calc(74px+env(safe-area-inset-bottom,0px))]"
    >
      <MessageSquare className="size-[22px]" aria-hidden />
      {naoLidas > 0 && (
        <span
          id="cc-chat-fab-selo"
          className="absolute -top-0.5 -right-0.5 grid h-5 min-w-5 place-items-center rounded-capsula border-2 border-white bg-[#B45309] px-[5px] text-rotulo leading-none font-semibold text-white"
        >
          {selo}
          <span className="sr-only"> não lida{naoLidas === 1 ? '' : 's'}</span>
        </span>
      )}
    </button>
  )
}
