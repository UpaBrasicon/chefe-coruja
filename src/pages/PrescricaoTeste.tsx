import { useQuery } from '@tanstack/react-query'
import { ChevronRight, Loader2, Pill, Plus, Search, ShieldAlert, Trash2 } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'

import { supabase } from '@/lib/supabase'
import { normalizarMedicamento } from '@/lib/search'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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

type ItemPrescricao = {
  id: string
  medicamento: Medicamento
  dose: string
  posologia: string
  diluicaoEditada: string
  diluicaoPublicada: boolean
}

export default function PrescricaoTeste({ embutido = false }: { embutido?: boolean } = {}) {
  const [busca, setBusca] = React.useState('')
  const [focada, setFocada] = React.useState(false)
  const [buscaDeb, setBuscaDeb] = React.useState('')
  const [itens, setItens] = React.useState<ItemPrescricao[]>([])

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
        .ilike('principio_ativo_norm', `%${normalizarMedicamento(termo)}%`)
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


  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      {!embutido && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1 text-sm text-tinta-sussurro">
            <Link to="/" className="transition-colors hover:text-tinta">
              Início
            </Link>
            <ChevronRight className="size-3.5" />
            <span className="font-medium text-tinta">Prescrição Teste</span>
          </div>
          <h1 className="text-titulo leading-[1.1] font-semibold tracking-[-0.02em] text-tinta">Consulta de Medicamentos</h1>
          <p className="text-sm text-tinta-sussurro">
            Comece a digitar o nome (ou parte) do medicamento para ver as sugestões, incluindo a diluição
            quando necessária.
          </p>
        </div>
      )}

      <p className="rounded-lg border border-fio bg-trilha/50 p-3 text-sm text-tinta-apoio">
        Esta tela é só consulta de medicamento e diluição. Para prescrever, abra a prescrição do paciente: lá o sistema
        confere alergia, idade e peso deste atendimento (Portão 2, tarefa 2).
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="size-4 text-tinta-sussurro" />
            Buscar medicamento
          </CardTitle>
          <CardDescription>Digite ao menos 2 letras para ver sugestões.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-tinta-sussurro">Base canônica (com diluição publicada)</span>
            <div className="relative">
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                onFocus={() => setFocada(true)}
                placeholder="Ex.: dipirona, soro, ceftriaxona, omeprazol…"
              />
              {buscando && (
                <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-tinta-sussurro" />
              )}
              {focada && busca.trim().length >= 2 && (resultados ?? []).length > 0 && (
                <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border bg-white shadow-lg">
                  {(resultados ?? []).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className="flex w-full flex-col gap-0.5 border-b px-3 py-2 text-left transition-colors last:border-0 hover:bg-trilha"
                      onClick={() => adicionar(m)}
                    >
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <Pill className="size-3.5 text-tinta-sussurro" />
                        {m.principio_ativo}
                        {m.concentracao && <span className="text-xs font-normal text-tinta-sussurro">{m.concentracao}</span>}
                        {m.alta_vigilancia && <ShieldAlert className="size-3.5 text-atencao" />}
                      </span>
                      <span className="text-[11px] text-tinta-sussurro">
                        {m.apresentacao ?? '—'}
                        {m.rxcui ? ` · rxcui ${m.rxcui}` : ''}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {focada && busca.trim().length >= 2 && (resultados ?? []).length === 0 && !buscando && (
                <div className="absolute z-20 mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm text-tinta-sussurro shadow-lg">
                  Nenhum medicamento encontrado.
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-tinta-sussurro">Tabela CMED (ANVISA — referência de preços/registro)</span>
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
            <Plus className="size-4 text-tinta-sussurro" />
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
                      <span className="font-normal text-tinta-sussurro">{item.medicamento.concentracao}</span>
                    )}
                    {item.medicamento.alta_vigilancia && <ShieldAlert className="size-3.5 text-atencao" />}
                    {item.diluicaoPublicada && <Badge variant="success">Diluição publicada</Badge>}
                  </span>
                  <span className="text-xs text-tinta-sussurro">
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
                  <label className="text-xs font-medium text-tinta-sussurro">Dose</label>
                  <Input
                    value={item.dose}
                    onChange={(e) => atualizarItem(item.id, 'dose', e.target.value)}
                    placeholder="Ex.: 500 mg, 2 mL, 1 comp"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-tinta-sussurro">Posologia</label>
                  <Input
                    value={item.posologia}
                    onChange={(e) => atualizarItem(item.id, 'posologia', e.target.value)}
                    placeholder="Ex.: 6/6h, 8/8h, 1x ao dia"
                  />
                </div>
              </div>
              <div className="mt-2 flex flex-col gap-1">
                <label className="text-xs font-medium text-suprimento">
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
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setItens([])}>
                Limpar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
