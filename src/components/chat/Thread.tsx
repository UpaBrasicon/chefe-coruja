'use client'

import { Loader2, Send } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useEnviarMensagem, useMarcarLida, useMensagens, type MensagemChat } from '@/hooks/useChat'
import { cn } from '@/lib/utils'

function fmtDia(iso: string) {
  const d = new Date(iso)
  const hoje = new Date()
  const ontem = new Date()
  ontem.setDate(hoje.getDate() - 1)
  const mesmaData = (a: Date, b: Date) => a.toDateString() === b.toDateString()
  if (mesmaData(d, hoje)) return 'Hoje'
  if (mesmaData(d, ontem)) return 'Ontem'
  return d.toLocaleDateString('pt-BR')
}

function fmtHora(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function Thread({
  conversaId,
  perfilId,
  onMensagemLida,
}: {
  conversaId: string
  perfilId?: string | null
  onMensagemLida: () => void
}) {
  const [texto, setTexto] = React.useState('')
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const fimRef = React.useRef<HTMLDivElement>(null)
  const [usuarioRolou, setUsuarioRolou] = React.useState(false)

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useMensagens(conversaId)
  const enviar = useEnviarMensagem(conversaId)
  const marcarLida = useMarcarLida()

  // mescla páginas (da mais antiga para a mais nova): invertemos a ordem das páginas
  const mensagens = React.useMemo(() => {
    const paginas = data?.pages ?? []
    const todas = [...paginas].reverse().flat() // mais antigas primeiro
    const ordenadas = todas.sort((a, b) => a.criado_em.localeCompare(b.criado_em))
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

  // marca como lida ao abrir a thread
  React.useEffect(() => {
    void marcarLida.mutateAsync(conversaId)
    onMensagemLida()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversaId])

  // autoscroll para o fim ao receber mensagem (se não rolou para cima)
  React.useEffect(() => {
    if (!usuarioRolou) {
      fimRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [mensagens.length, usuarioRolou])

  function onScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget
    const pertoDoTopo = el.scrollTop < 40
    const pertoDoFim = el.scrollHeight - el.scrollTop - el.clientHeight < 60
    setUsuarioRolou(!pertoDoFim)
    if (pertoDoTopo && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage()
    }
  }

  async function onSubmit() {
    const corpo = texto.trim()
    if (!corpo) return
    setTexto('')
    try {
      await enviar.mutateAsync(corpo)
    } catch {
      setTexto(corpo) // devolve o texto em erro
    }
  }

  // agrupa por dia
  const grupos = React.useMemo(() => {
    const g: { dia: string; itens: typeof mensagens }[] = []
    for (const m of mensagens) {
      const dia = fmtDia(m.criado_em)
      const ult = g[g.length - 1]
      if (ult && ult.dia === dia) ult.itens.push(m)
      else g.push({ dia, itens: [m] })
    }
    return g
  }, [mensagens])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Aviso fixo */}
      <div className="border-b bg-amber-50 px-3 py-1.5 text-center text-[11px] font-medium text-amber-800">
        ⚠ Evite dados identificáveis de paciente. Use leito/iniciais.
      </div>

      {/* Lista */}
      <div ref={scrollRef} onScroll={onScroll} className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-3">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="animate-spin" />
          </div>
        ) : isFetchingNextPage ? (
          <div className="flex justify-center py-1">
            <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
          </div>
        ) : null}

        {grupos.map((g) => (
          <React.Fragment key={g.dia}>
            <div className="my-1 text-center text-[10px] font-semibold uppercase text-muted-foreground">
              {g.dia}
            </div>
            {g.itens.map((m) => {
              const minha = m.autor_id === perfilId
              const corpo = m.excluida ? 'Mensagem excluída' : m.corpo
              return (
                <div key={m.id} className={cn('flex w-full', minha ? 'justify-end' : 'justify-start')}>
                  <div
                    className={cn(
                      'max-w-[80%] rounded-2xl px-3 py-2 text-sm',
                      minha ? 'bg-primary text-primary-foreground' : 'bg-muted'
                    )}
                  >
                    {!minha && m.autor?.nome_completo && (
                      <div className="mb-0.5 text-[10px] font-semibold text-muted-foreground">
                        {m.autor.nome_completo}
                      </div>
                    )}
                    <div className={cn('whitespace-pre-wrap break-words', m.excluida && 'italic opacity-60')}>
                      {corpo}
                    </div>
                    <div
                      className={cn(
                        'mt-0.5 text-[10px]',
                        minha ? 'text-primary-foreground/70' : 'text-muted-foreground'
                      )}
                    >
                      {fmtHora(m.criado_em)}
                      {m.editado_em ? ' · editada' : ''}
                    </div>
                  </div>
                </div>
              )
            })}
          </React.Fragment>
        ))}
        <div ref={fimRef} />
      </div>

      {/* Input */}
      <div className="border-t p-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void onSubmit()
              }
            }}
            placeholder="Escreva uma mensagem…"
            rows={2}
            className="min-h-[44px] flex-1 resize-none text-sm"
            maxLength={4000}
          />
          <Button onClick={() => void onSubmit()} disabled={!texto.trim() || enviar.isPending} className="h-[44px]">
            {enviar.isPending ? <Loader2 className="animate-spin" /> : <Send />}
          </Button>
        </div>
        <p className="mt-1 text-right text-[10px] text-muted-foreground">Enter envia · Shift+Enter quebra linha</p>
      </div>
    </div>
  )
}
