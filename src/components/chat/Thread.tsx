import { Loader2 } from 'lucide-react'
import * as React from 'react'

import { GavetaPe } from '@/components/ui/gaveta'
import { horaBr, quandoBr } from '@/components/chat/formato'
import { useCortePlantao, useEnviarMensagem, useMarcarLida, useMensagens, type MensagemChat } from '@/hooks/useChat'
import { cn } from '@/lib/utils'

// Conversa aberta na gaveta (P/index.html, chat.naConversa). Cada plantão
// começa limpo: o que veio antes do início do plantão atual fica recolhido
// atrás de uma cápsula e, aberto, entre as divisórias "Plantão anterior" e
// "Plantão de hoje". Ao pé, o campo de escrever e a regra de que assunto de
// paciente vai para a pendência do leito, não para cá.

function Balao({ m, minha }: { m: MensagemChat; minha: boolean }) {
  const quem = minha ? 'Você' : (m.autor?.nome_completo ?? 'Colega')
  return (
    <div
      className={cn(
        'flex max-w-[84%] flex-col gap-[3px] rounded-[14px] border px-[13px] py-2.5',
        minha ? 'self-end border-[#0D948833] bg-[#0D94881A]' : 'self-start border-fio bg-campo',
        m.id.startsWith('temp-') && 'opacity-70',
      )}
    >
      <div className="flex items-baseline gap-2">
        <span className="text-apoio font-semibold text-tinta">{quem}</span>
        <span className="text-rotulo text-tinta-sussurro">
          {quandoBr(m.criado_em)}
          {m.editado_em && !m.excluida ? ' · editada' : ''}
        </span>
      </div>
      <span
        className={cn(
          'text-controle leading-[1.5] break-words whitespace-pre-wrap text-pretty text-grafite',
          m.excluida && 'text-tinta-sussurro italic',
        )}
      >
        {m.excluida ? 'Mensagem excluída' : m.corpo}
      </span>
    </div>
  )
}

function Divisoria({ children }: { children: React.ReactNode }) {
  return (
    <span className="self-center text-center text-rotulo font-semibold tracking-[0.06em] text-tinta-sussurro uppercase">{children}</span>
  )
}

