// ─────────────────────────────────────────────────────────────────────────────
// Conversa com a regulação (R3, pedido do RT de 24/11/2026). Uma conversa por
// pedido: a equipe e o NIR da unidade de origem de um lado, o médico regulador
// da central do outro. O autor é o login; o regulador pode marcar a mensagem
// como pergunta ou pedido. Abrir marca como lida para quem abriu. Quando o
// regulador escreve, o médico e o NIR escalados no dia na origem recebem o
// aviso; quando a origem escreve, o regulador recebe.
// Migration 20270421000040_regulacao_conversa_nir.sql.
// ─────────────────────────────────────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MessageSquare, Send } from 'lucide-react'
import * as React from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CampoSelecao } from '@/components/ui/campo-selecao'
import { MensagemErro } from '@/components/ui/mensagem-erro'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { fmtDataHora } from '@/lib/datas'
import { INTENCOES, type Conversa, type IntencaoMensagem } from '@/lib/regulacaoPaciente'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

export function ConversaRegulacao({ solicitacaoId, aoEnviar }: { solicitacaoId: string; aoEnviar?: () => void }) {
  const qc = useQueryClient()
  const chave = ['regulacao-conversa', solicitacaoId]
  const conversa = useQuery({
    queryKey: chave,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('regulacao_conversa', { p_solicitacao: solicitacaoId })
      if (error) throw error
      return data as unknown as Conversa
    },
  })
  // abrir a conversa marca como lida: a lista de pacientes tira o aviso
  const lida = conversa.dataUpdatedAt
  React.useEffect(() => {
    if (lida) void qc.invalidateQueries({ queryKey: ['regulacao-pacientes'] })
  }, [lida, qc])

  const [texto, setTexto] = React.useState('')
  const [intencao, setIntencao] = React.useState<IntencaoMensagem>('mensagem')
  const enviar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('regulacao_conversa_enviar', {
        p_solicitacao: solicitacaoId, p_texto: texto.trim(), p_intencao: intencao,
      })
      if (error) throw error
    },
    onSuccess: () => {
      setTexto(''); setIntencao('mensagem')
      void qc.invalidateQueries({ queryKey: chave })
      void qc.invalidateQueries({ queryKey: ['regulacao-pacientes'] })
      void qc.invalidateQueries({ queryKey: ['regulacao-detalhe', solicitacaoId] })
      aoEnviar?.()
    },
  })

  const c = conversa.data
  const central = c?.meu_lado === 'central'
  return (
    <section aria-label="Conversa com a regulação" className="flex flex-col gap-2 rounded-controle border border-fio bg-superficie p-3 text-apoio">
      <h4 className="flex items-center gap-2 font-medium text-tinta">
        <MessageSquare className="size-4" aria-hidden /> Conversa com a {central ? 'unidade de origem' : 'regulação'}
      </h4>
      {conversa.isLoading ? <Spinner /> : conversa.error ? <MensagemErro texto={(conversa.error as Error).message} /> : (
        <>
          {(c?.mensagens ?? []).length === 0 ? (
            <p className="text-tinta-sussurro">
              {central ? 'Nenhuma mensagem. Pergunte ou peça o que falta para decidir; a equipe e o NIR de plantão recebem o aviso.'
                : 'Nenhuma mensagem. Quando o médico regulador perguntar ou pedir algo, aparece aqui e no aviso.'}
            </p>
          ) : (
            <ol className="flex flex-col gap-2">
              {c!.mensagens.map((m) => (
                <li key={m.id} className={cn('flex max-w-[85%] flex-col gap-0.5 rounded-controle px-3 py-2',
                  m.lado === 'central' ? 'self-start bg-acao/10' : 'self-end bg-campo')}>
                  <span className="flex flex-wrap items-center gap-1.5 text-rotulo text-tinta-sussurro">
                    <span className="font-medium text-tinta-apoio">{m.autor ?? '—'}</span>
                    {m.lado === 'central' ? 'médico regulador' : 'unidade de origem'}
                    {m.intencao !== 'mensagem' && <Badge variant="warning">{INTENCOES[m.intencao]}</Badge>}
                    <span>· {fmtDataHora(m.em)}</span>
                  </span>
                  <span className="whitespace-pre-wrap text-tinta">{m.texto}</span>
                </li>
              ))}
            </ol>
          )}
          {c?.pode_escrever && (
            <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); if (texto.trim().length >= 2) enviar.mutate() }}>
              <label htmlFor={`conversa-${solicitacaoId}`} className="sr-only">Mensagem</label>
              <Textarea id={`conversa-${solicitacaoId}`} value={texto} maxLength={4000} onChange={(e) => setTexto(e.target.value)}
                placeholder={central ? 'Pergunte ou peça um dado ou exame à unidade' : 'Responda ou atualize a regulação'} />
              <div className="flex flex-wrap items-center gap-2">
                {central && (
                  <CampoSelecao tamanho="compacto" aria-label="Tipo da mensagem" value={intencao} onChange={(e) => setIntencao(e.target.value as IntencaoMensagem)}>
                    {(Object.keys(INTENCOES) as IntencaoMensagem[]).map((k) => <option key={k} value={k}>{INTENCOES[k]}</option>)}
                  </CampoSelecao>
                )}
                <Button type="submit" size="sm" className="ml-auto" disabled={enviar.isPending || texto.trim().length < 2}><Send /> Enviar</Button>
              </div>
              <MensagemErro texto={enviar.error ? (enviar.error as Error).message : null} />
            </form>
          )}
        </>
      )}
    </section>
  )
}
