import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Clock, KeyRound, LogIn, Users } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { useUnidade } from '@/contexts/UnidadeContext'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'

type PresencaDia = {
  perfil_id: string
  nome: string
  papel: string
  em_escala: boolean
  checkin_em: string | null
  checkout_em: string | null
  checkin_dentro: boolean | null
  checkout_dentro: boolean | null
  observacao: string | null
  checkin_justificativa: string | null
  checkin_distancia_m: number | null
  checkout_automatico: boolean
  /** Liberação do gestor para continuar depois da tolerância de 20 min; null se não há. */
  liberado_pos_ate: string | null
}

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })

// Liberar continuidade depois da tolerância de 20 min (decisão do RT 03/10/2026).
function LiberarPosPlantao({ unidadeId, perfilId, nome }: { unidadeId: string; perfilId: string; nome: string }) {
  const qc = useQueryClient()
  const [aberto, setAberto] = React.useState(false)
  const [minutos, setMinutos] = React.useState('30')
  const [motivo, setMotivo] = React.useState('')
  const [erro, setErro] = React.useState<string | null>(null)
  const liberar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('liberar_pos_plantao', {
        p_unidade: unidadeId, p_perfil: perfilId, p_minutos: Number(minutos || 0), p_motivo: motivo.trim(),
      })
      if (error) throw error
    },
    onSuccess: () => { setAberto(false); setMotivo(''); void qc.invalidateQueries({ queryKey: ['presencas-do-dia'] }) },
    onError: (e) => setErro(e instanceof Error ? e.message : 'Falha ao liberar.'),
  })
  if (!aberto) {
    return (
      <Button size="xs" variant="outline" onClick={() => { setAberto(true); setErro(null) }}>
        <KeyRound className="size-3.5" /> Liberar após o plantão
      </Button>
    )
  }
  return (
    <div className="flex w-full flex-col gap-2 rounded-lg border border-fio bg-campo p-3">
      <p className="text-xs text-tinta-apoio">Liberar {nome} a continuar depois dos 20 min de tolerância.</p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-tinta-sussurro">Minutos (5 a 120)</label>
        <Input className="h-8 w-20" type="number" min={5} max={120} value={minutos} onChange={(e) => setMinutos(e.target.value)} />
      </div>
      <Input className="h-8" placeholder="Motivo (mínimo 10 letras)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      {erro && <p className="text-xs text-critico">{erro}</p>}
      <div className="flex gap-2">
        <Button size="xs" disabled={motivo.trim().length < 10 || Number(minutos) < 5 || Number(minutos) > 120 || liberar.isPending} onClick={() => { setErro(null); liberar.mutate() }}>Liberar</Button>
        <Button size="xs" variant="ghost" onClick={() => setAberto(false)}>Cancelar</Button>
      </div>
    </div>
  )
}

/**
 * Presenças do dia — visão do GESTOR (RPC presencas_do_dia_gestor).
 * Mostra quem fez check-in, a que horas, se dentro do raio da unidade, e quem
 * está em escala mas ainda NÃO fez check-in (pendência). Refresca a cada 30s.
 *
 * LGPD: nomes de profissionais (não é dado de paciente); RPC restrito a
 * gestor/admin/super via SECURITY DEFINER + guarda interna.
 */
export function PresencasDoDia() {
  const { unidadeAtiva } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id

  const { data: presencas, isLoading, error } = useQuery({
    queryKey: ['presencas-do-dia', unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('presencas_do_dia_gestor', { p_unidade: unidadeId! })
      if (error) throw error
      return (data ?? []) as unknown as PresencaDia[]
    },
    refetchInterval: 30_000,
  })

  const feitos = (presencas ?? []).filter((p) => p.checkin_em && !p.checkout_em)
  const pendentes = (presencas ?? []).filter((p) => !p.checkin_em)
  const concluidos = (presencas ?? []).filter((p) => p.checkout_em)

  if (error) {
    return (
      <div className="rounded-lg border border-critico/30 bg-critico/[0.08] p-4 text-sm text-critico">
        Falha ao carregar presenças: {(error as Error).message}
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="size-4 text-tinta-sussurro" />
            Presenças de hoje
          </CardTitle>
          <CardDescription>
            <span className="font-medium text-conforme">{feitos.length} em expediente</span>
            {' · '}
            <span className="font-medium text-atencao">{pendentes.length} sem check-in</span>
            {' · '}
            <span className="font-medium text-tinta-sussurro">{concluidos.length} concluídos</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {(presencas ?? []).length === 0 ? (
            <p className="text-sm text-tinta-sussurro">Nenhum plantonista vinculado nesta unidade.</p>
          ) : (
            (presencas ?? []).map((p) => (
              <div
                key={p.perfil_id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-medium">{p.nome}</span>
                  {!p.em_escala && <Badge variant="outline">fora da escala hoje</Badge>}
                  {p.checkin_dentro === true && <Badge variant="success">dentro do raio</Badge>}
                  {p.checkin_dentro === false && (<Badge variant="destructive">fora do raio{p.checkin_distancia_m != null ? ` · ${p.checkin_distancia_m} m` : ""}</Badge>)}
                </div>
                <div className="flex items-center gap-2 text-xs text-tinta-sussurro">
                  {p.checkin_em ? (
                    <span className="flex items-center gap-1">
                      <LogIn className="size-3.5" />
                      {new Date(p.checkin_em).toLocaleTimeString('pt-BR')}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 font-medium text-atencao">
                      <Clock className="size-3.5" /> aguardando
                    </span>
                  )}
                  {p.checkout_em && (
                    <span className="flex items-center gap-1 text-tinta-sussurro">
                      → {new Date(p.checkout_em).toLocaleTimeString('pt-BR')}{p.checkout_automatico && ' (automático)'}
                    </span>
                  )}
                </div>
                {p.checkin_justificativa && (
                  <p className="w-full text-rotulo text-tinta-apoio">
                    Justificativa do check-in: “{p.checkin_justificativa}”
                  </p>
                )}
                {p.liberado_pos_ate && (
                  <Badge variant="info" className="w-full justify-start">Liberado para continuar até {hhmm(p.liberado_pos_ate)}</Badge>
                )}
                {unidadeId && !p.liberado_pos_ate && (
                  <div className="w-full">
                    <LiberarPosPlantao unidadeId={unidadeId} perfilId={p.perfil_id} nome={p.nome} />
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
