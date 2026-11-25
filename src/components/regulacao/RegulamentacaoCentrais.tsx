// ─────────────────────────────────────────────────────────────────────────────
// Regulação no perfil Administrador (pedido do RT de 24/11/2026): só a
// regulamentação das centrais. Mestre-detalhe: as centrais da rede à esquerda;
// à direita a central aberta, com as abas "Unidades reguladas" (busca com
// seleção múltipla), "Capacidades" (o que cada unidade regulada tem: tipos de
// leito com quantidade, exames e especialidades, por busca e modelos prontos)
// e "Prazos" (prazo por tipo de pedido). Sem solicitação, fila, recebidos nem
// mapa de vagas, que são da central e das unidades.
// Migration 20270421000010_regulacao_centrais_admin.sql;
// src/lib/regulamentacaoCentrais.ts.
// ─────────────────────────────────────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Waypoints, X } from 'lucide-react'
import * as React from 'react'

import { ESPECIALIDADES } from '@/components/encaminhamento/useEncaminhamentos'
import { Abas, TituloPagina, Vazio } from '@/components/monitor/Pagina'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CampoSelecao } from '@/components/ui/campo-selecao'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EsqueletoLinhas } from '@/components/ui/esqueleto-linhas'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MensagemErro } from '@/components/ui/mensagem-erro'
import { fmtDataHora } from '@/lib/datas'
import {
  CATEGORIAS, TIPOS_PEDIDO, UNIDADES_PRAZO, capacidadesParaEnvio, codigoDe, filtrarOpcoes, opcoesDaCategoria, prazoEmMinutos, prazoLegivel,
  prazoParaTela, resumoCapacidades,
  type Capacidade, type CategoriaCapacidade, type CentralReg, type OrganizacaoReg, type TipoPedido, type UnidadePrazo, type UnidadeReg,
} from '@/lib/regulamentacaoCentrais'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import type { Json } from '@/types/database'

const TIPO_UNIDADE: Record<string, string> = { hospital: 'Hospital', upa: 'UPA', clinica: 'Clínica', ubs: 'UBS' }
const CHAVE = ['regulacao-regulamentacao']

export function RegulamentacaoCentrais({ superAdmin }: { superAdmin: boolean }) {
  const dados = useQuery({
    queryKey: CHAVE,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('regulacao_regulamentacao')
      if (error) throw error
      return (data ?? []) as unknown as OrganizacaoReg[]
    },
  })
  const [orgId, setOrgId] = React.useState('')
  const orgs = dados.data ?? []
  const org = orgs.find((o) => o.organizacao_id === orgId) ?? orgs[0]
  return (
    <div className="flex w-full max-w-6xl flex-col gap-4">
      <TituloPagina icone={Waypoints} titulo="Regulação"
        descricao="Regulamentação das centrais: que unidades cada central regula, o que cada unidade tem e o prazo de cada tipo de pedido." />
      {dados.isLoading ? <EsqueletoLinhas linhas={4} rotulo="Carregando as centrais…" />
        : dados.error ? <MensagemErro erro={dados.error} acao="carregar as centrais" />
        : !org ? <Vazio icone={Waypoints} titulo="Nenhuma rede para regulamentar" texto="Você não administra nenhuma organização ativa." />
        : (
          <>
            {orgs.length > 1 && (
              <div className="flex flex-wrap items-center gap-2">
                <Label htmlFor="reg-org" className="text-rotulo">Organização</Label>
                <CampoSelecao id="reg-org" tamanho="compacto" value={org.organizacao_id} onChange={(e) => setOrgId(e.target.value)}>
                  {orgs.map((o) => <option key={o.organizacao_id} value={o.organizacao_id}>{o.organizacao}</option>)}
                </CampoSelecao>
              </div>
            )}
            <Rede key={org.organizacao_id} org={org} superAdmin={superAdmin} />
          </>
        )}
    </div>
  )
}

