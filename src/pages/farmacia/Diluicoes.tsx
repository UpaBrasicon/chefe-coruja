// ─────────────────────────────────────────────────────────────────────────────
// Diluição padrão — tela do farmacêutico (Fase 4.5).
//
// O farmacêutico revisa o rascunho (o HU-UFGD v3 é só o ponto de partida,
// decisão de 27/09/2026) e publica com o CRF do revisor. Publicada não se
// edita: mudar é criar uma nova versão, que substitui a anterior a partir de
// agora — a anterior continua visível como "substituída", e as prescrições
// feitas sob ela continuam mostrando a versão delas.
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FlaskConical } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { TituloPagina } from '@/components/monitor/Pagina'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

type Diluicao = {
  id: string; medicamento_id: string | null; principio_ativo: string; apresentacao: string; via: string; status: string; versao: number
  reconstituicao_diluente: string | null; reconstituicao_volume_ml: number | null; reconstituicao_concentracao: string | null
  diluicao_solucao: string[] | null; diluicao_volume_min_ml: number | null; concentracao_maxima: string | null
  tempo_infusao_min: number | null; velocidade_max: string | null; bolus_permitido: boolean | null
  estabilidade_ta_h: number | null; estabilidade_refrig_h: number | null; fotossensivel: boolean | null; acesso: string | null
  observacoes: string | null; fonte: string; revisor_crf: string | null; vigente_desde: string | null; vigente_ate: string | null
  motivo_alteracao: string | null; origem_id: string | null
}
const ABAS = [
  ['publicado', 'Vigentes'],
  ['rascunho', 'Rascunhos'],
  ['substituido', 'Substituídas'],
] as const
const STATUS: Record<string, { rotulo: string; variante: 'success' | 'warning' | 'secondary' }> = {
  publicado: { rotulo: 'vigente', variante: 'success' },
  rascunho: { rotulo: 'rascunho', variante: 'warning' },
  revisado: { rotulo: 'rascunho', variante: 'warning' },
  substituido: { rotulo: 'substituída', variante: 'secondary' },
}
const dia = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—')

export default function Diluicoes() {
  const qc = useQueryClient()
  const [aba, setAba] = React.useState<(typeof ABAS)[number][0]>('rascunho')
  const [filtro, setFiltro] = React.useState('')
  const [selecionada, setSelecionada] = React.useState<string | null>(null)
  const [erro, setErro] = React.useState<string | null>(null)

  const lista = useQuery({
    queryKey: ['diluicoes-farmacia'],
    queryFn: async () => {
      const { data, error } = await supabase.from('diluicao').select('*').order('principio_ativo').order('via').order('versao')
      if (error) throw error
      return (data ?? []) as unknown as Diluicao[]
    },
  })
  const recarregar = () => void qc.invalidateQueries({ queryKey: ['diluicoes-farmacia'] })
  const visiveis = (lista.data ?? []).filter((d) =>
    (aba === 'rascunho' ? ['rascunho', 'revisado'].includes(d.status) : d.status === aba)
    && d.principio_ativo.toLowerCase().includes(filtro.trim().toLowerCase()))
  const sel = (lista.data ?? []).find((d) => d.id === selecionada) ?? null

  return (
    <>
      <TituloPagina icone={FlaskConical} titulo="Diluição padrão"
        descricao="Você revisa e publica. Publicada não se edita: mudar é nova versão, e a anterior fica no histórico." />
      {erro && <p className="mb-3 rounded-lg border border-critico/30 bg-critico/[0.08] p-3 text-sm text-critico">{erro}</p>}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap gap-1.5">
              {ABAS.map(([k, r]) => (
                <Button key={k} size="sm" variant={aba === k ? 'default' : 'outline'} onClick={() => setAba(k)}>
                  {r} ({(lista.data ?? []).filter((d) => (k === 'rascunho' ? ['rascunho', 'revisado'].includes(d.status) : d.status === k)).length})
                </Button>
              ))}
            </div>
            <Input className="mt-2" placeholder="Filtrar por princípio ativo" value={filtro} onChange={(e) => setFiltro(e.target.value)} />
          </CardHeader>
          <CardContent className="flex max-h-[70vh] flex-col overflow-y-auto text-sm">
            {visiveis.map((d) => (
              <button key={d.id} type="button" onClick={() => { setSelecionada(d.id); setErro(null) }}
                className={`flex items-center gap-2 border-b border-fio px-2 py-1.5 text-left last:border-0 hover:bg-trilha ${selecionada === d.id ? 'bg-trilha' : ''}`}>
                <span className="flex-1"><span className="font-medium">{d.principio_ativo}</span> <span className="text-tinta-apoio">· {d.via} · {d.apresentacao}</span></span>
                <span className="text-xs text-muted-foreground">v{d.versao}</span>
                {!d.medicamento_id && <Badge variant="outline">sem cadastro</Badge>}
              </button>
            ))}
            {visiveis.length === 0 && <p className="text-muted-foreground">Nada nesta lista.</p>}
          </CardContent>
        </Card>
        {sel ? <Editor key={`${sel.id}:${sel.status}`} d={sel} aoMudar={(novoId) => { recarregar(); if (novoId) setSelecionada(novoId) }} aoErro={setErro} />
          : <NovaDiluicao aoCriar={(id) => { recarregar(); setAba('rascunho'); setSelecionada(id) }} aoErro={setErro} />}
      </div>
    </>
  )
}

