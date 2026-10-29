// Atestado e receita para casa: as peças da aba "Atestado e receita" da porta,
// usadas também em "Alta e documentos" do leito (pontos 14 e 16 do
// plantonista, aprovados pelo RT em 28/10/2026). A receita padrão e os
// favoritos têm dose de adulto: só para adulto PELA IDADE (decisão do RT de
// 02/10/2026). Dose e "como tomar" são escritos pelo médico: nada é sugerido.
import { useQuery } from '@tanstack/react-query'
import { ClipboardList, Pill, Printer, X } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'

import { supabase } from '@/lib/supabase'
import { normalizarMedicamento } from '@/lib/search'
import { filtroDaUnidade } from '@/lib/medicamentoCadastro'
import { useUnidade } from '@/contexts/UnidadeContext'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Aviso } from '@/components/documentos/ui'
import { Estado } from '@/components/porta/Estado'
import { Chip } from '@/components/monitor/Pagina'
import { OpcaoLista } from '@/components/ui/botao-linha'
import { ofereceConteudoAdulto, type FaixaEtaria } from '@/domain/idade'
import { hora as horaFmt } from '@/lib/formato'
import { TEXTO_PEDIATRICO, TEXTO_SEM_NASCIMENTO, nomeMed, type EstadoDocs, type ItemReceita, type Med } from '@/lib/documentosAlta'

const hora = (iso: string | null | undefined) => (iso ? horaFmt(iso) : '—')
const msg = (e: unknown) => (e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e))

type Pref = {
  id: string; receita_padrao: string | null; dose: string | null; posologia: string; quantidade: string | null; medicamento_id: string
  medicamento: { principio_ativo: string; apresentacao: string | null } | null
}


export function Situacao({ em, rascunho }: { em: string | null; rascunho: string }) {
  return <Estado tom={em ? 'verde' : 'cinza'}>{em ? `Emitido ${hora(em)}` : rascunho}</Estado>
}

/** Atestado de afastamento ou de comparecimento; o CID só a pedido do paciente. */
export function CartaoAtestado({ estado, setEstado, cid, onEmitir }: {
  estado: EstadoDocs; setEstado: (f: (s: EstadoDocs) => EstadoDocs) => void; cid: string; onEmitir: () => void
}) {
  return (
    <section className="overflow-hidden rounded-cartao border border-fio bg-superficie">
      <div className="flex flex-wrap items-center gap-2 border-b border-trilha px-4 py-3">
        <ClipboardList className="size-4 text-acao" aria-hidden />
        <span className="text-controle font-semibold text-tinta">Atestado</span>
        <Situacao em={estado.atEmitidoEm} rascunho="Rascunho" />
      </div>
      <div className="flex flex-wrap items-end gap-3 px-4 py-3">
        <div className="flex gap-1.5">
          {(['afastamento', 'comparecimento'] as const).map((t) => (
            <Chip key={t} ativo={estado.atTipo === t} onClick={() => setEstado((s) => ({ ...s, atTipo: t, atEmitidoEm: null }))}>
              {t === 'afastamento' ? 'Afastamento' : 'Comparecimento'}
            </Chip>
          ))}
        </div>
        {estado.atTipo === 'afastamento' && (
          <div className="flex flex-col gap-1">
            <Label htmlFor="at-dias">Dias</Label>
            <Input id="at-dias" type="number" min={1} className="h-8 w-20" value={estado.atDias}
              onChange={(e) => setEstado((s) => ({ ...s, atDias: e.target.value, atEmitidoEm: null }))} />
          </div>
        )}
        <Chip ativo={estado.atCid} onClick={() => setEstado((s) => ({ ...s, atCid: !s.atCid, atEmitidoEm: null }))}>
          {estado.atCid ? `CID incluído a pedido do paciente${cid ? ` (${cid})` : ''}` : 'Incluir CID (só a pedido)'}
        </Chip>
        <Button size="sm" className="ml-auto" onClick={onEmitir}><Printer /> {estado.atEmitidoEm ? 'Emitir de novo' : 'Emitir atestado'}</Button>
      </div>
    </section>
  )
}

