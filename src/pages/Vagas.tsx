import { useQuery, useQueryClient } from '@tanstack/react-query'
import { BriefcaseBusiness, ChevronRight } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'

import { supabase } from '@/lib/supabase'
import { useUnidade } from '@/contexts/UnidadeContext'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'

type Vaga = {
  id: string
  data: string
  turno: string
  setor_id: string
  setores: { id: string; nome: string; especialidade: string | null } | null
  unidade_id: string
  unidades: { id: string; nome: string; latitude: number | null; longitude: number | null } | null
}

type Remuneracao = {
  setor_id: string | null
  turno: string | null
  valor: number
}

const TURNO_LABEL: Record<string, string> = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' }

function brl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function distanciaKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * r * Math.asin(Math.sqrt(s))
}

export default function Vagas() {
  const { unidades } = useUnidade()
  const { perfil } = useAuth()
  const queryClient = useQueryClient()

  const [unidadeFiltro, setUnidadeFiltro] = React.useState('')
  const [turnoFiltro, setTurnoFiltro] = React.useState('')
  const [especialidadeFiltro, setEspecialidadeFiltro] = React.useState('')
  const [raioKm, setRaioKm] = React.useState(0)
  const [pos, setPos] = React.useState<{ lat: number; lng: number } | null>(null)

  const { data: vagas, isLoading } = useQuery({
    queryKey: ['vagas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('escala_plantao')
        .select('id, data, turno, setor_id, unidade_id, setores(id, nome, especialidade), unidades(id, nome, latitude, longitude)')
        .is('perfil_id', null)
        .eq('ativo', true)
        .gte('data', new Date().toISOString().slice(0, 10))
        .order('data', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as Vaga[]
    },
  })

  const { data: remuneracoes } = useQuery({
    queryKey: ['remuneracoes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('remuneracoes_plantao').select('setor_id, turno, valor').eq('ativo', true)
      if (error) throw error
      return (data ?? []) as Remuneracao[]
    },
  })

  const { data: candidaturas } = useQuery({
    queryKey: ['minhas-candidaturas-vagas'],
    enabled: !!perfil,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('candidaturas_escala')
        .select('setor_id, data, turno, status')
        .eq('perfil_id', perfil!.id)
      if (error) throw error
      return data ?? []
    },
  })

  function valorDaVaga(v: Vaga): number {
    const r = (remuneracoes ?? []).filter(
      (x) => (x.setor_id === v.setor_id) || (x.setor_id == null)
    )
    const turno = r.find((x) => x.turno === v.turno) ?? r.find((x) => x.turno == null)
    return turno?.valor ?? 0
  }

  const vagasFiltradas = React.useMemo(() => {
    return (vagas ?? []).filter((v) => {
      if (unidadeFiltro && v.unidade_id !== unidadeFiltro) return false
      if (turnoFiltro && v.turno !== turnoFiltro) return false
      if (especialidadeFiltro && !v.setores?.especialidade?.toLowerCase().includes(especialidadeFiltro.toLowerCase())) return false
      if (raioKm > 0 && pos && v.unidades?.latitude != null && v.unidades.longitude != null) {
        const d = distanciaKm(pos, { lat: v.unidades.latitude, lng: v.unidades.longitude })
        if (d > raioKm) return false
      }
      return true
    })
  }, [vagas, unidadeFiltro, turnoFiltro, especialidadeFiltro, raioKm, pos])

  async function capturarPosicao() {
    if (!('geolocation' in navigator)) return
    navigator.geolocation.getCurrentPosition((p) => {
      setPos({ lat: p.coords.latitude, lng: p.coords.longitude })
    })
  }

  const jaCandidatou = (v: Vaga) =>
    (candidaturas ?? []).some(
      (c) => c.setor_id === v.setor_id && c.data === v.data && c.turno === v.turno
    )

  async function candidatar(v: Vaga) {
    if (!perfil) return
    const { error } = await supabase.from('candidaturas_escala').insert({
      unidade_id: v.unidade_id,
      setor_id: v.setor_id,
      data: v.data,
      turno: v.turno,
      perfil_id: perfil.id,
      criado_por: perfil.id,
    })
    if (error) {
      alert(error.message)
      return
    }
    void queryClient.invalidateQueries({ queryKey: ['minhas-candidaturas-vagas'] })
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Link to="/" className="transition-colors hover:text-foreground">
            Início
          </Link>
          <ChevronRight className="size-3.5" />
          <span className="font-medium text-foreground">Vagas de Plantão</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Vagas de Plantão</h1>
        <p className="text-sm text-muted-foreground">
          Planteões livres com filtros por unidade, turno, especialidade, distância e valor.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Unidade</label>
            <Select value={unidadeFiltro || null} onValueChange={(v) => setUnidadeFiltro(v ?? '')}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                {unidades.map((u) => (
                  <SelectItem key={u.unidade_id} value={u.unidade_id}>
                    {u.unidade.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Turno</label>
            <Select value={turnoFiltro || null} onValueChange={(v) => setTurnoFiltro(v ?? '')}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manha">Manhã</SelectItem>
                <SelectItem value="tarde">Tarde</SelectItem>
                <SelectItem value="noite">Noite</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Especialidade</label>
            <Input value={especialidadeFiltro} onChange={(e) => setEspecialidadeFiltro(e.target.value)} placeholder="Ex.: clínica" className="w-40" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Distância (km)</label>
            <Input type="number" min={0} value={raioKm || ''} onChange={(e) => setRaioKm(Number(e.target.value))} placeholder="Sem limite" className="w-28" />
          </div>
          <Button variant="outline" size="sm" onClick={capturarPosicao}>
            Usar minha localização
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BriefcaseBusiness className="size-4 text-muted-foreground" />
            {vagasFiltradas.length} vaga(s) disponível(is)
          </CardTitle>
          <CardDescription>Candide-se às vagas de sua preferência.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {isLoading ? (
            <div className="flex h-24 items-center justify-center">
              <Spinner />
            </div>
          ) : vagasFiltradas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma vaga encontrada com os filtros atuais.</p>
          ) : (
            vagasFiltradas.map((v) => (
              <div key={v.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2 font-medium">
                    {new Date(v.data + 'T12:00:00').toLocaleDateString('pt-BR')} · {TURNO_LABEL[v.turno] ?? v.turno}
                    <Badge variant="success">{brl(valorDaVaga(v))}</Badge>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {v.unidades?.nome ?? ''} — {v.setores?.nome ?? ''}
                    {v.setores?.especialidade ? ` · ${v.setores.especialidade}` : ''}
                    {pos && v.unidades?.latitude != null && v.unidades.longitude != null && (
                      <> · a {distanciaKm(pos, { lat: v.unidades.latitude, lng: v.unidades.longitude }).toFixed(1)} km</>
                    )}
                  </div>
                </div>
                <Button size="sm" variant={jaCandidatou(v) ? 'secondary' : 'default'} disabled={jaCandidatou(v)} onClick={() => candidatar(v)}>
                  {jaCandidatou(v) ? 'Já se candidatou' : 'Candidatar-se'}
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
