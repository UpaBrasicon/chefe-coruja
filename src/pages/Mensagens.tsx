import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronRight, MessageCircle, Send } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'

import { supabase } from '@/lib/supabase'
import { useUnidade } from '@/contexts/UnidadeContext'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Spinner } from '@/components/ui/spinner'

type Mensagem = {
  id: string
  conteudo: string
  remetente_id: string
  destinatario_id: string | null
  lida_em: string | null
  created_at: string
  remetente: { nome_completo: string; foto_url: string | null } | null
}

export default function Mensagens() {
  const { unidadeAtiva } = useUnidade()
  const { perfil } = useAuth()
  const unidadeId = unidadeAtiva?.unidade_id
  const queryClient = useQueryClient()

  const [texto, setTexto] = React.useState('')

  const { data: canalUnidade } = useQuery({
    queryKey: ['unidade-canal', unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('unidades')
        .select('canal_comunicacao, whatsapp_numero')
        .eq('id', unidadeId!)
        .single()
      if (error) throw error
      return data as { canal_comunicacao: string; whatsapp_numero: string | null }
    },
  })

  const usaWhatsApp = canalUnidade?.canal_comunicacao === 'whatsapp'

  const { data: mensagens, isLoading } = useQuery({
    queryKey: ['mensagens-chat', unidadeId],
    enabled: !!unidadeId && !usaWhatsApp,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mensagens_chat')
        .select('id, conteudo, remetente_id, destinatario_id, lida_em, created_at, remetente:perfis(nome_completo, foto_url)')
        .eq('unidade_id', unidadeId!)
        .order('created_at', { ascending: true })
        .limit(100)
      if (error) throw error
      return (data ?? []) as unknown as Mensagem[]
    },
    refetchInterval: 15_000,
  })

  async function enviar() {
    if (!unidadeId || !perfil || !texto.trim()) return
    const { error } = await supabase.from('mensagens_chat').insert({
      unidade_id: unidadeId,
      remetente_id: perfil.id,
      conteudo: texto.trim(),
      criado_por: perfil.id,
    })
    if (error) {
      alert(error.message)
      return
    }
    setTexto('')
    void queryClient.invalidateQueries({ queryKey: ['mensagens-chat', unidadeId] })
  }

  const linkWhats = React.useMemo(() => {
    if (!canalUnidade?.whatsapp_numero) return null
    const textoPrefeito = `Olá! Sou ${perfil?.nome_completo ?? ''} da equipe. Gostaria de falar sobre plantões.`
    return `https://wa.me/${canalUnidade.whatsapp_numero.replace(/\D/g, '')}?text=${encodeURIComponent(textoPrefeito)}`
  }, [canalUnidade, perfil])

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Link to="/" className="transition-colors hover:text-foreground">
            Início
          </Link>
          <ChevronRight className="size-3.5" />
          <span className="font-medium text-foreground">Mensagens</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Mensagens</h1>
        <p className="text-sm text-muted-foreground">
          {usaWhatsApp
            ? 'Esta unidade usa WhatsApp como canal de comunicação. Fale com a gestão pelo botão abaixo.'
            : 'Comunicação com a gestão da unidade. Mensagens são exibidas a todos da equipe.'}
        </p>
      </div>

      {usaWhatsApp ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageCircle className="size-4 text-muted-foreground" />
              WhatsApp da unidade
            </CardTitle>
            <CardDescription>
              A gestão configurou o WhatsApp como canal preferencial de contato.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {linkWhats ? (
              <a href={linkWhats} target="_blank" rel="noreferrer">
                <Button>
                  <MessageCircle /> Falar no WhatsApp
                </Button>
              </a>
            ) : (
              <p className="text-sm text-muted-foreground">Número de WhatsApp não configurado.</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageCircle className="size-4 text-muted-foreground" />
              {unidadeAtiva?.unidade.nome ?? 'Unidade'}
            </CardTitle>
            <CardDescription>Envie mensagens para a equipe da unidade.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex h-[320px] flex-col gap-2 overflow-y-auto rounded-lg border p-3">
              {isLoading ? (
                <div className="flex h-full items-center justify-center">
                  <Spinner />
                </div>
              ) : (mensagens ?? []).length === 0 ? (
                <p className="m-auto text-sm text-muted-foreground">Nenhuma mensagem ainda.</p>
              ) : (
                (mensagens ?? []).map((m) => {
                  const minha = m.remetente_id === perfil?.id
                  return (
                    <div key={m.id} className={`flex ${minha ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${minha ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                        {!minha && (
                          <div className="mb-0.5 text-xs font-medium text-muted-foreground">
                            {m.remetente?.nome_completo}
                          </div>
                        )}
                        <div>{m.conteudo}</div>
                        <div className={`mt-0.5 text-[10px] ${minha ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                          {new Date(m.created_at).toLocaleString('pt-BR')}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
            <div className="flex items-end gap-2">
              <Textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Escreva sua mensagem..."
                className="min-h-[60px] flex-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void enviar()
                  }
                }}
              />
              <Button onClick={enviar} disabled={!texto.trim()}>
                <Send /> Enviar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