export function ReceitaAlta({ faixa, estado, setEstado, onEmitir, titulo = 'Receita de alta', sugestoes = [] }: {
  faixa: FaixaEtaria; estado: EstadoDocs; setEstado: (f: (s: EstadoDocs) => EstadoDocs) => void; onEmitir: () => void
  titulo?: string
  /** Medicamentos para escolher com um clique (o leito: os da prescrição vigente). Só o nome entra; "como tomar" é do médico. */
  sugestoes?: Med[]
}) {
  const adulto = ofereceConteudoAdulto(faixa)
  const [busca, setBusca] = React.useState('')
  const [med, setMed] = React.useState<Med | null>(null)
  const [pos, setPos] = React.useState('')
  const [qtd, setQtd] = React.useState('')
  const [nomePadrao, setNomePadrao] = React.useState('')
  const [erro, setErro] = React.useState<string | null>(null)
  const [aviso, setAviso] = React.useState<string | null>(null)

  const prefs = useQuery({
    queryKey: ['preferencias-prescricao'],
    enabled: adulto,
    queryFn: async () => {
      const { data, error } = await supabase.from('preferencias_prescricao')
        .select('id, receita_padrao, dose, posologia, quantidade, medicamento_id, medicamento:medicamento(principio_ativo, apresentacao)')
        .order('created_at')
      if (error) throw error
      return (data ?? []) as unknown as Pref[]
    },
  })
  const unidadeBusca = useUnidade().unidadeAtiva?.unidade_id
  const resultados = useQuery({
    queryKey: ['busca-medicamento-receita', busca, unidadeBusca],
    enabled: busca.trim().length >= 3 && !med,
    queryFn: async () => {
      const { data, error } = await supabase.from('medicamento').select('id, principio_ativo, apresentacao, concentracao')
        .eq('ativo', true).or(filtroDaUnidade(unidadeBusca)).ilike('principio_ativo_norm', `%${normalizarMedicamento(busca.trim())}%`).order('principio_ativo').limit(8)
      if (error) throw error
      return (data ?? []) as Med[]
    },
  })

  const conjuntos = new Map<string, Pref[]>()
  const avulsos: Pref[] = []
  for (const p of adulto ? prefs.data ?? [] : []) {
    if (p.receita_padrao) conjuntos.set(p.receita_padrao, [...(conjuntos.get(p.receita_padrao) ?? []), p])
    else avulsos.push(p)
  }
  const deItem = (p: Pref): ItemReceita => ({
    id: crypto.randomUUID(), medicamento_id: p.medicamento_id,
    medicamento: [nomeMed(p.medicamento), p.dose].filter(Boolean).join(' · '), posologia: p.posologia, quantidade: p.quantidade ?? '',
  })
  const aplicar = (lista: Pref[]) => setEstado((s) => ({
    ...s, rxEmitidaEm: null,
    receita: [...s.receita, ...lista.filter((p) => !s.receita.some((r) => r.medicamento_id === p.medicamento_id && r.posologia === p.posologia)).map(deItem)],
  }))

  function adicionar() {
    const nomeItem = med ? nomeMed(med) : busca.trim()
    if (!nomeItem || !pos.trim()) return setErro('Informe o medicamento e como tomar.')
    setErro(null)
    setEstado((s) => ({ ...s, rxEmitidaEm: null, receita: [...s.receita, { id: crypto.randomUUID(), medicamento_id: med?.id ?? null, medicamento: nomeItem, posologia: pos.trim(), quantidade: qtd.trim() }] }))
    setMed(null); setBusca(''); setPos(''); setQtd('')
  }

  async function salvarPadrao() {
    const n = nomePadrao.trim()
    const doCadastro = estado.receita.filter((r) => r.medicamento_id && r.posologia.trim().length >= 3)
    if (n.length < 2 || !doCadastro.length) return
    setErro(null); setAviso(null)
    try {
      // o conjunto com o mesmo nome é substituído (protótipo)
      const antigos = (prefs.data ?? []).filter((p) => p.receita_padrao?.toLowerCase() === n.toLowerCase()).map((p) => p.id)
      if (antigos.length) {
        const { error } = await supabase.from('preferencias_prescricao').delete().in('id', antigos)
        if (error) throw error
      }
      const vistos = new Set<string>()
      const linhas = doCadastro.filter((r) => {
        const k = `${r.medicamento_id}|${r.posologia.trim().toLowerCase()}`
        if (vistos.has(k)) return false
        vistos.add(k); return true
      }).map((r) => ({ medicamento_id: r.medicamento_id!, posologia: r.posologia.trim(), quantidade: r.quantidade.trim() || null, receita_padrao: n }))
      const { error } = await supabase.from('preferencias_prescricao').insert(linhas)
      if (error) throw error
      const fora = estado.receita.length - doCadastro.length
      setAviso(`Receita padrão "${n}" salva com ${linhas.length} ${linhas.length === 1 ? 'item' : 'itens'}.${fora ? ` ${fora} item(ns) digitado(s) fora do cadastro de medicamentos não entra(m) no padrão.` : ''}`)
      setNomePadrao('')
      void prefs.refetch()
    } catch (e) {
      setErro(msg(e))
    }
  }

  return (
    <section className="overflow-hidden rounded-cartao border border-fio bg-superficie">
      <div className="flex flex-wrap items-center gap-2 border-b border-trilha px-4 py-3">
        <Pill className="size-4 text-acao" aria-hidden />
        <span className="text-controle font-semibold text-tinta">{titulo}</span>
        <Situacao em={estado.rxEmitidaEm} rascunho={estado.receita.length ? 'Rascunho' : 'Sem itens'} />
      </div>
      {!adulto && (
        <div className="border-b border-trilha px-4 py-3">
          <Aviso>{faixa === 'pediatrico' ? TEXTO_PEDIATRICO : TEXTO_SEM_NASCIMENTO}</Aviso>
          {estado.rxEmitidaEm && <Button size="sm" variant="ghost" className="mt-2" onClick={() => setEstado((s) => ({ ...s, rxEmitidaEm: null }))}>Reabrir</Button>}
        </div>
      )}
      {adulto && <div className="flex flex-wrap items-center gap-1.5 border-b border-trilha px-4 py-3">
        <span className="text-apoio text-tinta-sussurro">Receita padrão:</span>
        {[...conjuntos.entries()].map(([n, lista]) => (
          <Chip key={n} ativo={false} onClick={() => aplicar(lista)}>{n} ({lista.length})</Chip>
        ))}
        {avulsos.map((p) => (
          <Chip key={p.id} ativo={false} onClick={() => aplicar([p])}>{p.medicamento?.principio_ativo ?? 'Favorito'} · {p.posologia}</Chip>
        ))}
        {!prefs.isLoading && (prefs.data ?? []).length === 0 && (
          <span className="text-apoio text-tinta-sussurro">nenhuma ainda. <Link to="/preferencias-prescricao" className="text-acao underline-offset-2 hover:underline">Preferências de prescrição</Link></span>
        )}
        <span className="ml-auto flex flex-wrap items-center gap-1.5">
          <Input className="h-8 w-52" aria-label="Nome da receita padrão" placeholder="Nome para salvar como padrão" value={nomePadrao} onChange={(e) => setNomePadrao(e.target.value)} />
          <Button size="sm" variant="outline" disabled={nomePadrao.trim().length < 2 || !estado.receita.some((r) => r.medicamento_id)} onClick={() => void salvarPadrao()}>
            Salvar como padrão
          </Button>
          {estado.rxEmitidaEm && <Button size="sm" variant="ghost" onClick={() => setEstado((s) => ({ ...s, rxEmitidaEm: null }))}>Reabrir</Button>}
        </span>
      </div>}
      {sugestoes.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-trilha px-4 py-3">
          <span className="text-apoio text-tinta-sussurro">Da prescrição (escolha e escreva como tomar):</span>
          {sugestoes.map((m) => (
            <Chip key={m.id} ativo={med?.id === m.id} onClick={() => { setMed(m); setBusca('') }}>{nomeMed(m)}</Chip>
          ))}
        </div>
      )}
      {estado.receita.map((r, i) => (
        <div key={r.id} className="flex items-center gap-3 border-b border-trilha px-4 py-2.5">
          <span className="w-5 text-apoio tabular-nums text-tinta-sussurro">{i + 1}.</span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-controle font-medium text-tinta">{r.medicamento}{r.quantidade && <span className="font-normal text-tinta-sussurro"> · {r.quantidade}</span>}</span>
            <span className="text-apoio text-tinta-sussurro">{r.posologia}</span>
          </div>
          <Button size="icon-sm" variant="ghost" aria-label="Remover item"
            onClick={() => setEstado((s) => ({ ...s, rxEmitidaEm: null, receita: s.receita.filter((x) => x.id !== r.id) }))}><X /></Button>
        </div>
      ))}
      <div className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_110px_auto_auto] sm:items-end">
        <div className="relative flex flex-col gap-1">
          <Label htmlFor="rx-med">Medicamento</Label>
          {med ? (
            <div className="flex h-8 items-center gap-2 rounded-controle border border-fio px-2 text-apoio">
              <span className="truncate">{nomeMed(med)}</span>
              <Button size="xs" variant="ghost" className="ml-auto" onClick={() => setMed(null)}>Trocar</Button>
            </div>
          ) : (
            <Input id="rx-med" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Do cadastro (3 letras) ou livre" autoComplete="off" />
          )}
          {!med && (resultados.data ?? []).length > 0 && (
            <div role="listbox" className="absolute top-full right-0 left-0 z-20 mt-1 max-h-56 overflow-y-auto rounded-controle border border-fio bg-superficie shadow-popover">
              {(resultados.data ?? []).map((m) => (
                <OpcaoLista key={m.id} onClick={() => setMed(m)}>
                  <span className="font-medium text-tinta">{m.principio_ativo}</span>
                  <span className="text-tinta-sussurro">{[m.apresentacao, m.concentracao].filter(Boolean).join(' · ')}</span>
                </OpcaoLista>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="rx-pos">Como tomar</Label>
          <Input id="rx-pos" value={pos} onChange={(e) => setPos(e.target.value)} placeholder="escrito pelo médico" />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="rx-qtd">Quantidade</Label>
          <Input id="rx-qtd" value={qtd} onChange={(e) => setQtd(e.target.value)} />
        </div>
        <Button variant="outline" onClick={adicionar}>Adicionar</Button>
        <Button onClick={onEmitir} disabled={!estado.receita.length}><Printer /> {estado.rxEmitidaEm ? 'Emitir de novo' : 'Emitir receita'}</Button>
      </div>
      {(erro || aviso) && <p className={cn('border-t border-trilha px-4 py-2 text-apoio', erro ? 'text-critico' : 'text-conforme')}>{erro ?? aviso}</p>}
    </section>
  )
}
