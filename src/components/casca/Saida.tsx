import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { ClipboardList, Clock, FileText, LogOut } from 'lucide-react'

import { Spinner } from '@/components/ui/spinner'

import type { PendenciaSaida } from './usePendenciasSaida'

// SAÍDA (P/index.html 209–216, 1306–1334). A entrada tem cerimônia e a saída
// era um botão morto. Sair no meio do plantão não é sair de um site: o turno
// continua aberto, o check-out não foi feito e a passagem não foi escrita.
// Então a saída pergunta uma vez, mostra o que fica para trás e só depois
// deixa ir. O verde volta a cobrir a tela no sentido inverso ao da entrada.

const ICONE: Record<PendenciaSaida['chave'], typeof Clock> = { checkout: Clock, rascunhos: FileText, passagens: ClipboardList }

export function DialogoSaida({
  aberto,
  onAbertoChange,
  emPlantao,
  fimTurno,
  pendencias,
  carregando,
  onConfirmar,
}: {
  aberto: boolean
  onAbertoChange: (v: boolean) => void
  emPlantao: boolean
  /** "19:00" — até quando vai o turno, se houver. */
  fimTurno?: string
  pendencias: PendenciaSaida[]
  carregando: boolean
  onConfirmar: () => void
}) {
  const titulo = emPlantao ? 'Sair com o plantão aberto?' : 'Sair do sistema?'
  const texto = emPlantao
    ? `${fimTurno ? `Seu turno vai até ${fimTurno}. ` : ''}Sair do sistema não encerra o plantão nem faz o check-out — a escala continua no seu nome.`
    : 'Você volta para a tela de entrada. Nada do que você já registrou se perde.'

  return (
    <DialogPrimitive.Root open={aberto} onOpenChange={onAbertoChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-40 bg-[rgba(15,23,42,0.42)] data-open:animate-cc-scrim" />
        <DialogPrimitive.Popup className="fixed top-1/2 left-1/2 z-40 flex max-h-[calc(100dvh-48px)] w-[calc(100%-48px)] max-w-[420px] -translate-x-1/2 -translate-y-1/2 flex-col gap-3.5 overflow-y-auto rounded-cartao bg-superficie px-[22px] pt-[22px] pb-[18px] shadow-dialogo outline-none data-open:animate-cc-dlg">
          <div className="flex flex-col gap-1.5">
            <DialogPrimitive.Title className="text-secao font-semibold tracking-[-0.01em] text-tinta">{titulo}</DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-apoio leading-[1.5] text-pretty text-tinta-apoio">{texto}</DialogPrimitive.Description>
          </div>
          {emPlantao && carregando && <Spinner rotulo="Conferindo pendências" />}
          {emPlantao && pendencias.length > 0 && (
            <ul className="m-0 flex list-none flex-col gap-2 rounded-container bg-campo px-3.5 py-3">
              {pendencias.map((p) => {
                const Icone = ICONE[p.chave]
                return (
                  <li key={p.chave} className="flex items-start gap-2 text-apoio text-tinta">
                    <Icone className="mt-0.5 size-3.5 shrink-0 text-observacao" aria-hidden />
                    <span>{p.texto}</span>
                  </li>
                )
              })}
            </ul>
          )}
          <div className="mt-0.5 flex flex-wrap justify-end gap-2">
            <DialogPrimitive.Close className="rounded-controle border border-fio bg-superficie px-3.5 py-[9px] text-apoio font-medium text-tinta-apoio hover:border-[#94A3B8] hover:text-tinta">
              {emPlantao ? 'Continuar no plantão' : 'Cancelar'}
            </DialogPrimitive.Close>
            <button
              type="button"
              onClick={onConfirmar}
              className="flex items-center gap-[7px] rounded-controle bg-acao px-4 py-[9px] text-apoio font-semibold text-white hover:bg-[#0B5D57]"
            >
              <LogOut className="size-3.5" aria-hidden />
              {emPlantao ? 'Sair mesmo assim' : 'Sair'}
            </button>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

/** O véu verde que cobre a tela da direita para a esquerda ao sair. */
export function VeuSaida() {
  return <div aria-hidden className="pointer-events-none fixed inset-0 z-[60] bg-veu motion-safe:animate-cc-veu-saida" />
}

/** Sessão encerrada por ociosidade depois do plantão (P/index.html 883–893). */
export function SessaoEncerrada({ texto, onReentrar }: { texto: string; onReentrar: () => void }) {
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="cc-sessao-titulo" className="fixed inset-0 z-[1000] grid place-items-center bg-[#0B1220EB] p-6">
      <div className="flex w-full max-w-[420px] flex-col gap-3.5 rounded-[18px] bg-superficie px-7 pt-7 pb-6 shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
        <div className="grid size-11 place-items-center rounded-container bg-marca/10 text-acao">
          <Clock className="size-[22px]" aria-hidden />
        </div>
        <h2 id="cc-sessao-titulo" className="m-0 text-dialogo font-semibold tracking-[-0.02em] text-tinta">
          Sessão encerrada
        </h2>
        <p className="m-0 text-controle leading-[1.55] text-pretty text-tinta-apoio">{texto}</p>
        <p className="m-0 text-apoio leading-[1.5] text-pretty text-tinta-sussurro">
          Fora do plantão a Central não fica aberta. Houve 20 minutos de tolerância depois do fim do turno; para continuar além disso, só o gestor libera.
        </p>
        <button
          type="button"
          autoFocus
          onClick={onReentrar}
          className="mt-1 inline-flex items-center justify-center gap-[7px] rounded-controle bg-acao px-4 py-[11px] text-controle font-medium text-white hover:bg-acao-pressionada"
        >
          Entrar novamente
        </button>
      </div>
    </div>
  )
}