function NovaDiluicao({ aoCriar, aoErro }: { aoCriar: (id: string) => void; aoErro: (m: string | null) => void }) {
  const [busca, setBusca] = React.useState('')
  const [med, setMed] = React.useState<{ id: string; principio_ativo: string; apresentacao: string | null } | null>(null)
  const [via, setVia] = React.useState('EV')
  const [fonte, setFonte] = React.useState('')
  const r = useQuery({
    queryKey: ['med-farmacia', busca],
    enabled: busca.trim().length >= 3 && !med,
    queryFn: async () => (await supabase.from('medicamento').select('id, principio_ativo, apresentacao').ilike('principio_ativo', `%${busca.trim()}%`).limit(15)).data ?? [],
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Nova diluição</CardTitle>
        <CardDescription>Escolha uma diluição na lista para revisar, ou crie uma para um medicamento do cadastro.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        {med ? <p><strong>{med.principio_ativo}</strong> · {med.apresentacao} <Button size="xs" variant="ghost" onClick={() => setMed(null)}>Trocar</Button></p> : (
          <>
            <Input placeholder="Medicamento do cadastro (3 letras ou mais)" value={busca} onChange={(e) => setBusca(e.target.value)} />
            {(r.data ?? []).map((m) => (
              <button key={m.id} type="button" className="text-left text-xs hover:underline" onClick={() => setMed(m)}>{m.principio_ativo} · {m.apresentacao}</button>
            ))}
          </>
        )}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1"><Label htmlFor="nd-via">Via</Label>
            <select id="nd-via" className="h-8 rounded-controle border border-fio bg-background px-2" value={via} onChange={(e) => setVia(e.target.value)}>
              {['EV', 'IM', 'SC'].map((v) => <option key={v}>{v}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1"><Label htmlFor="nd-fonte">Fonte</Label><Input id="nd-fonte" value={fonte} onChange={(e) => setFonte(e.target.value)} placeholder="manual, versão, página" /></div>
        </div>
        <Button size="sm" className="self-start" disabled={!med} onClick={async () => {
          const { data, error } = await supabase.rpc('salvar_diluicao', { p_id: undefined as unknown as string, p_dados: { medicamento_id: med!.id, via, fonte } })
          if (error) return aoErro(error.message)
          aoErro(null); aoCriar(data as string)
        }}>Criar rascunho</Button>
      </CardContent>
    </Card>
  )
}

const CAMPOS: [keyof Diluicao, string, 'texto' | 'numero' | 'lista' | 'bool'][] = [
  ['reconstituicao_diluente', 'Reconstituir com', 'texto'], ['reconstituicao_volume_ml', 'Volume de reconstituição (mL)', 'numero'],
  ['reconstituicao_concentracao', 'Concentração após reconstituir', 'texto'], ['diluicao_solucao', 'Diluir em (separe por vírgula)', 'lista'],
  ['diluicao_volume_min_ml', 'Volume mínimo (mL)', 'numero'], ['concentracao_maxima', 'Concentração máxima', 'texto'],
  ['tempo_infusao_min', 'Tempo de infusão (min)', 'numero'], ['velocidade_max', 'Velocidade máxima', 'texto'],
  ['bolus_permitido', 'Bolus permitido', 'bool'], ['estabilidade_ta_h', 'Estabilidade em TA (h)', 'numero'],
  ['estabilidade_refrig_h', 'Estabilidade refrigerado (h)', 'numero'], ['fotossensivel', 'Fotossensível', 'bool'],
  ['acesso', 'Acesso (periférico/central)', 'texto'], ['observacoes', 'Observações', 'texto'], ['fonte', 'Fonte', 'texto'],
  ['revisor_crf', 'Revisor (CRF)', 'texto'],
]

function Editor({ d, aoMudar, aoErro }: { d: Diluicao; aoMudar: (novoId?: string) => void; aoErro: (m: string | null) => void }) {
  const editavel = d.status === 'rascunho' || d.status === 'revisado'
  const inicial = React.useCallback(() => Object.fromEntries(CAMPOS.map(([k, , t]) => {
    const v = d[k]
    return [k, t === 'lista' ? ((v as string[] | null) ?? []).join(', ') : t === 'bool' ? (v === null ? '' : v ? 'sim' : 'não') : v == null ? '' : String(v)]
  })) as Record<string, string>, [d])
  const [f, setF] = React.useState<Record<string, string>>(inicial)
  const [motivo, setMotivo] = React.useState(d.motivo_alteracao ?? '')

  const dados = () => {
    const o: Record<string, unknown> = {}
    for (const [k, , t] of CAMPOS) {
      const v = f[k] ?? ''
      o[k] = t === 'lista' ? v.split(',').map((x) => x.trim()).filter(Boolean) : t === 'bool' ? (v === 'sim' ? true : v === 'não' ? false : null) : v
    }
    if (d.origem_id) o.motivo_alteracao = motivo
    return o
  }
  async function salvar() {
    const { error } = await supabase.rpc('salvar_diluicao', { p_id: d.id, p_dados: dados() as never })
    if (error) { aoErro(error.message); return false }
    aoErro(null); aoMudar(); return true
  }
  const st = STATUS[d.status] ?? { rotulo: d.status, variante: 'secondary' as const }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          {d.principio_ativo} · {d.via} <Badge variant={st.variante}>{st.rotulo}</Badge> <span className="text-xs text-muted-foreground">versão {d.versao}</span>
        </CardTitle>
        <CardDescription>
          {d.apresentacao}
          {d.vigente_desde && <> · vigente desde {dia(d.vigente_desde)}</>}
          {d.vigente_ate && <> · substituída em {dia(d.vigente_ate)}</>}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        {!d.medicamento_id && <p className="text-atencao">Esta diluição não está ligada ao cadastro de medicamentos: não pode ser publicada até ser ligada.</p>}
        <div className="grid gap-2 sm:grid-cols-2">
          {CAMPOS.map(([k, r, t]) => (
            <div key={k} className="flex flex-col gap-1">
              <Label htmlFor={`dil-${k}`}>{r}</Label>
              {t === 'bool' ? (
                <select id={`dil-${k}`} disabled={!editavel} className="h-8 rounded-controle border border-fio bg-background px-2" value={f[k] ?? ''}
                  onChange={(e) => setF({ ...f, [k]: e.target.value })}>
                  <option value="">—</option><option>sim</option><option>não</option>
                </select>
              ) : (
                <Input id={`dil-${k}`} disabled={!editavel} value={f[k] ?? ''} onChange={(e) => setF({ ...f, [k]: e.target.value })}
                  inputMode={t === 'numero' ? 'decimal' : undefined} />
              )}
            </div>
          ))}
        </div>
        {editavel && d.origem_id && (
          <div className="flex flex-col gap-1">
            <Label htmlFor="dil-motivo">O que mudou em relação à versão anterior *</Label>
            <Textarea id="dil-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </div>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          {editavel ? (
            <>
              <Button size="sm" variant="outline" onClick={() => void salvar()}>Salvar rascunho</Button>
              <Button size="sm" onClick={async () => {
                if (!(await salvar())) return
                const { error } = await supabase.rpc('publicar_diluicao_versao', { p_id: d.id })
                if (error) return aoErro(error.message)
                aoErro(null); aoMudar()
              }}>Publicar aos prescritores</Button>
            </>
          ) : d.status === 'publicado' ? (
            <Button size="sm" variant="outline" onClick={async () => {
              const { data, error } = await supabase.rpc('salvar_diluicao', { p_id: d.id, p_dados: {} })
              if (error) return aoErro(error.message)
              aoErro(null); aoMudar(data as string)
            }}>Criar nova versão</Button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          Publicar exige CRF do revisor e fonte; via EV exige também volume mínimo e tempo de infusão. Nova versão pede o que mudou.
        </p>
      </CardContent>
    </Card>
  )
}