function Rede({ org, superAdmin }: { org: OrganizacaoReg; superAdmin: boolean }) {
  const [centralId, setCentralId] = React.useState<string | null>(null)
  const central = org.centrais.find((c) => c.id === centralId) ?? org.centrais[0] ?? null
  const nomeDe = React.useMemo(() => new Map(org.unidades.map((u) => [u.id, u.nome])), [org.unidades])
  return (
    <div className="grid gap-4 md:grid-cols-[minmax(220px,280px)_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="text-corpo">Centrais</CardTitle>
          <CardDescription>Cada unidade é regulada por uma central.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-apoio">
          {org.centrais.length === 0 ? (
            <p className="text-tinta-sussurro">A rede ainda não tem central. A primeira que você cadastrar passa a receber os pedidos.</p>
          ) : (
            <ul className="flex flex-col gap-1" aria-label="Centrais da rede">
              {org.centrais.map((c) => (
                <li key={c.id}>
                  <button type="button" aria-current={central?.id === c.id ? 'true' : undefined} onClick={() => setCentralId(c.id)}
                    className={cn('flex w-full flex-col items-start gap-0.5 rounded-controle border px-3 py-2 text-left',
                      central?.id === c.id ? 'border-acao bg-acao/5' : 'border-transparent hover:bg-campo')}>
                    <span className="font-medium text-tinta">{c.nome}</span>
                    <span className="text-rotulo text-tinta-sussurro">
                      {c.unidades.length} {c.unidades.length === 1 ? 'unidade' : 'unidades'}{c.principal ? ' · recebe os pedidos' : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <NovaCentral org={org} aoCriar={setCentralId} />
        </CardContent>
      </Card>
      {central ? <CentralAberta key={central.id} org={org} central={central} nomeDe={nomeDe} superAdmin={superAdmin} />
        : <Vazio icone={Waypoints} titulo="Nenhuma central aberta" texto="Cadastre a primeira central da rede ao lado." />}
    </div>
  )
}

function NovaCentral({ org, aoCriar }: { org: OrganizacaoReg; aoCriar: (id: string) => void }) {
  const qc = useQueryClient()
  const [aberto, setAberto] = React.useState(false)
  const nomeCentral = new Map(org.centrais.map((c) => [c.id, c.nome]))
  const opcoes = org.unidades.filter((u) => !u.eh_central).map((u) => ({
    id: u.id, nome: u.nome, detalhe: TIPO_UNIDADE[u.tipo] ?? u.tipo,
    desabilitada: u.central_id ? `regulada pela ${nomeCentral.get(u.central_id) ?? 'outra central'}` : undefined,
  }))
  const criar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('regulacao_cadastrar_central', { p_unidade: id })
      if (error) throw error
      return id
    },
    onSuccess: (id) => { setAberto(false); aoCriar(id); void qc.invalidateQueries({ queryKey: CHAVE }) },
  })
  if (!aberto) return <Button size="sm" variant="outline" onClick={() => setAberto(true)}><Plus className="size-4" aria-hidden /> Nova central</Button>
  return (
    <div className="flex flex-col gap-2 rounded-controle border border-fio p-2">
      <span className="text-rotulo text-tinta-apoio">Qual unidade vira central? Os médicos reguladores ficam vinculados a ela.</span>
      <BuscaSelecao id="nova-central" rotulo="Buscar unidade" opcoes={opcoes} escolhidos={[]} onEscolher={(id) => criar.mutate(id)} />
      <MensagemErro erro={criar.error} acao="cadastrar a central" />
      <Button size="xs" variant="ghost" onClick={() => setAberto(false)}>Cancelar</Button>
    </div>
  )
}

function CentralAberta({ org, central, nomeDe, superAdmin }: {
  org: OrganizacaoReg; central: CentralReg; nomeDe: Map<string, string>; superAdmin: boolean
}) {
  const qc = useQueryClient()
  const [aba, setAba] = React.useState<'unidades' | 'capacidades' | 'prazos'>('unidades')
  const [confirmarSaida, setConfirmarSaida] = React.useState(false)
  const recarregar = () => {
    void qc.invalidateQueries({ queryKey: CHAVE })
    void qc.invalidateQueries({ queryKey: ['regulacao-contexto'] })
  }
  const retirar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('regulacao_retirar_central', { p_central: central.id })
      if (error) throw error
    },
    onSuccess: recarregar,
  })
  // o super admin troca a central que recebe os pedidos (função de antes)
  const tornarPrincipal = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('regulacao_definir_central', { p_unidade: central.id })
      if (error) throw error
    },
    onSuccess: recarregar,
  })
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-corpo">{central.nome}</CardTitle>
          {central.principal && <Badge variant="info">recebe os pedidos da rede</Badge>}
          <div className="ml-auto flex flex-wrap gap-2">
            {superAdmin && !central.principal && (
              <Button size="xs" variant="outline" disabled={tornarPrincipal.isPending} onClick={() => tornarPrincipal.mutate()}>
                Passar a receber os pedidos
              </Button>
            )}
            {!central.principal && !confirmarSaida && (
              <Button size="xs" variant="destructive" onClick={() => setConfirmarSaida(true)}>Deixar de ser central</Button>
            )}
          </div>
        </div>
        <CardDescription>
          {central.principal
            ? 'Hoje todos os pedidos da rede chegam a esta central.'
            : 'Central cadastrada. Os pedidos da rede ainda chegam à central principal.'}
        </CardDescription>
        {confirmarSaida && (
          <div role="alert" className="mt-2 flex flex-wrap items-center gap-2 rounded-controle border border-atencao/30 bg-alerta-atencao px-3 py-2 text-apoio text-atencao">
            As {central.unidades.length} unidades desta central ficam sem central. Confirma?
            <Button size="xs" variant="destructive" disabled={retirar.isPending} onClick={() => retirar.mutate()}>Sim, deixar de ser central</Button>
            <Button size="xs" variant="ghost" onClick={() => setConfirmarSaida(false)}>Não</Button>
          </div>
        )}
        <MensagemErro erro={retirar.error ?? tornarPrincipal.error} acao="mudar a central" />
      </CardHeader>
      <CardContent className="text-apoio">
        <Abas rotulo="Regulamentação da central" valor={aba} onChange={setAba}
          abas={[['unidades', 'Unidades reguladas', central.unidades.length], ['capacidades', 'Capacidades'], ['prazos', 'Prazos']] as const} />
        {aba === 'unidades' && <AbaUnidades org={org} central={central} />}
        {aba === 'capacidades' && <AbaCapacidades org={org} central={central} nomeDe={nomeDe} />}
        {aba === 'prazos' && <AbaPrazos central={central} />}
      </CardContent>
    </Card>
  )
}