export function Thread({ conversaId, perfilId }: { conversaId: string; perfilId?: string | null }) {
  const [texto, setTexto] = React.useState('')
  const [verAntes, setVerAntes] = React.useState(false)
  const fimRef = React.useRef<HTMLDivElement>(null)
  const [usuarioRolou, setUsuarioRolou] = React.useState(false)

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useMensagens(conversaId)
  const enviar = useEnviarMensagem(conversaId)
  const { mutate: marcarLida } = useMarcarLida()
  const corte = useCortePlantao()

  // mescla páginas, da mais antiga para a mais nova
  const mensagens = React.useMemo(() => {
    const ordenadas = (data?.pages ?? []).flat().sort((a, b) => a.criado_em.localeCompare(b.criado_em))
    // deduplica por id (realtime + optimistic podem sobrepor) e remove temporárias
    // que já têm a mensagem real equivalente (mesmo corpo/remetente).
    const porId = new Map<string, MensagemChat>()
    const reaisPorChave = new Set<string>()
    for (const m of ordenadas) {
      if (!m.id.startsWith('temp-')) {
        porId.set(m.id, m)
        reaisPorChave.add(`${m.autor_id}:${m.corpo}`)
      }
    }
    for (const m of ordenadas) {
      if (m.id.startsWith('temp-') && reaisPorChave.has(`${m.autor_id}:${m.corpo}`)) continue
      if (!porId.has(m.id)) porId.set(m.id, m)
    }
    return [...porId.values()].sort((a, b) => a.criado_em.localeCompare(b.criado_em))
  }, [data])

  // divide no início do plantão atual
  const corteMs = corte.inicio.getTime()
  const { antes, deAgora } = React.useMemo(() => {
    const a: MensagemChat[] = []
    const d: MensagemChat[] = []
    for (const m of mensagens) (new Date(m.criado_em).getTime() < corteMs ? a : d).push(m)
    return { antes: a, deAgora: d }
  }, [mensagens, corteMs])
  // ainda pode haver plantão anterior nas páginas não carregadas
  const temAntes = antes.length > 0 || (!isLoading && !!hasNextPage)

  // marca como lida ao abrir e a cada mensagem nova de outra pessoa enquanto aberta
  const ultimaDeOutro = React.useMemo(() => {
    for (let i = mensagens.length - 1; i >= 0; i--) if (mensagens[i].autor_id !== perfilId) return mensagens[i].id
    return null
  }, [mensagens, perfilId])
  React.useEffect(() => {
    marcarLida(conversaId)
  }, [conversaId, ultimaDeOutro, marcarLida])

  // autoscroll para o fim ao receber mensagem (se não rolou para cima)
  React.useEffect(() => {
    if (!usuarioRolou) fimRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [deAgora.length, usuarioRolou])

  function onScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget
    const pertoDoFim = el.scrollHeight - el.scrollTop - el.clientHeight < 60
    setUsuarioRolou(!pertoDoFim)
    if (verAntes && el.scrollTop < 40 && hasNextPage && !isFetchingNextPage) void fetchNextPage()
  }

  function alternarAntes() {
    const abrir = !verAntes
    setVerAntes(abrir)
    if (abrir && antes.length === 0 && hasNextPage && !isFetchingNextPage) void fetchNextPage()
  }

  async function onSubmit() {
    const corpo = texto.trim()
    if (!corpo || enviar.isPending) return
    setTexto('')
    setUsuarioRolou(false)
    try {
      await enviar.mutateAsync(corpo)
    } catch {
      setTexto(corpo) // devolve o texto em erro
    }
  }

  const hora = horaBr(corte.inicio)
  const podeEnviar = texto.trim().length > 0 && !enviar.isPending

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div onScroll={onScroll} className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-[22px] py-[18px]">
        {isLoading ? (
          <div className="flex flex-1 items-center justify-center text-tinta-sussurro">
            <Loader2 className="size-5 animate-spin" aria-label="Carregando mensagens" />
          </div>
        ) : (
          <>
            {temAntes && (
              <button
                type="button"
                onClick={alternarAntes}
                aria-expanded={verAntes}
                className="cursor-pointer self-center rounded-capsula border border-fio bg-superficie px-[13px] py-[5px] text-apoio text-tinta-apoio hover:border-marca hover:text-acao focus-visible:border-marca focus-visible:outline-none"
              >
                {verAntes ? 'Ocultar plantão anterior' : 'Ver plantão anterior'}
              </button>
            )}

            {verAntes && (
              <div className="flex flex-col gap-2.5">
                {isFetchingNextPage && (
                  <Loader2 className="size-3.5 animate-spin self-center text-tinta-sussurro" aria-label="Carregando mensagens anteriores" />
                )}
                <Divisoria>
                  {corte.daEscala ? `Plantão anterior · encerrado às ${hora}` : 'Antes de hoje'}
                </Divisoria>
                {antes.length === 0 && !isFetchingNextPage && (
                  <span className="self-center text-apoio text-tinta-sussurro">Nada no plantão anterior.</span>
                )}
                {antes.map((m) => (
                  <Balao key={m.id} m={m} minha={m.autor_id === perfilId} />
                ))}
                <Divisoria>{corte.daEscala ? `Plantão de hoje · desde ${hora}` : `Hoje · desde ${hora}`}</Divisoria>
              </div>
            )}

            {deAgora.length === 0 && !verAntes && (
              <p className="self-center py-6 text-center text-apoio text-pretty text-tinta-sussurro">
                {temAntes ? 'Nenhuma mensagem neste plantão ainda.' : 'Nenhuma mensagem ainda.'}
              </p>
            )}

            {deAgora.map((m) => (
              <Balao key={m.id} m={m} minha={m.autor_id === perfilId} />
            ))}
          </>
        )}
        <div ref={fimRef} />
      </div>

      <GavetaPe className="flex flex-col gap-2 bg-superficie pt-3.5 pb-[18px]">
        <form
          className="flex items-end gap-[9px]"
          onSubmit={(e) => {
            e.preventDefault()
            void onSubmit()
          }}
        >
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              // Enter envia; Shift+Enter quebra a linha
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                void onSubmit()
              }
            }}
            rows={1}
            maxLength={4000}
            placeholder="Escrever mensagem"
            aria-label="Escrever mensagem"
            className="field-sizing-content max-h-32 min-w-0 flex-1 resize-none rounded-controle border border-fio bg-campo px-3 py-2.5 text-corpo leading-[1.35] text-tinta outline-none placeholder:text-tinta-sussurro focus:border-marca"
          />
          <button
            type="submit"
            disabled={!podeEnviar}
            className="flex shrink-0 items-center gap-1.5 rounded-controle border-0 bg-acao px-3.5 py-[9px] text-apoio font-semibold text-white hover:bg-acao-pressionada disabled:cursor-not-allowed disabled:bg-[#94A3B8] disabled:hover:bg-[#94A3B8]"
          >
            {enviar.isPending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
            Enviar
          </button>
        </form>
        <span className="leading-[1.45] text-pretty">
          Assunto de paciente não vai aqui: registre como pendência no leito, onde fica com prazo e com quem assume.
        </span>
      </GavetaPe>
    </div>
  )
}
