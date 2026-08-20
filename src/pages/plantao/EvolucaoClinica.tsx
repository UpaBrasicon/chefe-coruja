// ─────────────────────────────────────────────────────────────────────────────
// EvolucaoClinica — tela de evolução clínica (FASE 2)
//
// Gráfico de evolução (múltiplos conceitos + faixa de referência + críticos),
// flowsheet (PainelObservacoes) e registro rápido de sinais vitais.
// Acessível de /plantao/evolucao ou ?paciente=ID (vindo do painel).
// ─────────────────────────────────────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Activity, ChevronRight, Plus, Trash2 } from 'lucide-react'
import * as React from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useUnidade } from '@/contexts/UnidadeContext'
import { getSerieObservacao, type SerieObservacao } from '@/lib/observacao'
import { useInternacaoAtiva } from '@/hooks/useDocumentos'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { GraficoEvolucao } from '@/components/observacao/GraficoEvolucao'
import { PainelObservacoes } from '@/components/observacao/PainelObservacoes'

type Paciente = { id: string; nome: string; cpf: string | null }

const CONCEITOS_VITAIS = [
  'frequencia-cardiaca',
  'frequencia-respiratoria',
  'pressao-arterial-sistolica',
  'saturacao-o2',
  'temperatura',
  'glicemia-capilar',
]

