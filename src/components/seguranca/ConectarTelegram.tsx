import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MessageCircle } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

// Liga a conta do Telegram ao perfil (Hermes, rodada A). O código de 6 dígitos
// é de uso único e vale 10 minutos; a pessoa o manda à Corujinha no Telegram,
// que confirma pelo backend. Ninguém digita ID de Telegram à mão.
export function ConectarTelegram() {
  const queryClient = useQueryClient()
  const [codigo, setCodigo] = React.useState<{ valor: string; ate: number } | null>(null)

  const vinculo = useQuery({
    queryKey: ['hermes-vinculo-telegram'],
    queryFn: async () => {
      const { data, error } = await supabase.from('hermes_identidades').select('criado_em').eq('canal', 'telegram').maybeSingle()
      if (error) throw error
      return data as { criado_em: string } | null
    },
    refetchInterval: codigo ? 5_000 : false,
  })

  const gerar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('gerar_codigo_vinculo_hermes', { p_canal: 'telegram' })
      if (error) throw error
      return data as string
    },
    onSuccess: (valor) => setCodigo({ valor, ate: Date.now() + 10 * 60_000 }),
  })

  const desfazer = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('hermes_identidades').delete().eq('canal', 'telegram')
      if (error) throw error
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['hermes-vinculo-telegram'] }),
  })

  const conectado = !!vinculo.data

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageCircle className="size-4" /> Assistente no Telegram
        </CardTitle>
        <CardDescription>
          A Corujinha responde sobre os seus plantões, a escala e a operação da unidade — só depois de você ligar o
          Telegram à sua conta. Ela nunca recebe dado de paciente.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {conectado ? (
          <>
            <p className="text-conforme">
              Telegram conectado desde {new Date(vinculo.data!.criado_em).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}.
            </p>
            <Button variant="outline" className="self-start" disabled={desfazer.isPending} onClick={() => desfazer.mutate()}>
              Desconectar
            </Button>
          </>
        ) : codigo ? (
          <>
            <p className="text-tinta-apoio">Mande este código à Corujinha no Telegram. Vale por 10 minutos e uma vez só:</p>
            <p className="font-mono text-[30px] font-semibold tracking-[0.2em] text-tinta tabular-nums">{codigo.valor}</p>
            <p className="text-xs text-muted-foreground">Esta página confirma sozinha quando a conexão acontecer.</p>
          </>
        ) : (
          <Button className="self-start" disabled={gerar.isPending} onClick={() => gerar.mutate()}>
            Conectar ao Telegram
          </Button>
        )}
        {(gerar.error || desfazer.error) && <p className="text-destructive">{((gerar.error ?? desfazer.error) as Error).message}</p>}
      </CardContent>
    </Card>
  )
}