// ── unidades reguladas ──────────────────────────────────────────────────────
function AbaUnidades({ org, central }: { org: OrganizacaoReg; central: CentralReg }) {
  const qc = useQueryClient()
  const [escolhidas, setEscolhidas] = React.useState<string[]>(central.unidades)
  const [feito, setFeito] = React.useState<string | null>(null)
  const nomeCentral = new Map(org.centrais.map((c) => [c.id, c.nome]))
  const unidade = new Map(org.unidades.map((u) => [u.id, u]))
  const opcoes = org.unidades.filter((u) => !u.eh_central).map((u) => ({
    id: u.id, nome: u.nome, detalhe: [TIPO_UNIDADE[u.tipo] ?? u.tipo,
      u.central_id && u.central_id !== central.id ? `hoje na ${nomeCentral.get(u.central_id) ?? 'outra central'}; passa para esta` : null]
      .filter(Boolean).join(' · '),
  }))
  const mudou = escolhidas.length !== central.unidades.length || escolhidas.some((id) => !central.unidades.includes(id))
  const salvar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('regulacao_definir_unidades_central', { p_central: central.id, p_unidades: escolhidas })
      if (error) throw error
      return data as unknown as { incluidas: number; retiradas: number; movidas: number }
    },
    onSuccess: (r) => {
      setFeito(`Salvo: ${r.incluidas} incluída(s), ${r.retiradas} retirada(s)${r.movidas ? `, ${r.movidas} vinda(s) de outra central` : ''}.`)
      void qc.invalidateQueries({ queryKey: CHAVE })
    },
  })
  return (
    <div className="flex flex-col gap-3">
      <p className="text-tinta-sussurro">Busque as unidades que esta central regula. A unidade que está em outra central passa para esta ao salvar.</p>
      <BuscaSelecao id={`unidades-${central.id}`} rotulo="Buscar unidade" opcoes={opcoes} escolhidos={escolhidas}
        onEscolher={(id) => { setFeito(null); setEscolhidas((x) => [...x, id]) }} />
      {escolhidas.length === 0 ? <p className="text-tinta-sussurro">Nenhuma unidade regulada.</p> : (
        <ul className="flex flex-wrap gap-1.5" aria-label="Unidades reguladas">
          {escolhidas.map((id) => {
            const u = unidade.get(id)
            return (
              <li key={id}>
                <Ficha rotulo={u?.nome ?? id} detalhe={u ? TIPO_UNIDADE[u.tipo] : undefined}
                  onRemover={() => { setFeito(null); setEscolhidas((x) => x.filter((y) => y !== id)) }} />
              </li>
            )
          })}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={!mudou || salvar.isPending} onClick={() => salvar.mutate()}>Salvar unidades</Button>
        {mudou && <Button size="sm" variant="ghost" onClick={() => setEscolhidas(central.unidades)}>Desfazer</Button>}
        {feito && <span role="status" className="text-sucesso">{feito}</span>}
      </div>
      <MensagemErro erro={salvar.error} acao="salvar as unidades" />
    </div>
  )
}

// ── capacidades ─────────────────────────────────────────────────────────────
function AbaCapacidades({ org, central, nomeDe }: { org: OrganizacaoReg; central: CentralReg; nomeDe: Map<string, string> }) {
  const unidades = central.unidades.map((id) => org.unidades.find((u) => u.id === id)).filter((u): u is UnidadeReg => !!u)
  const [aberta, setAberta] = React.useState<string | null>(unidades[0]?.id ?? null)
  if (unidades.length === 0) return <p className="text-tinta-sussurro">Escolha primeiro as unidades reguladas por esta central.</p>
  const u = unidades.find((x) => x.id === aberta) ?? unidades[0]
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(180px,240px)_1fr]">
      <ul className="flex flex-col gap-1" aria-label="Unidades reguladas">
        {unidades.map((x) => (
          <li key={x.id}>
            <button type="button" aria-current={u.id === x.id ? 'true' : undefined} onClick={() => setAberta(x.id)}
              className={cn('flex w-full flex-col items-start gap-0.5 rounded-controle border px-2.5 py-1.5 text-left',
                u.id === x.id ? 'border-acao bg-acao/5' : 'border-transparent hover:bg-campo')}>
              <span className="font-medium text-tinta">{nomeDe.get(x.id) ?? x.nome}</span>
              <span className="text-rotulo text-tinta-sussurro">{resumoCapacidades(x.capacidades)}</span>
            </button>
          </li>
        ))}
      </ul>
      <EditorCapacidades key={u.id} unidade={u} />
    </div>
  )
}