export default function EvolucaoClinica() {
  const { unidadeAtiva } = useUnidade()
  const { perfil } = useAuth()
  const unidadeId = unidadeAtiva?.unidade_id
  const perfilId = perfil?.id
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const pacienteParam = searchParams.get('paciente')

  const [pacienteId, setPacienteId] = React.useState<string | null>(pacienteParam)
  const [conceitosSel, setConceitosSel] = React.useState<string[]>(['creatinina', 'ureia'])
  const [novoConceito, setNovoConceito] = React.useState('')
  const [form, setForm] = React.useState<Record<string, string>>({})

  // ── pacientes internados/em observação (para seleção) ──────────────────────
  const { data: pacientes } = useQuery({
    queryKey: ['evolucao-pacientes', unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pacientes')
        .select('id, nome, cpf')
        .eq('unidade_id', unidadeId!)
        .eq('ativo', true)
        .not('setor_id', 'is', null)
        .order('nome')
      if (error) throw error
      return (data ?? []) as Paciente[]
    },
  })

  const { data: internacao } = useInternacaoAtiva(pacienteId ?? undefined)

  // ── conceitos disponíveis (globais + unidade) ──────────────────────────────
  const { data: conceitos } = useQuery({
    queryKey: ['evolucao-conceitos', unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conceito')
        .select('id, nome, unidade_padrao, categoria')
        .eq('ativo', true)
        .or(`unidade_id.is.null,unidade_id.eq.${unidadeId!}`)
        .order('ordem_exibicao')
      if (error) throw error
      return data ?? []
    },
  })

  // ── séries dos conceitos selecionados ──────────────────────────────────────
  const { data: series, isFetching: carregandoSeries } = useQuery({
    queryKey: ['evolucao-series', internacao?.id, conceitosSel],
    enabled: !!internacao?.id && conceitosSel.length > 0,
    queryFn: async (): Promise<SerieObservacao[]> => {
      const resultados = await Promise.all(
        conceitosSel.map((nome) => {
          const c = conceitos?.find((x) => x.nome === nome)
          if (!c) return null
          return getSerieObservacao(internacao!.id, c.id)
        })
      )
      return resultados.filter((r): r is SerieObservacao => r !== null)
    },
  })

  // ── registro rápido de sinais vitais ───────────────────────────────────────
  const registrar = useMutation({
    mutationFn: async (valores: Record<string, string>) => {
      if (!internacao || !unidadeId || !perfilId || !pacienteId) throw new Error('Sem internação/unidade/perfil')
      const linhas = Object.entries(valores)
        .filter(([, v]) => v.trim() !== '')
        .map(([nome, v]) => {
          const c = conceitos?.find((x) => x.nome === nome)
          if (!c) throw new Error(`Conceito ${nome} não encontrado`)
          const num = Number(v.replace(',', '.'))
          if (Number.isNaN(num)) throw new Error(`Valor inválido para ${nome}`)
          return {
            unidade_id: unidadeId,
            internacao_id: internacao.id,
            paciente_id: pacienteId,
            conceito_id: c.id,
            aferido_em: new Date().toISOString(),
            registrado_por: perfilId,
            valor_num: num,
            origem: 'manual',
          }
        })
      if (linhas.length === 0) return
      const { error } = await supabase.from('observacao').insert(linhas)
      if (error) throw error
    },
    onSuccess: () => {
      setForm({})
      void queryClient.invalidateQueries({ queryKey: ['evolucao-series'] })
      void queryClient.invalidateQueries({ queryKey: ['evolucao-painel'] })
    },
  })

  function alternarConceito(nome: string) {
    setConceitosSel((prev) =>
      prev.includes(nome) ? prev.filter((n) => n !== nome) : [...prev, nome]
    )
  }

  const conceitosNomes = conceitos ?? []
  const vitaisNomes = conceitosNomes.filter((c) => CONCEITOS_VITAIS.includes(c.nome))

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Link to="/" className="transition-colors hover:text-foreground">Início</Link>
          <ChevronRight className="size-3.5" />
          <span className="font-medium text-foreground">Evolução Clínica</span>
        </div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Activity className="size-5 text-muted-foreground" />
          Evolução Clínica
        </h1>
        <p className="text-sm text-muted-foreground">
          Gráficos de sinais vitais e laboratório por internação — sem migration por exame.
        </p>
      </div>

      {/* Seleção de paciente */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Paciente</CardTitle>
          <CardDescription>Selecione o paciente internado para ver a evolução.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Select
            value={pacienteId ?? null}
            onValueChange={(v) => {
              setPacienteId(v)
              setSearchParams(v ? { paciente: v } : {}, { replace: true })
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecionar paciente…" />
            </SelectTrigger>
            <SelectContent>
              {(pacientes ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nome}
                  {p.cpf ? ` · ${p.cpf}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {internacao && (
            <p className="text-xs text-muted-foreground">
              Internação ativa · admissão{' '}
              {new Date(internacao.data_admissao).toLocaleDateString('pt-BR')}
            </p>
          )}
        </CardContent>
      </Card>

      {!internacao && pacienteId && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Nenhuma internação ativa para este paciente.
        </div>
      )}

      {internacao && (
        <>
          {/* Seletor de conceitos do gráfico */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Gráfico de evolução</CardTitle>
              <CardDescription>
                Selecione os conceitos sobrepostos (ex.: creatinina + ureia).
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                {conceitosNomes.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => alternarConceito(c.nome)}
                    className={
                      conceitosSel.includes(c.nome)
                        ? 'rounded-lg border border-primary bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary'
                        : 'rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40'
                    }
                  >
                    {c.nome.replace(/-/g, ' ')}
                    {c.unidade_padrao ? ` (${c.unidade_padrao})` : ''}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={novoConceito}
                  onChange={(e) => setNovoConceito(e.target.value)}
                  placeholder="Adicionar conceito por nome…"
                  className="max-w-xs"
                />
                <Button
                  variant="secondary"
                  disabled={!novoConceito.trim()}
                  onClick={() => {
                    const nome = novoConceito.trim()
                    if (nome && !conceitosSel.includes(nome)) {
                      setConceitosSel((prev) => [...prev, nome])
                    }
                    setNovoConceito('')
                  }}
                >
                  <Plus /> Adicionar
                </Button>
              </div>
              {carregandoSeries && <Spinner className="size-4" />}
              <GraficoEvolucao
                series={series ?? []}
                dataAdmissao={internacao.data_admissao}
              />
            </CardContent>
          </Card>

          {/* Registro rápido de sinais vitais */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Registrar sinais vitais</CardTitle>
              <CardDescription>Preencha os valores e salve (flag calculada no banco).</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid gap-3 sm:grid-cols-3">
                {vitaisNomes.map((c) => (
                  <div key={c.id} className="flex flex-col gap-1">
                    <Label className="capitalize">{c.nome.replace(/-/g, ' ')}</Label>
                    <Input
                      type="number"
                      step="any"
                      inputMode="decimal"
                      placeholder={c.unidade_padrao ?? '…'}
                      value={form[c.nome] ?? ''}
                      onChange={(e) => setForm((prev) => ({ ...prev, [c.nome]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
              {registrar.isError && (
                <p className="text-sm text-red-600">{(registrar.error as Error).message}</p>
              )}
              {registrar.isSuccess && (
                <p className="text-sm text-emerald-700">Sinais vitais registrados.</p>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setForm({})}>
                  <Trash2 /> Limpar
                </Button>
                <Button
                  onClick={() => registrar.mutate(form)}
                  disabled={registrar.isPending || Object.values(form).every((v) => !v.trim())}
                >
                  {registrar.isPending ? <Spinner className="size-4" /> : <Plus />} Registrar
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Flowsheet */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Flowsheet (últimos valores)</CardTitle>
              <CardDescription>Último valor por conceito, flag e delta.</CardDescription>
            </CardHeader>
            <CardContent>
              <PainelObservacoes internacaoId={internacao.id} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
