import { useQuery, useQueryClient } from '@tanstack/react-query'
import { BriefcaseBusiness, ChevronRight } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'

import { supabase } from '@/lib/supabase'
import { useUnidade } from '@/contexts/UnidadeContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import type { Database } from '@/types/database'

// Vagas abertas (migration 20261012000001, vagas_abertas): as partes de
// plantão fracionado, com a própria janela, e as faixas que o gestor marcou
// como vaga e ainda estão sem ninguém. A candidatura vai pela vaga
// (candidatar_vaga) e o gestor aprova na Escala.
type Vaga = Database['public']['Functions']['vagas_abertas']['Returns'][number]

type Remuneracao = {
  setor_id: string | null
  turno: string | null
  valor: number
}

const TURNO_LABEL: Record<string, string> = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' }

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })

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

export default function Vagas({ embutido = false }: { embutido?: boolean } = {}) {
  const { unidades } = useUnidade()
  const queryClient = useQueryClient()

  const [unidadeFiltro, setUnidadeFiltro] = React.useState('')
  const [turnoFiltro, setTurnoFiltro] = React.useState('')
  const [especialidadeFiltro, setEspecialidadeFiltro] = React.useState('')
  const [raioKm, setRaioKm] = React.useState(0)
  const [pos, setPos] = React.useState<{ lat: number; lng: number } | null>(null)

  const { data: vagas, isLoading } = useQuery({
    queryKey: ['vagas'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('vagas_abertas')
      if (error) throw error
      return data ?? []
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

  function valorDaVaga(v: Vaga): number {
    const r = (remuneracoes ?? []).filter(
      (x) => (x.setor_id === v.setor_id) || (x.setor_id == null)
    )
    const turno = r.find((x) => x.turno === v.turno) ?? r.find((x) => x.turno == null)
    const cheio = turno?.valor ?? 0
    // parte de plantão: proporcional às horas da parte sobre as do turno
    if (!v.parte) return cheio
    const horasParte = (new Date(v.fim).getTime() - new Date(v.inicio).getTime()) / 3_600_000
    return cheio * (horasParte / (v.turno === 'noite' ? 12 : 6))
  }

  const vagasFiltradas = React.useMemo(() => {
    return (vagas ?? []).filter((v) => {
      if (unidadeFiltro && v.unidade_id !== unidadeFiltro) return false
      if (turnoFiltro && v.turno !== turnoFiltro) return false
      if (especialidadeFiltro && !v.especialidade?.toLowerCase().includes(especialidadeFiltro.toLowerCase())) return false
      if (raioKm > 0 && pos && v.latitude != null && v.longitude != null) {
        const d = distanciaKm(pos, { lat: v.latitude, lng: v.longitude })
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

  const jaCandidatou = (v: Vaga) => v.minha_candidatura != null
  const [erro, setErro] = React.useState<string | null>(null)
  const [enviando, setEnviando] = React.useState<string | null>(null)

  async function candidatar(v: Vaga) {
    setErro(null)
    setEnviando(v.id)
    const { error } = await supabase.rpc('candidatar_vaga', { p_vaga: v.id })
    setEnviando(null)
    if (error) {
      setErro(error.message)
      return
    }
    void queryClient.invalidateQueries({ queryKey: ['vagas'] })
    void queryClient.invalidateQueries({ queryKey: ['candidaturas-escala'] })
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      {!embutido && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1 text-sm text-tinta-sussurro">
            <Link to="/" className="transition-colors hover:text-tinta">
              Início
            </Link>
            <ChevronRight className="size-3.5" />
            <span className="font-medium text-tinta">Vagas de Plantão</span>
          </div>
          <h1 className="text-titulo leading-[1.1] font-semibold tracking-[-0.02em] text-tinta">Vagas de Plantão</h1>
          <p className="text-sm text-tinta-sussurro">
            Plantões e partes de plantão livres, com filtros por unidade, turno, especialidade, distância e valor.
          </p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-tinta-sussurro">Unidade</label>
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
            <label className="text-xs font-medium text-tinta-sussurro">Turno</label>
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
            <label className="text-xs font-medium text-tinta-sussurro">Especialidade</label>
            <Input value={especialidadeFiltro} onChange={(e) => setEspecialidadeFiltro(e.target.value)} placeholder="Ex.: clínica" className="w-40" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-tinta-sussurro">Distância (km)</label>
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
            <BriefcaseBusiness className="size-4 text-tinta-sussurro" />
            {vagasFiltradas.length} vaga(s) disponível(is)
          </CardTitle>
          <CardDescription>Candidate-se às vagas de sua preferência. O gestor da unidade aprova na escala.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {erro && <p role="alert" className="text-sm text-critico">{erro}</p>}
          {isLoading ? (
            <div className="flex h-24 items-center justify-center">
              <Spinner />
            </div>
          ) : vagasFiltradas.length === 0 ? (
            <p className="text-sm text-tinta-sussurro">Nenhuma vaga encontrada com os filtros atuais.</p>
          ) : (
            vagasFiltradas.map((v) => (
              <div key={v.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                <div className="flex flex-col">
                  <div className="flex flex-wrap items-center gap-2 font-medium">
                    {new Date(v.data + 'T12:00:00').toLocaleDateString('pt-BR')} · {TURNO_LABEL[v.turno] ?? v.turno}
                    <span className="text-xs font-normal text-tinta-apoio">{hora(v.inicio)}–{hora(v.fim)}</span>
                    {v.parte && v.partes && <Badge variant="outline">Parte {v.parte} de {v.partes}</Badge>}
                    <Badge variant="success">{brl(valorDaVaga(v))}</Badge>
                  </div>
                  <div className="mt-0.5 text-xs text-tinta-sussurro">
                    {v.unidade_nome} — {v.setor_nome}
                    {v.especialidade ? ` · ${v.especialidade}` : ''}
                    {pos && v.latitude != null && v.longitude != null && (
                      <> · a {distanciaKm(pos, { lat: v.latitude, lng: v.longitude }).toFixed(1)} km</>
                    )}
                  </div>
                </div>
                <Button size="sm" variant={jaCandidatou(v) ? 'secondary' : 'default'} disabled={jaCandidatou(v) || enviando === v.id} onClick={() => candidatar(v)}>
                  {jaCandidatou(v) ? (v.minha_candidatura === 'recusado' ? 'Candidatura recusada' : 'Já se candidatou') : 'Candidatar-se'}
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
