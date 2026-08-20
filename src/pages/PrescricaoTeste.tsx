import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronRight, Loader2, Pill, Plus, Search, ShieldAlert, Trash2, User } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'

import { supabase } from '@/lib/supabase'
import { useUnidade } from '@/contexts/UnidadeContext'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { BuscaTerminologia } from '@/components/terminologia/BuscaTerminologia'

type Medicamento = {
  id: string
  principio_ativo: string
  concentracao: string | null
  apresentacao: string | null
  rxcui: string | null
  alta_vigilancia: boolean
}

type DiluicaoPublicada = {
  id: string
  via: string
  reconstituicao_diluente: string | null
  reconstituicao_volume_ml: number | null
  diluicao_solucao: string[] | null
  diluicao_volume_min_ml: number | null
  concentracao_maxima: string | null
  tempo_infusao_min: number | null
  velocidade_max: string | null
  observacoes: string | null
  fonte: string
  revisor_crf: string | null
}

type Paciente = {
  id: string
  nome: string
  cpf: string | null
  data_nascimento: string | null
}

type ItemPrescricao = {
  id: string
  medicamento: Medicamento
  dose: string
  posologia: string
  diluicaoEditada: string
  diluicaoPublicada: boolean
}

export default function PrescricaoTeste() {
  const { unidadeAtiva } = useUnidade()
  const { perfil } = useAuth()
  const unidadeId = unidadeAtiva?.unidade_id
  const queryClient = useQueryClient()

  const [busca, setBusca] = React.useState('')
  const [focada, setFocada] = React.useState(false)
  const [buscaDeb, setBuscaDeb] = React.useState('')
  const [buscaPaciente, setBuscaPaciente] = React.useState('')
  const [focadaPaciente, setFocadaPaciente] = React.useState(false)
  const [pacienteSel, setPacienteSel] = React.useState<Paciente | null>(null)
  const [itens, setItens] = React.useState<ItemPrescricao[]>([])
  const [observacoes, setObservacoes] = React.useState('')
  const [salvando, setSalvando] = React.useState(false)
  const [msg, setMsg] = React.useState<string | null>(null)
  const [erro, setErro] = React.useState<string | null>(null)

  React.useEffect(() => {
    const t = setTimeout(() => setBuscaDeb(busca), 350)
    return () => clearTimeout(t)
  }, [busca])

  const { data: resultados, isFetching: buscando } = useQuery({
    queryKey: ['buscar-medicamentos-canonico', buscaDeb],
    enabled: buscaDeb.trim().length >= 2,
    queryFn: async () => {
      const termo = buscaDeb.trim()
      const { data, error } = await supabase
        .from('medicamento')
        .select('id, principio_ativo, concentracao, apresentacao, rxcui, alta_vigilancia')
        .eq('ativo', true)
        .ilike('principio_ativo', `%${termo}%`)
        .order('principio_ativo')
        .limit(12)
      if (error) throw error
      return (data ?? []) as Medicamento[]
    },
    staleTime: 60_000,
  })

  // monta texto legível da diluição publicada (API que filtra status='publicado')
  function formatarDiluicao(d: DiluicaoPublicada): string {
    const partes: string[] = []
    if (d.diluicao_solucao?.length) {
      let sol = d.diluicao_solucao.join(' + ')
      if (d.diluicao_volume_min_ml) sol += ` · ${d.diluicao_volume_min_ml} mL`
      partes.push(`Diluir em ${sol}`)
    }
    if (d.reconstituicao_diluente) {
      let rec = d.reconstituicao_diluente
      if (d.reconstituicao_volume_ml) rec += ` · ${d.reconstituicao_volume_ml} mL`
      partes.push(`Reconstituir com ${rec}`)
    }
    if (d.concentracao_maxima) partes.push(`Concentração máx.: ${d.concentracao_maxima}`)
    if (d.tempo_infusao_min) partes.push(`Infundir em ${d.tempo_infusao_min} min`)
    if (d.velocidade_max) partes.push(`Velocidade: ${d.velocidade_max}`)
    if (d.observacoes) partes.push(d.observacoes)
    return partes.join('. ')
  }

  // busca a diluição publicada ao adicionar o item
  async function buscarDiluicao(m: Medicamento): Promise<string> {
    try {
      const { data, error } = await supabase.rpc('diluicao_publicada', { p_medicamento: m.id })
      if (error || !data || data.length === 0) return ''
      const d = (Array.isArray(data) ? data : [data]) as unknown as DiluicaoPublicada[]
      return d.map(formatarDiluicao).filter(Boolean).join('\n')
    } catch {
      return ''
    }
  }

  async function adicionar(m: Medicamento) {
    if (itens.some((i) => i.medicamento.id === m.id)) return
    const dil = await buscarDiluicao(m)
    setItens((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        medicamento: m,
        dose: '',
        posologia: '',
        diluicaoEditada: dil,
        diluicaoPublicada: dil !== '',
      },
    ])
    setBusca('')
    setFocada(false)
  }

  // adiciona um medicamento da CMED (terminologia) como item livre
  function adicionarDaCmed(descricao: string, codigo: string) {
    const m: Medicamento = {
      id: `cmed-${codigo}`,
      principio_ativo: descricao,
      concentracao: null,
      apresentacao: null,
      rxcui: null,
      alta_vigilancia: false,
    }
    if (itens.some((i) => i.medicamento.id === m.id)) return
    setItens((prev) => [
      ...prev,
      { id: crypto.randomUUID(), medicamento: m, dose: '', posologia: '', diluicaoEditada: '', diluicaoPublicada: false },
    ])
  }

  function atualizarItem(id: string, campo: 'dose' | 'posologia' | 'diluicaoEditada', valor: string) {
    setItens((prev) => prev.map((i) => (i.id === id ? { ...i, [campo]: valor } : i)))
  }

  function removerItem(id: string) {
    setItens((prev) => prev.filter((i) => i.id !== id))
  }

  const { data: pacientes } = useQuery({
    queryKey: ['pacientes-teste', unidadeId, buscaPaciente],
    enabled: !!unidadeId && buscaPaciente.trim().length >= 2,
    queryFn: async () => {
      const termo = buscaPaciente.trim()
      const { data, error } = await supabase
        .from('pacientes')
        .select('id, nome, cpf, data_nascimento')
        .eq('unidade_id', unidadeId!)
        .ilike('nome', `%${termo}%`)
        .order('nome')
        .limit(8)
      if (error) throw error
      if ((data ?? []).length === 0) {
        const { data: d2, error: e2 } = await supabase
          .from('pacientes')
          .select('id, nome, cpf, data_nascimento')
          .eq('unidade_id', unidadeId!)
          .ilike('cpf', `%${termo}%`)
          .order('nome')
          .limit(8)
        if (e2) throw e2
        return (d2 ?? []) as Paciente[]
      }
      return (data ?? []) as Paciente[]
    },
  })

  async function salvar() {
    if (!unidadeId || !perfil || itens.length === 0) return
    if (!pacienteSel) {
      setErro('Selecione um paciente antes de salvar.')
      return
    }
    setSalvando(true)
    setErro(null)
    setMsg(null)

    const { data: prescricao, error: err1 } = await supabase
      .from('prescricoes')
      .insert({
        unidade_id: unidadeId,
        paciente_id: pacienteSel.id,
        medico_id: perfil.id,
        criada_por: perfil.id,
        status: 'rascunho',
        observacoes: observacoes || null,
      })
      .select('id')
      .single()
    if (err1) {
      setErro(err1.message)
      setSalvando(false)
      return
    }

    const { error: err2 } = await supabase.from('prescricao_itens').insert(
      itens.map((i, idx) => ({
        prescricao_id: prescricao.id,
        medicamento_id: i.medicamento.id,
        descricao: i.medicamento.principio_ativo,
        dose: i.dose || null,
        posologia: i.posologia || null,
        observacao: i.diluicaoEditada || null,
        ordem: idx,
      }))
    )
    setSalvando(false)
    if (err2) {
      setErro(err2.message)
      return
    }
    setMsg(`Prescrição rascunho salva (id ${prescricao.id.slice(0, 8)}).`)
    setItens([])
    setObservacoes('')
    void queryClient.invalidateQueries({ queryKey: ['prescricoes'] })
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Link to="/" className="transition-colors hover:text-foreground">
            Início
          </Link>
          <ChevronRight className="size-3.5" />
          <span className="font-medium text-foreground">Prescrição Teste</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Prescrição Teste</h1>
        <p className="text-sm text-muted-foreground">
          Comece a digitar o nome (ou parte) do medicamento para ver as sugestões, incluindo a diluição
          quando necessária.
        </p>
      </div>

      {erro && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</div>}
      {msg && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{msg}</div>}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="size-4 text-muted-foreground" />
            Paciente
          </CardTitle>
          <CardDescription>Busque o paciente da unidade para vincular a prescrição.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {pacienteSel ? (
            <div className="flex items-center justify-between rounded-lg border p-3 text-sm">
              <div className="flex flex-col">
                <span className="font-semibold">{pacienteSel.nome}</span>
                <span className="text-xs text-muted-foreground">
                  {pacienteSel.cpf ?? 'sem CPF'}
                  {pacienteSel.data_nascimento
                    ? ` · ${new Date(pacienteSel.data_nascimento + 'T12:00:00').toLocaleDateString('pt-BR')}`
                    : ''}
                </span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setPacienteSel(null)}>
                Trocar
              </Button>
            </div>
          ) : (
            <div className="relative">
              <Input
                value={buscaPaciente}
                onChange={(e) => setBuscaPaciente(e.target.value)}
                onFocus={() => setFocadaPaciente(true)}
                placeholder="Buscar paciente por nome ou CPF…"
              />
              {focadaPaciente && buscaPaciente.trim().length >= 2 && (pacientes ?? []).length > 0 && (
                <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border bg-white shadow-lg">
                  {(pacientes ?? []).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="flex w-full flex-col gap-0.5 border-b px-3 py-2 text-left transition-colors last:border-0 hover:bg-muted"
                      onClick={() => {
                        setPacienteSel(p)
                        setBuscaPaciente('')
                        setFocadaPaciente(false)
                      }}
                    >
                      <span className="text-sm font-medium">{p.nome}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {p.cpf ?? 'sem CPF'}
                        {p.data_nascimento
                          ? ` · ${new Date(p.data_nascimento + 'T12:00:00').toLocaleDateString('pt-BR')}`
                          : ''}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {focadaPaciente && buscaPaciente.trim().length >= 2 && (pacientes ?? []).length === 0 && (
                <div className="absolute z-20 mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm text-muted-foreground shadow-lg">
                  Nenhum paciente encontrado.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="size-4 text-muted-foreground" />
            Buscar medicamento
          </CardTitle>
          <CardDescription>Digite ao menos 2 letras para ver sugestões.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Base canônica (com diluição publicada)</span>
            <div className="relative">
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                onFocus={() => setFocada(true)}
                placeholder="Ex.: dipirona, soro, ceftriaxona, omeprazol…"
              />
              {buscando && (
                <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
              {focada && busca.trim().length >= 2 && (resultados ?? []).length > 0 && (
                <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border bg-white shadow-lg">
                  {(resultados ?? []).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className="flex w-full flex-col gap-0.5 border-b px-3 py-2 text-left transition-colors last:border-0 hover:bg-muted"
                      onClick={() => adicionar(m)}
                    >
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <Pill className="size-3.5 text-muted-foreground" />
                        {m.principio_ativo}
                        {m.concentracao && <span className="text-xs font-normal text-muted-foreground">{m.concentracao}</span>}
                        {m.alta_vigilancia && <ShieldAlert className="size-3.5 text-amber-600" />}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {m.apresentacao ?? '—'}
                        {m.rxcui ? ` · rxcui ${m.rxcui}` : ''}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {focada && busca.trim().length >= 2 && (resultados ?? []).length === 0 && !buscando && (
                <div className="absolute z-20 mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm text-muted-foreground shadow-lg">
                  Nenhum medicamento encontrado.
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Tabela CMED (ANVISA — referência de preços/registro)</span>
            <BuscaTerminologia
              tipo="medicamento_cmed"
              onSelecionar={(r) => adicionarDaCmed(r.descricao, r.codigo)}
              placeholder="Ex.: dipirona, soro, omeprazol…"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="size-4 text-muted-foreground" />
            Itens da prescrição
          </CardTitle>
          <CardDescription>
            {itens.length === 0
              ? 'Nenhum item adicionado ainda.'
              : `${itens.length} item(ns) — preencha dose e posologia.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {itens.map((item) => (
            <div key={item.id} className="rounded-lg border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col">
                  <span className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                    {item.medicamento.principio_ativo}
                    {item.medicamento.concentracao && (
                      <span className="font-normal text-muted-foreground">{item.medicamento.concentracao}</span>
                    )}
                    {item.medicamento.alta_vigilancia && <ShieldAlert className="size-3.5 text-amber-600" />}
                    {item.diluicaoPublicada && <Badge variant="success">Diluição publicada</Badge>}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {item.medicamento.apresentacao ?? '—'}
                    {item.medicamento.rxcui ? ` · rxcui ${item.medicamento.rxcui}` : ''}
                  </span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => removerItem(item.id)}>
                  <Trash2 />
                </Button>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted-foreground">Dose</label>
                  <Input
                    value={item.dose}
                    onChange={(e) => atualizarItem(item.id, 'dose', e.target.value)}
                    placeholder="Ex.: 500 mg, 2 mL, 1 comp"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted-foreground">Posologia</label>
                  <Input
                    value={item.posologia}
                    onChange={(e) => atualizarItem(item.id, 'posologia', e.target.value)}
                    placeholder="Ex.: 6/6h, 8/8h, 1x ao dia"
                  />
                </div>
              </div>
              <div className="mt-2 flex flex-col gap-1">
                <label className="text-xs font-medium text-sky-700">
                  {item.diluicaoPublicada ? 'Diluição (publicada pelo farmacêutico)' : 'Diluição (editável)'}
                </label>
                <Input
                  value={item.diluicaoEditada}
                  onChange={(e) => atualizarItem(item.id, 'diluicaoEditada', e.target.value)}
                  placeholder={
                    item.diluicaoPublicada
                      ? 'Diluição preenchida da referência publicada…'
                      : 'Sem diluição publicada — preencha se necessário…'
                  }
                />
              </div>
            </div>
          ))}

          {itens.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Observações da prescrição</label>
              <Textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Orientações gerais…"
                className="min-h-[70px]"
              />
            </div>
          )}

          {itens.length > 0 && (
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setItens([])}>
                Limpar
              </Button>
              <Button onClick={salvar} disabled={salvando}>
                {salvando ? <Loader2 className="animate-spin" /> : <Pill />} Salvar prescrição (rascunho)
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
