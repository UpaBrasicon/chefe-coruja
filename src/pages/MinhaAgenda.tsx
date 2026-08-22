import { useQuery } from '@tanstack/react-query'
import { CalendarRange, ChevronRight, ChevronLeft, ChevronRight as Next } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'

import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

const TURNO_LABEL: Record<string, string> = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' }

type MeuPlantao = {
  id: string
  data: string
  turno: string
  setor_id: string
  unidade_id: string
  setores: { nome: string } | null
  unidades: { nome: string } | null
}

const CORES_UNIDADE = [
  'bg-emerald-500/15 text-emerald-700',
  'bg-sky-500/15 text-sky-700',
  'bg-violet-500/15 text-violet-700',
  'bg-amber-500/15 text-amber-700',
  'bg-rose-500/15 text-rose-700',
]

export default function MinhaAgenda({ embutido = false }: { embutido?: boolean } = {}) {
  const { perfil } = useAuth()
  const hoje = new Date()
  const [mes, setMes] = React.useState(`${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`)

  const { data: plantoes, isLoading } = useQuery({
    queryKey: ['minha-agenda', perfil?.id, mes],
    enabled: !!perfil,
    queryFn: async () => {
      const inicio = `${mes}-01`
      const fim = `${mes}-31`
      const { data, error } = await supabase
        .from('escala_plantao')
        .select('id, data, turno, setor_id, unidade_id, setores(nome), unidades(nome)')
        .eq('perfil_id', perfil!.id)
        .eq('ativo', true)
        .gte('data', inicio)
        .lte('data', fim)
        .order('data', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as MeuPlantao[]
    },
  })

  const [ano, mês] = mes.split('-').map(Number)
  const primeiroDia = new Date(ano, mês - 1, 1)
  const diasNoMes = new Date(ano, mês, 0).getDate()
  const offset = primeiroDia.getDay()

  const porUnidade = React.useMemo(() => {
    const mapa = new Map<string, { nome: string; cor: string }>()
    ;(plantoes ?? []).forEach((p) => {
      if (!mapa.has(p.unidade_id)) {
        mapa.set(p.unidade_id, {
          nome: p.unidades?.nome ?? '',
          cor: CORES_UNIDADE[mapa.size % CORES_UNIDADE.length],
        })
      }
    })
    return mapa
  }, [plantoes])

  function mover(delta: number) {
    const d = new Date(ano, mês - 1 + delta, 1)
    setMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      {!embutido && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Link to="/" className="transition-colors hover:text-foreground">
              Início
            </Link>
            <ChevronRight className="size-3.5" />
            <span className="font-medium text-foreground">Minha Agenda</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Minha Agenda</h1>
          <p className="text-sm text-muted-foreground">
            Todos os seus plantões de todas as unidades em um único calendário.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => mover(-1)}>
            <ChevronLeft />
          </Button>
          <span className="text-sm font-semibold">
            {primeiroDia.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
          </span>
          <Button variant="outline" size="sm" onClick={() => mover(1)}>
            <Next />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {Array.from(porUnidade.entries()).map(([uid, info]) => (
            <Badge key={uid} className={cn(info.cor)}>
              {info.nome}
            </Badge>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarRange className="size-4 text-muted-foreground" />
            Calendário consolidado
          </CardTitle>
          <CardDescription>Plantões de todas as unidades que você participa.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <Spinner />
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1.5">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => (
                <div key={d} className="pb-1 text-center text-xs font-medium text-muted-foreground">
                  {d}
                </div>
              ))}
              {Array.from({ length: offset }).map((_, i) => (
                <div key={`vazio-${i}`} />
              ))}
              {Array.from({ length: diasNoMes }).map((_, i) => {
                const dia = i + 1
                const dataStr = `${mes}-${String(dia).padStart(2, '0')}`
                const doDia = (plantoes ?? []).filter((p) => p.data === dataStr)
                return (
                  <div
                    key={dataStr}
                    className={cn(
                      'flex min-h-16 flex-col gap-1 rounded-lg border p-1.5 text-xs',
                      doDia.length === 0 ? 'bg-muted/40' : 'bg-card'
                    )}
                  >
                    <span className="font-medium text-muted-foreground">{dia}</span>
                    {doDia.map((p) => {
                      const info = porUnidade.get(p.unidade_id)
                      return (
                        <span key={p.id} className={cn('rounded px-1.5 py-0.5 font-medium', info?.cor)}>
                          {TURNO_LABEL[p.turno] ?? p.turno} {info?.nome}
                        </span>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
