// ─────────────────────────────────────────────────────────────────────────────
// EvolucaoClinica — tela de evolução clínica (FASE 2)
//
// Gráfico de evolução (múltiplos conceitos + faixa de referência + críticos),
// flowsheet (PainelObservacoes) e registro rápido de sinais vitais.
// Acessível de /plantao/evolucao (seção direta) ou ?paciente=ID (vindo do painel).
// ─────────────────────────────────────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Activity, Plus, Trash2 } from 'lucide-react'
import * as React from 'react'
import { useSearchParams } from 'react-router-dom'

import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useUnidade } from '@/contexts/UnidadeContext'
import { getSerieObservacao, type SerieObservacao } from '@/lib/observacao'
import { gravarRegistros, novoItem } from '@/lib/offline/sincronizar'
import { useInternacaoAtiva } from '@/hooks/useDocumentos'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { GraficoEvolucao } from '@/components/observacao/GraficoEvolucao'
import { PainelObservacoes } from '@/components/observacao/PainelObservacoes'
import { Chip, TituloPagina, Trilha } from '@/components/monitor/Pagina'
import { Aviso } from '@/components/ui/aviso'
import { data } from '@/lib/formato'

type Paciente = { id: string; nome: string; cpf: string | null }

const CONCEITOS_VITAIS = [
  'frequencia-cardiaca',
  'frequencia-respiratoria',
  'pressao-arterial-sistolica',
  'saturacao-o2',
  'temperatura',
  'glicemia-capilar',
]

export default function EvolucaoClinica({ embutido = false }: { embutido?: boolean } = {}) {
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
          // autor e hora vêm do servidor/relógio do servidor, não daqui
          return novoItem('observacao', {
            internacao_id: internacao.id,
            paciente_id: pacienteId,
            conceito_id: c.id,
            valor_num: num,
            origem: 'manual',
          })
        })
      if (linhas.length === 0) return null
      const r = await gravarRegistros(perfilId, linhas)
      if (r.recusados.length > 0) throw new Error(r.recusados[0].replace(/^SYNC_[A-Z_]+: /, ''))
      return r
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
      {!embutido && (
        <div className="flex flex-col">
          <Trilha niveis={[{ rotulo: 'Início', to: '/' }, { rotulo: 'Evolução clínica' }]} />
          <TituloPagina icone={Activity} titulo="Evolução clínica" className="mb-0"
            descricao="Gráficos de sinais vitais e de laboratório da internação." />
        </div>
      )}

      {/* Seleção de paciente */}
      <Card>
        <CardHeader>
          <CardTitle className="text-corpo">Paciente</CardTitle>
          <CardDescription>Selecione o paciente internado para ver a evolução.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Select items={Object.fromEntries((pacientes ?? []).map((p) => [p.id, p.nome + (p.cpf ? ` · ${p.cpf}` : '')]))}
            value={pacienteId ?? null}
            onValueChange={(v) => {
              setPacienteId(v)
              // Preserva os demais parâmetros — embutido em abas, a URL carrega
              // também o `?aba=`, e sobrescrever tudo voltaria para a 1ª aba.
              const proximo = new URLSearchParams(searchParams)
              if (v) proximo.set('paciente', v)
              else proximo.delete('paciente')
              setSearchParams(proximo, { replace: true })
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
            <p className="text-rotulo text-tinta-sussurro">
              Internação ativa · admissão{' '}
              {data(internacao.data_admissao)}
            </p>
          )}
        </CardContent>
      </Card>

      {!internacao && pacienteId && (
        <Aviso tom="atencao">Nenhuma internação ativa para este paciente.</Aviso>
      )}

      {internacao && (
        <>
          {/* Seletor de conceitos do gráfico */}
          <Card>
            <CardHeader>
              <CardTitle className="text-corpo">Gráfico de evolução</CardTitle>
              <CardDescription>
                Selecione os conceitos sobrepostos (ex.: creatinina + ureia).
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                {conceitosNomes.map((c) => (
                  <Chip key={c.id} variante="opcao" ativo={conceitosSel.includes(c.nome)} onClick={() => alternarConceito(c.nome)}>
                    {c.nome.replace(/-/g, ' ')}
                    {c.unidade_padrao ? ` (${c.unidade_padrao})` : ''}
                  </Chip>
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
              <CardTitle className="text-corpo">Registrar sinais vitais</CardTitle>
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
                <p className="text-apoio text-critico">{(registrar.error as Error).message}</p>
              )}
              {registrar.isSuccess && (
                <p className="text-apoio text-conforme">
                  {registrar.data?.naFila
                    ? 'Sem conexão: sinais vitais guardados neste aparelho. Serão enviados quando a conexão voltar.'
                    : 'Sinais vitais registrados.'}
                </p>
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
              <CardTitle className="text-corpo">Flowsheet (últimos valores)</CardTitle>
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
