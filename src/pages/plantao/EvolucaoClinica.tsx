// ─────────────────────────────────────────────────────────────────────────────
// EvolucaoClinica — tela de evolução clínica (FASE 2)
//
// Gráfico de evolução (múltiplos conceitos + faixa de referência + críticos),
// flowsheet (PainelObservacoes) e registro rápido de sinais vitais.
// Acessível de /plantao/evolucao (seção direta) ou ?paciente=ID (vindo do painel).
//
// Revisão do médico (RT, 24/11/2026): M1 painéis prontos (vitais, renal,
// gasometria, hemograma, coagulação, escores) e "Personalizar" recolhido, com
// os nomes dos conceitos com acento; M2 um gráfico pequeno por conceito, e o
// vazio diz o que falta; M3 o seletor lista só os internados com leito, um
// por paciente, com o leito na frente. Só apresentação: o registro é o mesmo.
// ─────────────────────────────────────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Activity, ChevronRight, Plus, Trash2 } from 'lucide-react'
import * as React from 'react'
import { useSearchParams } from 'react-router-dom'

import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useUnidade } from '@/contexts/UnidadeContext'
import { getSeriesObservacao, type SerieObservacao } from '@/lib/observacao'
import { gravarRegistros, novoItem } from '@/lib/offline/sincronizar'
import { PAINEIS_EVOLUCAO, rotuloConceito } from '@/lib/conceitosRotulos'
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

type Internado = { paciente_id: string; nome: string; leito: string }
type LinhaInternado = { paciente_id: string; leito: { identificador: string } | null; paciente: { nome: string; nome_social: string | null } | null }

const CONCEITOS_VITAIS = [
  'frequencia-cardiaca',
  'frequencia-respiratoria',
  'pressao-arterial-sistolica',
  'saturacao-o2',
  'temperatura',
  'glicemia-capilar',
]

type IdPainel = (typeof PAINEIS_EVOLUCAO)[number]['id'] | 'personalizado'