/** Modelos prontos de exames (o administrador ajusta depois). */
const MODELOS_EXAME: { rotulo: string; nomes: string[] }[] = [
  { rotulo: 'Básicos de UPA', nomes: ['Raio-X', 'Laboratório', 'Eletrocardiograma'] },
  { rotulo: 'Hospital geral', nomes: ['Raio-X', 'Laboratório', 'Eletrocardiograma', 'Ultrassonografia', 'Tomografia'] },
]

function EditorCapacidades({ unidade }: { unidade: UnidadeReg }) {
  const qc = useQueryClient()
  const [itens, setItens] = React.useState<Capacidade[]>(unidade.capacidades)
  const [mudou, setMudou] = React.useState(false)
  const [feito, setFeito] = React.useState(false)
  const mudar = (f: (x: Capacidade[]) => Capacidade[]) => { setItens(f); setMudou(true); setFeito(false) }
  const adicionar = (categoria: CategoriaCapacidade, codigo: string, nome: string) =>
    mudar((x) => x.some((i) => i.categoria === categoria && i.codigo === codigo) ? x
      : [...x, { categoria, codigo, nome, quantidade: null, observacao: null }])
  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('regulacao_salvar_capacidades', {
        p_unidade: unidade.id, p_itens: capacidadesParaEnvio(itens) as unknown as Json,
      })
      if (error) throw error
    },
    onSuccess: () => { setMudou(false); setFeito(true); void qc.invalidateQueries({ queryKey: CHAVE }) },
  })
  return (
    <div className="flex flex-col gap-4">
      <p className="text-tinta-sussurro">
        O que está na lista a unidade tem; o que não está, não tem.
        {unidade.capacidades_atualizado_em && ` Última mudança em ${fmtDataHora(unidade.capacidades_atualizado_em)}.`}
      </p>
      {CATEGORIAS.map(({ categoria, rotulo, vazio }) => {
        const daCategoria = itens.filter((i) => i.categoria === categoria)
        const opcoes = opcoesDaCategoria(categoria, ESPECIALIDADES).map((o) => ({ id: o.codigo, nome: o.nome }))
        return (
          <section key={categoria} className="flex flex-col gap-2" aria-labelledby={`cap-${unidade.id}-${categoria}`}>
            <h3 id={`cap-${unidade.id}-${categoria}`} className="font-medium text-tinta">{rotulo}</h3>
            {daCategoria.length === 0 ? <p className="text-tinta-sussurro">{vazio}</p> : categoria === 'leito' ? (
              <ul className="flex flex-col gap-1.5">
                {daCategoria.map((i) => (
                  <li key={i.codigo} className="flex flex-wrap items-center gap-2">
                    <span className="min-w-36 text-tinta">{i.nome}</span>
                    <Label htmlFor={`qtd-${unidade.id}-${i.codigo}`} className="sr-only">Quantidade de leitos {i.nome}</Label>
                    <Input id={`qtd-${unidade.id}-${i.codigo}`} className="h-8 w-20" inputMode="numeric" placeholder="nº"
                      value={i.quantidade ?? ''} onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, '').slice(0, 4)
                        mudar((x) => x.map((y) => y.categoria === 'leito' && y.codigo === i.codigo ? { ...y, quantidade: v === '' ? null : Number(v) } : y))
                      }} />
                    <span className="text-rotulo text-tinta-sussurro">leitos</span>
                    <Button size="icon-xs" variant="ghost" aria-label={`Tirar ${i.nome}`}
                      onClick={() => mudar((x) => x.filter((y) => !(y.categoria === 'leito' && y.codigo === i.codigo)))}>
                      <X aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="flex flex-wrap gap-1.5" aria-label={rotulo}>
                {daCategoria.map((i) => (
                  <li key={i.codigo}>
                    <Ficha rotulo={i.nome} onRemover={() => mudar((x) => x.filter((y) => !(y.categoria === categoria && y.codigo === i.codigo)))} />
                  </li>
                ))}
              </ul>
            )}
            {categoria === 'exame' && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-rotulo text-tinta-apoio">Modelos prontos:</span>
                {MODELOS_EXAME.map((m) => (
                  <Button key={m.rotulo} size="xs" variant="outline" onClick={() => mudar((x) => {
                    const novos = m.nomes.map((nome) => ({ categoria: 'exame' as const, codigo: codigoDe(nome), nome, quantidade: null, observacao: null }))
                      .filter((n) => !x.some((i) => i.categoria === 'exame' && i.codigo === n.codigo))
                    return [...x, ...novos]
                  })}>{m.rotulo}</Button>
                ))}
              </div>
            )}
            <BuscaSelecao id={`busca-${unidade.id}-${categoria}`} rotulo={`Adicionar a ${rotulo.toLowerCase()}`} opcoes={opcoes}
              escolhidos={daCategoria.map((i) => i.codigo)} livre={categoria !== 'leito'}
              onEscolher={(codigo, nome) => adicionar(categoria, codigo, nome ?? opcoes.find((o) => o.id === codigo)?.nome ?? codigo)} />
          </section>
        )
      })}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={!mudou || salvar.isPending} onClick={() => salvar.mutate()}>Salvar o que a unidade tem</Button>
        {mudou && <Button size="sm" variant="ghost" onClick={() => { setItens(unidade.capacidades); setMudou(false) }}>Desfazer</Button>}
        {feito && <span role="status" className="text-sucesso">Salvo.</span>}
      </div>
      <MensagemErro erro={salvar.error} acao="salvar o que a unidade tem" />
    </div>
  )
}

