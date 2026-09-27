// Passagem de plantão: o que chegou para eu aceitar e o que eu enviei e ainda
// aguarda aceite (o que bloqueia meu check-out). Fase 3.5.
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRightLeft } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'

type Linha = {
  id: string
  de_perfil: string
  para_perfil: string
  resumo: string
  enviada_em: string
  setores: { nome: string } | null
  pacientes: { nome: string } | null
}

const hora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' })

export function PassagensDoPlantao() {
  const { perfil } = useAuth()
  const eu = perfil?.id
  const qc = useQueryClient()
  const [erro, setErro] = React.useState<string | null>(null)
  const [recusando, setRecusando] = React.useState<string | null>(null)
  const [motivo, setMotivo] = React.useState('')

  const { data } = useQuery({
    queryKey: ['passagens-aguardando', eu],
    enabled: !!eu,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('passagens_plantao')
        .select('id, de_perfil, para_perfil, resumo, enviada_em, setores(nome), pacientes(nome)')
        .eq('situacao', 'aguardando')
        .or(`de_perfil.eq.${eu},para_perfil.eq.${eu}`)
        .order('enviada_em')
      if (error) throw error
      return (data ?? []) as unknown as Linha[]
    },
  })
  const recebidas = (data ?? []).filter((p) => p.para_perfil === eu)
  const enviadas = (data ?? []).filter((p) => p.de_perfil === eu)
  if (recebidas.length === 0 && enviadas.length === 0) return null

  async function chamar(nome: 'responder_passagem' | 'retirar_passagem', args: Record<string, unknown>) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.rpc(nome, args as any)
    if (error) return setErro(error.message)
    setErro(null)
    setRecusando(null)
    setMotivo('')
    void qc.invalidateQueries({ queryKey: ['passagens-aguardando'] })
    void qc.invalidateQueries({ queryKey: ['passagens'] })
  }
  const paciente = (p: Linha) => p.pacientes?.nome ?? `Paciente de ${p.setores?.nome ?? 'setor'}`

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ArrowRightLeft className="size-4 text-muted-foreground" /> Passagem de plantão
        </CardTitle>
        <CardDescription>
          Paciente a paciente, com aceite. Enquanto uma passagem sua aguarda aceite, o check-out fica bloqueado.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {erro && <p className="text-critico">{erro}</p>}
        {recebidas.map((p) => (
          <div key={p.id} className="flex flex-col gap-2 rounded-lg border border-atencao/30 bg-atencao/[0.06] p-3">
            <div className="font-medium text-tinta">{paciente(p)} · {p.setores?.nome}</div>
            <p className="whitespace-pre-wrap">{p.resumo}</p>
            <div className="text-xs text-muted-foreground">enviada em {hora(p.enviada_em)}</div>
            {recusando === p.id ? (
              <div className="flex flex-col gap-2">
                <Textarea placeholder="Por que recusa (mínimo de 15 letras)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={motivo.trim().length < 15}
                    onClick={() => void chamar('responder_passagem', { p_passagem: p.id, p_aceitar: false, p_motivo: motivo })}>
                    Recusar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setRecusando(null)}>Voltar</Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => void chamar('responder_passagem', { p_passagem: p.id, p_aceitar: true })}>Aceitar</Button>
                <Button size="sm" variant="ghost" onClick={() => setRecusando(p.id)}>Recusar</Button>
              </div>
            )}
          </div>
        ))}
        {enviadas.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-fio p-3">
            <span className="flex-1">
              <span className="font-medium text-tinta">{paciente(p)}</span> — enviada em {hora(p.enviada_em)}, aguardando aceite
            </span>
            <Button size="xs" variant="outline" onClick={() => void chamar('retirar_passagem', { p_passagem: p.id })}>Retirar</Button>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
