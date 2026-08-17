import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronRight, Loader2, Pill, Plus, Search, Trash2, User } from 'lucide-react'
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

type Medicamento = {
  id: string
  nome: string
  principio_ativo: string
  concentracao: string | null
  forma_farmaceutica: string | null
  apresentacao: string | null
  via: string | null
  diluicao: string | null
  controlado: boolean
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
}

const VIA_LABEL: Record<string, string> = {
  VO: 'Via oral',
  EV: 'Endovenosa',
  IM: 'Intramuscular',
  SC: 'Subcutânea',
  INAL: 'Inalatória',
  SL: 'Sublingual',
  VG: 'Vaginal',
  TOP: 'Tópica',
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
    queryKey: ['buscar-medicamentos', buscaDeb],
    enabled: buscaDeb.trim().length >= 2,
    queryFn: async () => {
      const termo = buscaDeb.trim()
      const { data, error } = await supabase
        .from('medicamentos')
        .select('id, nome, principio_ativo, concentracao, forma_farmaceutica, apresentacao, via, diluicao, controlado')
        .eq('ativo', true)
        .ilike('nome', `%${termo}%`)
        .order('nome')
        .limit(12)
      if (error) throw error
      if ((data ?? []).length === 0) {
        const { data: d2, error: e2 } = await supabase
          .from('medicamentos')
          .select('id, nome, principio_ativo, concentracao, forma_farmaceutica, apresentacao, via, diluicao, controlado')
          .eq('ativo', true)
          .ilike('principio_ativo', `%${termo}%`)
          .order('nome')
          .limit(12)
        if (e2) throw e2
        return (d2 ?? []) as Medicamento[]
      }
      return (data ?? []) as Medicamento[]
    },
    staleTime: 60_000,
  })

  function adicionar(m: Medicamento) {
    if (itens.some((i) => i.medicamento.id === m.id)) return
    setItens((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        medicamento: m,
        dose: '',
        posologia: '',
        diluicaoEditada: m.diluicao ?? '',
      },
    ])
    setBusca('')
    setFocada(false)
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
        descricao: i.medicamento.nome,
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
        <CardContent className="flex flex-col gap-2">
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
                      {m.nome}
                      {m.concentracao && <span className="text-xs font-normal text-muted-foreground">{m.concentracao}</span>}
                      {m.controlado && <Badge variant="destructive">Controlado</Badge>}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {m.principio_ativo}
                      {m.via ? ` · ${VIA_LABEL[m.via] ?? m.via}` : ''}
                      {m.apresentacao ? ` · ${m.apresentacao}` : ''}
                    </span>
                    {m.diluicao && (
                      <span className="text-[11px] text-sky-700">Diluição: {m.diluicao}</span>
                    )}
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
                  <span className="text-sm font-semibold">
                    {item.medicamento.nome}
                    {item.medicamento.concentracao && (
                      <span className="ml-1 font-normal text-muted-foreground">{item.medicamento.concentracao}</span>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {item.medicamento.principio_ativo}
                    {item.medicamento.via ? ` · ${VIA_LABEL[item.medicamento.via] ?? item.medicamento.via}` : ''}
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
              {item.medicamento.diluicao && (
                <div className="mt-2 flex flex-col gap-1">
                  <label className="text-xs font-medium text-sky-700">
                    Diluição (sugerida) — {item.medicamento.nome}
                  </label>
                  <Input
                    value={item.diluicaoEditada}
                    onChange={(e) => atualizarItem(item.id, 'diluicaoEditada', e.target.value)}
                    placeholder="Diluição recomendada…"
                  />
                </div>
              )}
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