// ── prazos ──────────────────────────────────────────────────────────────────
function AbaPrazos({ central }: { central: CentralReg }) {
  const qc = useQueryClient()
  const inicial = React.useMemo(() => Object.fromEntries(TIPOS_PEDIDO.map(({ tipo }) => [tipo, prazoParaTela(central.prazos[tipo])])) as
    Record<TipoPedido, { valor: string; unidade: UnidadePrazo }>, [central.prazos])
  const [form, setForm] = React.useState(inicial)
  const [feito, setFeito] = React.useState(false)
  const convertidos = TIPOS_PEDIDO.map(({ tipo }) => ({ tipo, ...prazoEmMinutos(form[tipo].valor, form[tipo].unidade) }))
  const erro = convertidos.some((c) => c.erro)
  const mudou = convertidos.some((c) => !c.erro && (c.minutos ?? null) !== (central.prazos[c.tipo] ?? null))
  const salvar = useMutation({
    mutationFn: async () => {
      const p_prazos = Object.fromEntries(convertidos.map((c) => [c.tipo, c.minutos]))
      const { error } = await supabase.rpc('regulacao_definir_prazos_tipo', { p_central: central.id, p_prazos: p_prazos as unknown as Json })
      if (error) throw error
    },
    onSuccess: () => { setFeito(true); void qc.invalidateQueries({ queryKey: CHAVE }) },
  })
  return (
    <div className="flex flex-col gap-3">
      <p className="text-tinta-sussurro">
        Prazo da central para cada tipo de pedido, contado da chegada à central. Vazio = sem prazo.
        {central.prazos_atualizado_em && ` Última mudança em ${fmtDataHora(central.prazos_atualizado_em)}; cada ajuste fica guardado com o antes e o depois.`}
      </p>
      <ul className="flex flex-col divide-y divide-fio">
        {TIPOS_PEDIDO.map(({ tipo, rotulo, ajuda }, i) => (
          <li key={tipo} className="flex flex-wrap items-center gap-3 py-2">
            <div className="min-w-52 flex-1">
              <Label htmlFor={`prazo-${central.id}-${tipo}`} className="font-medium text-tinta">{rotulo}</Label>
              <p className="text-rotulo text-tinta-sussurro">{ajuda} · hoje: {prazoLegivel(central.prazos[tipo])}</p>
            </div>
            <Input id={`prazo-${central.id}-${tipo}`} className="h-8 w-24" inputMode="decimal" placeholder="sem prazo"
              aria-invalid={!!convertidos[i].erro || undefined}
              value={form[tipo].valor} onChange={(e) => { setFeito(false); setForm((f) => ({ ...f, [tipo]: { ...f[tipo], valor: e.target.value } })) }} />
            <CampoSelecao aria-label={`Unidade do prazo de ${rotulo}`} tamanho="compacto" value={form[tipo].unidade}
              onChange={(e) => { setFeito(false); setForm((f) => ({ ...f, [tipo]: { ...f[tipo], unidade: e.target.value as UnidadePrazo } })) }}>
              {(Object.keys(UNIDADES_PRAZO) as UnidadePrazo[]).map((k) => <option key={k} value={k}>{UNIDADES_PRAZO[k].rotulo}</option>)}
            </CampoSelecao>
            {convertidos[i].erro && <span className="w-full text-rotulo text-critico">{convertidos[i].erro}</span>}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={!mudou || erro || salvar.isPending} onClick={() => salvar.mutate()}>Salvar prazos</Button>
        {mudou && <Button size="sm" variant="ghost" onClick={() => setForm(inicial)}>Desfazer</Button>}
        {feito && <span role="status" className="text-sucesso">Salvo.</span>}
      </div>
      <MensagemErro erro={salvar.error} acao="salvar os prazos" />
    </div>
  )
}

// ── peças ───────────────────────────────────────────────────────────────────
function Ficha({ rotulo, detalhe, onRemover }: { rotulo: string; detalhe?: string; onRemover: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-fio bg-campo py-0.5 pr-1 pl-2.5 text-tinta">
      {rotulo}{detalhe && <span className="text-rotulo text-tinta-sussurro">· {detalhe}</span>}
      <button type="button" aria-label={`Tirar ${rotulo}`} onClick={onRemover}
        className="inline-flex size-5 items-center justify-center rounded-full text-tinta-sussurro hover:text-critico">
        <X className="size-3" aria-hidden />
      </button>
    </span>
  )
}

type OpcaoBusca = { id: string; nome: string; detalhe?: string; desabilitada?: string }

/**
 * Busca com seleção: abre a lista ao focar, filtra sem acento, some com o que já
 * foi escolhido. `livre` deixa adicionar o que foi escrito (código pelo nome).
 */
function BuscaSelecao({ id, rotulo, opcoes, escolhidos, onEscolher, livre = false }: {
  id: string; rotulo: string; opcoes: OpcaoBusca[]; escolhidos: string[]
  onEscolher: (id: string, nome?: string) => void; livre?: boolean
}) {
  const [termo, setTermo] = React.useState('')
  const [aberto, setAberto] = React.useState(false)
  const restantes = opcoes.filter((o) => !escolhidos.includes(o.id))
  const achados = filtrarOpcoes(restantes, termo, 10)
  const novo = termo.trim()
  const codigoNovo = codigoDe(novo)
  const podeLivre = livre && novo.length >= 2 && codigoNovo.length >= 2 && !opcoes.some((o) => o.id === codigoNovo)
  const escolher = (oid: string, nome?: string) => { onEscolher(oid, nome); setTermo('') }
  const listaId = `${id}-opcoes`
  return (
    <div className="relative flex max-w-md flex-col gap-1">
      <Label htmlFor={id} className="sr-only">{rotulo}</Label>
      <Input id={id} className="h-8" placeholder={rotulo} value={termo} autoComplete="off"
        role="combobox" aria-expanded={aberto} aria-controls={listaId} aria-autocomplete="list"
        onFocus={() => setAberto(true)} onBlur={() => window.setTimeout(() => setAberto(false), 150)}
        onChange={(e) => { setTermo(e.target.value); setAberto(true) }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setAberto(false)
          if (e.key === 'Enter') {
            e.preventDefault()
            const primeiro = achados.find((o) => !o.desabilitada)
            if (primeiro) escolher(primeiro.id)
            else if (podeLivre) escolher(codigoNovo, novo)
          }
        }} />
      {aberto && (achados.length > 0 || podeLivre) && (
        <ul id={listaId} className="z-10 flex max-h-64 flex-col overflow-auto rounded-controle border border-fio bg-superficie py-1 shadow-sm">
          {achados.map((o) => (
            <li key={o.id}>
              <button type="button" disabled={!!o.desabilitada} onMouseDown={(e) => e.preventDefault()} onClick={() => escolher(o.id)}
                className="flex w-full flex-wrap items-baseline gap-x-2 px-3 py-1.5 text-left hover:bg-campo disabled:cursor-not-allowed disabled:opacity-60">
                <span className="text-tinta">{o.nome}</span>
                {(o.desabilitada ?? o.detalhe) && <span className="text-rotulo text-tinta-sussurro">{o.desabilitada ?? o.detalhe}</span>}
              </button>
            </li>
          ))}
          {podeLivre && (
            <li>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => escolher(codigoNovo, novo)}
                className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-acao hover:bg-campo">
                <Plus className="size-3.5" aria-hidden /> Adicionar “{novo}”
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