export default function EvolucaoClinica({ embutido = false }: { embutido?: boolean } = {}) {
  const { unidadeAtiva } = useUnidade()
  const { perfil } = useAuth()
  const unidadeId = unidadeAtiva?.unidade_id
  const perfilId = perfil?.id
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const pacienteParam = searchParams.get('paciente')

  const [pacienteId, setPacienteId] = React.useState<string | null>(pacienteParam)
  const [painelSel, setPainelSel] = React.useState<IdPainel>('vitais')
  const [personalizados, setPersonalizados] = React.useState<string[]>(['creatinina', 'ureia'])
  const [novoConceito, setNovoConceito] = React.useState('')
  const [form, setForm] = React.useState<Record<string, string>>({})

  // ── internados com leito (M3): um por paciente, o leito na frente ──────────
  const { data: internados } = useQuery({
    queryKey: ['evolucao-internados', unidadeId],
    enabled: !!unidadeId,
    queryFn: async (): Promise<Internado[]> => {
      const { data, error } = await supabase
        .from('internacoes')
        .select('paciente_id, leito:leitos!internacoes_leito_atual_id_fkey(identificador), paciente:pacientes(nome, nome_social)')
        .eq('unidade_id', unidadeId!)
        .in('status', ['admitido', 'internado'])
        .not('leito_atual_id', 'is', null)
      if (error) throw error
      const vistos = new Map<string, Internado>()
      for (const l of (data ?? []) as unknown as LinhaInternado[]) {
        if (!l.leito || vistos.has(l.paciente_id)) continue
        vistos.set(l.paciente_id, { paciente_id: l.paciente_id, nome: l.paciente?.nome_social || l.paciente?.nome || 'Paciente', leito: l.leito.identificador })
      }
      return [...vistos.values()].sort((a, b) => a.leito.localeCompare(b.leito, 'pt-BR', { numeric: true }))
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

  const painelAtual = PAINEIS_EVOLUCAO.find((p) => p.id === painelSel)
  const conceitosSel: string[] = painelAtual ? [...painelAtual.conceitos] : personalizados
  // só os que existem no catálogo da unidade entram no gráfico
  const conceitosDoGrafico = conceitosSel.filter((nome) => conceitos?.some((c) => c.nome === nome))

  // ── séries dos conceitos selecionados ──────────────────────────────────────
  const { data: series, isFetching: carregandoSeries } = useQuery({
    queryKey: ['evolucao-series', internacao?.id, conceitosDoGrafico],
    enabled: !!internacao?.id && conceitosDoGrafico.length > 0,
    queryFn: async (): Promise<SerieObservacao[]> => {
      // item 08 do kit de desempenho: todos os conceitos numa leitura só
      const ids = conceitosDoGrafico
        .map((nome) => conceitos?.find((x) => x.nome === nome)?.id)
        .filter((id): id is string => !!id)
      return getSeriesObservacao(internacao!.id, ids)
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
          if (!c) throw new Error(`Conceito ${rotuloConceito(nome)} não encontrado`)
          const num = Number(v.replace(',', '.'))
          if (Number.isNaN(num)) throw new Error(`Valor inválido para ${rotuloConceito(nome)}`)
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
    setPainelSel('personalizado')
    setPersonalizados((prev) => (prev.includes(nome) ? prev.filter((n) => n !== nome) : [...prev, nome]))
  }

  const conceitosNomes = conceitos ?? []
  const vitaisNomes = conceitosNomes.filter((c) => CONCEITOS_VITAIS.includes(c.nome))
  const itensSelect = Object.fromEntries((internados ?? []).map((p) => [p.paciente_id, `Leito ${p.leito} · ${p.nome}`]))

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
          <CardDescription>Internados com leito na unidade, pelo número do leito.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Select items={itensSelect}
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
              <SelectValue placeholder={internados && internados.length === 0 ? 'Nenhum internado com leito agora' : 'Escolher o leito…'} />
            </SelectTrigger>
            <SelectContent>
              {(internados ?? []).map((p) => (
                <SelectItem key={p.paciente_id} value={p.paciente_id}>{itensSelect[p.paciente_id]}</SelectItem>
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
          {/* M1: painéis prontos; "Personalizar" recolhido */}
          <Card>
            <CardHeader>
              <CardTitle className="text-corpo">Gráficos da internação</CardTitle>
              <CardDescription>Escolha um painel. Cada conceito tem o seu gráfico, pelo dia de internação.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div role="radiogroup" aria-label="Painel" className="flex flex-wrap gap-2">
                {PAINEIS_EVOLUCAO.map((p) => (
                  <Chip key={p.id} radio ativo={painelSel === p.id} onClick={() => setPainelSel(p.id)}>{p.rotulo}</Chip>
                ))}
                {painelSel === 'personalizado' && <Chip radio ativo onClick={() => undefined}>Personalizado</Chip>}
              </div>

              {carregandoSeries && <Spinner className="size-4" />}
              {/* M2: um gráfico pequeno por conceito; sem registro, o vazio diz qual falta */}
              {conceitosSel.length === 0 ? (
                <p className="text-apoio text-tinta-sussurro">Nenhum conceito escolhido. Abra "Personalizar" e marque o que quer ver.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {conceitosSel.map((nome) => {
                    const c = conceitosNomes.find((x) => x.nome === nome)
                    const serie = (series ?? []).find((s) => s.conceito.nome === nome)
                    return (
                      <section key={nome} aria-label={rotuloConceito(nome)} className="flex flex-col gap-1 rounded-container border border-fio px-3 py-2.5">
                        <span className="text-apoio font-medium text-tinta">
                          {rotuloConceito(nome)}
                          {c?.unidade_padrao && <span className="ml-1 text-rotulo font-normal text-tinta-sussurro">{c.unidade_padrao}</span>}
                        </span>
                        {!c ? (
                          <p className="py-2 text-rotulo text-tinta-sussurro">Este conceito não está no catálogo da unidade.</p>
                        ) : (
                          <GraficoEvolucao compacto series={serie ? [serie] : []} dataAdmissao={internacao.data_admissao}
                            vazio={`Sem ${rotuloConceito(nome).toLowerCase()} registrado nesta internação.`} />
                        )}
                      </section>
                    )
                  })}
                </div>
              )}

              <details className="group rounded-container border border-fio px-3 py-2">
                <summary className="flex cursor-pointer list-none items-center gap-1.5 text-apoio font-medium text-tinta-apoio">
                  <ChevronRight className="size-4 transition-transform group-open:rotate-90" aria-hidden /> Personalizar
                </summary>
                <div className="mt-3 flex flex-col gap-3">
                  <div className="flex flex-wrap gap-2">
                    {conceitosNomes.map((c) => (
                      <Chip key={c.id} variante="opcao" ativo={painelSel === 'personalizado' && personalizados.includes(c.nome)} onClick={() => alternarConceito(c.nome)}>
                        {rotuloConceito(c.nome)}
                        {c.unidade_padrao ? ` (${c.unidade_padrao})` : ''}
                      </Chip>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={novoConceito}
                      onChange={(e) => setNovoConceito(e.target.value)}
                      placeholder="Adicionar conceito pelo nome técnico…"
                      className="max-w-xs"
                    />
                    <Button
                      variant="secondary"
                      disabled={!novoConceito.trim()}
                      onClick={() => {
                        const nome = novoConceito.trim()
                        setPainelSel('personalizado')
                        if (nome && !personalizados.includes(nome)) setPersonalizados((prev) => [...prev, nome])
                        setNovoConceito('')
                      }}
                    >
                      <Plus /> Adicionar
                    </Button>
                  </div>
                </div>
              </details>
            </CardContent>
          </Card>

          {/* Registro rápido de sinais vitais */}
          <Card>
            <CardHeader>
              <CardTitle className="text-corpo">Registrar sinais vitais</CardTitle>
              <CardDescription>Preencha os valores e registre. O registro leva o seu nome e a hora do servidor.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid gap-3 sm:grid-cols-3">
                {vitaisNomes.map((c) => (
                  <div key={c.id} className="flex flex-col gap-1">
                    <Label htmlFor={`vital-${c.nome}`}>{rotuloConceito(c.nome)}</Label>
                    <Input
                      id={`vital-${c.nome}`}
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
              <CardTitle className="text-corpo">Últimos valores</CardTitle>
              <CardDescription>Último valor de cada conceito, a hora, a variação e a referência.</CardDescription>
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
